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

// PostContent holds the structured fields of an AI-generated post.
type PostContent struct {
	PostText               string   `json:"post_text"`
	CTA                    string   `json:"cta"`
	Hashtags               []string `json:"hashtags"`
	SuggestedFormat        string   `json:"suggested_format"`
	StrategicJustification string   `json:"strategic_justification"`
	TokensUsed             int      `json:"tokens_used"`
	ImageURL               string   `json:"image_url,omitempty"`
	ImagePrompt            string   `json:"image_prompt,omitempty"`
}

// Post represents the post model at the service layer.
type Post struct {
	ID                     string          `json:"id"`
	UserID                 string          `json:"user_id"`
	BrandID                string          `json:"brand_id"`
	Status                 string          `json:"status"`
	Platform               string          `json:"platform"`
	PostText               string          `json:"post_text"`
	CTA                    string          `json:"cta"`
	Hashtags               []string        `json:"hashtags"`
	SuggestedFormat        string          `json:"suggested_format"`
	StrategicJustification string          `json:"strategic_justification"`
	TokensUsed             int             `json:"tokens_used"`
	ImageURL               string          `json:"image_url,omitempty"`
	ImagePrompt            string          `json:"image_prompt,omitempty"`
	TrendContext           json.RawMessage `json:"trend_context,omitempty"`
	CreatedAt              time.Time       `json:"created_at"`
	UpdatedAt              time.Time       `json:"updated_at"`
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

const postColumns = `id, user_id, brand_id, status, platform,
	COALESCE(post_text, ''), COALESCE(cta, ''), COALESCE(hashtags, ARRAY[]::TEXT[]),
	COALESCE(suggested_format, ''), COALESCE(strategic_justification, ''),
	COALESCE(tokens_used, 0), COALESCE(image_url, ''), COALESCE(image_prompt, ''),
	trend_context, created_at, updated_at`

func scanPost(row interface {
	Scan(dest ...any) error
}, p *Post) error {
	return row.Scan(
		&p.ID, &p.UserID, &p.BrandID, &p.Status, &p.Platform,
		&p.PostText, &p.CTA, &p.Hashtags, &p.SuggestedFormat, &p.StrategicJustification,
		&p.TokensUsed, &p.ImageURL, &p.ImagePrompt, &p.TrendContext,
		&p.CreatedAt, &p.UpdatedAt,
	)
}

// Create inserts a new post for the given user.
// If db is nil, returns a stub Post with ID="stub-id".
func (s *PostService) Create(ctx context.Context, userID, brandID string, content PostContent, trendContext []byte, platform string) (*Post, error) {
	if platform == "" {
		platform = "instagram"
	}
	if s.db == nil {
		return &Post{
			ID:                     "stub-id",
			UserID:                 userID,
			BrandID:                brandID,
			Status:                 "pending",
			Platform:               platform,
			PostText:               content.PostText,
			CTA:                    content.CTA,
			Hashtags:               content.Hashtags,
			SuggestedFormat:        content.SuggestedFormat,
			StrategicJustification: content.StrategicJustification,
			TokensUsed:             content.TokensUsed,
			ImageURL:               content.ImageURL,
			ImagePrompt:            content.ImagePrompt,
			TrendContext:           trendContext,
			CreatedAt:              time.Now(),
			UpdatedAt:              time.Now(),
		}, nil
	}

	hashtags := content.Hashtags
	if hashtags == nil {
		hashtags = []string{}
	}

	post := &Post{}
	row := s.db.QueryRow(ctx,
		`INSERT INTO generated_posts
		 (user_id, brand_id, status, platform,
		  post_text, cta, hashtags, suggested_format, strategic_justification,
		  tokens_used, image_url, image_prompt, trend_context)
		 VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		 RETURNING `+postColumns,
		userID, brandID, platform,
		content.PostText, content.CTA, hashtags, content.SuggestedFormat, content.StrategicJustification,
		content.TokensUsed, nullableStr(content.ImageURL), nullableStr(content.ImagePrompt), trendContext,
	)
	if err := scanPost(row, post); err != nil {
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
		`SELECT `+postColumns+` FROM generated_posts WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err := scanPost(row, post); err != nil {
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
		`SELECT `+postColumns+` FROM generated_posts WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []Post
	for rows.Next() {
		var p Post
		if err := scanPost(rows, &p); err != nil {
			return nil, err
		}
		if p.Hashtags == nil {
			p.Hashtags = []string{}
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
		 RETURNING `+postColumns,
		status, id, userID,
	)
	if err := scanPost(row, post); err != nil {
		return nil, ErrPostNotFound
	}
	return post, nil
}

// nullableStr returns nil for empty strings so they're stored as NULL in the DB.
func nullableStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
