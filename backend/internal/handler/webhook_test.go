package handler_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	stripe "github.com/stripe/stripe-go/v76"

	"postable/internal/handler"
	"postable/internal/service"
)

const testWebhookSecret = "test-webhook-secret"

// stripeAPIVersion is the version stripe-go v76 expects.
const stripeAPIVersion = "2023-10-16"

// mockSubscriptionUpsertService implements handler.SubscriptionUpsertService.
type mockSubscriptionUpsertService struct {
	sub          *service.Subscription
	getErr       error
	upsertErr    error
	lastUpserted *service.Subscription
}

func (m *mockSubscriptionUpsertService) Upsert(_ context.Context, sub *service.Subscription) error {
	m.lastUpserted = sub
	return m.upsertErr
}

func (m *mockSubscriptionUpsertService) GetByStripeSubscriptionID(_ context.Context, _ string) (*service.Subscription, error) {
	return m.sub, m.getErr
}

func buildWebhookRouter(svc handler.SubscriptionUpsertService) http.Handler {
	r := chi.NewRouter()
	h := handler.NewWebhookHandler(svc, testWebhookSecret, map[string]string{
		"price_basic":    "basic",
		"price_advanced": "advanced",
	})
	r.Post("/api/webhook/stripe", h.Handle)
	return r
}

// stripeTestSig computes a valid Stripe-Signature header for the given payload and secret.
func stripeTestSig(t *testing.T, payload []byte, secret string) string {
	t.Helper()
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts + "." + string(payload)))
	sig := fmt.Sprintf("t=%s,v1=%x", ts, mac.Sum(nil))
	return sig
}

func TestWebhook_InvalidSignature(t *testing.T) {
	svc := &mockSubscriptionUpsertService{}
	router := buildWebhookRouter(svc)

	payload := []byte(`{"type":"customer.subscription.deleted","data":{"object":{}}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/webhook/stripe", strings.NewReader(string(payload)))
	req.Header.Set("Stripe-Signature", "t=1234,v1=invalidsignature")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid signature, got %d", rr.Code)
	}
}

func TestWebhook_UnknownEventType(t *testing.T) {
	svc := &mockSubscriptionUpsertService{}
	router := buildWebhookRouter(svc)

	event := stripe.Event{
		Type:       "some.unknown.event",
		APIVersion: stripeAPIVersion,
		Data: &stripe.EventData{
			Raw: json.RawMessage(`{}`),
		},
	}
	payload, _ := json.Marshal(event)
	sig := stripeTestSig(t, payload, testWebhookSecret)

	req := httptest.NewRequest(http.MethodPost, "/api/webhook/stripe", strings.NewReader(string(payload)))
	req.Header.Set("Stripe-Signature", sig)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 for unknown event type, got %d", rr.Code)
	}
	if svc.lastUpserted != nil {
		t.Error("expected no upsert for unknown event type")
	}
}

func TestWebhook_SubscriptionDeleted_CallsUpsertWithCanceled(t *testing.T) {
	existing := &service.Subscription{
		UserID:               "user-abc",
		StripeCustomerID:     "cus_test",
		StripeSubscriptionID: "sub_test",
		Plan:                 "advanced",
		Status:               "active",
		CurrentPeriodStart:   time.Now().Add(-30 * 24 * time.Hour),
		CurrentPeriodEnd:     time.Now().Add(24 * time.Hour),
	}
	svc := &mockSubscriptionUpsertService{sub: existing}
	router := buildWebhookRouter(svc)

	subData := map[string]any{
		"id":                    "sub_test",
		"current_period_end":    time.Now().Add(24 * time.Hour).Unix(),
		"cancel_at_period_end":  false,
		"items": map[string]any{
			"data": []any{},
		},
	}
	subJSON, _ := json.Marshal(subData)

	event := stripe.Event{
		Type:       "customer.subscription.deleted",
		APIVersion: stripeAPIVersion,
		Data: &stripe.EventData{
			Raw: json.RawMessage(subJSON),
		},
	}
	payload, _ := json.Marshal(event)
	sig := stripeTestSig(t, payload, testWebhookSecret)

	req := httptest.NewRequest(http.MethodPost, "/api/webhook/stripe", strings.NewReader(string(payload)))
	req.Header.Set("Stripe-Signature", sig)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rr.Code, rr.Body.String())
	}
	if svc.lastUpserted == nil {
		t.Fatal("expected Upsert to be called")
	}
	if svc.lastUpserted.Status != "canceled" {
		t.Errorf("expected status=canceled, got %q", svc.lastUpserted.Status)
	}
	if svc.lastUpserted.UserID != "user-abc" {
		t.Errorf("expected userID=user-abc, got %q", svc.lastUpserted.UserID)
	}
}

func TestWebhook_PaymentFailed_NoSubscriptionFound_NoOp(t *testing.T) {
	svc := &mockSubscriptionUpsertService{getErr: service.ErrNoSubscription}
	router := buildWebhookRouter(svc)

	invoiceData := map[string]any{
		"id": "inv_test",
		"subscription": map[string]any{
			"id": "sub_missing",
		},
	}
	invoiceJSON, _ := json.Marshal(invoiceData)

	event := stripe.Event{
		Type:       "invoice.payment_failed",
		APIVersion: stripeAPIVersion,
		Data: &stripe.EventData{
			Raw: json.RawMessage(invoiceJSON),
		},
	}
	payload, _ := json.Marshal(event)
	sig := stripeTestSig(t, payload, testWebhookSecret)

	req := httptest.NewRequest(http.MethodPost, "/api/webhook/stripe", strings.NewReader(string(payload)))
	req.Header.Set("Stripe-Signature", sig)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 (no-op), got %d", rr.Code)
	}
	if svc.lastUpserted != nil {
		t.Error("expected no upsert when subscription not found")
	}
}
