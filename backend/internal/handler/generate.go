package handler

import (
	"context"
	"encoding/json"
	"net/http"
)

// GenerateServiceInterface defines the streaming generation contract.
// brandJSON is the pre-marshaled brand data to send to the Python agent.
type GenerateServiceInterface interface {
	Stream(ctx context.Context, brandJSON string, w http.ResponseWriter)
}

// GenerateHandler handles GET /api/generate SSE requests.
type GenerateHandler struct {
	svc      GenerateServiceInterface
	brandSvc BrandServiceInterface
}

// NewGenerateHandler creates a new GenerateHandler.
func NewGenerateHandler(svc GenerateServiceInterface, brandSvc BrandServiceInterface) *GenerateHandler {
	return &GenerateHandler{svc: svc, brandSvc: brandSvc}
}

// Generate handles GET /api/generate — streams SSE generation events.
func (h *GenerateHandler) Generate(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	brand, err := h.brandSvc.GetByUserID(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "brand not found — create a brand first"})
		return
	}

	brandJSON, err := json.Marshal(brand)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to marshal brand"})
		return
	}

	h.svc.Stream(r.Context(), string(brandJSON), w)
}
