package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"postable/internal/service"
)

const subscriptionKey contextKey = "subscription"

// SubscriptionServiceInterface is the subset needed by the subscription middleware.
type SubscriptionServiceInterface interface {
	GetByUserID(ctx context.Context, userID string) (*service.Subscription, error)
}

// RequireActiveSubscription blocks requests that have no active subscription.
// past_due and trialing are allowed through; canceled and unpaid are blocked.
func RequireActiveSubscription(subSvc SubscriptionServiceInterface) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, err := GetUserID(r)
			if err != nil {
				writeSubJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
				return
			}

			sub, err := subSvc.GetByUserID(r.Context(), userID)
			if err != nil {
				if errors.Is(err, service.ErrNoSubscription) {
					writeSubJSON(w, http.StatusPaymentRequired, map[string]any{
						"error":    "subscription_required",
						"redirect": "/pricing",
					})
					return
				}
				writeSubJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to check subscription"})
				return
			}

			// Block canceled and unpaid subscriptions
			if sub.Status == "canceled" || sub.Status == "unpaid" {
				writeSubJSON(w, http.StatusPaymentRequired, map[string]any{
					"error":  "subscription_inactive",
					"status": sub.Status,
				})
				return
			}

			// Inject subscription into context for downstream handlers
			ctx := context.WithValue(r.Context(), subscriptionKey, sub)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// SubscriptionFromContext retrieves the subscription from the request context.
func SubscriptionFromContext(ctx context.Context) (*service.Subscription, bool) {
	sub, ok := ctx.Value(subscriptionKey).(*service.Subscription)
	return sub, ok && sub != nil
}

func writeSubJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// InjectSubscriptionForTest injects a subscription into the context for use in tests.
func InjectSubscriptionForTest(ctx context.Context, sub *service.Subscription) context.Context {
	return context.WithValue(ctx, subscriptionKey, sub)
}
