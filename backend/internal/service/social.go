package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
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
	ErrInvalidNetwork        = errors.New("invalid network: must be linkedin, facebook, instagram, reddit, or x")
	ErrConnectionNotFound    = errors.New("social connection not found")
	ErrPublishPayloadInvalid = errors.New("publish payload must include text")
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
	Network      string     `json:"network"`
	ConnectionID string     `json:"connection_id,omitempty"`
	PostID       string     `json:"post_id,omitempty"`
	Title        string     `json:"title,omitempty"`
	Subreddit    string     `json:"subreddit,omitempty"`
	Text         string     `json:"text,omitempty"`
	Link         string     `json:"link,omitempty"`
	MediaURLs    []string   `json:"media_urls,omitempty"`
	PublishAt    *time.Time `json:"publish_at,omitempty"`
}

type SocialPublishPayload struct {
	Title     string   `json:"title,omitempty"`
	Subreddit string   `json:"subreddit,omitempty"`
	Text      string   `json:"text"`
	Link      string   `json:"link,omitempty"`
	MediaURLs []string `json:"media_urls,omitempty"`
	PostID    string   `json:"post_id,omitempty"`
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

type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

type SocialService struct {
	db         *pgxpool.Pool
	publishers map[string]SocialPublisher
}

func NewSocialService(db *pgxpool.Pool, publishers map[string]SocialPublisher) *SocialService {
	if publishers == nil {
		defaultClient := &http.Client{Timeout: 20 * time.Second}
		publishers = map[string]SocialPublisher{
			SocialNetworkLinkedIn:  NewLinkedInPublisher(defaultClient),
			SocialNetworkFacebook:  NewFacebookPublisher(defaultClient),
			SocialNetworkInstagram: NewInstagramPublisher(defaultClient),
			SocialNetworkReddit:    NewRedditPublisher(defaultClient),
			SocialNetworkX:         NewXPublisher(defaultClient),
		}
	}
	return &SocialService{db: db, publishers: publishers}
}

func IsValidSocialNetwork(network string) bool {
	switch strings.ToLower(strings.TrimSpace(network)) {
	case SocialNetworkLinkedIn, SocialNetworkFacebook, SocialNetworkInstagram, SocialNetworkReddit, SocialNetworkX:
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
		Title:     strings.TrimSpace(in.Title),
		Subreddit: normalizeSubreddit(in.Subreddit),
		Text:      strings.TrimSpace(in.Text),
		Link:      strings.TrimSpace(in.Link),
		MediaURLs: in.MediaURLs,
		PostID:    strings.TrimSpace(in.PostID),
	}

	var postIDPtr *string
	if payload.PostID != "" {
		pid := payload.PostID
		postIDPtr = &pid
	}

	if payload.Text == "" && payload.PostID != "" {
		var content json.RawMessage
		err := s.db.QueryRow(ctx, `
			SELECT content_json
			FROM generated_posts
			WHERE id = $1 AND user_id = $2
		`, payload.PostID, userID).Scan(&content)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return SocialPublishPayload{}, nil, ErrPostNotFound
			}
			return SocialPublishPayload{}, nil, err
		}
		text := extractPostText(content)
		if strings.TrimSpace(text) == "" {
			return SocialPublishPayload{}, nil, ErrPostTextNotFound
		}
		payload.Text = text
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

func normalizeSubreddit(v string) string {
	v = strings.TrimSpace(strings.ToLower(v))
	v = strings.TrimPrefix(v, "r/")
	v = strings.TrimPrefix(v, "/r/")
	return v
}

func extractPostText(content json.RawMessage) string {
	if len(content) == 0 {
		return ""
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(content, &body); err != nil {
		return ""
	}
	candidates := []string{"post_text", "text", "content"}
	for _, key := range candidates {
		raw, ok := body[key]
		if !ok {
			continue
		}
		var value string
		if err := json.Unmarshal(raw, &value); err == nil {
			value = strings.TrimSpace(value)
			if value != "" {
				return value
			}
		}
	}
	return ""
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
	body := map[string]interface{}{
		"author":         conn.AccountID,
		"lifecycleState": "PUBLISHED",
		"specificContent": map[string]interface{}{
			"com.linkedin.ugc.ShareContent": map[string]interface{}{
				"shareCommentary":    map[string]string{"text": payload.Text},
				"shareMediaCategory": "NONE",
			},
		},
		"visibility": map[string]string{
			"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
		},
	}
	if payload.Link != "" {
		body["specificContent"] = map[string]interface{}{
			"com.linkedin.ugc.ShareContent": map[string]interface{}{
				"shareCommentary":    map[string]string{"text": payload.Text},
				"shareMediaCategory": "ARTICLE",
				"media":              []interface{}{map[string]interface{}{"status": "READY", "originalUrl": payload.Link}},
			},
		}
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

// FacebookPublisher publishes to a Facebook Page feed.
type FacebookPublisher struct {
	client HTTPDoer
}

func NewFacebookPublisher(client HTTPDoer) *FacebookPublisher {
	return &FacebookPublisher{client: client}
}

func (p *FacebookPublisher) Publish(ctx context.Context, conn SocialConnection, payload SocialPublishPayload) (*PublishResult, error) {
	form := map[string]string{
		"message": payload.Text,
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
	url := fmt.Sprintf("https://graph.instagram.com/v25.0/%s/media_publish", conn.AccountID)
	raw, status, _, err := doJSONRequest(ctx, p.client, http.MethodPost, url, conn.AccessToken, publishBody, nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("instagram publish failed: status=%d body=%s", status, string(raw))
	}
	var parsed struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(raw, &parsed)
	return &PublishResult{ProviderPostID: parsed.ID, RawResponse: raw}, nil
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
		"caption":    payload.Text,
		"media_type": "CAROUSEL",
		"children":   strings.Join(children, ","),
	}
	url := fmt.Sprintf("https://graph.instagram.com/v25.0/%s/media", conn.AccountID)
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
		"caption": payload.Text,
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
	url := fmt.Sprintf("https://graph.instagram.com/v25.0/%s/media", conn.AccountID)
	raw, status, _, err := doJSONRequest(ctx, p.client, http.MethodPost, url, conn.AccessToken, body, nil)
	if err != nil {
		return "", err
	}
	if status < 200 || status >= 300 {
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

func (p *XPublisher) Publish(ctx context.Context, conn SocialConnection, payload SocialPublishPayload) (*PublishResult, error) {
	body := map[string]interface{}{"text": payload.Text}
	raw, status, _, err := doJSONRequest(ctx, p.client, http.MethodPost, "https://api.x.com/2/tweets", conn.AccessToken, body, nil)
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
