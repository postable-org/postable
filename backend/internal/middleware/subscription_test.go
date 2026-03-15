package middleware_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"

	"postable/internal/middleware"
	"postable/internal/service"
)

var testTokenAuthMW *jwtauth.JWTAuth

func TestMain(m *testing.M) {
	os.Setenv("SUPABASE_JWT_SECRET", "test-secret")
	testTokenAuthMW = jwtauth.New("HS256", []byte("test-secret"), nil)
	os.Exit(m.Run())
}

func makeTestJWTMW(t *testing.T, userID string) string {
	t.Helper()
	_, tokenString, err := testTokenAuthMW.Encode(map[string]any{
		"sub": userID,
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatalf("failed to create test JWT: %v", err)
	}
	return tokenString
}

// mockSubService implements middleware.SubscriptionServiceInterface.
type mockSubService struct {
	sub *service.Subscription
	err error
}

func (m *mockSubService) GetByUserID(_ context.Context, _ string) (*service.Subscription, error) {
	return m.sub, m.err
}

// okHandler returns 200 OK and writes the plan from context if available.
var okHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	sub, ok := middleware.SubscriptionFromContext(r.Context())
	if ok {
		json.NewEncoder(w).Encode(map[string]string{"plan": sub.Plan, "status": sub.Status})
	}
})

func buildSubRouter(subSvc middleware.SubscriptionServiceInterface) http.Handler {
	r := chi.NewRouter()
	r.Use(jwtauth.Verifier(testTokenAuthMW))
	r.Use(jwtauth.Authenticator(testTokenAuthMW))
	r.With(middleware.RequireActiveSubscription(subSvc)).Get("/protected", okHandler)
	return r
}

func makeAuthRequest(t *testing.T, userID string) *http.Request {
	t.Helper()
	token := makeTestJWTMW(t, userID)
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	return req
}

func TestRequireActiveSubscription_NoSubscription(t *testing.T) {
	svc := &mockSubService{err: service.ErrNoSubscription}
	router := buildSubRouter(svc)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, makeAuthRequest(t, "user-1"))

	if rr.Code != http.StatusPaymentRequired {
		t.Errorf("expected 402, got %d", rr.Code)
	}

	var body map[string]any
	json.NewDecoder(rr.Body).Decode(&body)
	if body["error"] != "subscription_required" {
		t.Errorf("expected subscription_required error, got %v", body["error"])
	}
}

func TestRequireActiveSubscription_CanceledStatus(t *testing.T) {
	svc := &mockSubService{sub: &service.Subscription{Plan: "basic", Status: "canceled"}}
	router := buildSubRouter(svc)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, makeAuthRequest(t, "user-1"))

	if rr.Code != http.StatusPaymentRequired {
		t.Errorf("expected 402, got %d", rr.Code)
	}

	var body map[string]any
	json.NewDecoder(rr.Body).Decode(&body)
	if body["error"] != "subscription_inactive" {
		t.Errorf("expected subscription_inactive error, got %v", body["error"])
	}
}

func TestRequireActiveSubscription_UnpaidStatus(t *testing.T) {
	svc := &mockSubService{sub: &service.Subscription{Plan: "basic", Status: "unpaid"}}
	router := buildSubRouter(svc)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, makeAuthRequest(t, "user-1"))

	if rr.Code != http.StatusPaymentRequired {
		t.Errorf("expected 402, got %d", rr.Code)
	}

	var body map[string]any
	json.NewDecoder(rr.Body).Decode(&body)
	if body["error"] != "subscription_inactive" {
		t.Errorf("expected subscription_inactive error, got %v", body["error"])
	}
}

func TestRequireActiveSubscription_ActivePassesThrough(t *testing.T) {
	svc := &mockSubService{sub: &service.Subscription{Plan: "advanced", Status: "active"}}
	router := buildSubRouter(svc)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, makeAuthRequest(t, "user-1"))

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestRequireActiveSubscription_PastDuePassesThrough(t *testing.T) {
	svc := &mockSubService{sub: &service.Subscription{Plan: "basic", Status: "past_due"}}
	router := buildSubRouter(svc)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, makeAuthRequest(t, "user-1"))

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 for past_due, got %d", rr.Code)
	}
}

func TestRequireActiveSubscription_TrialingPassesThrough(t *testing.T) {
	svc := &mockSubService{sub: &service.Subscription{Plan: "basic", Status: "trialing"}}
	router := buildSubRouter(svc)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, makeAuthRequest(t, "user-1"))

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 for trialing, got %d", rr.Code)
	}
}

func TestRequireActiveSubscription_InjectsSubscriptionInContext(t *testing.T) {
	svc := &mockSubService{sub: &service.Subscription{Plan: "advanced", Status: "active"}}
	router := buildSubRouter(svc)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, makeAuthRequest(t, "user-1"))

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["plan"] != "advanced" {
		t.Errorf("expected plan=advanced in context, got %v", body["plan"])
	}
	if body["status"] != "active" {
		t.Errorf("expected status=active in context, got %v", body["status"])
	}
}
