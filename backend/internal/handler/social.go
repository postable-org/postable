package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"postable/internal/service"
)

type SocialServiceInterface interface {
	UpsertConnection(ctx context.Context, userID string, in service.SocialConnectionInput) (*service.SocialConnection, error)
	ListConnections(ctx context.Context, userID string) ([]service.SocialConnection, error)
	DeleteConnection(ctx context.Context, userID, connectionID string) error
	SubmitPublish(ctx context.Context, userID string, in service.SocialPublishInput) (*service.SocialPostJob, error)
	ListJobs(ctx context.Context, userID, status string) ([]service.SocialPostJob, error)
	ProcessDueJobs(ctx context.Context, now time.Time, limit int) (int, error)
	FetchAndSaveInsights(ctx context.Context, userID string) (int, error)
}

type SocialHandler struct {
	svc SocialServiceInterface
}

func NewSocialHandler(svc SocialServiceInterface) *SocialHandler {
	return &SocialHandler{svc: svc}
}

func (h *SocialHandler) UpsertConnection(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input service.SocialConnectionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	conn, err := h.svc.UpsertConnection(r.Context(), userID, input)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidNetwork):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		default:
			slog.Error("social connection upsert failed", "userID", userID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return
	}

	writeJSON(w, http.StatusOK, conn)
}

func (h *SocialHandler) ListConnections(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	connections, err := h.svc.ListConnections(r.Context(), userID)
	if err != nil {
		slog.Error("social connection list failed", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if connections == nil {
		connections = []service.SocialConnection{}
	}
	writeJSON(w, http.StatusOK, connections)
}

func (h *SocialHandler) DeleteConnection(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	connectionID := chi.URLParam(r, "id")
	if connectionID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing connection id"})
		return
	}
	if err := h.svc.DeleteConnection(r.Context(), userID, connectionID); err != nil {
		if errors.Is(err, service.ErrConnectionNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "connection not found"})
			return
		}
		slog.Error("social connection delete failed", "userID", userID, "id", connectionID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *SocialHandler) Publish(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input service.SocialPublishInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	job, err := h.svc.SubmitPublish(r.Context(), userID, input)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidNetwork),
			errors.Is(err, service.ErrConnectionNotFound),
			errors.Is(err, service.ErrPublishPayloadInvalid),
			errors.Is(err, service.ErrPostTextNotFound),
			errors.Is(err, service.ErrPostNotFound):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		default:
			slog.Error("social publish submit failed", "userID", userID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return
	}

	if job.Status == service.SocialJobPublished {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"mode": "published_now",
			"job":  job,
		})
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]interface{}{
		"mode": "scheduled",
		"job":  job,
	})
}

func (h *SocialHandler) ListJobs(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	status := strings.TrimSpace(r.URL.Query().Get("status"))
	jobs, err := h.svc.ListJobs(r.Context(), userID, status)
	if err != nil {
		slog.Error("social jobs list failed", "userID", userID, "status", status, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if jobs == nil {
		jobs = []service.SocialPostJob{}
	}
	writeJSON(w, http.StatusOK, jobs)
}

func (h *SocialHandler) RunDueJobs(w http.ResponseWriter, r *http.Request) {
	_, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	processed, err := h.svc.ProcessDueJobs(r.Context(), time.Now().UTC(), 50)
	if err != nil {
		slog.Error("social run due jobs failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]int{"processed": processed})
}

func (h *SocialHandler) RefreshInsights(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	updated, err := h.svc.FetchAndSaveInsights(r.Context(), userID)
	if err != nil {
		slog.Error("social refresh insights failed", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]int{"updated": updated})
}
