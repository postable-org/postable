package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"postable/internal/service"
)

type SocialOAuthServiceInterface interface {
	StartAuthorization(ctx context.Context, userID, network string) (string, error)
	HandleCallback(ctx context.Context, network, code, state string) (string, error)
	FrontendRedirect(network, status, message string) string
}

type SocialOAuthHandler struct {
	svc SocialOAuthServiceInterface
}

func NewSocialOAuthHandler(svc SocialOAuthServiceInterface) *SocialOAuthHandler {
	return &SocialOAuthHandler{svc: svc}
}

func (h *SocialOAuthHandler) Start(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	network := chi.URLParam(r, "network")
	authURL, err := h.svc.StartAuthorization(r.Context(), userID, network)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, service.ErrOAuthNotConfigured) {
			status = http.StatusNotImplemented
		}
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"auth_url": authURL})
}

func (h *SocialOAuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	network := chi.URLParam(r, "network")
	if providerError := r.URL.Query().Get("error"); providerError != "" {
		message := r.URL.Query().Get("error_description")
		if message == "" {
			message = providerError
		}
		http.Redirect(w, r, h.svc.FrontendRedirect(network, "error", message), http.StatusFound)
		return
	}
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	if code == "" || state == "" {
		http.Redirect(w, r, h.svc.FrontendRedirect(network, "error", "missing_oauth_code_or_state"), http.StatusFound)
		return
	}
	redirectURL, err := h.svc.HandleCallback(r.Context(), network, code, state)
	if err != nil {
		slog.Warn("social oauth callback failed", "network", network, "error", err)
	}
	http.Redirect(w, r, redirectURL, http.StatusFound)
}
