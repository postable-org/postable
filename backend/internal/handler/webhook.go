package handler

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/webhook"

	"postable/internal/service"
)

func parseStripeObject(raw json.RawMessage, v interface{}) error {
	return json.Unmarshal(raw, v)
}

// SubscriptionUpsertService is the subset of SubscriptionService needed by the webhook handler.
type SubscriptionUpsertService interface {
	Upsert(ctx context.Context, sub *service.Subscription) error
	GetByStripeSubscriptionID(ctx context.Context, subID string) (*service.Subscription, error)
}

// WebhookHandler handles POST /api/webhook/stripe.
type WebhookHandler struct {
	subSvc        SubscriptionUpsertService
	webhookSecret string
	priceToplan   map[string]string
}

// NewWebhookHandler creates a new WebhookHandler.
func NewWebhookHandler(subSvc SubscriptionUpsertService, webhookSecret string, priceToplan map[string]string) *WebhookHandler {
	return &WebhookHandler{
		subSvc:        subSvc,
		webhookSecret: webhookSecret,
		priceToplan:   priceToplan,
	}
}

// Handle handles POST /api/webhook/stripe — public, no JWT auth.
func (h *WebhookHandler) Handle(w http.ResponseWriter, r *http.Request) {
	payload, err := io.ReadAll(io.LimitReader(r.Body, 65536))
	if err != nil {
		slog.Warn("webhook: failed to read body", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}

	event, err := webhook.ConstructEvent(payload, r.Header.Get("Stripe-Signature"), h.webhookSecret)
	if err != nil {
		slog.Warn("webhook: invalid signature", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid signature"})
		return
	}

	slog.Info("webhook: received event", "type", event.Type)

	switch event.Type {
	case "checkout.session.completed":
		h.handleCheckoutCompleted(r.Context(), event)
	case "customer.subscription.updated":
		h.handleSubscriptionUpdated(r.Context(), event)
	case "customer.subscription.deleted":
		h.handleSubscriptionDeleted(r.Context(), event)
	case "invoice.payment_failed":
		h.handlePaymentFailed(r.Context(), event)
	}

	// Always return 200 to Stripe (except signature failure above)
	w.WriteHeader(http.StatusOK)
}

func (h *WebhookHandler) handleCheckoutCompleted(ctx context.Context, event stripe.Event) {
	var session stripe.CheckoutSession
	if err := parseStripeObject(event.Data.Raw, &session); err != nil {
		slog.Error("webhook: failed to parse checkout session", "error", err)
		return
	}

	userID := session.ClientReferenceID
	if userID == "" {
		slog.Warn("webhook: checkout session missing client_reference_id")
		return
	}

	if session.Subscription == nil {
		slog.Warn("webhook: checkout session has no subscription", "session_id", session.ID)
		return
	}

	sub := session.Subscription
	plan := h.planFromSubscription(sub)

	record := &service.Subscription{
		UserID:               userID,
		StripeCustomerID:     sub.Customer.ID,
		StripeSubscriptionID: sub.ID,
		Plan:                 plan,
		Status:               string(sub.Status),
		CurrentPeriodStart:   time.Unix(sub.CurrentPeriodStart, 0),
		CurrentPeriodEnd:     time.Unix(sub.CurrentPeriodEnd, 0),
		CancelAtPeriodEnd:    sub.CancelAtPeriodEnd,
	}

	if err := h.subSvc.Upsert(ctx, record); err != nil {
		slog.Error("webhook: failed to upsert subscription", "userID", userID, "error", err)
	} else {
		slog.Info("webhook: subscription created", "userID", userID, "plan", plan)
	}
}

func (h *WebhookHandler) handleSubscriptionUpdated(ctx context.Context, event stripe.Event) {
	var sub stripe.Subscription
	if err := parseStripeObject(event.Data.Raw, &sub); err != nil {
		slog.Error("webhook: failed to parse subscription", "error", err)
		return
	}

	existing, err := h.subSvc.GetByStripeSubscriptionID(ctx, sub.ID)
	if err != nil {
		slog.Warn("webhook: subscription not found for update", "sub_id", sub.ID, "error", err)
		return
	}

	plan := h.planFromSubscription(&sub)

	record := &service.Subscription{
		UserID:               existing.UserID,
		StripeCustomerID:     sub.Customer.ID,
		StripeSubscriptionID: sub.ID,
		Plan:                 plan,
		Status:               string(sub.Status),
		CurrentPeriodStart:   time.Unix(sub.CurrentPeriodStart, 0),
		CurrentPeriodEnd:     time.Unix(sub.CurrentPeriodEnd, 0),
		CancelAtPeriodEnd:    sub.CancelAtPeriodEnd,
	}

	if err := h.subSvc.Upsert(ctx, record); err != nil {
		slog.Error("webhook: failed to update subscription", "sub_id", sub.ID, "error", err)
	} else {
		slog.Info("webhook: subscription updated", "sub_id", sub.ID, "plan", plan, "status", sub.Status)
	}
}

func (h *WebhookHandler) handleSubscriptionDeleted(ctx context.Context, event stripe.Event) {
	var sub stripe.Subscription
	if err := parseStripeObject(event.Data.Raw, &sub); err != nil {
		slog.Error("webhook: failed to parse subscription deletion", "error", err)
		return
	}

	existing, err := h.subSvc.GetByStripeSubscriptionID(ctx, sub.ID)
	if err != nil {
		slog.Warn("webhook: subscription not found for deletion", "sub_id", sub.ID)
		return
	}

	record := &service.Subscription{
		UserID:               existing.UserID,
		StripeCustomerID:     existing.StripeCustomerID,
		StripeSubscriptionID: sub.ID,
		Plan:                 existing.Plan,
		Status:               "canceled",
		CurrentPeriodStart:   existing.CurrentPeriodStart,
		CurrentPeriodEnd:     time.Unix(sub.CurrentPeriodEnd, 0),
		CancelAtPeriodEnd:    sub.CancelAtPeriodEnd,
	}

	if err := h.subSvc.Upsert(ctx, record); err != nil {
		slog.Error("webhook: failed to mark subscription canceled", "sub_id", sub.ID, "error", err)
	} else {
		slog.Info("webhook: subscription canceled", "sub_id", sub.ID)
	}
}

func (h *WebhookHandler) handlePaymentFailed(ctx context.Context, event stripe.Event) {
	var invoice stripe.Invoice
	if err := parseStripeObject(event.Data.Raw, &invoice); err != nil {
		slog.Error("webhook: failed to parse invoice", "error", err)
		return
	}

	if invoice.Subscription == nil {
		return
	}

	existing, err := h.subSvc.GetByStripeSubscriptionID(ctx, invoice.Subscription.ID)
	if err != nil {
		slog.Warn("webhook: subscription not found for payment_failed", "sub_id", invoice.Subscription.ID)
		return
	}

	record := &service.Subscription{
		UserID:               existing.UserID,
		StripeCustomerID:     existing.StripeCustomerID,
		StripeSubscriptionID: existing.StripeSubscriptionID,
		Plan:                 existing.Plan,
		Status:               "past_due",
		CurrentPeriodStart:   existing.CurrentPeriodStart,
		CurrentPeriodEnd:     existing.CurrentPeriodEnd,
		CancelAtPeriodEnd:    existing.CancelAtPeriodEnd,
	}

	if err := h.subSvc.Upsert(ctx, record); err != nil {
		slog.Error("webhook: failed to mark subscription past_due", "error", err)
	} else {
		slog.Info("webhook: subscription marked past_due", "sub_id", existing.StripeSubscriptionID)
	}
}

// planFromSubscription extracts the plan name from the first line item's price ID.
func (h *WebhookHandler) planFromSubscription(sub *stripe.Subscription) string {
	if sub == nil || len(sub.Items.Data) == 0 {
		return "basic"
	}
	item := sub.Items.Data[0]
	if item.Price == nil {
		return "basic"
	}
	if plan, ok := h.priceToplan[item.Price.ID]; ok {
		return plan
	}
	return "basic"
}
