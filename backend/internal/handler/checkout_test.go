package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"

	"postable/internal/handler"
	"postable/internal/service"
)

// mockSubscriptionReadService implements handler.SubscriptionReadService.
type mockSubscriptionReadService struct {
	sub *service.Subscription
	err error
}

func (m *mockSubscriptionReadService) GetByUserID(_ context.Context, _ string) (*service.Subscription, error) {
	return m.sub, m.err
}

func (m *mockSubscriptionReadService) Upsert(_ context.Context, _ *service.Subscription) error {
	return nil
}

func buildCheckoutRouter(svc handler.SubscriptionReadService) http.Handler {
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(jwtauth.Verifier(testTokenAuth))
		r.Use(jwtauth.Authenticator(testTokenAuth))
		h := handler.NewCheckoutHandler(svc)
		r.Get("/api/subscription", h.GetSubscription)
		r.Post("/api/checkout/session", h.CreateSession)
		r.Post("/api/billing/portal", h.CreatePortalSession)
	})
	return r
}

func TestGetSubscription_Unauthenticated(t *testing.T) {
	svc := &mockSubscriptionReadService{}
	router := buildCheckoutRouter(svc)

	req := httptest.NewRequest(http.MethodGet, "/api/subscription", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetSubscription_NoSubscription(t *testing.T) {
	svc := &mockSubscriptionReadService{err: service.ErrNoSubscription}
	router := buildCheckoutRouter(svc)

	token := makeTestJWT(t, "user-abc")
	req := httptest.NewRequest(http.MethodGet, "/api/subscription", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusPaymentRequired {
		t.Errorf("expected 402, got %d", rr.Code)
	}

	var body map[string]any
	json.NewDecoder(rr.Body).Decode(&body)
	if body["error"] != "subscription_required" {
		t.Errorf("expected subscription_required error, got %v", body["error"])
	}
	if body["redirect"] != "/pricing" {
		t.Errorf("expected redirect=/pricing, got %v", body["redirect"])
	}
}

func TestGetSubscription_Active(t *testing.T) {
	sub := &service.Subscription{
		Plan:             "advanced",
		Status:           "active",
		StripeCustomerID: "cus_test123",
		CancelAtPeriodEnd: false,
	}
	svc := &mockSubscriptionReadService{sub: sub}
	router := buildCheckoutRouter(svc)

	token := makeTestJWT(t, "user-abc")
	req := httptest.NewRequest(http.MethodGet, "/api/subscription", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rr.Code, rr.Body.String())
	}

	var body map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["plan"] != "advanced" {
		t.Errorf("expected plan=advanced, got %v", body["plan"])
	}
	if body["status"] != "active" {
		t.Errorf("expected status=active, got %v", body["status"])
	}
	if _, ok := body["current_period_end"]; !ok {
		t.Error("expected current_period_end in response")
	}
}

func TestCreateSession_MissingPriceID(t *testing.T) {
	svc := &mockSubscriptionReadService{err: service.ErrNoSubscription}
	router := buildCheckoutRouter(svc)

	token := makeTestJWT(t, "user-abc")
	body := strings.NewReader(`{}`)
	req := httptest.NewRequest(http.MethodPost, "/api/checkout/session", body)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing price_id, got %d", rr.Code)
	}

	var resp map[string]any
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp["error"] != "price_id required" {
		t.Errorf("expected price_id required error, got %v", resp["error"])
	}
}

func TestCreateSession_Unauthenticated(t *testing.T) {
	svc := &mockSubscriptionReadService{}
	router := buildCheckoutRouter(svc)

	body := strings.NewReader(`{"price_id":"price_test"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/checkout/session", body)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestCreatePortalSession_NoSubscription(t *testing.T) {
	svc := &mockSubscriptionReadService{err: service.ErrNoSubscription}
	router := buildCheckoutRouter(svc)

	token := makeTestJWT(t, "user-abc")
	req := httptest.NewRequest(http.MethodPost, "/api/billing/portal", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusPaymentRequired {
		t.Errorf("expected 402 for no subscription, got %d", rr.Code)
	}
}

func TestCreatePortalSession_Unauthenticated(t *testing.T) {
	svc := &mockSubscriptionReadService{}
	router := buildCheckoutRouter(svc)

	req := httptest.NewRequest(http.MethodPost, "/api/billing/portal", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}
