package service

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrInvalidAnalyticsRange = errors.New("invalid analytics range: must be 7d, 30d, or 90d")

type AnalyticsOverview struct {
	TotalReach          int     `json:"total_reach"`
	TotalEngagements    int     `json:"total_engagements"`
	EngagementRate      float64 `json:"engagement_rate"`
	TotalPostsPublished int     `json:"total_posts_published"`
	ReachTrend          float64 `json:"reach_trend"`
	EngagementTrend     float64 `json:"engagement_trend"`
	RateTrend           float64 `json:"rate_trend"`
	ScheduledPosts      int     `json:"scheduled_posts"`
	FailedPosts         int     `json:"failed_posts"`
	ConnectedAccounts   int     `json:"connected_accounts"`
	ConnectedPlatforms  int     `json:"connected_platforms"`
}

type AnalyticsDailyDataPoint struct {
	Date       string `json:"date"`
	Reach      int    `json:"reach"`
	Engagement int    `json:"engagement"`
	Posts      int    `json:"posts"`
}

type AnalyticsPlatformStat struct {
	ID             string  `json:"id"`
	Network        string  `json:"network"`
	Label          string  `json:"label"`
	AccountName    string  `json:"account_name"`
	Color          string  `json:"color"`
	Posts          int     `json:"posts"`
	Reach          int     `json:"reach"`
	EngagementRate float64 `json:"engagement_rate"`
	Likes          int     `json:"likes"`
	Comments       int     `json:"comments"`
	Shares         int     `json:"shares"`
}

type AnalyticsTopPost struct {
	ID             string  `json:"id"`
	Text           string  `json:"text"`
	Platform       string  `json:"platform"`
	AccountName    string  `json:"account_name"`
	Format         string  `json:"format"`
	Date           string  `json:"date"`
	Reach          int     `json:"reach"`
	Likes          int     `json:"likes"`
	Comments       int     `json:"comments"`
	Shares         int     `json:"shares"`
	EngagementRate float64 `json:"engagement_rate"`
	Engagements    int     `json:"engagements"`
}

type AnalyticsBreakdown struct {
	Likes            int `json:"likes"`
	Comments         int `json:"comments"`
	Shares           int `json:"shares"`
	FollowersReached int `json:"followers_reached"`
}

type AnalyticsResponse struct {
	Range              string                    `json:"range"`
	GeneratedAt        time.Time                 `json:"generated_at"`
	Overview           AnalyticsOverview         `json:"overview"`
	Daily              []AnalyticsDailyDataPoint `json:"daily"`
	Platforms          []AnalyticsPlatformStat   `json:"platforms"`
	TopPosts           []AnalyticsTopPost        `json:"top_posts"`
	Breakdown          AnalyticsBreakdown        `json:"breakdown"`
	HasConnectedSocial bool                      `json:"has_connected_social"`
	HasPerformanceData bool                      `json:"has_performance_data"`
}

type AnalyticsService struct {
	db *pgxpool.Pool
}

type analyticsConnectionRow struct {
	ID          string
	Network     string
	AccountName string
}

type analyticsJobRow struct {
	ID               string
	Network          string
	ConnectionID     string
	AccountName      string
	Status           string
	ScheduledFor     time.Time
	PublishedAt      *time.Time
	PayloadJSON      json.RawMessage
	ProviderResponse json.RawMessage
}

type analyticsPayload struct {
	Title     string   `json:"title,omitempty"`
	Text      string   `json:"text,omitempty"`
	Link      string   `json:"link,omitempty"`
	MediaURLs []string `json:"media_urls,omitempty"`
	PostID    string   `json:"post_id,omitempty"`
}

type analyticsMetricBundle struct {
	Reach            int
	Likes            int
	Comments         int
	Shares           int
	FollowersReached int
}

func NewAnalyticsService(db *pgxpool.Pool) *AnalyticsService {
	return &AnalyticsService{db: db}
}

func ParseAnalyticsRange(raw string) (int, string, error) {
	switch strings.TrimSpace(strings.ToLower(raw)) {
	case "", "30d":
		return 30, "30d", nil
	case "7d":
		return 7, "7d", nil
	case "90d":
		return 90, "90d", nil
	default:
		return 0, "", ErrInvalidAnalyticsRange
	}
}

func (s *AnalyticsService) GetOverview(ctx context.Context, userID, rangeKey string, now time.Time) (*AnalyticsResponse, error) {
	days, normalizedRange, err := ParseAnalyticsRange(rangeKey)
	if err != nil {
		return nil, err
	}

	now = now.UTC()
	if s.db == nil {
		return &AnalyticsResponse{
			Range:              normalizedRange,
			GeneratedAt:        now,
			Daily:              makeDailySeries(time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -(days-1)), days),
			Platforms:          defaultAnalyticsPlatforms(),
			TopPosts:           []AnalyticsTopPost{},
			HasConnectedSocial: false,
			HasPerformanceData: false,
		}, nil
	}

	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	currentStart := todayStart.AddDate(0, 0, -(days - 1))
	currentEnd := todayStart.AddDate(0, 0, 1)
	previousStart := currentStart.AddDate(0, 0, -days)

	connections, err := s.listConnectionCounts(ctx, userID)
	if err != nil {
		return nil, err
	}

	jobs, err := s.listAnalyticsJobs(ctx, userID, previousStart, currentEnd)
	if err != nil {
		return nil, err
	}

	response := buildAnalyticsResponse(normalizedRange, now, days, currentStart, currentEnd, previousStart, connections, jobs)
	return &response, nil
}

func (s *AnalyticsService) listConnectionCounts(ctx context.Context, userID string) ([]analyticsConnectionRow, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, network, account_name
		FROM social_connections
		WHERE user_id = $1
		ORDER BY network, created_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]analyticsConnectionRow, 0, 4)
	for rows.Next() {
		var row analyticsConnectionRow
		if err := rows.Scan(&row.ID, &row.Network, &row.AccountName); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (s *AnalyticsService) listAnalyticsJobs(ctx context.Context, userID string, from, to time.Time) ([]analyticsJobRow, error) {
	rows, err := s.db.Query(ctx, `
		SELECT spj.id, spj.network, spj.connection_id, COALESCE(sc.account_name, ''),
		       spj.status, spj.scheduled_for, spj.published_at, spj.payload_json, spj.provider_response
		FROM social_post_jobs spj
		LEFT JOIN social_connections sc ON sc.id = spj.connection_id
		WHERE spj.user_id = $1
		  AND COALESCE(spj.published_at, spj.scheduled_for) >= $2
		  AND COALESCE(spj.published_at, spj.scheduled_for) < $3
		ORDER BY COALESCE(spj.published_at, spj.scheduled_for) DESC, spj.created_at DESC
	`, userID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]analyticsJobRow, 0)
	for rows.Next() {
		var row analyticsJobRow
		if err := rows.Scan(&row.ID, &row.Network, &row.ConnectionID, &row.AccountName, &row.Status, &row.ScheduledFor, &row.PublishedAt, &row.PayloadJSON, &row.ProviderResponse); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func networkColor(network string) string {
	switch network {
	case SocialNetworkInstagram:
		return "#E1306C"
	case SocialNetworkLinkedIn:
		return "#0A66C2"
	case SocialNetworkFacebook:
		return "#1877F2"
	case SocialNetworkX:
		return "#111111"
	default:
		return "#8c8880"
	}
}

func networkLabel(network string) string {
	switch network {
	case SocialNetworkInstagram:
		return "Instagram"
	case SocialNetworkLinkedIn:
		return "LinkedIn"
	case SocialNetworkFacebook:
		return "Facebook"
	case SocialNetworkX:
		return "X (Twitter)"
	default:
		return strings.Title(network)
	}
}

func buildAnalyticsResponse(rangeKey string, now time.Time, days int, currentStart, currentEnd, previousStart time.Time, connections []analyticsConnectionRow, jobs []analyticsJobRow) AnalyticsResponse {
	// Build per-account platform stats from actual connections.
	platforms := make([]AnalyticsPlatformStat, 0, len(connections))
	platformIndex := make(map[string]*AnalyticsPlatformStat, len(connections))
	for i, conn := range connections {
		platforms = append(platforms, AnalyticsPlatformStat{
			ID:          conn.ID,
			Network:     conn.Network,
			Label:       networkLabel(conn.Network),
			AccountName: conn.AccountName,
			Color:       networkColor(conn.Network),
		})
		platformIndex[conn.ID] = &platforms[i]
	}

	daily := makeDailySeries(currentStart, days)
	dailyIndex := make(map[string]*AnalyticsDailyDataPoint, len(daily))
	for index := range daily {
		dailyIndex[daily[index].Date] = &daily[index]
	}

	connectedAccounts := len(connections)
	uniqueNetworks := make(map[string]struct{}, 4)
	for _, conn := range connections {
		uniqueNetworks[conn.Network] = struct{}{}
	}

	var currentTotals analyticsMetricBundle
	var previousTotals analyticsMetricBundle
	currentPostsPublished := 0
	currentScheduled := 0
	currentFailed := 0
	topPosts := make([]AnalyticsTopPost, 0)
	hasPerformanceData := false

	for _, job := range jobs {
		eventAt := job.ScheduledFor.UTC()
		if job.PublishedAt != nil {
			eventAt = job.PublishedAt.UTC()
		}

		inCurrent := !eventAt.Before(currentStart) && eventAt.Before(currentEnd)
		inPrevious := !eventAt.Before(previousStart) && eventAt.Before(currentStart)
		if !inCurrent && !inPrevious {
			continue
		}

		if inCurrent {
			switch job.Status {
			case SocialJobQueued, SocialJobProcessing:
				currentScheduled++
			case SocialJobFailed:
				currentFailed++
			}
		}

		if job.Status != SocialJobPublished {
			continue
		}

		metrics := extractAnalyticsMetrics(job.ProviderResponse)
		if metrics.Reach > 0 || metrics.Engagements() > 0 || metrics.FollowersReached > 0 {
			hasPerformanceData = true
		}

		if inCurrent {
			currentPostsPublished++
			currentTotals.Reach += metrics.Reach
			currentTotals.Likes += metrics.Likes
			currentTotals.Comments += metrics.Comments
			currentTotals.Shares += metrics.Shares
			currentTotals.FollowersReached += metrics.followersReachedFallback()

			if point, ok := dailyIndex[eventAt.Format("2006-01-02")]; ok {
				point.Posts++
				point.Reach += metrics.Reach
				point.Engagement += metrics.Engagements()
			}

				if stat, ok := platformIndex[job.ConnectionID]; ok {
				stat.Posts++
				stat.Reach += metrics.Reach
				stat.Likes += metrics.Likes
				stat.Comments += metrics.Comments
				stat.Shares += metrics.Shares
			}

			topPosts = append(topPosts, buildAnalyticsTopPost(job, eventAt, metrics))
		} else {
			previousTotals.Reach += metrics.Reach
			previousTotals.Likes += metrics.Likes
			previousTotals.Comments += metrics.Comments
			previousTotals.Shares += metrics.Shares
		}
	}

	for index := range platforms {
		platforms[index].EngagementRate = computeRate(platforms[index].Likes+platforms[index].Comments+platforms[index].Shares, platforms[index].Reach)
	}

	sort.Slice(topPosts, func(i, j int) bool {
		if topPosts[i].Engagements != topPosts[j].Engagements {
			return topPosts[i].Engagements > topPosts[j].Engagements
		}
		if topPosts[i].Reach != topPosts[j].Reach {
			return topPosts[i].Reach > topPosts[j].Reach
		}
		return topPosts[i].Date > topPosts[j].Date
	})
	if len(topPosts) > 5 {
		topPosts = topPosts[:5]
	}

	currentRate := computeRate(currentTotals.Engagements(), currentTotals.Reach)
	previousRate := computeRate(previousTotals.Engagements(), previousTotals.Reach)

	return AnalyticsResponse{
		Range:       rangeKey,
		GeneratedAt: now,
		Overview: AnalyticsOverview{
			TotalReach:          currentTotals.Reach,
			TotalEngagements:    currentTotals.Engagements(),
			EngagementRate:      currentRate,
			TotalPostsPublished: currentPostsPublished,
			ReachTrend:          computeTrend(currentTotals.Reach, previousTotals.Reach),
			EngagementTrend:     computeTrend(currentTotals.Engagements(), previousTotals.Engagements()),
			RateTrend:           computeTrendFloat(currentRate, previousRate),
			ScheduledPosts:      currentScheduled,
			FailedPosts:         currentFailed,
			ConnectedAccounts:   connectedAccounts,
				ConnectedPlatforms:  len(uniqueNetworks),
		},
		Daily:     daily,
		Platforms: platforms,
		TopPosts:  topPosts,
		Breakdown: AnalyticsBreakdown{
			Likes:            currentTotals.Likes,
			Comments:         currentTotals.Comments,
			Shares:           currentTotals.Shares,
			FollowersReached: currentTotals.FollowersReached,
		},
		HasConnectedSocial: connectedAccounts > 0,
		HasPerformanceData: hasPerformanceData,
	}
}

func defaultAnalyticsPlatforms() []AnalyticsPlatformStat {
	return []AnalyticsPlatformStat{}
}

func makeDailySeries(start time.Time, days int) []AnalyticsDailyDataPoint {
	series := make([]AnalyticsDailyDataPoint, 0, days)
	for offset := 0; offset < days; offset++ {
		day := start.AddDate(0, 0, offset)
		series = append(series, AnalyticsDailyDataPoint{Date: day.Format("2006-01-02")})
	}
	return series
}

func buildAnalyticsTopPost(job analyticsJobRow, eventAt time.Time, metrics analyticsMetricBundle) AnalyticsTopPost {
	payload := analyticsPayload{}
	_ = json.Unmarshal(job.PayloadJSON, &payload)
	text := strings.TrimSpace(payload.Text)
	if text == "" {
		text = strings.TrimSpace(payload.Title)
	}
	if text == "" {
		text = "Post publicado"
	}

	return AnalyticsTopPost{
		ID:             job.ID,
		Text:           text,
		Platform:       job.Network,
		AccountName:    job.AccountName,
		Format:         inferAnalyticsFormat(payload),
		Date:           eventAt.Format(time.RFC3339),
		Reach:          metrics.Reach,
		Likes:          metrics.Likes,
		Comments:       metrics.Comments,
		Shares:         metrics.Shares,
		EngagementRate: computeRate(metrics.Engagements(), metrics.Reach),
		Engagements:    metrics.Engagements(),
	}
}

func inferAnalyticsFormat(payload analyticsPayload) string {
	if len(payload.MediaURLs) > 1 {
		return "carousel"
	}
	if len(payload.MediaURLs) == 1 {
		return "media"
	}
	if strings.TrimSpace(payload.Link) != "" {
		return "link"
	}
	return "text"
}

func extractAnalyticsMetrics(raw json.RawMessage) analyticsMetricBundle {
	if len(raw) == 0 || string(raw) == "null" {
		return analyticsMetricBundle{}
	}

	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return analyticsMetricBundle{}
	}

	return analyticsMetricBundle{
		Reach:            firstAnalyticsNumber(value, []string{"reach", "reach_count", "impressions", "impression_count", "views", "view_count"}),
		Likes:            firstAnalyticsNumber(value, []string{"likes", "like_count", "reactions", "reaction_count", "favorite_count"}),
		Comments:         firstAnalyticsNumber(value, []string{"comments", "comment_count", "replies", "reply_count"}),
		Shares:           firstAnalyticsNumber(value, []string{"shares", "share_count", "reposts", "repost_count", "retweets", "retweet_count"}),
		FollowersReached: firstAnalyticsNumber(value, []string{"followers_reached", "audience_reached", "unique_reach"}),
	}
}

func (m analyticsMetricBundle) Engagements() int {
	return m.Likes + m.Comments + m.Shares
}

func (m analyticsMetricBundle) followersReachedFallback() int {
	if m.FollowersReached > 0 {
		return m.FollowersReached
	}
	return m.Reach
}

func firstAnalyticsNumber(value any, keys []string) int {
	for _, key := range keys {
		if found, ok := findAnalyticsNumber(value, strings.ToLower(key)); ok {
			return found
		}
	}
	return 0
}

func findAnalyticsNumber(value any, targetKey string) (int, bool) {
	switch typed := value.(type) {
	case map[string]any:
		for key, inner := range typed {
			if strings.ToLower(key) == targetKey {
				if numeric, ok := analyticsNumberFromValue(inner); ok {
					return numeric, true
				}
			}
		}
		for _, inner := range typed {
			if numeric, ok := findAnalyticsNumber(inner, targetKey); ok {
				return numeric, true
			}
		}
	case []any:
		for _, inner := range typed {
			if numeric, ok := findAnalyticsNumber(inner, targetKey); ok {
				return numeric, true
			}
		}
	}
	return 0, false
}

func analyticsNumberFromValue(value any) (int, bool) {
	switch typed := value.(type) {
	case float64:
		return int(math.Round(typed)), true
	case float32:
		return int(math.Round(float64(typed))), true
	case int:
		return typed, true
	case int64:
		return int(typed), true
	case int32:
		return int(typed), true
	case json.Number:
		parsed, err := typed.Int64()
		if err == nil {
			return int(parsed), true
		}
		floatParsed, err := typed.Float64()
		if err == nil {
			return int(math.Round(floatParsed)), true
		}
	case string:
		cleaned := strings.TrimSpace(strings.ReplaceAll(typed, ",", ""))
		if cleaned == "" {
			return 0, false
		}
		if parsed, err := strconv.ParseFloat(cleaned, 64); err == nil {
			return int(math.Round(parsed)), true
		}
	}
	return 0, false
}

func computeRate(engagements, reach int) float64 {
	if reach <= 0 {
		return 0
	}
	return roundAnalyticsFloat((float64(engagements) / float64(reach)) * 100)
}

func computeTrend(current, previous int) float64 {
	return computeTrendFloat(float64(current), float64(previous))
}

func computeTrendFloat(current, previous float64) float64 {
	if previous == 0 {
		if current == 0 {
			return 0
		}
		return 100
	}
	return roundAnalyticsFloat(((current - previous) / previous) * 100)
}

func roundAnalyticsFloat(value float64) float64 {
	return math.Round(value*10) / 10
}
