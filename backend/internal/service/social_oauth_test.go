package service

import (
	"strings"
	"testing"
	"time"
)

func TestSocialOAuthService_SignAndVerifyState(t *testing.T) {
	svc := &SocialOAuthService{stateSecret: []byte("super-secret")}
	state, err := svc.signState("user-123", SocialNetworkLinkedIn)
	if err != nil {
		t.Fatalf("signState failed: %v", err)
	}

	payload, err := svc.verifyState(state)
	if err != nil {
		t.Fatalf("verifyState failed: %v", err)
	}
	if payload.UserID != "user-123" {
		t.Fatalf("expected user-123, got %q", payload.UserID)
	}
	if payload.Network != SocialNetworkLinkedIn {
		t.Fatalf("expected linkedin, got %q", payload.Network)
	}
	if payload.ExpiresAt <= time.Now().Unix() {
		t.Fatalf("expected future expiration, got %d", payload.ExpiresAt)
	}
}

func TestSocialOAuthService_VerifyStateRejectsTamperedState(t *testing.T) {
	svc := &SocialOAuthService{stateSecret: []byte("super-secret")}
	state, err := svc.signState("user-123", SocialNetworkReddit)
	if err != nil {
		t.Fatalf("signState failed: %v", err)
	}
	tampered := state[:len(state)-1] + "x"

	if _, err := svc.verifyState(tampered); err != ErrOAuthStateInvalid {
		t.Fatalf("expected ErrOAuthStateInvalid, got %v", err)
	}
}

func TestSocialOAuthService_CallbackURLMapsInstagramToFacebook(t *testing.T) {
	svc := &SocialOAuthService{apiBaseURL: "http://localhost:8080"}
	if got := svc.callbackURL(SocialNetworkInstagram); got != "http://localhost:8080/api/social/oauth/facebook/callback" {
		t.Fatalf("unexpected callback URL: %q", got)
	}
}

func TestSocialOAuthService_FrontendRedirectUsesSocialPage(t *testing.T) {
	svc := &SocialOAuthService{frontendURL: "http://localhost:3000"}
	redirect := svc.FrontendRedirect(SocialNetworkFacebook, "error", "missing state")
	if !strings.HasPrefix(redirect, "http://localhost:3000/social?") {
		t.Fatalf("expected social page redirect, got %q", redirect)
	}
	for _, expected := range []string{"network=facebook", "status=error", "message=missing+state"} {
		if !strings.Contains(redirect, expected) {
			t.Fatalf("expected %q in redirect, got %q", expected, redirect)
		}
	}
}
