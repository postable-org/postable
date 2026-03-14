package middleware

import (
	"errors"
	"log/slog"
	"net/http"
	"os"

	"github.com/go-chi/jwtauth/v5"
)

var tokenAuth *jwtauth.JWTAuth

func init() {
	secret := os.Getenv("SUPABASE_JWT_SECRET")
	if secret == "" {
		slog.Warn("SUPABASE_JWT_SECRET is not set — JWT verification will fail")
	} else {
		slog.Info("JWT middleware initialized")
	}
	tokenAuth = jwtauth.New("HS256", []byte(secret), nil)
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
