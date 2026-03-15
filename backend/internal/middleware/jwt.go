package middleware

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/jwtauth/v5"
	"github.com/lestrrat-go/jwx/v2/jwk"
)

var tokenAuth *jwtauth.JWTAuth

// Init initializes the JWT middleware. Must be called after environment variables are loaded.
// It prefers Supabase's JWKS endpoint (for ES256 tokens) and falls back to the legacy HS256 secret.
func Init() {
	supabaseURL := os.Getenv("SUPABASE_URL")
	if supabaseURL != "" {
		if err := initFromJWKS(supabaseURL); err == nil {
			slog.Info("JWT middleware initialized from JWKS (ES256)")
			return
		} else {
			slog.Warn("JWKS fetch failed, falling back to HS256 secret", "error", err)
		}
	}

	secret := os.Getenv("SUPABASE_JWT_SECRET")
	if secret == "" {
		slog.Warn("SUPABASE_JWT_SECRET is not set — JWT verification will fail")
	} else {
		slog.Info("JWT middleware initialized with HS256 secret")
	}
	tokenAuth = jwtauth.New("HS256", []byte(secret), nil)
}

func initFromJWKS(supabaseURL string) error {
	jwksURL := supabaseURL + "/auth/v1/.well-known/jwks.json"

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	set, err := jwk.Fetch(ctx, jwksURL)
	if err != nil {
		return fmt.Errorf("fetch JWKS from %s: %w", jwksURL, err)
	}
	if set.Len() == 0 {
		return errors.New("JWKS returned no keys")
	}

	key, ok := set.Key(0)
	if !ok {
		return errors.New("could not read first key from JWKS")
	}

	var rawKey any
	if err := key.Raw(&rawKey); err != nil {
		return fmt.Errorf("extract raw key: %w", err)
	}

	alg := key.Algorithm().String()
	if alg == "" {
		alg = "ES256"
	}

	tokenAuth = jwtauth.New(alg, nil, rawKey)
	return nil
}

// Verifier returns the JWT verifier middleware for chi.
func Verifier() func(http.Handler) http.Handler {
	return jwtauth.Verifier(tokenAuth)
}

// Authenticator returns the JWT authenticator middleware for chi.
func Authenticator() func(http.Handler) http.Handler {
	return jwtauth.Authenticator(tokenAuth)
}

// GetUserID extracts the user ID (sub claim) from the request context.
func GetUserID(r *http.Request) (string, error) {
	_, claims, err := jwtauth.FromContext(r.Context())
	if err != nil {
		return "", err
	}
	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return "", errors.New("missing or invalid sub claim")
	}
	return sub, nil
}
