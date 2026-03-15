package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	SocialNetworkLinkedIn  = "linkedin"
	SocialNetworkFacebook  = "facebook"
	SocialNetworkInstagram = "instagram"
	SocialNetworkReddit    = "reddit"
	SocialNetworkX         = "x"
)

const (
	SocialJobQueued     = "queued"
	SocialJobProcessing = "processing"
	SocialJobPublished  = "published"
	SocialJobFailed     = "failed"
)

var (
	ErrSocialUnavailable     = errors.New("social publishing requires database")
	ErrInvalidNetwork        = errors.New("invalid network: must be linkedin, facebook, instagram, or x")
	ErrConnectionNotFound    = errors.New("social connection not found")
	ErrPublishPayloadInvalid = errors.New("invalid publish payload")
	ErrPostTextNotFound      = errors.New("post content text not found")
)

type SocialConnectionInput struct {
	Network        string          `json:"network"`
	AccountID      string          `json:"account_id"`
	AccountName    string          `json:"account_name"`
	AccessToken    string          `json:"access_token"`
	RefreshToken   string          `json:"refresh_token,omitempty"`
	TokenExpiresAt *time.Time      `json:"token_expires_at,omitempty"`
	MetadataJSON   json.RawMessage `json:"metadata_json,omitempty"`
}

type SocialConnection struct {
	ID             string          `json:"id"`
	UserID         string          `json:"user_id"`
	Network        string          `json:"network"`
	AccountID      string          `json:"account_id"`
	AccountName    string          `json:"account_name"`
	AccessToken    string          `json:"-"`
	RefreshToken   string          `json:"-"`
	TokenExpiresAt *time.Time      `json:"token_expires_at,omitempty"`
	MetadataJSON   json.RawMessage `json:"metadata_json,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type SocialPublishInput struct {
	Network          string     `json:"network"`
	ConnectionID     string     `json:"connection_id,omitempty"`
	PostID           string     `json:"post_id,omitempty"`
	Title            string     `json:"title,omitempty"`
	Subreddit        string     `json:"subreddit,omitempty"`
	Text             string     `json:"text,omitempty"`
	Link             string     `json:"link,omitempty"`
	MediaURLs        []string   `json:"media_urls,omitempty"`
	Hashtags         []string   `json:"hashtags,omitempty"`
	Mentions         []string   `json:"mentions,omitempty"`
	InstagramTags    []string   `json:"instagram_tags,omitempty"`
	MusicTrack       string     `json:"music_track,omitempty"`
	FacebookPostType string     `json:"facebook_post_type,omitempty"`
	LinkedInPostType string     `json:"linkedin_post_type,omitempty"`
	PublishAt        *time.Time `json:"publish_at,omitempty"`
}

type SocialPublishPayload struct {
	Title            string   `json:"title,omitempty"`
	Subreddit        string   `json:"subreddit,omitempty"`
	Text             string   `json:"text"`
	Link             string   `json:"link,omitempty"`
	MediaURLs        []string `json:"media_urls,omitempty"`
	Hashtags         []string `json:"hashtags,omitempty"`
	Mentions         []string `json:"mentions,omitempty"`
	InstagramTags    []string `json:"instagram_tags,omitempty"`
	MusicTrack       string   `json:"music_track,omitempty"`
	FacebookPostType string   `json:"facebook_post_type,omitempty"`
	LinkedInPostType string   `json:"linkedin_post_type,omitempty"`
	PostID           string   `json:"post_id,omitempty"`
}

type SocialPostJob struct {
	ID             string               `json:"id"`
	UserID         string               `json:"user_id"`
	PostID         *string              `json:"post_id,omitempty"`
	ConnectionID   string               `json:"connection_id"`
	Network        string               `json:"network"`
	Status         string               `json:"status"`
	ScheduledFor   time.Time            `json:"scheduled_for"`
	PublishedAt    *time.Time           `json:"published_at,omitempty"`
	ProviderPostID *string              `json:"provider_post_id,omitempty"`
	ErrorMessage   *string              `json:"error_message,omitempty"`
	Payload        SocialPublishPayload `json:"payload"`
	CreatedAt      time.Time            `json:"created_at"`
	UpdatedAt      time.Time            `json:"updated_at"`
}

type PublishResult struct {
	ProviderPostID string
	RawResponse    json.RawMessage
}

type SocialPublisher interface {
	Publish(ctx context.Context, conn SocialConnection, payload SocialPublishPayload) (*PublishResult, error)
}

// TokenRefresher refreshes an expired OAuth access token in-place before publishing.
// Only networks that support refresh tokens (currently X) need to implement this.
type TokenRefresher interface {
	RefreshTokenIfNeeded(ctx context.Context, conn *SocialConnection) error
}

type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

type SocialService struct {
	db             *pgxpool.Pool
	publishers     map[string]SocialPublisher
	tokenRefresher TokenRefresher
}

func (s *SocialService) SetTokenRefresher(r TokenRefresher) {
	s.tokenRefresher = r
}

func NewSocialService(db *pgxpool.Pool, publishers map[string]SocialPublisher) *SocialService {
	if publishers == nil {
		defaultClient := &http.Client{Timeout: 20 * time.Second}
		publishers = map[string]SocialPublisher{
			SocialNetworkLinkedIn:  NewLinkedInPublisher(defaultClient),
			SocialNetworkFacebook:  NewFacebookPublisher(defaultClient),
			SocialNetworkInstagram: NewInstagramPublisher(defaultClient),
			SocialNetworkX:         NewXPublisher(defaultClient),
		}
	}
	return &SocialService{db: db, publishers: publishers}
}

func IsValidSocialNetwork(network string) bool {
	switch strings.ToLower(strings.TrimSpace(network)) {
	case SocialNetworkLinkedIn, SocialNetworkFacebook, SocialNetworkInstagram, SocialNetworkX:
		return true
	default:
		return false
	}
}

func normalizeSocialNetwork(network string) string {
	return strings.ToLower(strings.TrimSpace(network))
}

func (s *SocialService) UpsertConnection(ctx context.Context, userID string, in SocialConnectionInput) (*SocialConnection, error) {
	if s.db == nil {
		return nil, ErrSocialUnavailable
	}
	in.Network = normalizeSocialNetwork(in.Network)
	if !IsValidSocialNetwork(in.Network) {
		return nil, ErrInvalidNetwork
	}
	if strings.TrimSpace(in.AccountID) == "" || strings.TrimSpace(in.AccessToken) == "" {
		return nil, errors.New("account_id and access_token are required")
	}

	meta := in.MetadataJSON
	if len(meta) == 0 {
		meta = []byte("{}")
	}

	conn := &SocialConnection{}
	err := s.db.QueryRow(ctx, `
		INSERT INTO social_connections (
			user_id, network, account_id, account_name, access_token, refresh_token, token_expires_at, metadata_json
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (user_id, network, account_id)
		DO UPDATE SET
			account_name = EXCLUDED.account_name,
			access_token = EXCLUDED.access_token,
			refresh_token = EXCLUDED.refresh_token,
			token_expires_at = EXCLUDED.token_expires_at,
			metadata_json = EXCLUDED.metadata_json,
			updated_at = now()
		RETURNING id, user_id, network, account_id, account_name, access_token, refresh_token, token_expires_at, metadata_json, created_at, updated_at
	`, userID, in.Network, in.AccountID, in.AccountName, in.AccessToken, in.RefreshToken, in.TokenExpiresAt, meta).Scan(
		&conn.ID,
		&conn.UserID,
		&conn.Network,
		&conn.AccountID,
		&conn.AccountName,
		&conn.AccessToken,
		&conn.RefreshToken,
		&conn.TokenExpiresAt,
		&conn.MetadataJSON,
		&conn.CreatedAt,
		&conn.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return conn, nil
}

func (s *SocialService) ListConnections(ctx context.Context, userID string) ([]SocialConnection, error) {
	if s.db == nil {
		return nil, ErrSocialUnavailable
	}

	rows, err := s.db.Query(ctx, `
		SELECT id, user_id, network, account_id, account_name, access_token, refresh_token, token_expires_at, metadata_json, created_at, updated_at
		FROM social_connections
		WHERE user_id = $1
		ORDER BY network, created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []SocialConnection{}
	for rows.Next() {
		var conn SocialConnection
		if err := rows.Scan(
			&conn.ID,
			&conn.UserID,
			&conn.Network,
			&conn.AccountID,
			&conn.AccountName,
			&conn.AccessToken,
			&conn.RefreshToken,
			&conn.TokenExpiresAt,
			&conn.MetadataJSON,
			&conn.CreatedAt,
			&conn.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, conn)
	}
	return out, rows.Err()
}

func (s *SocialService) DeleteConnection(ctx context.Context, userID, connectionID string) error {
	if s.db == nil {
		return ErrSocialUnavailable
	}
	tag, err := s.db.Exec(ctx, `
		DELETE FROM social_connections WHERE id = $1 AND user_id = $2
	`, connectionID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrConnectionNotFound
	}
	return nil
}

func (s *SocialService) SubmitPublish(ctx context.Context, userID string, in SocialPublishInput) (*SocialPostJob, error) {
	if s.db == nil {
		return nil, ErrSocialUnavailable
	}
	in.Network = normalizeSocialNetwork(in.Network)
	if !IsValidSocialNetwork(in.Network) {
		return nil, ErrInvalidNetwork
	}

	conn, err := s.resolveConnection(ctx, userID, in.ConnectionID, in.Network)
	if err != nil {
		return nil, err
	}

	payload, postIDPtr, err := s.resolvePayload(ctx, userID, in)
	if err != nil {
		return nil, err
	}

	scheduledFor := time.Now().UTC()
	if in.PublishAt != nil {
		scheduledFor = in.PublishAt.UTC()
	}

	job, err := s.createJob(ctx, userID, postIDPtr, conn, payload, scheduledFor)
	if err != nil {
		return nil, err
	}

	// Immediate publish: same behavior users expect from "publish now".
	if in.PublishAt == nil || !scheduledFor.After(time.Now().UTC()) {
		executed, execErr := s.executeJob(ctx, *job, *conn)
		if execErr != nil {
			return executed, nil
		}
		// Asynchronously fetch insights a few seconds after publish so the
		// analytics page shows metrics without requiring a manual refresh.
		if executed != nil && executed.ProviderPostID != nil {
			go func() {
				bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				// Brief delay: give the platform time to process the post.
				if err := sleepWithContext(bgCtx, 5*time.Second); err != nil {
					return
				}
				if _, err := s.FetchAndSaveInsights(bgCtx, userID); err != nil {
					slog.Warn("social publish: background insights fetch failed", "jobID", executed.ID, "error", err)
				}
			}()
		}
		return executed, nil
	}

	return job, nil
}

func (s *SocialService) ListJobs(ctx context.Context, userID, status string) ([]SocialPostJob, error) {
	if s.db == nil {
		return nil, ErrSocialUnavailable
	}

	query := `
		SELECT id, user_id, post_id, connection_id, network, status, scheduled_for, published_at, provider_post_id, error_message, payload_json, created_at, updated_at
		FROM social_post_jobs
		WHERE user_id = $1
	`
	args := []interface{}{userID}
	if status != "" {
		query += " AND status = $2"
		args = append(args, status)
	}
	query += " ORDER BY scheduled_for DESC, created_at DESC"

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jobs := []SocialPostJob{}
	for rows.Next() {
		job, err := scanSocialJob(rows)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

func (s *SocialService) ProcessDueJobs(ctx context.Context, now time.Time, limit int) (int, error) {
	if s.db == nil {
		return 0, ErrSocialUnavailable
	}
	if limit <= 0 {
		limit = 20
	}

	// Recover jobs that were marked as processing but never finished (e.g., crash/restart).
	if err := s.requeueStaleProcessingJobs(ctx, now.UTC(), 2*time.Minute); err != nil {
		return 0, err
	}

	processed := 0
	for processed < limit {
		job, conn, err := s.claimNextDueJob(ctx, now.UTC())
		if err != nil {
			return processed, err
		}
		if job == nil || conn == nil {
			return processed, nil
		}
		if _, err := s.executeJob(ctx, *job, *conn); err != nil {
			slog.Warn("social publish: failed executing job", "jobID", job.ID, "error", err)
		}
		processed++
	}

	return processed, nil
}

// FetchAndSaveInsights pulls post-level metrics from the platform API for all
// published jobs that have a provider_post_id. Merges the result into
// provider_response so the analytics service can pick it up immediately.
// Returns the number of jobs updated.
func (s *SocialService) FetchAndSaveInsights(ctx context.Context, userID string) (int, error) {
	if s.db == nil {
		return 0, ErrSocialUnavailable
	}

	type insightJob struct {
		JobID          string
		Network        string
		ProviderPostID string
		AccessToken    string
	}

	rows, err := s.db.Query(ctx, `
		SELECT spj.id, spj.network, spj.provider_post_id, sc.access_token
		FROM social_post_jobs spj
		JOIN social_connections sc ON sc.id = spj.connection_id
		WHERE spj.user_id = $1
		  AND spj.status = $2
		  AND spj.provider_post_id IS NOT NULL
		ORDER BY spj.published_at DESC
		LIMIT 100
	`, userID, SocialJobPublished)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	jobs := make([]insightJob, 0)
	for rows.Next() {
		var ij insightJob
		if err := rows.Scan(&ij.JobID, &ij.Network, &ij.ProviderPostID, &ij.AccessToken); err != nil {
			return 0, err
		}
		jobs = append(jobs, ij)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	httpClient := &http.Client{Timeout: 10 * time.Second}
	updated := 0
	for _, job := range jobs {
		var metrics map[string]interface{}
		switch job.Network {
		case SocialNetworkInstagram, SocialNetworkFacebook:
			metrics = fetchMetaInsights(ctx, httpClient, job.ProviderPostID, job.AccessToken)
		case SocialNetworkLinkedIn:
			metrics = fetchLinkedInInsights(ctx, httpClient, job.ProviderPostID, job.AccessToken)
		default:
			continue
		}
		if len(metrics) == 0 {
			continue
		}
		raw, err := json.Marshal(metrics)
		if err != nil {
			continue
		}
		if _, err := s.db.Exec(ctx, `
			UPDATE social_post_jobs
			SET provider_response = $1, updated_at = now()
			WHERE id = $2
		`, raw, job.JobID); err != nil {
			slog.Warn("social insights: failed to save provider_response", "jobID", job.JobID, "error", err)
			continue
		}
		updated++
	}
	return updated, nil
}

// fetchMetaInsights calls Meta's Graph API to get post-level metrics.
// It fetches basic engagement fields first, then tries the /insights endpoint
// with multiple metric sets (different media types support different metrics).
func fetchMetaInsights(ctx context.Context, client *http.Client, mediaID, accessToken string) map[string]interface{} {
	result := make(map[string]interface{})

	// Basic fields available on all Instagram/Facebook media.
	basicURL := fmt.Sprintf(
		"https://graph.facebook.com/v25.0/%s?fields=like_count,comments_count,timestamp,media_type&access_token=%s",
		mediaID, accessToken,
	)
	if raw, status, _, err := doJSONRequest(ctx, client, http.MethodGet, basicURL, "", nil, nil); err == nil && status >= 200 && status < 300 {
		var parsed map[string]interface{}
		if json.Unmarshal(raw, &parsed) == nil {
			if v, ok := parsed["like_count"]; ok {
				result["likes"] = v
			}
			if v, ok := parsed["comments_count"]; ok {
				result["comments"] = v
			}
		}
	}

	// Insights endpoint — requires instagram_manage_insights permission.
	// Try progressively simpler metric sets because invalid metrics cause a 400
	// for the entire request. profile_activity was deprecated; video_views only
	// applies to VIDEO/REEL. We try broad → narrow so we always get reach.
	metricSets := []string{
		"reach,impressions,saved,video_views",
		"reach,impressions,saved",
		"reach,impressions",
		"reach",
	}
	for _, metrics := range metricSets {
		insightsURL := fmt.Sprintf(
			"https://graph.facebook.com/v25.0/%s/insights?metric=%s&access_token=%s",
			mediaID, metrics, accessToken,
		)
		raw, status, _, err := doJSONRequest(ctx, client, http.MethodGet, insightsURL, "", nil, nil)
		if err != nil || status < 200 || status >= 300 {
			continue
		}
		var body struct {
			Data []struct {
				Name   string `json:"name"`
				Values []struct {
					Value interface{} `json:"value"`
				} `json:"values"`
			} `json:"data"`
		}
		if json.Unmarshal(raw, &body) != nil {
			continue
		}
		for _, metric := range body.Data {
			if len(metric.Values) > 0 {
				result[metric.Name] = metric.Values[0].Value
			}
		}
		// Got a successful response — no need to try simpler sets.
		break
	}

	return result
}

// fetchLinkedInInsights calls the LinkedIn Share Statistics API to get
// impressions, clicks, likes, comments, and shares for a UGC post.
// shareID is the provider_post_id returned at publish time (the X-RestLi-Id header).
func fetchLinkedInInsights(ctx context.Context, client *http.Client, shareID, accessToken string) map[string]interface{} {
	if strings.TrimSpace(shareID) == "" {
		return nil
	}
	// LinkedIn share statistics endpoint for member shares.
	statsURL := fmt.Sprintf(
		"https://api.linkedin.com/v2/shareStatistics?q=shares&shares[0]=%s",
		shareID,
	)
	raw, status, _, err := doJSONRequest(ctx, client, http.MethodGet, statsURL, accessToken, nil, map[string]string{
		"X-Restli-Protocol-Version": "2.0.0",
	})
	if err != nil || status < 200 || status >= 300 {
		return nil
	}

	var body struct {
		Elements []struct {
			TotalShareStatistics struct {
				ImpressionCount        int `json:"impressionCount"`
				ClickCount             int `json:"clickCount"`
				LikeCount              int `json:"likeCount"`
				CommentCount           int `json:"commentCount"`
				ShareCount             int `json:"shareCount"`
				UniqueImpressionsCount int `json:"uniqueImpressionsCount"`
			} `json:"totalShareStatistics"`
		} `json:"elements"`
	}
	if err := json.Unmarshal(raw, &body); err != nil || len(body.Elements) == 0 {
		return nil
	}

	stats := body.Elements[0].TotalShareStatistics
	result := map[string]interface{}{
		"impressions": stats.ImpressionCount,
		"reach":       stats.UniqueImpressionsCount,
		"likes":       stats.LikeCount,
		"comments":    stats.CommentCount,
		"shares":      stats.ShareCount,
	}
	// If unique impressions not available, fall back to total impressions for reach.
	if stats.UniqueImpressionsCount == 0 && stats.ImpressionCount > 0 {
		result["reach"] = stats.ImpressionCount
	}
	return result
}

func (s *SocialService) requeueStaleProcessingJobs(ctx context.Context, now time.Time, staleAfter time.Duration) error {
	if staleAfter <= 0 {
		staleAfter = 2 * time.Minute
	}
	staleBefore := now.Add(-staleAfter)
	tag, err := s.db.Exec(ctx, `
		UPDATE social_post_jobs
		SET status = $1, updated_at = now()
		WHERE status = $2 AND updated_at < $3
	`, SocialJobQueued, SocialJobProcessing, staleBefore)
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		slog.Warn("social scheduler: requeued stale processing jobs", "count", tag.RowsAffected())
	}
	return nil
}

func (s *SocialService) resolveConnection(ctx context.Context, userID, connectionID, network string) (*SocialConnection, error) {
	conn := &SocialConnection{}
	if strings.TrimSpace(connectionID) != "" {
		err := s.db.QueryRow(ctx, `
			SELECT id, user_id, network, account_id, account_name, access_token, refresh_token, token_expires_at, metadata_json, created_at, updated_at
			FROM social_connections
			WHERE id = $1 AND user_id = $2
		`, connectionID, userID).Scan(
			&conn.ID,
			&conn.UserID,
			&conn.Network,
			&conn.AccountID,
			&conn.AccountName,
			&conn.AccessToken,
			&conn.RefreshToken,
			&conn.TokenExpiresAt,
			&conn.MetadataJSON,
			&conn.CreatedAt,
			&conn.UpdatedAt,
		)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrConnectionNotFound
			}
			return nil, err
		}
		return conn, nil
	}

	err := s.db.QueryRow(ctx, `
		SELECT id, user_id, network, account_id, account_name, access_token, refresh_token, token_expires_at, metadata_json, created_at, updated_at
		FROM social_connections
		WHERE user_id = $1 AND network = $2
		ORDER BY created_at DESC
		LIMIT 1
	`, userID, network).Scan(
		&conn.ID,
		&conn.UserID,
		&conn.Network,
		&conn.AccountID,
		&conn.AccountName,
		&conn.AccessToken,
		&conn.RefreshToken,
		&conn.TokenExpiresAt,
		&conn.MetadataJSON,
		&conn.CreatedAt,
		&conn.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrConnectionNotFound
		}
		return nil, err
	}
	return conn, nil
}

func (s *SocialService) resolvePayload(ctx context.Context, userID string, in SocialPublishInput) (SocialPublishPayload, *string, error) {
	payload := SocialPublishPayload{
		Title:            strings.TrimSpace(in.Title),
		Subreddit:        normalizeSubreddit(in.Subreddit),
		Text:             strings.TrimSpace(in.Text),
		Link:             strings.TrimSpace(in.Link),
		MediaURLs:        trimStringSlice(in.MediaURLs),
		Hashtags:         normalizeHashtags(in.Hashtags),
		Mentions:         normalizeMentions(in.Mentions),
		InstagramTags:    normalizeMentions(in.InstagramTags),
		MusicTrack:       strings.TrimSpace(in.MusicTrack),
		FacebookPostType: normalizeFacebookPostType(in.FacebookPostType),
		LinkedInPostType: normalizeLinkedInPostType(in.LinkedInPostType, in.MediaURLs, in.Link),
		PostID:           strings.TrimSpace(in.PostID),
	}

	var postIDPtr *string
	if payload.PostID != "" {
		pid := payload.PostID
		postIDPtr = &pid
	}

	if payload.PostID != "" {
		var postText string
		var imageURL string
		var postHashtags []string
		err := s.db.QueryRow(ctx, `
			SELECT COALESCE(post_text, ''), COALESCE(image_url, ''), COALESCE(hashtags, '{}')
			FROM generated_posts
			WHERE id = $1 AND user_id = $2
		`, payload.PostID, userID).Scan(&postText, &imageURL, &postHashtags)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return SocialPublishPayload{}, nil, ErrPostNotFound
			}
			return SocialPublishPayload{}, nil, err
		}

		if strings.TrimSpace(payload.Text) == "" {
			text := strings.TrimSpace(postText)
			if strings.TrimSpace(text) == "" {
				return SocialPublishPayload{}, nil, ErrPostTextNotFound
			}
			payload.Text = text
		}

		if normalizeSocialNetwork(in.Network) == SocialNetworkInstagram {
			// For generated posts on Instagram, prefer image_url from generated_posts.
			// If the column is empty, keep any media_urls already sent by the client.
			dbImageURL := strings.TrimSpace(imageURL)
			if dbImageURL != "" {
				payload.MediaURLs = []string{dbImageURL}
			} else if len(payload.MediaURLs) == 0 || strings.TrimSpace(payload.MediaURLs[0]) == "" {
				return SocialPublishPayload{}, nil, errors.New("generated post selected but image_url is empty in database and no media_urls were provided")
			}
		} else if len(payload.MediaURLs) == 0 && strings.TrimSpace(imageURL) != "" {
			payload.MediaURLs = []string{strings.TrimSpace(imageURL)}
		}

		if len(payload.Hashtags) == 0 && len(postHashtags) > 0 {
			payload.Hashtags = normalizeHashtags(postHashtags)
		}
	}

	if err := validatePublishPayload(in.Network, payload); err != nil {
		return SocialPublishPayload{}, nil, err
	}

	return payload, postIDPtr, nil
}

func validatePublishPayload(network string, payload SocialPublishPayload) error {
	switch normalizeSocialNetwork(network) {
	case SocialNetworkInstagram:
		if len(payload.MediaURLs) == 0 || strings.TrimSpace(payload.MediaURLs[0]) == "" {
			return fmt.Errorf("instagram publish requires at least one public media_url: %w", ErrPublishPayloadInvalid)
		}
		return nil
	case SocialNetworkFacebook:
		if payload.FacebookPostType == "photo" && (len(payload.MediaURLs) == 0 || strings.TrimSpace(payload.MediaURLs[0]) == "") {
			return fmt.Errorf("facebook photo publish requires at least one public media_url: %w", ErrPublishPayloadInvalid)
		}
		if strings.TrimSpace(payload.Text) == "" && strings.TrimSpace(payload.Link) == "" {
			return ErrPublishPayloadInvalid
		}
		return nil
	case SocialNetworkLinkedIn:
		if payload.LinkedInPostType == "image" && (len(payload.MediaURLs) == 0 || strings.TrimSpace(payload.MediaURLs[0]) == "") {
			return fmt.Errorf("linkedin image publish requires at least one public media_url: %w", ErrPublishPayloadInvalid)
		}
		if payload.LinkedInPostType == "article" && strings.TrimSpace(payload.Link) == "" {
			return fmt.Errorf("linkedin article publish requires link: %w", ErrPublishPayloadInvalid)
		}
		if strings.TrimSpace(payload.Text) == "" {
			return ErrPublishPayloadInvalid
		}
		return nil
	case SocialNetworkReddit:
		if strings.TrimSpace(payload.Subreddit) == "" {
			return fmt.Errorf("reddit publish requires subreddit: %w", ErrPublishPayloadInvalid)
		}
		if strings.TrimSpace(payload.Title) == "" {
			return fmt.Errorf("reddit publish requires title: %w", ErrPublishPayloadInvalid)
		}
		if strings.TrimSpace(payload.Text) == "" && strings.TrimSpace(payload.Link) == "" {
			return fmt.Errorf("reddit publish requires text or link: %w", ErrPublishPayloadInvalid)
		}
		return nil
	default:
		if strings.TrimSpace(payload.Text) == "" {
			return ErrPublishPayloadInvalid
		}
		return nil
	}
}

func trimStringSlice(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		v := strings.TrimSpace(value)
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}

func normalizeHashtags(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		v := strings.TrimSpace(strings.TrimPrefix(value, "#"))
		if v != "" {
			out = append(out, "#"+v)
		}
	}
	return out
}

func normalizeMentions(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		v := strings.TrimSpace(strings.TrimPrefix(value, "@"))
		if v != "" {
			out = append(out, "@"+v)
		}
	}
	return out
}

func normalizeFacebookPostType(value string) string {
	v := strings.ToLower(strings.TrimSpace(value))
	if v == "photo" {
		return "photo"
	}
	return "feed"
}

func normalizeLinkedInPostType(value string, mediaURLs []string, link string) string {
	v := strings.ToLower(strings.TrimSpace(value))
	switch v {
	case "article", "image":
		return v
	case "text":
		return "text"
	default:
		if len(trimStringSlice(mediaURLs)) > 0 {
			return "image"
		}
		if strings.TrimSpace(link) != "" {
			return "article"
		}
		return "text"
	}
}

func normalizeLinkedInPersonURN(accountID string) string {
	v := strings.TrimSpace(accountID)
	if v == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(v), "urn:li:person:") {
		return v
	}
	v = strings.TrimPrefix(v, "urn:")
	v = strings.TrimPrefix(v, "li:")
	v = strings.TrimPrefix(v, "person:")
	v = strings.TrimSpace(v)
	if v == "" {
		return ""
	}
	return "urn:li:person:" + v
}

func composeNetworkText(payload SocialPublishPayload, maxLen int) string {
	parts := []string{}
	base := strings.TrimSpace(payload.Text)
	if base != "" {
		parts = append(parts, base)
	}
	if len(payload.Mentions) > 0 {
		parts = append(parts, strings.Join(payload.Mentions, " "))
	}
	if len(payload.Hashtags) > 0 {
		parts = append(parts, strings.Join(payload.Hashtags, " "))
	}
	out := strings.TrimSpace(strings.Join(parts, "\n\n"))
	if maxLen > 0 && len([]rune(out)) > maxLen {
		runes := []rune(out)
		if maxLen > 1 {
			out = string(runes[:maxLen-1]) + "…"
		} else {
			out = string(runes[:maxLen])
		}
	}
	return out
}

func composeInstagramCaption(payload SocialPublishPayload) string {
	mergedMentions := make([]string, 0, len(payload.Mentions)+len(payload.InstagramTags))
	seen := map[string]bool{}
	for _, mention := range append(payload.Mentions, payload.InstagramTags...) {
		norm := strings.TrimSpace(mention)
		if norm == "" {
			continue
		}
		if !strings.HasPrefix(norm, "@") {
			norm = "@" + strings.TrimPrefix(norm, "@")
		}
		if seen[norm] {
			continue
		}
		seen[norm] = true
		mergedMentions = append(mergedMentions, norm)
	}

	captionPayload := payload
	captionPayload.Mentions = mergedMentions
	caption := composeNetworkText(captionPayload, 0)
	if strings.TrimSpace(payload.MusicTrack) == "" {
		return caption
	}
	if caption == "" {
		return "🎵 " + strings.TrimSpace(payload.MusicTrack)
	}
	return caption + "\n\n🎵 " + strings.TrimSpace(payload.MusicTrack)
}

func normalizeSubreddit(v string) string {
	v = strings.TrimSpace(strings.ToLower(v))
	v = strings.TrimPrefix(v, "r/")
	v = strings.TrimPrefix(v, "/r/")
	return v
}

func (s *SocialService) createJob(ctx context.Context, userID string, postID *string, conn *SocialConnection, payload SocialPublishPayload, scheduledFor time.Time) (*SocialPostJob, error) {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	job := &SocialPostJob{}
	err = s.db.QueryRow(ctx, `
		INSERT INTO social_post_jobs (
			user_id, post_id, connection_id, network, status, scheduled_for, payload_json
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id, user_id, post_id, connection_id, network, status, scheduled_for, published_at, provider_post_id, error_message, payload_json, created_at, updated_at
	`, userID, postID, conn.ID, conn.Network, SocialJobQueued, scheduledFor.UTC(), payloadJSON).Scan(
		&job.ID,
		&job.UserID,
		&job.PostID,
		&job.ConnectionID,
		&job.Network,
		&job.Status,
		&job.ScheduledFor,
		&job.PublishedAt,
		&job.ProviderPostID,
		&job.ErrorMessage,
		&payloadJSON,
		&job.CreatedAt,
		&job.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(payloadJSON, &job.Payload); err != nil {
		return nil, err
	}
	return job, nil
}

func (s *SocialService) executeJob(ctx context.Context, job SocialPostJob, conn SocialConnection) (*SocialPostJob, error) {
	publisher := s.publishers[job.Network]
	if publisher == nil {
		msg := fmt.Sprintf("publisher not configured for network: %s", job.Network)
		failed, updateErr := s.markJobFailed(ctx, job.ID, msg)
		if updateErr != nil {
			return nil, updateErr
		}
		return failed, errors.New(msg)
	}

	if _, err := s.db.Exec(ctx, `
		UPDATE social_post_jobs
		SET status = $1, error_message = NULL, updated_at = now()
		WHERE id = $2
	`, SocialJobProcessing, job.ID); err != nil {
		return nil, err
	}

	if s.tokenRefresher != nil {
		if err := s.tokenRefresher.RefreshTokenIfNeeded(ctx, &conn); err != nil {
			slog.Warn("social publish: token refresh failed, continuing with existing token", "jobID", job.ID, "network", conn.Network, "error", err)
		}
	}

	result, publishErr := publisher.Publish(ctx, conn, job.Payload)
	if publishErr != nil {
		failed, updateErr := s.markJobFailed(ctx, job.ID, publishErr.Error())
		if updateErr != nil {
			return nil, updateErr
		}
		return failed, publishErr
	}

	publishedAt := time.Now().UTC()
	updated := &SocialPostJob{}
	payloadJSON, _ := json.Marshal(job.Payload)
	err := s.db.QueryRow(ctx, `
		UPDATE social_post_jobs
		SET status = $1, published_at = $2, provider_post_id = $3, error_message = NULL, provider_response = $4, updated_at = now()
		WHERE id = $5
		RETURNING id, user_id, post_id, connection_id, network, status, scheduled_for, published_at, provider_post_id, error_message, payload_json, created_at, updated_at
	`, SocialJobPublished, publishedAt, nullableString(result.ProviderPostID), result.RawResponse, job.ID).Scan(
		&updated.ID,
		&updated.UserID,
		&updated.PostID,
		&updated.ConnectionID,
		&updated.Network,
		&updated.Status,
		&updated.ScheduledFor,
		&updated.PublishedAt,
		&updated.ProviderPostID,
		&updated.ErrorMessage,
		&payloadJSON,
		&updated.CreatedAt,
		&updated.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(payloadJSON, &updated.Payload); err != nil {
		return nil, err
	}
	return updated, nil
}

func nullableString(v string) *string {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	s := v
	return &s
}

func (s *SocialService) markJobFailed(ctx context.Context, jobID, message string) (*SocialPostJob, error) {
	failed := &SocialPostJob{}
	var payloadJSON []byte
	err := s.db.QueryRow(ctx, `
		UPDATE social_post_jobs
		SET status = $1, error_message = $2, updated_at = now()
		WHERE id = $3
		RETURNING id, user_id, post_id, connection_id, network, status, scheduled_for, published_at, provider_post_id, error_message, payload_json, created_at, updated_at
	`, SocialJobFailed, message, jobID).Scan(
		&failed.ID,
		&failed.UserID,
		&failed.PostID,
		&failed.ConnectionID,
		&failed.Network,
		&failed.Status,
		&failed.ScheduledFor,
		&failed.PublishedAt,
		&failed.ProviderPostID,
		&failed.ErrorMessage,
		&payloadJSON,
		&failed.CreatedAt,
		&failed.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(payloadJSON) != 0 {
		_ = json.Unmarshal(payloadJSON, &failed.Payload)
	}
	return failed, nil
}

func scanSocialJob(row pgx.Row) (SocialPostJob, error) {
	var job SocialPostJob
	var payloadJSON []byte
	err := row.Scan(
		&job.ID,
		&job.UserID,
		&job.PostID,
		&job.ConnectionID,
		&job.Network,
		&job.Status,
		&job.ScheduledFor,
		&job.PublishedAt,
		&job.ProviderPostID,
		&job.ErrorMessage,
		&payloadJSON,
		&job.CreatedAt,
		&job.UpdatedAt,
	)
	if err != nil {
		return SocialPostJob{}, err
	}
	if len(payloadJSON) > 0 {
		if err := json.Unmarshal(payloadJSON, &job.Payload); err != nil {
			return SocialPostJob{}, err
		}
	}
	return job, nil
}

func (s *SocialService) claimNextDueJob(ctx context.Context, now time.Time) (*SocialPostJob, *SocialConnection, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback(ctx)

	var jobID string
	err = tx.QueryRow(ctx, `
		SELECT id
		FROM social_post_jobs
		WHERE status = $1 AND scheduled_for <= $2
		ORDER BY scheduled_for ASC, created_at ASC
		LIMIT 1
		FOR UPDATE SKIP LOCKED
	`, SocialJobQueued, now).Scan(&jobID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, nil
		}
		return nil, nil, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE social_post_jobs
		SET status = $1, updated_at = now()
		WHERE id = $2
	`, SocialJobProcessing, jobID); err != nil {
		return nil, nil, err
	}

	var payloadJSON []byte
	job := &SocialPostJob{}
	err = tx.QueryRow(ctx, `
		SELECT id, user_id, post_id, connection_id, network, status, scheduled_for, published_at, provider_post_id, error_message, payload_json, created_at, updated_at
		FROM social_post_jobs
		WHERE id = $1
	`, jobID).Scan(
		&job.ID,
		&job.UserID,
		&job.PostID,
		&job.ConnectionID,
		&job.Network,
		&job.Status,
		&job.ScheduledFor,
		&job.PublishedAt,
		&job.ProviderPostID,
		&job.ErrorMessage,
		&payloadJSON,
		&job.CreatedAt,
		&job.UpdatedAt,
	)
	if err != nil {
		return nil, nil, err
	}
	if len(payloadJSON) > 0 {
		if err := json.Unmarshal(payloadJSON, &job.Payload); err != nil {
			return nil, nil, err
		}
	}

	conn := &SocialConnection{}
	err = tx.QueryRow(ctx, `
		SELECT id, user_id, network, account_id, account_name, access_token, refresh_token, token_expires_at, metadata_json, created_at, updated_at
		FROM social_connections
		WHERE id = $1
	`, job.ConnectionID).Scan(
		&conn.ID,
		&conn.UserID,
		&conn.Network,
		&conn.AccountID,
		&conn.AccountName,
		&conn.AccessToken,
		&conn.RefreshToken,
		&conn.TokenExpiresAt,
		&conn.MetadataJSON,
		&conn.CreatedAt,
		&conn.UpdatedAt,
	)
	if err != nil {
		return nil, nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, err
	}
	return job, conn, nil
}

func StartSocialScheduler(ctx context.Context, svc *SocialService, tickEvery time.Duration, batchSize int) {
	if svc == nil {
		return
	}
	if tickEvery <= 0 {
		tickEvery = 15 * time.Second
	}
	if batchSize <= 0 {
		batchSize = 20
	}
	ticker := time.NewTicker(tickEvery)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			processed, err := svc.ProcessDueJobs(context.Background(), time.Now().UTC(), batchSize)
			if err != nil {
				slog.Warn("social scheduler: process due jobs failed", "error", err)
				continue
			}
			if processed > 0 {
				slog.Info("social scheduler: jobs processed", "count", processed)
			}
		}
	}
}

// LinkedInPublisher publishes plain text/link posts via UGC API.
type LinkedInPublisher struct {
	client HTTPDoer
}

func NewLinkedInPublisher(client HTTPDoer) *LinkedInPublisher {
	return &LinkedInPublisher{client: client}
}

func (p *LinkedInPublisher) Publish(ctx context.Context, conn SocialConnection, payload SocialPublishPayload) (*PublishResult, error) {
	finalText := composeNetworkText(payload, 0)
	shareMediaCategory := "NONE"
	media := make([]interface{}, 0)
	authorURN := normalizeLinkedInPersonURN(conn.AccountID)
	if authorURN == "" {
		return nil, errors.New("linkedin publish failed: missing account_id")
	}

	postType := payload.LinkedInPostType
	if postType == "" {
		postType = normalizeLinkedInPostType("", payload.MediaURLs, payload.Link)
	}

	if postType == "article" && payload.Link != "" {
		shareMediaCategory = "ARTICLE"
		media = append(media, map[string]interface{}{
			"status":      "READY",
			"originalUrl": payload.Link,
		})
	}

	if postType == "image" && len(payload.MediaURLs) > 0 {
		shareMediaCategory = "IMAGE"
		for _, mediaURL := range payload.MediaURLs {
			assetURN, err := p.uploadImageAsset(ctx, conn.AccessToken, authorURN, mediaURL)
			if err != nil {
				return nil, err
			}
			media = append(media, map[string]interface{}{
				"status": "READY",
				"media":  assetURN,
			})
		}
	}

	shareContent := map[string]interface{}{
		"shareCommentary":    map[string]string{"text": finalText},
		"shareMediaCategory": shareMediaCategory,
	}
	if len(media) > 0 {
		shareContent["media"] = media
	}

	body := map[string]interface{}{
		"author":         authorURN,
		"lifecycleState": "PUBLISHED",
		"specificContent": map[string]interface{}{
			"com.linkedin.ugc.ShareContent": shareContent,
		},
		"visibility": map[string]string{
			"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
		},
	}

	raw, status, headers, err := doJSONRequest(ctx, p.client, http.MethodPost, "https://api.linkedin.com/v2/ugcPosts", conn.AccessToken, body, map[string]string{
		"X-Restli-Protocol-Version": "2.0.0",
	})
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("linkedin publish failed: status=%d body=%s", status, string(raw))
	}
	providerID := headers.Get("X-RestLi-Id")
	return &PublishResult{ProviderPostID: providerID, RawResponse: raw}, nil
}

func (p *LinkedInPublisher) uploadImageAsset(ctx context.Context, accessToken, ownerURN, mediaURL string) (string, error) {
	registerBody := map[string]interface{}{
		"registerUploadRequest": map[string]interface{}{
			"recipes": []string{"urn:li:digitalmediaRecipe:feedshare-image"},
			"owner":   ownerURN,
			"serviceRelationships": []map[string]string{
				{
					"relationshipType": "OWNER",
					"identifier":       "urn:li:userGeneratedContent",
				},
			},
		},
	}

	regRaw, regStatus, _, err := doJSONRequest(
		ctx,
		p.client,
		http.MethodPost,
		"https://api.linkedin.com/v2/assets?action=registerUpload",
		accessToken,
		registerBody,
		map[string]string{"X-Restli-Protocol-Version": "2.0.0"},
	)
	if err != nil {
		return "", err
	}
	if regStatus < 200 || regStatus >= 300 {
		return "", fmt.Errorf("linkedin image register upload failed: status=%d body=%s", regStatus, string(regRaw))
	}

	var regResp struct {
		Value struct {
			Asset           string `json:"asset"`
			UploadMechanism struct {
				MediaUploadHTTP struct {
					UploadURL string `json:"uploadUrl"`
				} `json:"com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"`
			} `json:"uploadMechanism"`
		} `json:"value"`
	}
	if err := json.Unmarshal(regRaw, &regResp); err != nil {
		return "", err
	}
	assetURN := strings.TrimSpace(regResp.Value.Asset)
	uploadURL := strings.TrimSpace(regResp.Value.UploadMechanism.MediaUploadHTTP.UploadURL)
	if assetURN == "" || uploadURL == "" {
		return "", errors.New("linkedin image register upload returned empty asset or upload URL")
	}

	mediaReq, err := http.NewRequestWithContext(ctx, http.MethodGet, mediaURL, nil)
	if err != nil {
		return "", err
	}
	mediaResp, err := p.client.Do(mediaReq)
	if err != nil {
		return "", err
	}
	defer mediaResp.Body.Close()
	if mediaResp.StatusCode < 200 || mediaResp.StatusCode >= 300 {
		body, _ := io.ReadAll(mediaResp.Body)
		return "", fmt.Errorf("linkedin image fetch failed: status=%d body=%s", mediaResp.StatusCode, string(body))
	}
	data, err := io.ReadAll(mediaResp.Body)
	if err != nil {
		return "", err
	}

	uploadReq, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	contentType := mediaResp.Header.Get("Content-Type")
	if strings.TrimSpace(contentType) == "" {
		contentType = "application/octet-stream"
	}
	uploadReq.Header.Set("Content-Type", contentType)
	uploadResp, err := p.client.Do(uploadReq)
	if err != nil {
		return "", err
	}
	defer uploadResp.Body.Close()
	if uploadResp.StatusCode < 200 || uploadResp.StatusCode >= 300 {
		body, _ := io.ReadAll(uploadResp.Body)
		return "", fmt.Errorf("linkedin image binary upload failed: status=%d body=%s", uploadResp.StatusCode, string(body))
	}

	return assetURN, nil
}

// FacebookPublisher publishes to a Facebook Page feed.
type FacebookPublisher struct {
	client HTTPDoer
}

func NewFacebookPublisher(client HTTPDoer) *FacebookPublisher {
	return &FacebookPublisher{client: client}
}

func (p *FacebookPublisher) Publish(ctx context.Context, conn SocialConnection, payload SocialPublishPayload) (*PublishResult, error) {
	finalText := composeNetworkText(payload, 0)
	if len(payload.MediaURLs) > 0 && strings.TrimSpace(payload.MediaURLs[0]) != "" {
		form := map[string]string{
			"url":       strings.TrimSpace(payload.MediaURLs[0]),
			"caption":   finalText,
			"published": "true",
		}
		url := fmt.Sprintf("https://graph.facebook.com/v25.0/%s/photos", conn.AccountID)
		raw, status, _, err := doFormRequest(ctx, p.client, http.MethodPost, url, conn.AccessToken, form)
		if err != nil {
			return nil, err
		}
		if status < 200 || status >= 300 {
			return nil, fmt.Errorf("facebook photo publish failed: status=%d body=%s", status, string(raw))
		}
		var parsed struct {
			ID string `json:"id"`
		}
		_ = json.Unmarshal(raw, &parsed)
		return &PublishResult{ProviderPostID: parsed.ID, RawResponse: raw}, nil
	}

	form := map[string]string{
		"message": finalText,
	}
	if payload.Link != "" {
		form["link"] = payload.Link
	}
	url := fmt.Sprintf("https://graph.facebook.com/v25.0/%s/feed", conn.AccountID)
	raw, status, _, err := doFormRequest(ctx, p.client, http.MethodPost, url, conn.AccessToken, form)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("facebook publish failed: status=%d body=%s", status, string(raw))
	}
	var parsed struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(raw, &parsed)
	return &PublishResult{ProviderPostID: parsed.ID, RawResponse: raw}, nil
}

// InstagramPublisher publishes to Instagram professional accounts using media containers.
type InstagramPublisher struct {
	client HTTPDoer
}

func NewInstagramPublisher(client HTTPDoer) *InstagramPublisher {
	return &InstagramPublisher{client: client}
}

func (p *InstagramPublisher) Publish(ctx context.Context, conn SocialConnection, payload SocialPublishPayload) (*PublishResult, error) {
	if err := validatePublishPayload(SocialNetworkInstagram, payload); err != nil {
		return nil, err
	}

	creationID, err := p.createMediaContainer(ctx, conn, payload)
	if err != nil {
		return nil, err
	}

	publishBody := map[string]string{"creation_id": creationID}
	url := fmt.Sprintf("https://graph.facebook.com/v25.0/%s/media_publish", conn.AccountID)
	const maxAttempts = 5
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		raw, status, _, err := doJSONRequest(ctx, p.client, http.MethodPost, url, conn.AccessToken, publishBody, nil)
		if err != nil {
			return nil, err
		}
		if status >= 200 && status < 300 {
			var parsed struct {
				ID string `json:"id"`
			}
			_ = json.Unmarshal(raw, &parsed)
			return &PublishResult{ProviderPostID: parsed.ID, RawResponse: raw}, nil
		}

		if isMetaOAuthInvalidToken(raw) {
			return nil, errors.New("instagram access token invalid or expired; reconnect your Facebook/Instagram account")
		}

		if attempt < maxAttempts && isInstagramMediaNotReady(raw) {
			if err := sleepWithContext(ctx, 2*time.Second); err != nil {
				return nil, err
			}
			continue
		}

		return nil, fmt.Errorf("instagram publish failed: status=%d body=%s", status, string(raw))
	}

	return nil, errors.New("instagram publish failed after retries")
}

func (p *InstagramPublisher) createMediaContainer(ctx context.Context, conn SocialConnection, payload SocialPublishPayload) (string, error) {
	if len(payload.MediaURLs) == 1 {
		return p.createSingleInstagramContainer(ctx, conn, payload, strings.TrimSpace(payload.MediaURLs[0]), false)
	}

	children := make([]string, 0, len(payload.MediaURLs))
	for _, mediaURL := range payload.MediaURLs {
		childID, err := p.createSingleInstagramContainer(ctx, conn, payload, strings.TrimSpace(mediaURL), true)
		if err != nil {
			return "", err
		}
		children = append(children, childID)
	}

	body := map[string]string{
		"caption":    composeInstagramCaption(payload),
		"media_type": "CAROUSEL",
		"children":   strings.Join(children, ","),
	}
	url := fmt.Sprintf("https://graph.facebook.com/v25.0/%s/media", conn.AccountID)
	raw, status, _, err := doJSONRequest(ctx, p.client, http.MethodPost, url, conn.AccessToken, body, nil)
	if err != nil {
		return "", err
	}
	if status < 200 || status >= 300 {
		return "", fmt.Errorf("instagram carousel container failed: status=%d body=%s", status, string(raw))
	}
	var parsed struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	if parsed.ID == "" {
		return "", fmt.Errorf("instagram carousel container missing id")
	}
	return parsed.ID, nil
}

func (p *InstagramPublisher) createSingleInstagramContainer(ctx context.Context, conn SocialConnection, payload SocialPublishPayload, mediaURL string, isCarouselItem bool) (string, error) {
	body := map[string]interface{}{
		"caption": composeInstagramCaption(payload),
	}
	hasUserTags := false
	if len(payload.InstagramTags) > 0 {
		tags := make([]map[string]interface{}, 0, len(payload.InstagramTags))
		for _, username := range payload.InstagramTags {
			tags = append(tags, map[string]interface{}{
				"username": strings.TrimPrefix(username, "@"),
				"x":        0.5,
				"y":        0.5,
			})
		}
		body["user_tags"] = tags
		hasUserTags = true
	}
	if isCarouselItem {
		body["is_carousel_item"] = true
	}
	if looksLikeVideoURL(mediaURL) {
		body["video_url"] = mediaURL
		body["media_type"] = "VIDEO"
	} else {
		body["image_url"] = mediaURL
	}
	url := fmt.Sprintf("https://graph.facebook.com/v25.0/%s/media", conn.AccountID)
	raw, status, _, err := doJSONRequest(ctx, p.client, http.MethodPost, url, conn.AccessToken, body, nil)
	if err != nil {
		return "", err
	}
	if status >= 200 && status < 300 {
		var parsed struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(raw, &parsed); err != nil {
			return "", err
		}
		if parsed.ID == "" {
			return "", fmt.Errorf("instagram media container missing id")
		}
		return parsed.ID, nil
	}

	// If tagging specific users fails, retry once without user_tags so publish can continue.
	if hasUserTags && isInstagramUserTagInaccessible(raw) {
		delete(body, "user_tags")
		raw, status, _, err = doJSONRequest(ctx, p.client, http.MethodPost, url, conn.AccessToken, body, nil)
		if err != nil {
			return "", err
		}
	}
	if status < 200 || status >= 300 {
		if isInstagramInvalidMediaURL(raw) {
			return "", errors.New("instagram media URL is invalid or unreachable; use a direct public image/video URL (https) that does not require login")
		}
		return "", fmt.Errorf("instagram media container failed: status=%d body=%s", status, string(raw))
	}
	var parsed struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	if parsed.ID == "" {
		return "", fmt.Errorf("instagram media container missing id")
	}
	return parsed.ID, nil
}

func looksLikeVideoURL(rawURL string) bool {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return false
	}
	ext := strings.ToLower(path.Ext(parsed.Path))
	switch ext {
	case ".mp4", ".mov", ".webm", ".m4v":
		return true
	default:
		return false
	}
}

func isInstagramMediaNotReady(raw []byte) bool {
	_, subcode, message, ok := parseMetaError(raw)
	if ok && subcode == 2207027 {
		return true
	}
	return strings.Contains(strings.ToLower(message), "media id is not available")
}

func isMetaOAuthInvalidToken(raw []byte) bool {
	code, _, message, ok := parseMetaError(raw)
	if ok && code == 190 {
		return true
	}
	return strings.Contains(strings.ToLower(message), "invalid oauth access token")
}

func isInstagramInvalidMediaURL(raw []byte) bool {
	code, subcode, message, ok := parseMetaError(raw)
	if ok && code == 9004 {
		return true
	}
	if ok && subcode == 2207052 {
		return true
	}
	msg := strings.ToLower(message)
	return strings.Contains(msg, "only photo or video can be accepted") ||
		strings.Contains(msg, "url da midia") ||
		strings.Contains(msg, "media url")
}

func isInstagramUserTagInaccessible(raw []byte) bool {
	code, subcode, message, ok := parseMetaError(raw)
	if ok && code == 100 && subcode == 2207018 {
		return true
	}
	msg := strings.ToLower(message)
	return strings.Contains(msg, "user") && strings.Contains(msg, "cannot be")
}

func parseMetaError(raw []byte) (code int, subcode int, message string, ok bool) {
	var body struct {
		Error struct {
			Message      string `json:"message"`
			Code         int    `json:"code"`
			ErrorSubcode int    `json:"error_subcode"`
		} `json:"error"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		return 0, 0, "", false
	}
	if body.Error.Code == 0 && body.Error.Message == "" {
		return 0, 0, "", false
	}
	return body.Error.Code, body.Error.ErrorSubcode, body.Error.Message, true
}

func sleepWithContext(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

// RedditPublisher submits either self-posts or link posts to a subreddit.
type RedditPublisher struct {
	client HTTPDoer
}

func NewRedditPublisher(client HTTPDoer) *RedditPublisher {
	return &RedditPublisher{client: client}
}

func (p *RedditPublisher) Publish(ctx context.Context, conn SocialConnection, payload SocialPublishPayload) (*PublishResult, error) {
	if err := validatePublishPayload(SocialNetworkReddit, payload); err != nil {
		return nil, err
	}

	form := url.Values{}
	form.Set("api_type", "json")
	form.Set("sr", payload.Subreddit)
	form.Set("title", payload.Title)
	form.Set("sendreplies", "true")
	if strings.TrimSpace(payload.Link) != "" {
		form.Set("kind", "link")
		form.Set("url", payload.Link)
	} else {
		form.Set("kind", "self")
		form.Set("text", payload.Text)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth.reddit.com/api/submit", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+conn.AccessToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", redditUserAgent(conn.MetadataJSON))

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw := new(bytes.Buffer)
	if _, err := raw.ReadFrom(resp.Body); err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("reddit publish failed: status=%d body=%s", resp.StatusCode, raw.String())
	}

	providerID, parseErr := parseRedditSubmitResponse(raw.Bytes())
	if parseErr != nil {
		return nil, parseErr
	}
	return &PublishResult{ProviderPostID: providerID, RawResponse: raw.Bytes()}, nil
}

func redditUserAgent(metadata json.RawMessage) string {
	if len(metadata) != 0 {
		var body map[string]json.RawMessage
		if json.Unmarshal(metadata, &body) == nil {
			if raw, ok := body["user_agent"]; ok {
				var v string
				if json.Unmarshal(raw, &v) == nil && strings.TrimSpace(v) != "" {
					return v
				}
			}
		}
	}
	return "postable/1.0"
}

func parseRedditSubmitResponse(raw []byte) (string, error) {
	var parsed struct {
		JSON struct {
			Errors [][]interface{} `json:"errors"`
			Data   struct {
				Name string `json:"name"`
				URL  string `json:"url"`
				ID   string `json:"id"`
			} `json:"data"`
		} `json:"json"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	if len(parsed.JSON.Errors) > 0 {
		return "", fmt.Errorf("reddit publish failed: %v", parsed.JSON.Errors)
	}
	for _, candidate := range []string{parsed.JSON.Data.Name, parsed.JSON.Data.ID, parsed.JSON.Data.URL} {
		if strings.TrimSpace(candidate) != "" {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("reddit publish succeeded but response did not include a post id")
}

// XPublisher publishes text posts via X API v2.
type XPublisher struct {
	client HTTPDoer
}

func NewXPublisher(client HTTPDoer) *XPublisher {
	return &XPublisher{client: client}
}

func xAPIVersion() string {
	v := strings.TrimSpace(os.Getenv("X_API_VERSION"))
	if v == "" {
		return "2"
	}
	return strings.TrimPrefix(v, "v")
}

func xAPIHost() string {
	h := strings.TrimSpace(os.Getenv("X_API_HOST"))
	if h == "" {
		return "https://api.x.com"
	}
	return strings.TrimSuffix(h, "/")
}

func xFallbackAPIHost() string {
	h := strings.TrimSpace(os.Getenv("X_API_FALLBACK_HOST"))
	if h == "" {
		return "https://api.twitter.com"
	}
	return strings.TrimSuffix(h, "/")
}

func xMediaUploadHost() string {
	h := strings.TrimSpace(os.Getenv("X_MEDIA_UPLOAD_HOST"))
	if h == "" {
		return "https://upload.twitter.com"
	}
	return strings.TrimSuffix(h, "/")
}

func xMediaUploadFallbackHost() string {
	h := strings.TrimSpace(os.Getenv("X_MEDIA_UPLOAD_FALLBACK_HOST"))
	if h == "" {
		return "https://upload.x.com"
	}
	return strings.TrimSuffix(h, "/")
}

func (p *XPublisher) Publish(ctx context.Context, conn SocialConnection, payload SocialPublishPayload) (*PublishResult, error) {
	finalText := strings.TrimSpace(payload.Text)
	if finalText == "" {
		return nil, fmt.Errorf("x publish requires text: %w", ErrPublishPayloadInvalid)
	}
	if len([]rune(finalText)) > 280 {
		runes := []rune(finalText)
		finalText = string(runes[:279]) + "…"
	}
	body := map[string]interface{}{"text": finalText}

	endpoint := fmt.Sprintf("%s/%s/tweets", xAPIHost(), xAPIVersion())
	raw, status, _, err := doJSONRequest(ctx, p.client, http.MethodPost, endpoint, conn.AccessToken, body, nil)
	if err == nil && status >= 400 {
		fallbackEndpoint := fmt.Sprintf("%s/%s/tweets", xFallbackAPIHost(), xAPIVersion())
		fallbackRaw, fallbackStatus, _, fallbackErr := doJSONRequest(ctx, p.client, http.MethodPost, fallbackEndpoint, conn.AccessToken, body, nil)
		if fallbackErr == nil {
			raw = fallbackRaw
			status = fallbackStatus
			err = nil
		}
	}
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("x publish failed: status=%d body=%s", status, string(raw))
	}
	var parsed struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	_ = json.Unmarshal(raw, &parsed)
	return &PublishResult{ProviderPostID: parsed.Data.ID, RawResponse: raw}, nil
}

func xConnectionScope(conn SocialConnection) string {
	if len(conn.MetadataJSON) == 0 {
		return ""
	}
	var meta map[string]interface{}
	if err := json.Unmarshal(conn.MetadataJSON, &meta); err != nil {
		return ""
	}
	raw, ok := meta["scope"]
	if !ok {
		return ""
	}
	v, ok := raw.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(v)
}

func xHasScope(scope, required string) bool {
	required = strings.TrimSpace(required)
	if required == "" {
		return true
	}
	for _, part := range strings.Fields(strings.TrimSpace(scope)) {
		if strings.TrimSpace(part) == required {
			return true
		}
	}
	return false
}

func (p *XPublisher) uploadXMedia(ctx context.Context, conn SocialConnection, mediaURL string) (string, error) {
	accessToken := conn.AccessToken
	mediaReq, err := http.NewRequestWithContext(ctx, http.MethodGet, mediaURL, nil)
	if err != nil {
		return "", err
	}
	mediaResp, err := p.client.Do(mediaReq)
	if err != nil {
		return "", err
	}
	defer mediaResp.Body.Close()
	if mediaResp.StatusCode < 200 || mediaResp.StatusCode >= 300 {
		body, _ := io.ReadAll(mediaResp.Body)
		return "", fmt.Errorf("x media fetch failed: status=%d body=%s", mediaResp.StatusCode, string(body))
	}

	mediaBytes, err := io.ReadAll(mediaResp.Body)
	if err != nil {
		return "", err
	}

	uploadBody := &bytes.Buffer{}
	writer := multipart.NewWriter(uploadBody)
	part, err := writer.CreateFormFile("media", path.Base(mediaURL))
	if err != nil {
		return "", err
	}
	if _, err := part.Write(mediaBytes); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	contentType := writer.FormDataContentType()

	// Try v2 media upload first (OAuth2 user token compatibility), then fall
	// back to legacy v1.1 upload endpoint for broader provider compatibility.
	v2URLs := []string{
		fmt.Sprintf("%s/%s/media/upload", xAPIHost(), xAPIVersion()),
		fmt.Sprintf("%s/%s/media/upload", xFallbackAPIHost(), xAPIVersion()),
	}
	for _, endpoint := range v2URLs {
		raw, status, err := p.uploadXMediaOnce(ctx, endpoint, accessToken, uploadBody, contentType)
		if err != nil {
			continue
		}
		if status >= 200 && status < 300 {
			if mediaID, parseErr := parseXMediaID(raw); parseErr == nil {
				return mediaID, nil
			}
		}
	}

	uploadPath := "/1.1/media/upload.json"
	primaryURL := xMediaUploadHost() + uploadPath
	raw, status, err := p.uploadXMediaOnce(ctx, primaryURL, accessToken, uploadBody, contentType)
	if err != nil {
		return "", err
	}
	if status < 200 || status >= 300 {
		fallbackURL := xMediaUploadFallbackHost() + uploadPath
		fallbackRaw, fallbackStatus, fallbackErr := p.uploadXMediaOnce(ctx, fallbackURL, accessToken, uploadBody, contentType)
		if fallbackErr == nil {
			raw = fallbackRaw
			status = fallbackStatus
		}
	}
	if status < 200 || status >= 300 {
		return "", formatXMediaUploadError(status, raw, xConnectionScope(conn))
	}

	mediaID, err := parseXMediaID(raw)
	if err != nil {
		return "", err
	}
	return mediaID, nil
}

func parseXMediaID(raw []byte) (string, error) {
	var parsed struct {
		MediaIDString string `json:"media_id_string"`
		MediaID       int64  `json:"media_id"`
		Data          struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	if strings.TrimSpace(parsed.Data.ID) != "" {
		return parsed.Data.ID, nil
	}
	if strings.TrimSpace(parsed.MediaIDString) != "" {
		return parsed.MediaIDString, nil
	}
	if parsed.MediaID > 0 {
		return fmt.Sprintf("%d", parsed.MediaID), nil
	}
	return "", errors.New("x media upload succeeded but response did not include media id")
}

func formatXMediaUploadError(status int, raw []byte, scope string) error {
	message := strings.TrimSpace(string(raw))
	var parsed struct {
		Title  string `json:"title"`
		Detail string `json:"detail"`
		Error  string `json:"error"`
	}
	if err := json.Unmarshal(raw, &parsed); err == nil {
		switch {
		case strings.TrimSpace(parsed.Detail) != "":
			message = strings.TrimSpace(parsed.Detail)
		case strings.TrimSpace(parsed.Title) != "":
			message = strings.TrimSpace(parsed.Title)
		case strings.TrimSpace(parsed.Error) != "":
			message = strings.TrimSpace(parsed.Error)
		}
	}

	if status == http.StatusUnauthorized || status == http.StatusForbidden {
		scopeInfo := ""
		if strings.TrimSpace(scope) != "" {
			scopeInfo = fmt.Sprintf(" escopo_atual=%q.", scope)
		}
		return fmt.Errorf("x media upload não autorizado (status=%d).%s Reconecte a conta X com media.write/tweet.write e confirme no Developer Portal que o app está com permissão 'Read and write'. detalhe: %s", status, scopeInfo, message)
	}

	return fmt.Errorf("x media upload failed: status=%d body=%s", status, message)
}

func (p *XPublisher) uploadXMediaOnce(ctx context.Context, endpoint, accessToken string, body *bytes.Buffer, contentType string) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body.Bytes()))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", contentType)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, err
	}
	return raw, resp.StatusCode, nil
}

func doJSONRequest(ctx context.Context, client HTTPDoer, method, url, bearer string, body interface{}, extraHeaders map[string]string) ([]byte, int, http.Header, error) {
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		encoded, err := json.Marshal(body)
		if err != nil {
			return nil, 0, nil, err
		}
		reader = bytes.NewReader(encoded)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, reader)
	if err != nil {
		return nil, 0, nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if strings.TrimSpace(bearer) != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, nil, err
	}
	defer resp.Body.Close()

	raw := new(bytes.Buffer)
	if _, err := raw.ReadFrom(resp.Body); err != nil {
		return nil, 0, nil, err
	}
	return raw.Bytes(), resp.StatusCode, resp.Header, nil
}

func doFormRequest(ctx context.Context, client HTTPDoer, method, url, bearer string, form map[string]string) ([]byte, int, http.Header, error) {
	values := make([]string, 0, len(form)+1)
	for k, v := range form {
		values = append(values, fmt.Sprintf("%s=%s", k, urlQueryEscape(v)))
	}
	values = append(values, fmt.Sprintf("access_token=%s", urlQueryEscape(bearer)))

	req, err := http.NewRequestWithContext(ctx, method, url, strings.NewReader(strings.Join(values, "&")))
	if err != nil {
		return nil, 0, nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, nil, err
	}
	defer resp.Body.Close()

	raw := new(bytes.Buffer)
	if _, err := raw.ReadFrom(resp.Body); err != nil {
		return nil, 0, nil, err
	}
	return raw.Bytes(), resp.StatusCode, resp.Header, nil
}

func urlQueryEscape(v string) string {
	replacer := strings.NewReplacer(
		"%", "%25",
		" ", "%20",
		"+", "%2B",
		"&", "%26",
		"=", "%3D",
		"?", "%3F",
		"#", "%23",
		"/", "%2F",
		":", "%3A",
	)
	return replacer.Replace(v)
}
