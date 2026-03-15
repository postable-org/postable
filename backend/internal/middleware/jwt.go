package middleware

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/jwtauth/v5"
	"github.com/lestrrat-go/jwx/v2/jwk"
	jwxjwt "github.com/lestrrat-go/jwx/v2/jwt"
)

var tokenAuth *jwtauth.JWTAuth

type contextKey string

const rsClaimsContextKey contextKey = "rs256_claims"

type rs256Verifier struct {
	jwksURL   string
	issuer    string
	mu        sync.RWMutex
	keySet    jwk.Set
	fetchedAt time.Time
	cacheTTL  time.Duration
}

var rsVerifier *rs256Verifier

// Init initializes the JWT middleware. Must be called after environment variables are loaded.
func Init() {
	secret := os.Getenv("SUPABASE_JWT_SECRET")
	if secret == "" {
		slog.Warn("SUPABASE_JWT_SECRET is not set — JWT verification will fail")
	} else {
		slog.Info("JWT middleware initialized")
	}
	tokenAuth = jwtauth.New("HS256", []byte(secret), nil)

	if verifier, err := newRS256Verifier(); err != nil {
		slog.Warn("RS256 verifier disabled", "error", err)
	} else {
		rsVerifier = verifier
		slog.Info("RS256 verifier enabled", "jwks_url", verifier.jwksURL)
	}
}

// Verifier returns the JWT verifier middleware for chi.
// Checks Authorization header and cookie only — no query param extraction.
func Verifier() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenString := firstNonEmpty(
				jwtauth.TokenFromHeader(r),
				jwtauth.TokenFromCookie(r),
				jwtauth.TokenFromQuery(r),
			)
			if tokenString == "" {
				next.ServeHTTP(w, r.WithContext(jwtauth.NewContext(r.Context(), nil, jwtauth.ErrNoTokenFound)))
				return
			}

			if token, err := jwtauth.VerifyToken(tokenAuth, tokenString); err == nil {
				next.ServeHTTP(w, r.WithContext(jwtauth.NewContext(r.Context(), token, nil)))
				return
			}

			if rsVerifier != nil {
				claims, err := rsVerifier.Verify(r.Context(), tokenString)
				if err == nil {
					ctx := context.WithValue(r.Context(), rsClaimsContextKey, claims)
					next.ServeHTTP(w, r.WithContext(jwtauth.NewContext(ctx, nil, nil)))
					return
				}
				next.ServeHTTP(w, r.WithContext(jwtauth.NewContext(r.Context(), nil, err)))
				return
			}

			next.ServeHTTP(w, r.WithContext(jwtauth.NewContext(r.Context(), nil, jwtauth.ErrUnauthorized)))
		})
	}
}

// Authenticator returns the JWT authenticator middleware for chi.
func Authenticator() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if _, err := GetUserID(r); err != nil {
				http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// GetUserID extracts the user ID (sub claim) from the request context.
func GetUserID(r *http.Request) (string, error) {
	if claims, ok := r.Context().Value(rsClaimsContextKey).(map[string]interface{}); ok {
		sub, ok := claims["sub"].(string)
		if ok && strings.TrimSpace(sub) != "" {
			return sub, nil
		}
	}

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

func newRS256Verifier() (*rs256Verifier, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("SUPABASE_URL")), "/")
	if baseURL == "" {
		baseURL = strings.TrimRight(strings.TrimSpace(os.Getenv("NEXT_PUBLIC_SUPABASE_URL")), "/")
	}
	if baseURL == "" {
		return nil, errors.New("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is required for RS256 JWT verification")
	}

	return &rs256Verifier{
		jwksURL:  baseURL + "/auth/v1/.well-known/jwks.json",
		issuer:   baseURL + "/auth/v1",
		cacheTTL: 5 * time.Minute,
	}, nil
}

func (v *rs256Verifier) Verify(ctx context.Context, tokenString string) (map[string]interface{}, error) {
	set, err := v.getKeySet(ctx)
	if err != nil {
		return nil, err
	}

	tok, err := jwxjwt.Parse(
		[]byte(tokenString),
		jwxjwt.WithKeySet(set),
		jwxjwt.WithValidate(true),
		jwxjwt.WithIssuer(v.issuer),
	)
	if err != nil {
		return nil, err
	}

	claims, err := tok.AsMap(ctx)
	if err != nil {
		return nil, err
	}
	return claims, nil
}

func (v *rs256Verifier) getKeySet(ctx context.Context) (jwk.Set, error) {
	v.mu.RLock()
	if v.keySet != nil && time.Since(v.fetchedAt) < v.cacheTTL {
		set := v.keySet
		v.mu.RUnlock()
		return set, nil
	}
	v.mu.RUnlock()

	v.mu.Lock()
	defer v.mu.Unlock()
	if v.keySet != nil && time.Since(v.fetchedAt) < v.cacheTTL {
		return v.keySet, nil
	}

	set, err := jwk.Fetch(ctx, v.jwksURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch supabase JWKS: %w", err)
	}
	v.keySet = set
	v.fetchedAt = time.Now()
	return set, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
