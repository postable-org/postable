package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
)

// GenerateServiceInterface defines the streaming generation contract.
// brandJSON is the pre-marshaled brand data to send to the Python agent.
type GenerateServiceInterface interface {
	StreamAndReturn(ctx context.Context, brandJSON string, w http.ResponseWriter) (responseJSON []byte, err error)
}

// CompetitorServiceForGenerateInterface provides competitor snapshots for the generate payload.
type CompetitorServiceForGenerateInterface interface {
	ActiveSnapshotsForGenerate(ctx context.Context, userID, brandID string) ([]json.RawMessage, error)
}

// QuotaChecker can check whether a user is allowed to generate a post for a given platform.
type QuotaChecker interface {
	CheckQuota(ctx context.Context, userID, platform string) (allowed bool, used, limit int, err error)
}

// generatePayload is the enriched payload sent to the Python agent.
type generatePayload struct {
	ID          string `json:"id"`
	UserID      string `json:"user_id"`
	Niche       string `json:"niche"`
	City        string `json:"city"`
	State       string `json:"state"`
	ToneOfVoice string `json:"tone_of_voice"`
	ToneCustom  string `json:"tone_custom,omitempty"`
	CTAChannel  string `json:"cta_channel,omitempty"`
	Platform    string `json:"platform,omitempty"`

	CompetitorSnapshots  []json.RawMessage `json:"competitor_snapshots"`
	LocalityBasis        string            `json:"locality_basis"`
	LocalityStateKey     string            `json:"locality_state_key"`
	PreviousPrimaryTheme string            `json:"previous_primary_theme,omitempty"`
}

var allowedPlatforms = map[string]bool{
	"instagram": true,
	"linkedin":  true,
	"facebook":  true,
	"x":         true,
	"reddit":    true,
}

// GenerateHandler handles GET /api/generate SSE requests.
type GenerateHandler struct {
	svc           GenerateServiceInterface
	brandSvc      BrandServiceInterface
	postSvc       PostServiceInterface
	competitorSvc CompetitorServiceForGenerateInterface
	subSvc        QuotaChecker
}

// NewGenerateHandler creates a new GenerateHandler.
func NewGenerateHandler(svc GenerateServiceInterface, brandSvc BrandServiceInterface, postSvc PostServiceInterface, competitorSvc CompetitorServiceForGenerateInterface) *GenerateHandler {
	return &GenerateHandler{svc: svc, brandSvc: brandSvc, postSvc: postSvc, competitorSvc: competitorSvc}
}

// NewGenerateHandlerWithQuota creates a GenerateHandler with quota checking.
func NewGenerateHandlerWithQuota(svc GenerateServiceInterface, brandSvc BrandServiceInterface, postSvc PostServiceInterface, competitorSvc CompetitorServiceForGenerateInterface, subSvc QuotaChecker) *GenerateHandler {
	return &GenerateHandler{svc: svc, brandSvc: brandSvc, postSvc: postSvc, competitorSvc: competitorSvc, subSvc: subSvc}
}

// Generate handles GET /api/generate — streams SSE generation events.
func (h *GenerateHandler) Generate(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		slog.Warn("generate: unauthorized")
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	// Read and validate platform param
	platform := r.URL.Query().Get("platform")
	if platform == "" {
		platform = "instagram"
	}
	if !allowedPlatforms[platform] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid platform"})
		return
	}

	// Quota check
	if h.subSvc != nil {
		allowed, used, limit, err := h.subSvc.CheckQuota(r.Context(), userID, platform)
		if err != nil {
			slog.Warn("generate: quota check failed", "userID", userID, "error", err)
			// On quota check failure, fall through (don't block generation)
		} else if !allowed {
			// Find period end from subscription context (best-effort)
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

	// Fetch competitor snapshots for gap analysis.
	var snapshots []json.RawMessage
	if h.competitorSvc != nil {
		snapshots, err = h.competitorSvc.ActiveSnapshotsForGenerate(r.Context(), userID, brand.ID)
		if err != nil {
			slog.Warn("generate: failed to fetch competitor snapshots", "userID", userID, "error", err)
			snapshots = []json.RawMessage{}
		}
	}
	if snapshots == nil {
		snapshots = []json.RawMessage{}
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

	payload := generatePayload{
		ID:                   brand.ID,
		UserID:               userID,
		Niche:                brand.Niche,
		City:                 brand.City,
		State:                brand.State,
		ToneOfVoice:          brand.ToneOfVoice,
		ToneCustom:           brand.ToneCustom,
		CTAChannel:           brand.CTAChannel,
		Platform:             platform,
		CompetitorSnapshots:  snapshots,
		LocalityBasis:        "state",
		LocalityStateKey:     brand.State,
		PreviousPrimaryTheme: prevTheme,
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

	if responseJSON != nil && h.postSvc != nil {
		trendContextJSON := extractTrendContextFromGenerateResponse(responseJSON)

		// Save the generated post to DB. Use a background context so DB write
		// isn't cancelled if the HTTP request context is already done.
		saveCtx := context.Background()
		_, saveErr := h.postSvc.Create(saveCtx, userID, brand.ID, responseJSON, trendContextJSON, platform)
		if saveErr != nil {
			slog.Error("generate: failed to save post", "userID", userID, "error", saveErr)
		} else {
			slog.Info("generate: post saved", "userID", userID, "platform", platform)
		}
	}
}

func extractTrendContextFromGenerateResponse(responseJSON []byte) []byte {
	if len(responseJSON) == 0 {
		return nil
	}

	var payload map[string]json.RawMessage
	if err := json.Unmarshal(responseJSON, &payload); err != nil {
		return nil
	}

	analysis, ok := payload["competitor_gap_analysis"]
	if !ok || len(analysis) == 0 || string(analysis) == "null" {
		return nil
	}

	trendContext, err := json.Marshal(map[string]json.RawMessage{
		"competitor_gap_analysis": analysis,
	})
	if err != nil {
		return nil
	}
	return trendContext
}
