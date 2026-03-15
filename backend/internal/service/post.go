package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrPostNotFound is returned when a post is not found for the given id/user.
var ErrPostNotFound = errors.New("post not found")

// ErrInvalidStatus is returned when an invalid status is provided.
var ErrInvalidStatus = errors.New("invalid status: must be pending, approved, or rejected")

// Post represents the post model at the service layer.
type Post struct {
	ID           string          `json:"id"`
	UserID       string          `json:"user_id"`
	BrandID      string          `json:"brand_id"`
	Status       string          `json:"status"`
	Platform     string          `json:"platform"`
	ContentJSON  json.RawMessage `json:"content_json"`
	TrendContext json.RawMessage `json:"trend_context,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// PostService is the concrete implementation backed by PostgreSQL via pgxpool.
type PostService struct {
	db *pgxpool.Pool
}

// NewPostService creates a new PostService. db may be nil for stub/test mode.
func NewPostService(db *pgxpool.Pool) *PostService {
	return &PostService{db: db}
}

// validStatuses is the set of allowed status values.
var validStatuses = map[string]bool{
	"pending":  true,
	"approved": true,
	"rejected": true,
}

// Create inserts a new post for the given user.
// If db is nil, returns a stub Post with ID="stub-id".
func (s *PostService) Create(ctx context.Context, userID, brandID string, contentJSON, trendContext []byte, platform string) (*Post, error) {
	if platform == "" {
		platform = "instagram"
	}
	if s.db == nil {
		return &Post{
			ID:           "stub-id",
			UserID:       userID,
			BrandID:      brandID,
			Status:       "pending",
			Platform:     platform,
			ContentJSON:  contentJSON,
			TrendContext: trendContext,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}, nil
	}

	post := &Post{}
	row := s.db.QueryRow(ctx,
		`INSERT INTO generated_posts (user_id, brand_id, status, content_json, trend_context, platform)
		 VALUES ($1, $2, 'pending', $3, $4, $5)
		 RETURNING id, user_id, brand_id, status, platform, content_json, trend_context, created_at, updated_at`,
		userID, brandID, contentJSON, trendContext, platform,
	)
	err := row.Scan(&post.ID, &post.UserID, &post.BrandID, &post.Status, &post.Platform,
		&post.ContentJSON, &post.TrendContext, &post.CreatedAt, &post.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return post, nil
}

// GetByID retrieves a single post by id for the given user.
// Returns ErrPostNotFound if the post does not exist or belongs to a different user.
func (s *PostService) GetByID(ctx context.Context, id, userID string) (*Post, error) {
	if s.db == nil {
		return nil, ErrPostNotFound
	}

	post := &Post{}
	row := s.db.QueryRow(ctx,
		`SELECT id, user_id, brand_id, status, platform, content_json, trend_context, created_at, updated_at
		 FROM generated_posts WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	err := row.Scan(&post.ID, &post.UserID, &post.BrandID, &post.Status, &post.Platform,
		&post.ContentJSON, &post.TrendContext, &post.CreatedAt, &post.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPostNotFound
		}
		return nil, err
	}
	return post, nil
}

// ListByUserID retrieves all posts for the given user ordered by created_at DESC.
// Returns empty slice if db is nil.
func (s *PostService) ListByUserID(ctx context.Context, userID string) ([]Post, error) {
	if s.db == nil {
		return []Post{}, nil
	}

	rows, err := s.db.Query(ctx,
		`SELECT id, user_id, brand_id, status, platform, content_json, trend_context, created_at, updated_at
		 FROM generated_posts WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []Post
	for rows.Next() {
		var p Post
		if err := rows.Scan(&p.ID, &p.UserID, &p.BrandID, &p.Status, &p.Platform,
			&p.ContentJSON, &p.TrendContext, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}
	if posts == nil {
		posts = []Post{}
	}
	return posts, rows.Err()
}

// GetLastSelectedTheme reads the most recent selected_theme from trend_context for the given brand.
// Returns "", nil when db is nil, when no posts exist, or when the field is absent.
func (s *PostService) GetLastSelectedTheme(ctx context.Context, userID, brandID string) (string, error) {
	if s.db == nil {
		return "", nil
	}

	var theme *string
	err := s.db.QueryRow(ctx,
		`SELECT trend_context->'competitor_gap_analysis'->>'selected_theme'
		 FROM generated_posts
		 WHERE user_id=$1 AND brand_id=$2 AND trend_context IS NOT NULL
		 ORDER BY created_at DESC LIMIT 1`,
		userID, brandID,
	).Scan(&theme)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	if theme == nil {
		return "", nil
	}
	return *theme, nil
}

// UpdateStatus changes the status of a post belonging to the given user.
// Returns ErrPostNotFound if the post does not exist or belongs to a different user.
// Returns ErrInvalidStatus if the status value is not allowed.
func (s *PostService) UpdateStatus(ctx context.Context, id, userID, status string) (*Post, error) {
	if !validStatuses[status] {
		return nil, ErrInvalidStatus
	}

	if s.db == nil {
		return nil, ErrPostNotFound
	}

	post := &Post{}
	row := s.db.QueryRow(ctx,
		`UPDATE generated_posts SET status = $1, updated_at = now()
		 WHERE id = $2 AND user_id = $3
		 RETURNING id, user_id, brand_id, status, content_json, trend_context, created_at, updated_at`,
		status, id, userID,
	)
	err := row.Scan(&post.ID, &post.UserID, &post.BrandID, &post.Status,
		&post.ContentJSON, &post.TrendContext, &post.CreatedAt, &post.UpdatedAt)
	if err != nil {
		return nil, ErrPostNotFound
	}
	return post, nil
}
