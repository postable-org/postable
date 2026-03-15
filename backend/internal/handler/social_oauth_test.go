package handler_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"

	"postable/internal/handler"
	"postable/internal/service"
)

type mockSocialOAuthService struct {
	startFn            func(ctx context.Context, userID, network string) (string, error)
	handleCallbackFn   func(ctx context.Context, network, code, state string) (string, error)
	frontendRedirectFn func(network, status, message string) string
}

func (m *mockSocialOAuthService) StartAuthorization(ctx context.Context, userID, network string) (string, error) {
	if m.startFn != nil {
		return m.startFn(ctx, userID, network)
	}
	return "https://example.com/oauth", nil
}

func (m *mockSocialOAuthService) HandleCallback(ctx context.Context, network, code, state string) (string, error) {
	if m.handleCallbackFn != nil {
		return m.handleCallbackFn(ctx, network, code, state)
	}
	return "http://localhost:3000/social?status=success&message=ok", nil
}

func (m *mockSocialOAuthService) FrontendRedirect(network, status, message string) string {
	if m.frontendRedirectFn != nil {
		return m.frontendRedirectFn(network, status, message)
	}
	return "http://localhost:3000/social?status=" + status + "&message=" + message + "&network=" + network
}

func buildSocialOAuthRouter(svc handler.SocialOAuthServiceInterface) http.Handler {
	r := chi.NewRouter()
	r.Get("/api/social/oauth/{network}/callback", handler.NewSocialOAuthHandler(svc).Callback)
	r.Group(func(r chi.Router) {
		r.Use(jwtauth.Verifier(testTokenAuth))
		r.Use(jwtauth.Authenticator(testTokenAuth))
		r.Get("/api/social/oauth/{network}/start", handler.NewSocialOAuthHandler(svc).Start)
	})
	return r
}

func TestSocialOAuthStart_Unauthorized(t *testing.T) {
	router := buildSocialOAuthRouter(&mockSocialOAuthService{})
	req := httptest.NewRequest(http.MethodGet, "/api/social/oauth/linkedin/start", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}

func TestSocialOAuthStart_ReturnsAuthURL(t *testing.T) {
	router := buildSocialOAuthRouter(&mockSocialOAuthService{
		startFn: func(ctx context.Context, userID, network string) (string, error) {
			if userID != "user-abc" {
				t.Fatalf("expected user-abc, got %q", userID)
			}
			if network != "linkedin" {
				t.Fatalf("expected linkedin, got %q", network)
			}
			return "https://accounts.example.com/linkedin", nil
		},
	})
	token := makeTestJWT(t, "user-abc")
	req := httptest.NewRequest(http.MethodGet, "/api/social/oauth/linkedin/start", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json body: %v", err)
	}
	if body["auth_url"] != "https://accounts.example.com/linkedin" {
		t.Fatalf("unexpected auth_url: %q", body["auth_url"])
	}
}

func TestSocialOAuthCallback_ProviderErrorRedirectsToFrontend(t *testing.T) {
	router := buildSocialOAuthRouter(&mockSocialOAuthService{
		frontendRedirectFn: func(network, status, message string) string {
			if network != "reddit" || status != "error" || message != "access_denied" {
				t.Fatalf("unexpected redirect args: %q %q %q", network, status, message)
			}
			return "http://localhost:3000/social?network=reddit&status=error&message=access_denied"
		},
	})
	req := httptest.NewRequest(http.MethodGet, "/api/social/oauth/reddit/callback?error=access_denied", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("network", "reddit")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	rr := httptest.NewRecorder()

	handler.NewSocialOAuthHandler(&mockSocialOAuthService{
		frontendRedirectFn: func(network, status, message string) string {
			if network != "reddit" || status != "error" || message != "access_denied" {
				t.Fatalf("unexpected redirect args: %q %q %q", network, status, message)
			}
			return "http://localhost:3000/social?network=reddit&status=error&message=access_denied"
		},
	}).Callback(rr, req)

	if rr.Code != http.StatusFound {
		t.Fatalf("expected 302, got %d", rr.Code)
	}
	if location := rr.Header().Get("Location"); location != "http://localhost:3000/social?network=reddit&status=error&message=access_denied" {
		t.Fatalf("unexpected location: %q", location)
	}
	_ = router
}

func TestSocialOAuthCallback_MissingCodeRedirectsToFrontend(t *testing.T) {
	service := &mockSocialOAuthService{
		frontendRedirectFn: func(network, status, message string) string {
			if network != "linkedin" || status != "error" || message != "missing_oauth_code_or_state" {
				t.Fatalf("unexpected redirect args: %q %q %q", network, status, message)
			}
			return "http://localhost:3000/social?network=linkedin&status=error&message=missing_oauth_code_or_state"
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/api/social/oauth/linkedin/callback?state=abc", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("network", "linkedin")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	rr := httptest.NewRecorder()

	handler.NewSocialOAuthHandler(service).Callback(rr, req)

	if rr.Code != http.StatusFound {
		t.Fatalf("expected 302, got %d", rr.Code)
	}
	if location := rr.Header().Get("Location"); location != "http://localhost:3000/social?network=linkedin&status=error&message=missing_oauth_code_or_state" {
		t.Fatalf("unexpected location: %q", location)
	}
}

func TestSocialOAuthCallback_UsesServiceRedirect(t *testing.T) {
	service := &mockSocialOAuthService{
		handleCallbackFn: func(ctx context.Context, network, code, state string) (string, error) {
			if network != "facebook" || code != "abc" || state != "signed-state" {
				t.Fatalf("unexpected callback args: %q %q %q", network, code, state)
			}
			return "http://localhost:3000/social?network=facebook&status=success&message=ok", nil
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/api/social/oauth/facebook/callback?code=abc&state=signed-state", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("network", "facebook")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	rr := httptest.NewRecorder()

	handler.NewSocialOAuthHandler(service).Callback(rr, req)

	if rr.Code != http.StatusFound {
		t.Fatalf("expected 302, got %d", rr.Code)
	}
	if location := rr.Header().Get("Location"); location != "http://localhost:3000/social?network=facebook&status=success&message=ok" {
		t.Fatalf("unexpected location: %q", location)
	}
}

func TestSocialOAuthStart_NotConfiguredReturns501(t *testing.T) {
	router := buildSocialOAuthRouter(&mockSocialOAuthService{
		startFn: func(ctx context.Context, userID, network string) (string, error) {
			return "", fmt.Errorf("linkedin oauth is not configured; set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET: %w", service.ErrOAuthNotConfigured)
		},
	})
	token := makeTestJWT(t, "user-abc")
	req := httptest.NewRequest(http.MethodGet, "/api/social/oauth/linkedin/start", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501 for wrapped oauth-not-configured error, got %d", rr.Code)
	}
}
