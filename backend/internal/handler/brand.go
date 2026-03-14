package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/jwtauth/v5"
)

// ErrBrandNotFound is returned when a brand does not exist for the given user.
var ErrBrandNotFound = errors.New("brand not found")

// Brand represents the brand record returned to clients.
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

// BrandInput holds the request body fields for create/update operations.
type BrandInput struct {
	Niche       string `json:"niche"`
	City        string `json:"city"`
	State       string `json:"state"`
	ToneOfVoice string `json:"tone_of_voice"`
	ToneCustom  string `json:"tone_custom,omitempty"`
	CTAChannel  string `json:"cta_channel,omitempty"`
}

// BrandServiceInterface defines the operations needed by the brand handler.
type BrandServiceInterface interface {
	Create(ctx context.Context, userID string, input BrandInput) (*Brand, error)
	GetByUserID(ctx context.Context, userID string) (*Brand, error)
	Update(ctx context.Context, userID string, input BrandInput) (*Brand, error)
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
	_, claims, err := jwtauth.FromContext(r.Context())
	if err != nil {
		return "", false
	}
	sub, ok := claims["sub"].(string)
	return sub, ok && sub != ""
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
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input BrandInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	brand, err := h.svc.Create(r.Context(), userID, input)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, brand)
}

// Get handles GET /api/brands.
func (h *BrandHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	brand, err := h.svc.GetByUserID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrBrandNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "brand not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, brand)
}

// Update handles PUT /api/brands.
func (h *BrandHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input BrandInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	brand, err := h.svc.Update(r.Context(), userID, input)
	if err != nil {
		if errors.Is(err, ErrBrandNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "brand not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, brand)
}
