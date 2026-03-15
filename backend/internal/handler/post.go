package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"postable/internal/middleware"
	"postable/internal/service"
)

// PostServiceInterface defines the operations needed by the post handler and generate handler.
type PostServiceInterface interface {
	Create(ctx context.Context, userID, brandID string, contentJSON, trendContext []byte, platform string) (*service.Post, error)
	GetByID(ctx context.Context, id, userID string) (*service.Post, error)
	ListByUserID(ctx context.Context, userID string) ([]service.Post, error)
	UpdateStatus(ctx context.Context, id, userID, status string) (*service.Post, error)
	GetLastSelectedTheme(ctx context.Context, userID, brandID string) (string, error)
}

// PostHandler handles post-related HTTP requests.
type PostHandler struct {
	svc PostServiceInterface
}

type postInsightsResponse struct {
	PostID                string                 `json:"post_id"`
	SelectionMode         string                 `json:"selection_mode"`
	PrimaryGapTheme       string                 `json:"primary_gap_theme"`
	WhyNowSummary         string                 `json:"why_now_summary"`
	CompetitorsConsidered []string               `json:"competitors_considered"`
	KeySignals            postInsightsKeySignals `json:"key_signals"`
	ConfidenceBand        string                 `json:"confidence_band"`
	FallbackReason        string                 `json:"fallback_reason,omitempty"`
}

type postInsightsKeySignals struct {
	GapStrength   float64 `json:"gap_strength"`
	TrendMomentum float64 `json:"trend_momentum"`
	BrandFit      float64 `json:"brand_fit"`
}

type competitorGapAnalysisPayload struct {
	SelectionMode         string                 `json:"selection_mode"`
	PrimaryGapTheme       string                 `json:"primary_gap_theme"`
	WhyNowSummary         string                 `json:"why_now_summary"`
	CompetitorsConsidered []string               `json:"competitors_considered"`
	KeySignals            postInsightsKeySignals `json:"key_signals"`
	ConfidenceBand        string                 `json:"confidence_band"`
	FallbackReason        string                 `json:"fallback_reason"`
}

// NewPostHandler creates a new PostHandler with the given service.
func NewPostHandler(svc PostServiceInterface) *PostHandler {
	return &PostHandler{svc: svc}
}

// List handles GET /api/posts — returns all posts for the authenticated user.
func (h *PostHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		slog.Warn("post list: unauthorized")
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	posts, err := h.svc.ListByUserID(r.Context(), userID)
	if err != nil {
		slog.Error("post list: service error", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(posts)
}

// UpdateStatus handles PATCH /api/posts/{id}/status.
func (h *PostHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		slog.Warn("post update status: unauthorized")
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing post id"})
		return
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		slog.Warn("post update status: invalid body", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	post, err := h.svc.UpdateStatus(r.Context(), id, userID, body.Status)
	if err != nil {
		if errors.Is(err, service.ErrPostNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "post not found"})
			return
		}
		if errors.Is(err, service.ErrInvalidStatus) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		slog.Error("post update status: service error", "id", id, "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	slog.Info("post status updated", "id", id, "userID", userID, "status", body.Status)
	writeJSON(w, http.StatusOK, post)
}

// GetPostInsights handles GET /api/posts/{id}/insights.
func (h *PostHandler) GetPostInsights(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		slog.Warn("post insights: unauthorized")
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	// Analytics gating — requires Advanced or Agency plan
	sub, hasSub := middleware.SubscriptionFromContext(r.Context())
	if !hasSub || !service.PlanLimitsFor(sub.Plan).AnalyticsEnabled {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error":         "plan_upgrade_required",
			"required_plan": "advanced",
		})
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing post id"})
		return
	}

	post, err := h.svc.GetByID(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, service.ErrPostNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "post not found"})
			return
		}
		slog.Error("post insights: service error", "id", id, "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	resp, ok := buildInsightsResponse(post)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "insights not found"})
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func buildInsightsResponse(post *service.Post) (postInsightsResponse, bool) {
	if post == nil || len(post.TrendContext) == 0 {
		return postInsightsResponse{}, false
	}

	var trendContext map[string]json.RawMessage
	if err := json.Unmarshal(post.TrendContext, &trendContext); err != nil {
		return postInsightsResponse{}, false
	}

	analysisRaw, ok := trendContext["competitor_gap_analysis"]
	if !ok {
		analysisRaw = post.TrendContext
	}
	if len(analysisRaw) == 0 || string(analysisRaw) == "null" {
		return postInsightsResponse{}, false
	}

	var analysis competitorGapAnalysisPayload
	if err := json.Unmarshal(analysisRaw, &analysis); err != nil {
		return postInsightsResponse{}, false
	}
	if analysis.SelectionMode == "" {
		return postInsightsResponse{}, false
	}

	return postInsightsResponse{
		PostID:                post.ID,
		SelectionMode:         analysis.SelectionMode,
		PrimaryGapTheme:       analysis.PrimaryGapTheme,
		WhyNowSummary:         analysis.WhyNowSummary,
		CompetitorsConsidered: analysis.CompetitorsConsidered,
		KeySignals:            analysis.KeySignals,
		ConfidenceBand:        analysis.ConfidenceBand,
		FallbackReason:        analysis.FallbackReason,
	}, true
}
