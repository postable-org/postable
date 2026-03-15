package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/jwtauth/v5"
	stripe "github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/billingportal/session"
	stripeCheckout "github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/stripe/stripe-go/v76/customer"

	"postable/internal/service"
)

// SubscriptionReadService is the subset of SubscriptionService needed by the checkout handler.
type SubscriptionReadService interface {
	GetByUserID(ctx context.Context, userID string) (*service.Subscription, error)
	Upsert(ctx context.Context, sub *service.Subscription) error
}

// CheckoutHandler handles checkout and billing portal routes.
type CheckoutHandler struct {
	subSvc SubscriptionReadService
	appURL string
}

// NewCheckoutHandler creates a new CheckoutHandler.
func NewCheckoutHandler(subSvc SubscriptionReadService) *CheckoutHandler {
	appURL := os.Getenv("NEXT_PUBLIC_APP_URL")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}
	return &CheckoutHandler{subSvc: subSvc, appURL: appURL}
}

// GetSubscription handles GET /api/subscription.
func (h *CheckoutHandler) GetSubscription(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	sub, err := h.subSvc.GetByUserID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, service.ErrNoSubscription) {
			writeJSON(w, http.StatusPaymentRequired, map[string]string{
				"error":    "subscription_required",
				"redirect": "/pricing",
			})
			return
		}
		slog.Error("get subscription: service error", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"plan":                 sub.Plan,
		"status":               sub.Status,
		"current_period_end":   sub.CurrentPeriodEnd,
		"cancel_at_period_end": sub.CancelAtPeriodEnd,
		"stripe_customer_id":   sub.StripeCustomerID,
	})
}

// CreateSession handles POST /api/checkout/session.
func (h *CheckoutHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	// Extract email from JWT claims
	_, claims, _ := jwtauth.FromContext(r.Context())
	email, _ := claims["email"].(string)

	var body struct {
		PriceID string `json:"price_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.PriceID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "price_id required"})
		return
	}

	if strings.TrimSpace(stripe.Key) == "" {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "stripe_secret_key_missing"})
		return
	}

	// Look up or create Stripe customer
	customerID, err := h.getOrCreateCustomer(r.Context(), userID, email)
	if err != nil {
		slog.Error("checkout: failed to get/create customer", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": stripeFriendlyError(err, "failed to create checkout session")})
		return
	}

	params := &stripe.CheckoutSessionParams{
		Mode:              stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		Customer:          stripe.String(customerID),
		ClientReferenceID: stripe.String(userID),
		SuccessURL:        stripe.String(h.appURL + "/dashboard?subscription=success"),
		CancelURL:         stripe.String(h.appURL + "/pricing"),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(body.PriceID),
				Quantity: stripe.Int64(1),
			},
		},
	}

	sess, err := stripeCheckout.New(params)
	if err != nil {
		slog.Error("checkout: failed to create stripe session", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": stripeFriendlyError(err, "failed to create checkout session")})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"url": sess.URL})
}

// CreatePortalSession handles POST /api/billing/portal.
func (h *CheckoutHandler) CreatePortalSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	_, claims, _ := jwtauth.FromContext(r.Context())
	email, _ := claims["email"].(string)

	sub, err := h.subSvc.GetByUserID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, service.ErrNoSubscription) {
			writeJSON(w, http.StatusPaymentRequired, map[string]string{"error": "no subscription found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if strings.TrimSpace(stripe.Key) == "" {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "stripe_secret_key_missing"})
		return
	}

	customerID, err := h.ensureValidCustomerID(r.Context(), sub, email)
	if err != nil {
		slog.Error("billing portal: failed to ensure customer", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": stripeFriendlyError(err, "failed to create portal session")})
		return
	}

	params := &stripe.BillingPortalSessionParams{
		Customer:  stripe.String(customerID),
		ReturnURL: stripe.String(h.appURL + "/dashboard"),
	}

	portalSession, err := session.New(params)
	if err != nil {
		if isMissingCustomerError(err) {
			recoveredID, recoverErr := h.createAndPersistCustomer(r.Context(), sub, email)
			if recoverErr == nil {
				params.Customer = stripe.String(recoveredID)
				portalSession, err = session.New(params)
			}
		}
	}

	if err != nil {
		slog.Error("billing portal: failed to create session", "userID", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": stripeFriendlyError(err, "failed to create portal session")})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"url": portalSession.URL})
}

// getOrCreateCustomer returns the existing Stripe customer ID or creates a new one.
func (h *CheckoutHandler) getOrCreateCustomer(ctx context.Context, userID, email string) (string, error) {
	// Check if we already have a customer ID stored
	sub, err := h.subSvc.GetByUserID(ctx, userID)
	if err == nil {
		return h.ensureValidCustomerID(ctx, sub, email)
	}

	// No subscription record yet, create a new customer for checkout.
	params := &stripe.CustomerParams{
		Email: stripe.String(email),
		Metadata: map[string]string{
			"user_id": userID,
		},
	}
	c, err := customer.New(params)
	if err != nil {
		return "", err
	}
	return c.ID, nil
}

func stripeFriendlyError(err error, fallback string) string {
	if err == nil {
		return fallback
	}
	if se, ok := err.(*stripe.Error); ok {
		msg := strings.TrimSpace(se.Msg)
		if msg == "" {
			msg = strings.TrimSpace(se.Error())
		}
		if strings.Contains(strings.ToLower(msg), "billing portal") {
			return "stripe billing portal não configurado para este ambiente"
		}
		if msg != "" {
			return msg
		}
	}
	if m := strings.TrimSpace(err.Error()); m != "" {
		return m
	}
	return fallback
}

func (h *CheckoutHandler) ensureValidCustomerID(ctx context.Context, sub *service.Subscription, email string) (string, error) {
	if sub == nil {
		return "", errors.New("subscription record not found")
	}
	customerID := strings.TrimSpace(sub.StripeCustomerID)
	if customerID == "" {
		return h.createAndPersistCustomer(ctx, sub, email)
	}

	_, err := customer.Get(customerID, nil)
	if err == nil {
		return customerID, nil
	}
	if !isMissingCustomerError(err) {
		return "", err
	}

	return h.createAndPersistCustomer(ctx, sub, email)
}

func (h *CheckoutHandler) createAndPersistCustomer(ctx context.Context, sub *service.Subscription, email string) (string, error) {
	params := &stripe.CustomerParams{
		Email: stripe.String(email),
		Metadata: map[string]string{
			"user_id": sub.UserID,
		},
	}
	c, err := customer.New(params)
	if err != nil {
		return "", err
	}

	if strings.TrimSpace(sub.StripeSubscriptionID) == "" {
		return c.ID, nil
	}

	updated := *sub
	updated.StripeCustomerID = c.ID
	if err := h.subSvc.Upsert(ctx, &updated); err != nil {
		return "", err
	}

	return c.ID, nil
}

func isMissingCustomerError(err error) bool {
	se, ok := err.(*stripe.Error)
	if !ok {
		msg := strings.ToLower(strings.TrimSpace(err.Error()))
		return strings.Contains(msg, "no such customer")
	}
	if se.Code == stripe.ErrorCodeResourceMissing {
		return true
	}
	msg := strings.ToLower(strings.TrimSpace(se.Msg))
	return strings.Contains(msg, "no such customer")
}
