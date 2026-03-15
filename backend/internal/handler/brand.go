package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"postable/internal/middleware"
	"postable/internal/service"
)

// ErrBrandNotFound aliases the service sentinel so handler checks work correctly.
var ErrBrandNotFound = service.ErrBrandNotFound

// BrandServiceInterface defines the operations needed by the brand handler.
type BrandServiceInterface interface {
	Create(ctx context.Context, userID string, input service.BrandInput) (*service.Brand, error)
	GetByUserID(ctx context.Context, userID string) (*service.Brand, error)
	Update(ctx context.Context, userID string, input service.BrandInput) (*service.Brand, error)
}

// BrandHandler handles brand-related HTTP requests.
type BrandHandler struct {
	svc BrandServiceInterface
}

// NewBrandHandler creates a new BrandHandler with the given service.
func NewBrandHandler(svc BrandServiceInterface) *BrandHandler {
	return &BrandHandler{svc: svc}
}

// getUserID extracts the user ID from the JWT claims in the request context.
func getUserID(r *http.Request) (string, bool) {
	userID, err := middleware.GetUserID(r)
	if err != nil {
		return "", false
	}
	return userID, userID != ""
}

// writeJSON writes a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// Create handles POST /api/brands.
func (h *BrandHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		slog.Warn("brand create: unauthorized")
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input service.BrandInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		slog.Warn("brand create: invalid request body", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	input.State = service.NormalizeStateKey(input.State)

	brand, err := h.svc.Create(r.Context(), userID, input)
	if err != nil {
		slog.Error("brand create: service error", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	slog.Info("brand created", "userID", userID, "brandID", brand.ID)
	writeJSON(w, http.StatusCreated, brand)
}

// Get handles GET /api/brands.
func (h *BrandHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		slog.Warn("brand get: unauthorized")
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	brand, err := h.svc.GetByUserID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, service.ErrBrandNotFound) {
			slog.Info("brand get: not found", "userID", userID)
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "brand not found"})
			return
		}
		slog.Error("brand get: service error", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, brand)
}

// Update handles PUT /api/brands.
func (h *BrandHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		slog.Warn("brand update: unauthorized")
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input service.BrandInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		slog.Warn("brand update: invalid request body", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	input.State = service.NormalizeStateKey(input.State)

	brand, err := h.svc.Update(r.Context(), userID, input)
	if err != nil {
		if errors.Is(err, service.ErrBrandNotFound) {
			slog.Info("brand update: not found", "userID", userID)
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "brand not found"})
			return
		}
		slog.Error("brand update: service error", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	slog.Info("brand updated", "userID", userID, "brandID", brand.ID)
	writeJSON(w, http.StatusOK, brand)
}
