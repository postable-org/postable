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

// GenerateHandler handles GET /api/generate SSE requests.
type GenerateHandler struct {
	svc      GenerateServiceInterface
	brandSvc BrandServiceInterface
	postSvc  PostServiceInterface
}

// NewGenerateHandler creates a new GenerateHandler.
func NewGenerateHandler(svc GenerateServiceInterface, brandSvc BrandServiceInterface, postSvc PostServiceInterface) *GenerateHandler {
	return &GenerateHandler{svc: svc, brandSvc: brandSvc, postSvc: postSvc}
}

// Generate handles GET /api/generate — streams SSE generation events.
func (h *GenerateHandler) Generate(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		slog.Warn("generate: unauthorized")
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	brand, err := h.brandSvc.GetByUserID(r.Context(), userID)
	if err != nil {
		slog.Info("generate: brand not found", "userID", userID)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "brand not found — create a brand first"})
		return
	}

	brandJSON, err := json.Marshal(brand)
	if err != nil {
		slog.Error("generate: failed to marshal brand", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to marshal brand"})
		return
	}

	slog.Info("generate: starting stream", "userID", userID)
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
		_, saveErr := h.postSvc.Create(saveCtx, userID, brand.ID, responseJSON, trendContextJSON)
		if saveErr != nil {
			slog.Error("generate: failed to save post", "userID", userID, "error", saveErr)
		} else {
			slog.Info("generate: post saved", "userID", userID)
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
