package service_test

import (
	"context"
	"testing"
	"time"

	"postable/internal/service"
)

func TestPlanLimitsFor(t *testing.T) {
	tests := []struct {
		plan             string
		wantPosts        int
		wantAnalytics    bool
	}{
		{"basic", 10, false},
		{"advanced", 25, true},
		{"agency", 60, true},
		{"unknown", 10, false},
		{"", 10, false},
	}
	for _, tt := range tests {
		t.Run(tt.plan, func(t *testing.T) {
			limits := service.PlanLimitsFor(tt.plan)
			if limits.PostsPerPlatformPerMonth != tt.wantPosts {
				t.Errorf("plan %q: expected %d posts, got %d", tt.plan, tt.wantPosts, limits.PostsPerPlatformPerMonth)
			}
			if limits.AnalyticsEnabled != tt.wantAnalytics {
				t.Errorf("plan %q: expected analytics=%v, got %v", tt.plan, tt.wantAnalytics, limits.AnalyticsEnabled)
			}
		})
	}
}

func TestSubscriptionService_GetByUserID_NilDB(t *testing.T) {
	svc := service.NewSubscriptionService(nil)
	_, err := svc.GetByUserID(context.Background(), "user-123")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err != service.ErrNoSubscription {
		t.Errorf("expected ErrNoSubscription, got %v", err)
	}
}

func TestSubscriptionService_CountPostsThisPeriod_NilDB(t *testing.T) {
	svc := service.NewSubscriptionService(nil)
	count, err := svc.CountPostsThisPeriod(context.Background(), "user-123", "instagram", time.Now())
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0, got %d", count)
	}
}

func TestSubscriptionService_Upsert_NilDB(t *testing.T) {
	svc := service.NewSubscriptionService(nil)
	sub := &service.Subscription{
		UserID:               "user-123",
		StripeCustomerID:     "cus_test",
		StripeSubscriptionID: "sub_test",
		Plan:                 "basic",
		Status:               "active",
		CurrentPeriodStart:   time.Now(),
		CurrentPeriodEnd:     time.Now().Add(30 * 24 * time.Hour),
	}
	err := svc.Upsert(context.Background(), sub)
	if err != nil {
		t.Errorf("expected nil error with nil db, got %v", err)
	}
}
