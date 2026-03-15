package service

import (
	"context"
	"errors"
	"net/url"
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
	tampered := "x" + state[1:]

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

func TestSocialOAuthService_StartAuthorizationXIncludesPKCE(t *testing.T) {
	t.Setenv("X_CLIENT_ID", "x-client-id")
	svc := &SocialOAuthService{
		stateSecret: []byte("super-secret"),
		apiBaseURL:  "http://localhost:8080",
	}

	authURL, err := svc.StartAuthorization(context.Background(), "user-123", SocialNetworkX)
	if err != nil {
		t.Fatalf("StartAuthorization failed: %v", err)
	}
	parsed, err := url.Parse(authURL)
	if err != nil {
		t.Fatalf("invalid auth URL: %v", err)
	}
	if parsed.Host != "x.com" {
		t.Fatalf("expected x.com host, got %q", parsed.Host)
	}
	q := parsed.Query()
	if q.Get("code_challenge_method") != "S256" {
		t.Fatalf("expected code_challenge_method=S256, got %q", q.Get("code_challenge_method"))
	}
	if q.Get("code_challenge") == "" {
		t.Fatalf("expected code_challenge in auth URL")
	}

	payload, err := svc.verifyState(q.Get("state"))
	if err != nil {
		t.Fatalf("verifyState failed: %v", err)
	}
	if payload.Network != SocialNetworkX {
		t.Fatalf("expected network x, got %q", payload.Network)
	}
	if payload.CodeVerifier == "" {
		t.Fatalf("expected state payload to include PKCE code verifier")
	}
}

func TestSocialOAuthService_StartAuthorizationLinkedInMissingConfigReturnsHelpfulError(t *testing.T) {
	svc := &SocialOAuthService{
		stateSecret: []byte("super-secret"),
		apiBaseURL:  "http://localhost:8080",
	}

	_, err := svc.StartAuthorization(context.Background(), "user-123", SocialNetworkLinkedIn)
	if err == nil {
		t.Fatal("expected missing config error")
	}
	if !strings.Contains(err.Error(), "LINKEDIN_CLIENT_ID") {
		t.Fatalf("expected helpful linkedin error, got %v", err)
	}
	if !errors.Is(err, ErrOAuthNotConfigured) {
		t.Fatalf("expected ErrOAuthNotConfigured, got %v", err)
	}
}
