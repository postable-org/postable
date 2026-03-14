package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"postable/internal/service"
)

// CompetitorServiceInterface defines competitor management capabilities.
type CompetitorServiceInterface interface {
	List(ctx context.Context, userID, brandID, stateCode string) (service.CompetitorListResponse, error)
	ApplyOperations(ctx context.Context, userID, brandID, stateCode string, ops []service.CompetitorOperation) (service.CompetitorUpdateResponse, error)
}

// CompetitorHandler handles authenticated competitor endpoints.
type CompetitorHandler struct {
	svc      CompetitorServiceInterface
	brandSvc BrandServiceInterface
}

// NewCompetitorHandler creates a competitor handler.
func NewCompetitorHandler(svc CompetitorServiceInterface, brandSvc BrandServiceInterface) *CompetitorHandler {
	return &CompetitorHandler{svc: svc, brandSvc: brandSvc}
}

// List handles GET /api/competitors.
func (h *CompetitorHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		slog.Warn("competitor list: unauthorized")
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	brand, err := h.brandSvc.GetByUserID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrBrandNotFound) || errors.Is(err, service.ErrBrandNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "brand not found"})
			return
		}
		slog.Error("competitor list: brand lookup failed", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to resolve brand"})
		return
	}

	resp, err := h.svc.List(r.Context(), userID, brand.ID, brand.State)
	if err != nil {
		if errors.Is(err, service.ErrMissingStateLocality) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		slog.Error("competitor list: service failed", "userID", userID, "brandID", brand.ID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list competitors"})
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// Upsert handles PUT /api/competitors.
func (h *CompetitorHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		slog.Warn("competitor upsert: unauthorized")
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var req struct {
		Ops []service.CompetitorOperation `json:"ops"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		slog.Warn("competitor upsert: invalid body", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	brand, err := h.brandSvc.GetByUserID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrBrandNotFound) || errors.Is(err, service.ErrBrandNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "brand not found"})
			return
		}
		slog.Error("competitor upsert: brand lookup failed", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to resolve brand"})
		return
	}

	resp, err := h.svc.ApplyOperations(r.Context(), userID, brand.ID, brand.State, req.Ops)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrMissingStateLocality),
			errors.Is(err, service.ErrInvalidCompetitorOperation),
			errors.Is(err, service.ErrHandleRequired):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		default:
			slog.Error("competitor upsert: service failed", "userID", userID, "brandID", brand.ID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update competitors"})
		}
		return
	}

	writeJSON(w, http.StatusOK, resp)
}
