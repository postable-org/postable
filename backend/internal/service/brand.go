package service

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrBrandNotFound is returned when a brand is not found for the given user.
var ErrBrandNotFound = errors.New("brand not found")

// Brand represents the brand model at the service layer.
type Brand struct {
	ID          string `json:"id"`
	UserID      string `json:"user_id"`
	Niche       string `json:"niche"`
	City        string `json:"city"`
	State       string `json:"state"`
	ToneOfVoice string `json:"tone_of_voice"`
	ToneCustom  string `json:"tone_custom,omitempty"`
	CTAChannel  string `json:"cta_channel,omitempty"`
}

// BrandInput holds the fields for create/update operations at the service layer.
type BrandInput struct {
	Niche       string `json:"niche"`
	City        string `json:"city"`
	State       string `json:"state"`
	ToneOfVoice string `json:"tone_of_voice"`
	ToneCustom  string `json:"tone_custom,omitempty"`
	CTAChannel  string `json:"cta_channel,omitempty"`
}

// BrandService is the concrete implementation backed by PostgreSQL via pgxpool.
type BrandService struct {
	db *pgxpool.Pool
}

// NewBrandService creates a new BrandService. db may be nil in tests.
func NewBrandService(db *pgxpool.Pool) *BrandService {
	return &BrandService{db: db}
}

// Create inserts a new brand for the given user.
func (s *BrandService) Create(ctx context.Context, userID string, input BrandInput) (*Brand, error) {
	brand := &Brand{
		ID:          "generated-uuid", // TODO: use gen_random_uuid() via SQL
		UserID:      userID,
		Niche:       input.Niche,
		City:        input.City,
		State:       input.State,
		ToneOfVoice: input.ToneOfVoice,
		ToneCustom:  input.ToneCustom,
		CTAChannel:  input.CTAChannel,
	}

	if s.db == nil {
		return brand, nil
	}

	row := s.db.QueryRow(ctx,
		`INSERT INTO brands (user_id, niche, city, state, tone_of_voice, tone_custom, cta_channel)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, user_id, niche, city, state, tone_of_voice, tone_custom, cta_channel`,
		userID, input.Niche, input.City, input.State, input.ToneOfVoice, input.ToneCustom, input.CTAChannel,
	)
	return brand, row.Scan(&brand.ID, &brand.UserID, &brand.Niche, &brand.City, &brand.State,
		&brand.ToneOfVoice, &brand.ToneCustom, &brand.CTAChannel)
}

// GetByUserID retrieves the brand for the given user.
func (s *BrandService) GetByUserID(ctx context.Context, userID string) (*Brand, error) {
	if s.db == nil {
		return nil, ErrBrandNotFound
	}

	brand := &Brand{}
	err := s.db.QueryRow(ctx,
		`SELECT id, user_id, niche, city, state, tone_of_voice, tone_custom, cta_channel
		 FROM brands WHERE user_id = $1 LIMIT 1`,
		userID,
	).Scan(&brand.ID, &brand.UserID, &brand.Niche, &brand.City, &brand.State,
		&brand.ToneOfVoice, &brand.ToneCustom, &brand.CTAChannel)
	if err != nil {
		return nil, ErrBrandNotFound
	}
	return brand, nil
}

// Update modifies the brand belonging to the given user.
func (s *BrandService) Update(ctx context.Context, userID string, input BrandInput) (*Brand, error) {
	brand := &Brand{
		UserID:      userID,
		Niche:       input.Niche,
		City:        input.City,
		State:       input.State,
		ToneOfVoice: input.ToneOfVoice,
		ToneCustom:  input.ToneCustom,
		CTAChannel:  input.CTAChannel,
	}

	if s.db == nil {
		return brand, nil
	}

	err := s.db.QueryRow(ctx,
		`UPDATE brands SET niche=$2, city=$3, state=$4, tone_of_voice=$5, tone_custom=$6, cta_channel=$7
		 WHERE user_id=$1
		 RETURNING id, user_id, niche, city, state, tone_of_voice, tone_custom, cta_channel`,
		userID, input.Niche, input.City, input.State, input.ToneOfVoice, input.ToneCustom, input.CTAChannel,
	).Scan(&brand.ID, &brand.UserID, &brand.Niche, &brand.City, &brand.State,
		&brand.ToneOfVoice, &brand.ToneCustom, &brand.CTAChannel)
	if err != nil {
		return nil, ErrBrandNotFound
	}
	return brand, nil
}
