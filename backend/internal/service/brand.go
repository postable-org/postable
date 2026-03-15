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

	// Visual identity
	BrandColors []string `json:"brand_colors,omitempty"`
	BrandFonts  []string `json:"brand_fonts,omitempty"`
	DesignStyle string   `json:"design_style,omitempty"`

	// Target audience
	TargetAgeMin              int    `json:"target_age_min,omitempty"`
	TargetAgeMax              int    `json:"target_age_max,omitempty"`
	TargetGender              string `json:"target_gender,omitempty"`
	TargetAudienceDescription string `json:"target_audience_description,omitempty"`

	// Brand identity
	CompanyHistory string   `json:"company_history,omitempty"`
	BrandTagline   string   `json:"brand_tagline,omitempty"`
	BrandValues    []string `json:"brand_values,omitempty"`
	BrandKeyPeople []string `json:"brand_key_people,omitempty"`

	// Communication rules
	BrandMustUse   string `json:"brand_must_use,omitempty"`
	BrandMustAvoid string `json:"brand_must_avoid,omitempty"`
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

	// Visual identity
	BrandColors []string `json:"brand_colors,omitempty"`
	BrandFonts  []string `json:"brand_fonts,omitempty"`
	DesignStyle string   `json:"design_style,omitempty"`

	// Target audience
	TargetAgeMin              int    `json:"target_age_min,omitempty"`
	TargetAgeMax              int    `json:"target_age_max,omitempty"`
	TargetGender              string `json:"target_gender,omitempty"`
	TargetAudienceDescription string `json:"target_audience_description,omitempty"`

	// Brand identity
	CompanyHistory string   `json:"company_history,omitempty"`
	BrandTagline   string   `json:"brand_tagline,omitempty"`
	BrandValues    []string `json:"brand_values,omitempty"`
	BrandKeyPeople []string `json:"brand_key_people,omitempty"`

	// Communication rules
	BrandMustUse   string `json:"brand_must_use,omitempty"`
	BrandMustAvoid string `json:"brand_must_avoid,omitempty"`
}

// BrandService is the concrete implementation backed by PostgreSQL via pgxpool.
type BrandService struct {
	db *pgxpool.Pool
}

// NewBrandService creates a new BrandService. db may be nil in tests.
func NewBrandService(db *pgxpool.Pool) *BrandService {
	return &BrandService{db: db}
}

// coalesceStrings ensures nil slices become empty slices before DB writes.
func coalesceStrings(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

// scanBrand scans a row into a Brand struct. Column order must match selectColumns.
func scanBrand(row interface {
	Scan(dest ...any) error
}, brand *Brand) error {
	return row.Scan(
		&brand.ID, &brand.UserID,
		&brand.Name, &brand.Niche, &brand.City, &brand.State,
		&brand.ToneOfVoice, &brand.ToneCustom, &brand.CTAChannel,
		&brand.ContextJSON, &brand.AssetURLs,
		&brand.BrandColors, &brand.BrandFonts, &brand.DesignStyle,
		&brand.TargetAgeMin, &brand.TargetAgeMax, &brand.TargetGender,
		&brand.CompanyHistory, &brand.BrandTagline,
		&brand.BrandValues, &brand.BrandKeyPeople,
		&brand.BrandMustUse, &brand.BrandMustAvoid,
		&brand.TargetAudienceDescription,
	)
}

// selectColumns is the canonical column list for SELECT / RETURNING queries.
const selectColumns = `
	id, user_id,
	COALESCE(name,''), niche, city, state, tone_of_voice,
	COALESCE(tone_custom,''), COALESCE(cta_channel,''), COALESCE(context_json,''), COALESCE(asset_urls,'{}'),
	COALESCE(brand_colors,'{}'), COALESCE(brand_fonts,'{}'), COALESCE(design_style,''),
	COALESCE(target_age_min,0), COALESCE(target_age_max,0), COALESCE(target_gender,'all'),
	COALESCE(company_history,''), COALESCE(brand_tagline,''),
	COALESCE(brand_values,'{}'), COALESCE(brand_key_people,'{}'),
	COALESCE(brand_must_use,''), COALESCE(brand_must_avoid,''),
	COALESCE(target_audience_description,'')`

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

	row := s.db.QueryRow(ctx,
		`INSERT INTO brands (
			user_id, name, niche, city, state, tone_of_voice, tone_custom, cta_channel, context_json, asset_urls,
			brand_colors, brand_fonts, design_style,
			target_age_min, target_age_max, target_gender,
			company_history, brand_tagline, brand_values, brand_key_people,
			brand_must_use, brand_must_avoid, target_audience_description
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13,
			$14, $15, $16,
			$17, $18, $19, $20,
			$21, $22, $23
		) RETURNING `+selectColumns,
		userID, input.Name, input.Niche, input.City, stateKey,
		input.ToneOfVoice, input.ToneCustom, input.CTAChannel, input.ContextJSON,
		coalesceStrings(input.AssetURLs),
		coalesceStrings(input.BrandColors), coalesceStrings(input.BrandFonts), input.DesignStyle,
		input.TargetAgeMin, input.TargetAgeMax, input.TargetGender,
		input.CompanyHistory, input.BrandTagline,
		coalesceStrings(input.BrandValues), coalesceStrings(input.BrandKeyPeople),
		input.BrandMustUse, input.BrandMustAvoid, input.TargetAudienceDescription,
	)
	return brand, scanBrand(row, brand)
}

// GetByUserID retrieves the brand for the given user.
func (s *BrandService) GetByUserID(ctx context.Context, userID string) (*Brand, error) {
	if s.db == nil {
		return nil, ErrBrandNotFound
	}

	brand := &Brand{}
	err := scanBrand(
		s.db.QueryRow(ctx,
			`SELECT `+selectColumns+` FROM brands WHERE user_id = $1 LIMIT 1`,
			userID,
		),
		brand,
	)
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

	err := scanBrand(
		s.db.QueryRow(ctx,
			`UPDATE brands SET
				name=$2, niche=$3, city=$4, state=$5, tone_of_voice=$6, tone_custom=$7,
				cta_channel=$8, context_json=$9, asset_urls=$10,
				brand_colors=$11, brand_fonts=$12, design_style=$13,
				target_age_min=$14, target_age_max=$15, target_gender=$16,
				company_history=$17, brand_tagline=$18, brand_values=$19, brand_key_people=$20,
				brand_must_use=$21, brand_must_avoid=$22, target_audience_description=$23
			WHERE user_id=$1
			RETURNING `+selectColumns,
			userID, input.Name, input.Niche, input.City, stateKey,
			input.ToneOfVoice, input.ToneCustom, input.CTAChannel, input.ContextJSON,
			coalesceStrings(input.AssetURLs),
			coalesceStrings(input.BrandColors), coalesceStrings(input.BrandFonts), input.DesignStyle,
			input.TargetAgeMin, input.TargetAgeMax, input.TargetGender,
			input.CompanyHistory, input.BrandTagline,
			coalesceStrings(input.BrandValues), coalesceStrings(input.BrandKeyPeople),
			input.BrandMustUse, input.BrandMustAvoid, input.TargetAudienceDescription,
		),
		brand,
	)
	if err != nil {
		return nil, ErrBrandNotFound
	}
	return brand, nil
}
