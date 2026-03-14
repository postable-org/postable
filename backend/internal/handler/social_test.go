package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"

	"postable/internal/handler"
	"postable/internal/service"
)

type mockSocialService struct {
	submitFn func(ctx context.Context, userID string, in service.SocialPublishInput) (*service.SocialPostJob, error)
}

func (m *mockSocialService) UpsertConnection(ctx context.Context, userID string, in service.SocialConnectionInput) (*service.SocialConnection, error) {
	return &service.SocialConnection{}, nil
}

func (m *mockSocialService) ListConnections(ctx context.Context, userID string) ([]service.SocialConnection, error) {
	return []service.SocialConnection{}, nil
}

func (m *mockSocialService) SubmitPublish(ctx context.Context, userID string, in service.SocialPublishInput) (*service.SocialPostJob, error) {
	if m.submitFn != nil {
		return m.submitFn(ctx, userID, in)
	}
	return &service.SocialPostJob{ID: "job-1", Status: service.SocialJobQueued}, nil
}

func (m *mockSocialService) ListJobs(ctx context.Context, userID, status string) ([]service.SocialPostJob, error) {
	return []service.SocialPostJob{}, nil
}

func (m *mockSocialService) ProcessDueJobs(ctx context.Context, now time.Time, limit int) (int, error) {
	return 0, nil
}

func buildSocialRouter(svc handler.SocialServiceInterface) http.Handler {
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(jwtauth.Verifier(testTokenAuth))
		r.Use(jwtauth.Authenticator(testTokenAuth))

		h := handler.NewSocialHandler(svc)
		r.Post("/api/social/publish", h.Publish)
	})
	return r
}

func TestSocialPublish_Unauthorized(t *testing.T) {
	router := buildSocialRouter(&mockSocialService{})

	req := httptest.NewRequest(http.MethodPost, "/api/social/publish", bytes.NewBufferString(`{"network":"linkedin","text":"hello"}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}

func TestSocialPublish_ImmediateReturns200(t *testing.T) {
	router := buildSocialRouter(&mockSocialService{
		submitFn: func(ctx context.Context, userID string, in service.SocialPublishInput) (*service.SocialPostJob, error) {
			if in.Network != "linkedin" {
				t.Fatalf("expected network linkedin, got %q", in.Network)
			}
			return &service.SocialPostJob{ID: "job-now", Status: service.SocialJobPublished}, nil
		},
	})
	token := makeTestJWT(t, "user-abc")

	req := httptest.NewRequest(http.MethodPost, "/api/social/publish", bytes.NewBufferString(`{"network":"linkedin","text":"hello now"}`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rr.Code, rr.Body.String())
	}

	var body map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid response json: %v", err)
	}
	if body["mode"] != "published_now" {
		t.Fatalf("expected mode published_now, got %v", body["mode"])
	}
}

func TestSocialPublish_ScheduledReturns202(t *testing.T) {
	router := buildSocialRouter(&mockSocialService{
		submitFn: func(ctx context.Context, userID string, in service.SocialPublishInput) (*service.SocialPostJob, error) {
			return &service.SocialPostJob{ID: "job-scheduled", Status: service.SocialJobQueued}, nil
		},
	})
	token := makeTestJWT(t, "user-abc")

	publishAt := time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339)
	payload := `{"network":"x","text":"later","publish_at":"` + publishAt + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/social/publish", bytes.NewBufferString(payload))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d (body: %s)", rr.Code, rr.Body.String())
	}

	var body map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid response json: %v", err)
	}
	if body["mode"] != "scheduled" {
		t.Fatalf("expected mode scheduled, got %v", body["mode"])
	}
}
