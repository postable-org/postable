package handler

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"postable/internal/service"
)

// GenerateServiceInterface defines the streaming generation contract.
// brandJSON is the pre-marshaled brand data to send to the Python agent.
type GenerateServiceInterface interface {
	StreamAndReturn(ctx context.Context, brandJSON string, w http.ResponseWriter) (responseJSON []byte, err error)
}

// StorageServiceInterface uploads image bytes and returns a public URL.
type StorageServiceInterface interface {
	UploadImage(ctx context.Context, userID string, imageBytes []byte, mimeType string) (string, error)
}

// CompetitorServiceForGenerateInterface provides competitor snapshots for the generate payload.
type CompetitorServiceForGenerateInterface interface {
	ActiveSnapshotsForGenerate(ctx context.Context, userID, brandID string) ([]json.RawMessage, error)
}

// QuotaChecker can check whether a user is allowed to generate a post for a given platform.
type QuotaChecker interface {
	CheckQuota(ctx context.Context, userID, platform string) (allowed bool, used, limit int, err error)
}

// generateBusinessProfile mirrors the Python schema's business_profile block.
type generateBusinessProfile struct {
	Niche                     string   `json:"niche"`
	City                      string   `json:"city"`
	State                     string   `json:"state"`
	Tone                      string   `json:"tone"`
	BrandIdentity             string   `json:"brand_identity"`
	AssetURLs                 []string `json:"asset_urls,omitempty"`
	BrandName                 string   `json:"brand_name,omitempty"`
	BrandTagline              string   `json:"brand_tagline,omitempty"`
	CompanyHistory            string   `json:"company_history,omitempty"`
	BrandValues               []string `json:"brand_values,omitempty"`
	BrandKeyPeople            []string `json:"brand_key_people,omitempty"`
	BrandColors               []string `json:"brand_colors,omitempty"`
	BrandFonts                []string `json:"brand_fonts,omitempty"`
	DesignStyle               string   `json:"design_style,omitempty"`
	TargetGender              string   `json:"target_gender,omitempty"`
	TargetAgeMin              int      `json:"target_age_min,omitempty"`
	TargetAgeMax              int      `json:"target_age_max,omitempty"`
	TargetAudienceDescription string   `json:"target_audience_description,omitempty"`
	BrandMustUse              string   `json:"brand_must_use,omitempty"`
	BrandMustAvoid            string   `json:"brand_must_avoid,omitempty"`
}

// generateCampaignBrief mirrors the Python schema's campaign_brief block.
type generateCampaignBrief struct {
	Goal           string  `json:"goal"`
	TargetAudience string  `json:"target_audience"`
	CTAChannel     string  `json:"cta_channel"`
	ThemeHint      *string `json:"theme_hint"`
}

// generatePayload is the enriched payload sent to the Python agent.
type generatePayload struct {
	BusinessProfile   generateBusinessProfile `json:"business_profile"`
	CompetitorHandles []string                `json:"competitor_handles"`
	PostHistory       []string                `json:"post_history"`
	CampaignBrief     generateCampaignBrief   `json:"campaign_brief"`
	Platform          string                  `json:"platform"`
	Placement         string                  `json:"placement,omitempty"`
}

var allowedPlatforms = map[string]bool{
	"instagram": true,
	"linkedin":  true,
	"facebook":  true,
	"x":         true,
}

// frontendBusinessProfile is the business_profile block from the frontend request body.
type frontendBusinessProfile struct {
	Niche         string   `json:"niche"`
	City          string   `json:"city"`
	State         string   `json:"state"`
	Tone          string   `json:"tone"`
	BrandIdentity string   `json:"brand_identity"`
	AssetURLs     []string `json:"asset_urls,omitempty"`
}

// frontendCampaignBrief is the campaign_brief block from the frontend request body.
type frontendCampaignBrief struct {
	Goal           string  `json:"goal"`
	TargetAudience string  `json:"target_audience"`
	CTAChannel     string  `json:"cta_channel"`
	ThemeHint      *string `json:"theme_hint"`
}

// frontendGenerateRequest is the POST body sent by the frontend.
type frontendGenerateRequest struct {
	BusinessProfile   frontendBusinessProfile `json:"business_profile"`
	CompetitorHandles []string                `json:"competitor_handles"`
	PostHistory       []string                `json:"post_history"`
	CampaignBrief     frontendCampaignBrief   `json:"campaign_brief"`
	Platform          string                  `json:"platform"`
	Placement         string                  `json:"placement,omitempty"`
}

// GenerateHandler handles POST /api/generate SSE requests.
type GenerateHandler struct {
	svc           GenerateServiceInterface
	brandSvc      BrandServiceInterface
	postSvc       PostServiceInterface
	competitorSvc CompetitorServiceForGenerateInterface
	subSvc        QuotaChecker
	storageSvc    StorageServiceInterface
}

// NewGenerateHandler creates a new GenerateHandler.
func NewGenerateHandler(svc GenerateServiceInterface, brandSvc BrandServiceInterface, postSvc PostServiceInterface, competitorSvc CompetitorServiceForGenerateInterface, storageSvc StorageServiceInterface) *GenerateHandler {
	return &GenerateHandler{svc: svc, brandSvc: brandSvc, postSvc: postSvc, competitorSvc: competitorSvc, storageSvc: storageSvc}
}

// NewGenerateHandlerWithQuota creates a GenerateHandler with quota checking.
func NewGenerateHandlerWithQuota(svc GenerateServiceInterface, brandSvc BrandServiceInterface, postSvc PostServiceInterface, competitorSvc CompetitorServiceForGenerateInterface, subSvc QuotaChecker, storageSvc StorageServiceInterface) *GenerateHandler {
	return &GenerateHandler{svc: svc, brandSvc: brandSvc, postSvc: postSvc, competitorSvc: competitorSvc, subSvc: subSvc, storageSvc: storageSvc}
}

// Generate handles POST /api/generate — streams SSE generation events.
func (h *GenerateHandler) Generate(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		slog.Warn("generate: unauthorized")
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	// Decode POST body
	var req frontendGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	platform := req.Platform
	if !allowedPlatforms[platform] {
		platform = "instagram"
	}

	// Quota check
	if h.subSvc != nil {
		allowed, used, limit, err := h.subSvc.CheckQuota(r.Context(), userID, platform)
		if err != nil {
			slog.Warn("generate: quota check failed", "userID", userID, "error", err)
			// On quota check failure, fall through (don't block generation)
		} else if !allowed {
			writeJSON(w, http.StatusTooManyRequests, map[string]any{
				"error":    "quota_exceeded",
				"used":     used,
				"limit":    limit,
				"platform": platform,
			})
			return
		}
	}

	brand, err := h.brandSvc.GetByUserID(r.Context(), userID)
	if err != nil {
		slog.Info("generate: brand not found", "userID", userID)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "brand not found — create a brand first"})
		return
	}

	// Fetch previous primary theme for soft rotation.
	var prevTheme string
	if h.postSvc != nil {
		prevTheme, err = h.postSvc.GetLastSelectedTheme(r.Context(), userID, brand.ID)
		if err != nil {
			slog.Warn("generate: failed to fetch previous theme", "userID", userID, "error", err)
			prevTheme = ""
		}
	}

	themeHint := req.CampaignBrief.ThemeHint
	if themeHint == nil && prevTheme != "" {
		themeHint = &prevTheme
	}

	toneStr := brand.ToneOfVoice
	if brand.ToneCustom != "" {
		toneStr = brand.ToneCustom
	}

	payload := generatePayload{
		BusinessProfile: generateBusinessProfile{
			Niche:                     brand.Niche,
			City:                      brand.City,
			State:                     brand.State,
			Tone:                      toneStr,
			BrandIdentity:             buildBrandIdentity(brand),
			AssetURLs:                 brand.AssetURLs,
			BrandName:                 brand.Name,
			BrandTagline:              brand.BrandTagline,
			CompanyHistory:            brand.CompanyHistory,
			BrandValues:               brand.BrandValues,
			BrandKeyPeople:            brand.BrandKeyPeople,
			BrandColors:               brand.BrandColors,
			BrandFonts:                brand.BrandFonts,
			DesignStyle:               brand.DesignStyle,
			TargetGender:              brand.TargetGender,
			TargetAgeMin:              brand.TargetAgeMin,
			TargetAgeMax:              brand.TargetAgeMax,
			TargetAudienceDescription: brand.TargetAudienceDescription,
			BrandMustUse:              brand.BrandMustUse,
			BrandMustAvoid:            brand.BrandMustAvoid,
		},
		CompetitorHandles: req.CompetitorHandles,
		PostHistory:       req.PostHistory,
		CampaignBrief: generateCampaignBrief{
			Goal:           req.CampaignBrief.Goal,
			TargetAudience: req.CampaignBrief.TargetAudience,
			CTAChannel:     brand.CTAChannel,
			ThemeHint:      themeHint,
		},
		Platform:  platform,
		Placement: req.Placement,
	}

	brandJSON, err := json.Marshal(payload)
	if err != nil {
		slog.Error("generate: failed to marshal payload", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to marshal payload"})
		return
	}

	slog.Info("generate: starting stream", "userID", userID, "platform", platform)
	responseJSON, streamErr := h.svc.StreamAndReturn(r.Context(), string(brandJSON), w)
	if streamErr != nil {
		slog.Warn("generate: stream ended with error", "userID", userID, "error", streamErr)
		return
	}

	// Use a background context for post-stream operations so they aren't cancelled
	// if the HTTP request context is already done.
	saveCtx := context.Background()

	// Process image: upload base64 to Supabase Storage and replace with public URL.
	finalJSON := responseJSON
	if responseJSON != nil && h.storageSvc != nil {
		processed, _, err := processAgentImage(saveCtx, responseJSON, h.storageSvc, userID)
		if err != nil {
			slog.Warn("generate: image processing failed, using original response", "userID", userID, "error", err)
		} else {
			finalJSON = processed
		}
	}

	// Send the done event with the (processed) final content. StreamAndReturn no longer
	// emits done, so the handler is responsible for sending it here.
	if flusher, ok := w.(http.Flusher); ok {
		if finalJSON != nil {
			fmt.Fprintf(w, "event: done\ndata: %s\n\n", finalJSON)
		} else {
			fmt.Fprintf(w, "event: done\ndata: null\n\n")
		}
		flusher.Flush()
	}

	if finalJSON != nil && h.postSvc != nil {
		trendContextJSON := extractTrendContextFromGenerateResponse(finalJSON)
		content, parseErr := parsePostContent(finalJSON)
		if parseErr != nil {
			slog.Warn("generate: failed to parse post content, skipping save", "userID", userID, "error", parseErr)
		} else {
			_, saveErr := h.postSvc.Create(saveCtx, userID, brand.ID, content, trendContextJSON, platform)
			if saveErr != nil {
				slog.Error("generate: failed to save post", "userID", userID, "error", saveErr)
			} else {
				slog.Info("generate: post saved", "userID", userID, "platform", platform)
			}
		}
	}
}

// buildBrandIdentity synthesizes a rich, structured brand identity string from all brand fields.
// This is passed to the AI agent as context so it can generate highly personalized posts.
func buildBrandIdentity(brand *service.Brand) string {
	var parts []string

	if brand.Name != "" {
		parts = append(parts, "EMPRESA: "+brand.Name)
	}
	if brand.Niche != "" {
		parts = append(parts, "SEGMENTO: "+brand.Niche)
	}
	if brand.BrandTagline != "" {
		parts = append(parts, "TAGLINE: "+brand.BrandTagline)
	}
	if brand.CompanyHistory != "" {
		parts = append(parts, "HISTÓRIA: "+brand.CompanyHistory)
	}
	if len(brand.BrandValues) > 0 {
		parts = append(parts, "VALORES: "+strings.Join(brand.BrandValues, ", "))
	}
	if len(brand.BrandKeyPeople) > 0 {
		parts = append(parts, "PESSOAS-CHAVE: "+strings.Join(brand.BrandKeyPeople, ", "))
	}
	if brand.TargetAudienceDescription != "" {
		parts = append(parts, "PÚBLICO-ALVO: "+brand.TargetAudienceDescription)
	}
	if brand.TargetGender != "" && brand.TargetGender != "all" {
		parts = append(parts, "GÊNERO DO PÚBLICO: "+brand.TargetGender)
	}
	if brand.TargetAgeMin > 0 || brand.TargetAgeMax > 0 {
		parts = append(parts, fmt.Sprintf("FAIXA ETÁRIA: %d–%d anos", brand.TargetAgeMin, brand.TargetAgeMax))
	}
	if len(brand.BrandColors) > 0 {
		parts = append(parts, "CORES DA MARCA: "+strings.Join(brand.BrandColors, ", "))
	}
	if len(brand.BrandFonts) > 0 {
		parts = append(parts, "FONTES: "+strings.Join(brand.BrandFonts, ", "))
	}
	if brand.DesignStyle != "" {
		parts = append(parts, "ESTILO VISUAL: "+brand.DesignStyle)
	}
	if brand.BrandMustUse != "" {
		parts = append(parts, "SEMPRE INCLUIR: "+brand.BrandMustUse)
	}
	if brand.BrandMustAvoid != "" {
		parts = append(parts, "NUNCA USAR: "+brand.BrandMustAvoid)
	}
	if brand.ContextJSON != "" {
		parts = append(parts, "ATUALIZAÇÕES: "+brand.ContextJSON)
	}

	if len(parts) == 0 {
		return brand.Name
	}
	return strings.Join(parts, "\n")
}

// processAgentImage detects image_base64 in responseJSON, uploads it to storage,
// and returns mutated JSON with image_url injected and base64 fields removed.
// If no image_base64 is present, returns responseJSON unchanged.
func processAgentImage(ctx context.Context, responseJSON []byte, storageSvc StorageServiceInterface, userID string) ([]byte, string, error) {
	var payload map[string]json.RawMessage
	if err := json.Unmarshal(responseJSON, &payload); err != nil {
		return responseJSON, "", nil
	}

	var imageBytes []byte
	mimeType := "image/jpeg"

	imageBase64Raw, hasBase64 := payload["image_base64"]
	if hasBase64 && len(imageBase64Raw) > 0 && string(imageBase64Raw) != "null" {
		var imageBase64 string
		if err := json.Unmarshal(imageBase64Raw, &imageBase64); err != nil || imageBase64 == "" {
			return responseJSON, "", nil
		}
		if mimeRaw, ok := payload["image_mime_type"]; ok {
			var mt string
			if err := json.Unmarshal(mimeRaw, &mt); err == nil && mt != "" {
				mimeType = mt
			}
		}
		// Strip whitespace/newlines — some encoders (e.g. Python's base64 module) wrap at 76 chars.
		imageBase64 = strings.ReplaceAll(imageBase64, "\n", "")
		imageBase64 = strings.ReplaceAll(imageBase64, "\r", "")
		imageBase64 = strings.ReplaceAll(imageBase64, " ", "")
		decoded, err := base64.StdEncoding.DecodeString(imageBase64)
		if err != nil {
			decoded, err = base64.RawStdEncoding.DecodeString(imageBase64)
			if err != nil {
				return responseJSON, "", fmt.Errorf("decode image_base64: %w", err)
			}
		}
		imageBytes = decoded
	} else {
		// Check if image_url is a data URL (data:{mime};base64,{b64})
		imageURLRaw, hasURL := payload["image_url"]
		if !hasURL || len(imageURLRaw) == 0 || string(imageURLRaw) == "null" {
			return responseJSON, "", nil
		}
		var imageURL string
		if err := json.Unmarshal(imageURLRaw, &imageURL); err != nil || imageURL == "" {
			return responseJSON, "", nil
		}
		if !strings.HasPrefix(imageURL, "data:") {
			return responseJSON, "", nil
		}
		// Parse: data:{mimeType};base64,{b64data}
		rest := strings.TrimPrefix(imageURL, "data:")
		semicolonIdx := strings.Index(rest, ";")
		if semicolonIdx < 0 {
			return responseJSON, "", fmt.Errorf("invalid data URL: missing semicolon")
		}
		mimeType = rest[:semicolonIdx]
		rest = rest[semicolonIdx+1:]
		commaIdx := strings.Index(rest, ",")
		if commaIdx < 0 {
			return responseJSON, "", fmt.Errorf("invalid data URL: missing comma")
		}
		b64 := rest[commaIdx+1:]
		b64 = strings.ReplaceAll(b64, "\n", "")
		b64 = strings.ReplaceAll(b64, "\r", "")
		b64 = strings.ReplaceAll(b64, " ", "")
		decoded, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			decoded, err = base64.RawStdEncoding.DecodeString(b64)
			if err != nil {
				return responseJSON, "", fmt.Errorf("decode data URL base64: %w", err)
			}
		}
		imageBytes = decoded
	}

	imageURL, err := storageSvc.UploadImage(ctx, userID, imageBytes, mimeType)
	if err != nil {
		return responseJSON, "", fmt.Errorf("upload image: %w", err)
	}

	delete(payload, "image_base64")
	delete(payload, "image_mime_type")
	imageURLJSON, _ := json.Marshal(imageURL)
	payload["image_url"] = imageURLJSON

	processed, err := json.Marshal(payload)
	if err != nil {
		return responseJSON, imageURL, fmt.Errorf("re-marshal payload: %w", err)
	}
	return processed, imageURL, nil
}

// parsePostContent unmarshals the agent response JSON into a PostContent struct.
func parsePostContent(data []byte) (service.PostContent, error) {
	var c service.PostContent
	if err := json.Unmarshal(data, &c); err != nil {
		return service.PostContent{}, fmt.Errorf("parse post content: %w", err)
	}
	return c, nil
}

func extractTrendContextFromGenerateResponse(responseJSON []byte) []byte {
	if len(responseJSON) == 0 {
		return nil
	}

	var payload map[string]json.RawMessage
	if err := json.Unmarshal(responseJSON, &payload); err != nil {
		return nil
	}

	// Try both field names: the agent may send "gap_analysis" or "competitor_gap_analysis".
	analysis, ok := payload["competitor_gap_analysis"]
	if !ok || len(analysis) == 0 || string(analysis) == "null" {
		analysis, ok = payload["gap_analysis"]
		if !ok || len(analysis) == 0 || string(analysis) == "null" {
			return nil
		}
	}

	trendContext, err := json.Marshal(map[string]json.RawMessage{
		"competitor_gap_analysis": analysis,
	})
	if err != nil {
		return nil
	}
	return trendContext
}
