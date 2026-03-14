package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"

	"postable/internal/handler"
	"postable/internal/service"
)

// MockBrandService is a test double for the handler.BrandServiceInterface.
type MockBrandService struct {
	brand *service.Brand
	err   error
}

func (m *MockBrandService) Create(ctx context.Context, userID string, input service.BrandInput) (*service.Brand, error) {
	if m.brand != nil {
		return m.brand, nil
	}
	return &service.Brand{
		ID:     "brand-123",
		UserID: userID,
		Niche:  input.Niche,
	}, m.err
}

func (m *MockBrandService) GetByUserID(ctx context.Context, userID string) (*service.Brand, error) {
	return m.brand, m.err
}

func (m *MockBrandService) Update(ctx context.Context, userID string, input service.BrandInput) (*service.Brand, error) {
	if m.brand != nil {
		return m.brand, nil
	}
	return &service.Brand{
		ID:     "brand-123",
		UserID: userID,
		Niche:  input.Niche,
	}, m.err
}

var testTokenAuth *jwtauth.JWTAuth

func TestMain(m *testing.M) {
	os.Setenv("SUPABASE_JWT_SECRET", "test-secret")
	testTokenAuth = jwtauth.New("HS256", []byte("test-secret"), nil)
	os.Exit(m.Run())
}

func makeTestJWT(t *testing.T, userID string) string {
	t.Helper()
	_, tokenString, err := testTokenAuth.Encode(map[string]interface{}{
		"sub": userID,
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatalf("failed to create test JWT: %v", err)
	}
	return tokenString
}

func buildBrandRouter(svc handler.BrandServiceInterface) http.Handler {
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(jwtauth.Verifier(testTokenAuth))
		r.Use(jwtauth.Authenticator(testTokenAuth))
		bh := handler.NewBrandHandler(svc)
		r.Post("/api/brands", bh.Create)
		r.Get("/api/brands", bh.Get)
		r.Put("/api/brands", bh.Update)
	})
	return r
}

func TestCreateBrand_Unauthenticated(t *testing.T) {
	svc := &MockBrandService{}
	router := buildBrandRouter(svc)

	body := bytes.NewBufferString(`{"niche":"restaurant","city":"Austin","state":"TX"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/brands", body)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetBrand_Unauthenticated(t *testing.T) {
	svc := &MockBrandService{}
	router := buildBrandRouter(svc)

	req := httptest.NewRequest(http.MethodGet, "/api/brands", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestCreateBrand_Success(t *testing.T) {
	svc := &MockBrandService{}
	router := buildBrandRouter(svc)

	token := makeTestJWT(t, "user-abc")
	body := bytes.NewBufferString(`{"niche":"restaurant","city":"Austin","state":"TX","tone_of_voice":"friendly"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/brands", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d (body: %s)", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if result["id"] == nil {
		t.Error("expected brand id in response")
	}
}

func TestGetBrand_NotFound(t *testing.T) {
	svc := &MockBrandService{brand: nil, err: handler.ErrBrandNotFound}
	router := buildBrandRouter(svc)

	token := makeTestJWT(t, "user-abc")
	req := httptest.NewRequest(http.MethodGet, "/api/brands", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d (body: %s)", rr.Code, rr.Body.String())
	}
}
