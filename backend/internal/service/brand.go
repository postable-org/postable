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
	ID          string   `json:"id"`
	UserID      string   `json:"user_id"`
	Name        string   `json:"name,omitempty"`
	Niche       string   `json:"niche"`
	City        string   `json:"city"`
	State       string   `json:"state"`
	ToneOfVoice string   `json:"tone_of_voice"`
	ToneCustom  string   `json:"tone_custom,omitempty"`
	CTAChannel  string   `json:"cta_channel,omitempty"`
	ContextJSON string   `json:"context_json,omitempty"`
	AssetURLs   []string `json:"asset_urls,omitempty"`
}

// StateLocalityKey returns the normalized state key used for competitor locality.
func (b *Brand) StateLocalityKey() string {
	return NormalizeStateKey(b.State)
}

// BrandInput holds the fields for create/update operations at the service layer.
type BrandInput struct {
	Name        string   `json:"name,omitempty"`
	Niche       string   `json:"niche"`
	City        string   `json:"city"`
	State       string   `json:"state"`
	ToneOfVoice string   `json:"tone_of_voice"`
	ToneCustom  string   `json:"tone_custom,omitempty"`
	CTAChannel  string   `json:"cta_channel,omitempty"`
	ContextJSON string   `json:"context_json,omitempty"`
	AssetURLs   []string `json:"asset_urls,omitempty"`
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
	stateKey := NormalizeStateKey(input.State)
	brand := &Brand{
		ID:          "generated-uuid", // TODO: use gen_random_uuid() via SQL
		UserID:      userID,
		Niche:       input.Niche,
		City:        input.City,
		State:       stateKey,
		ToneOfVoice: input.ToneOfVoice,
		ToneCustom:  input.ToneCustom,
		CTAChannel:  input.CTAChannel,
	}

	if s.db == nil {
		return brand, nil
	}

	assetURLs := input.AssetURLs
	if assetURLs == nil {
		assetURLs = []string{}
	}
	row := s.db.QueryRow(ctx,
		`INSERT INTO brands (user_id, name, niche, city, state, tone_of_voice, tone_custom, cta_channel, context_json, asset_urls)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 RETURNING id, user_id, COALESCE(name,''), niche, city, state, tone_of_voice, COALESCE(tone_custom,''), COALESCE(cta_channel,''), COALESCE(context_json,''), COALESCE(asset_urls, '{}')`,
		userID, input.Name, input.Niche, input.City, stateKey, input.ToneOfVoice, input.ToneCustom, input.CTAChannel, input.ContextJSON, assetURLs,
	)
	return brand, row.Scan(&brand.ID, &brand.UserID, &brand.Name, &brand.Niche, &brand.City, &brand.State,
		&brand.ToneOfVoice, &brand.ToneCustom, &brand.CTAChannel, &brand.ContextJSON, &brand.AssetURLs)
}

// GetByUserID retrieves the brand for the given user.
func (s *BrandService) GetByUserID(ctx context.Context, userID string) (*Brand, error) {
	if s.db == nil {
		return nil, ErrBrandNotFound
	}

	brand := &Brand{}
	err := s.db.QueryRow(ctx,
		`SELECT id, user_id, COALESCE(name,''), niche, city, state, tone_of_voice, COALESCE(tone_custom,''), COALESCE(cta_channel,''), COALESCE(context_json,''), COALESCE(asset_urls, '{}')
		 FROM brands WHERE user_id = $1 LIMIT 1`,
		userID,
	).Scan(&brand.ID, &brand.UserID, &brand.Name, &brand.Niche, &brand.City, &brand.State,
		&brand.ToneOfVoice, &brand.ToneCustom, &brand.CTAChannel, &brand.ContextJSON, &brand.AssetURLs)
	if err != nil {
		return nil, ErrBrandNotFound
	}
	return brand, nil
}

// Update modifies the brand belonging to the given user.
func (s *BrandService) Update(ctx context.Context, userID string, input BrandInput) (*Brand, error) {
	stateKey := NormalizeStateKey(input.State)
	brand := &Brand{
		UserID:      userID,
		Niche:       input.Niche,
		City:        input.City,
		State:       stateKey,
		ToneOfVoice: input.ToneOfVoice,
		ToneCustom:  input.ToneCustom,
		CTAChannel:  input.CTAChannel,
	}

	if s.db == nil {
		return brand, nil
	}

	updateAssetURLs := input.AssetURLs
	if updateAssetURLs == nil {
		updateAssetURLs = []string{}
	}
	err := s.db.QueryRow(ctx,
		`UPDATE brands SET name=$2, niche=$3, city=$4, state=$5, tone_of_voice=$6, tone_custom=$7, cta_channel=$8, context_json=$9, asset_urls=$10
		 WHERE user_id=$1
		 RETURNING id, user_id, COALESCE(name,''), niche, city, state, tone_of_voice, COALESCE(tone_custom,''), COALESCE(cta_channel,''), COALESCE(context_json,''), COALESCE(asset_urls, '{}')`,
		userID, input.Name, input.Niche, input.City, stateKey, input.ToneOfVoice, input.ToneCustom, input.CTAChannel, input.ContextJSON, updateAssetURLs,
	).Scan(&brand.ID, &brand.UserID, &brand.Name, &brand.Niche, &brand.City, &brand.State,
		&brand.ToneOfVoice, &brand.ToneCustom, &brand.CTAChannel, &brand.ContextJSON, &brand.AssetURLs)
	if err != nil {
		return nil, ErrBrandNotFound
	}
	return brand, nil
}
