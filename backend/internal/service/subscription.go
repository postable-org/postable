package service

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNoSubscription is returned when no subscription is found for a user.
var ErrNoSubscription = errors.New("no subscription found")

// Subscription represents a user's Stripe subscription record.
type Subscription struct {
	ID                   string
	UserID               string
	StripeCustomerID     string
	StripeSubscriptionID string
	Plan                 string
	Status               string
	CurrentPeriodStart   time.Time
	CurrentPeriodEnd     time.Time
	CancelAtPeriodEnd    bool
}

// PlanLimits holds the feature limits for a given plan.
type PlanLimits struct {
	PostsPerPlatformPerMonth int
	AnalyticsEnabled         bool
}

var planLimits = map[string]PlanLimits{
	"basic":    {10, false},
	"advanced": {25, true},
	"agency":   {60, true},
}

// PlanLimitsFor returns the limits for a given plan name.
// Defaults to basic limits if the plan is unknown.
func PlanLimitsFor(plan string) PlanLimits {
	if l, ok := planLimits[plan]; ok {
		return l
	}
	return planLimits["basic"]
}

// SubscriptionService handles subscription persistence.
type SubscriptionService struct {
	db *pgxpool.Pool
}

// NewSubscriptionService creates a new SubscriptionService.
func NewSubscriptionService(db *pgxpool.Pool) *SubscriptionService {
	return &SubscriptionService{db: db}
}

const subscriptionColumns = `id, user_id, stripe_customer_id, stripe_subscription_id,
	plan, status, current_period_start, current_period_end, cancel_at_period_end`

func scanSubscription(row pgx.Row) (*Subscription, error) {
	s := &Subscription{}
	err := row.Scan(
		&s.ID, &s.UserID, &s.StripeCustomerID, &s.StripeSubscriptionID,
		&s.Plan, &s.Status, &s.CurrentPeriodStart, &s.CurrentPeriodEnd, &s.CancelAtPeriodEnd,
	)
	if err != nil {
		return nil, err
	}
	return s, nil
}

// GetByUserID returns the subscription for the given user, or ErrNoSubscription.
func (s *SubscriptionService) GetByUserID(ctx context.Context, userID string) (*Subscription, error) {
	if s.db == nil {
		return nil, ErrNoSubscription
	}
	row := s.db.QueryRow(ctx,
		`SELECT `+subscriptionColumns+` FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
		userID,
	)
	sub, err := scanSubscription(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoSubscription
		}
		return nil, err
	}
	return sub, nil
}

// GetByStripeCustomerID returns the subscription for the given Stripe customer ID.
func (s *SubscriptionService) GetByStripeCustomerID(ctx context.Context, customerID string) (*Subscription, error) {
	if s.db == nil {
		return nil, ErrNoSubscription
	}
	row := s.db.QueryRow(ctx,
		`SELECT `+subscriptionColumns+` FROM subscriptions WHERE stripe_customer_id = $1 ORDER BY created_at DESC LIMIT 1`,
		customerID,
	)
	sub, err := scanSubscription(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoSubscription
		}
		return nil, err
	}
	return sub, nil
}

// GetByStripeSubscriptionID returns the subscription for the given Stripe subscription ID.
func (s *SubscriptionService) GetByStripeSubscriptionID(ctx context.Context, subID string) (*Subscription, error) {
	if s.db == nil {
		return nil, ErrNoSubscription
	}
	row := s.db.QueryRow(ctx,
		`SELECT `+subscriptionColumns+` FROM subscriptions WHERE stripe_subscription_id = $1`,
		subID,
	)
	sub, err := scanSubscription(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoSubscription
		}
		return nil, err
	}
	return sub, nil
}

// Upsert inserts or updates a subscription record, keyed on stripe_subscription_id.
func (s *SubscriptionService) Upsert(ctx context.Context, sub *Subscription) error {
	if s.db == nil {
		return nil
	}
	_, err := s.db.Exec(ctx,
		`INSERT INTO subscriptions
			(user_id, stripe_customer_id, stripe_subscription_id, plan, status,
			 current_period_start, current_period_end, cancel_at_period_end)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 ON CONFLICT (stripe_subscription_id) DO UPDATE SET
			stripe_customer_id   = EXCLUDED.stripe_customer_id,
			plan                 = EXCLUDED.plan,
			status               = EXCLUDED.status,
			current_period_start = EXCLUDED.current_period_start,
			current_period_end   = EXCLUDED.current_period_end,
			cancel_at_period_end = EXCLUDED.cancel_at_period_end,
			updated_at           = now()`,
		sub.UserID, sub.StripeCustomerID, sub.StripeSubscriptionID,
		sub.Plan, sub.Status, sub.CurrentPeriodStart, sub.CurrentPeriodEnd, sub.CancelAtPeriodEnd,
	)
	return err
}

// CountPostsThisPeriod counts posts for a user/platform since the given time.
func (s *SubscriptionService) CountPostsThisPeriod(ctx context.Context, userID, platform string, from time.Time) (int, error) {
	if s.db == nil {
		return 0, nil
	}
	var count int
	err := s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM generated_posts
		 WHERE user_id = $1 AND platform = $2 AND created_at >= $3`,
		userID, platform, from,
	).Scan(&count)
	return count, err
}

// CheckQuota returns whether the user is allowed to generate a post for the given platform.
func (s *SubscriptionService) CheckQuota(ctx context.Context, userID, platform string) (allowed bool, used, limit int, err error) {
	sub, err := s.GetByUserID(ctx, userID)
	if err != nil {
		return false, 0, 0, err
	}
	limits := PlanLimitsFor(sub.Plan)
	count, err := s.CountPostsThisPeriod(ctx, userID, platform, sub.CurrentPeriodStart)
	if err != nil {
		return false, 0, 0, err
	}
	return count < limits.PostsPerPlatformPerMonth, count, limits.PostsPerPlatformPerMonth, nil
}
