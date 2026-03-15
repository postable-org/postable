package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"postable/internal/service"
)

type AnalyticsServiceInterface interface {
	GetOverview(ctx context.Context, userID, rangeKey string, now time.Time) (*service.AnalyticsResponse, error)
}

type AnalyticsHandler struct {
	svc AnalyticsServiceInterface
}

func NewAnalyticsHandler(svc AnalyticsServiceInterface) *AnalyticsHandler {
	return &AnalyticsHandler{svc: svc}
}

func (h *AnalyticsHandler) Overview(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	resp, err := h.svc.GetOverview(r.Context(), userID, r.URL.Query().Get("range"), time.Now().UTC())
	if err != nil {
		if errors.Is(err, service.ErrInvalidAnalyticsRange) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		slog.Error("analytics overview failed", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load analytics"})
		return
	}

	writeJSON(w, http.StatusOK, resp)
}
