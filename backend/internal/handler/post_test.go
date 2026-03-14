package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"

	"postable/internal/handler"
	"postable/internal/service"
)

type mockPostService struct {
	lastCreateContent json.RawMessage
	lastCreateTrend   json.RawMessage
	byID              map[string]*service.Post
	createdID         string
}

func (m *mockPostService) Create(ctx context.Context, userID, brandID string, contentJSON, trendContext []byte) (*service.Post, error) {
	m.lastCreateContent = append([]byte(nil), contentJSON...)
	m.lastCreateTrend = append([]byte(nil), trendContext...)
	id := m.createdID
	if id == "" {
		id = "created-post"
	}
	return &service.Post{
		ID:           id,
		UserID:       userID,
		BrandID:      brandID,
		Status:       "pending",
		ContentJSON:  append([]byte(nil), contentJSON...),
		TrendContext: append([]byte(nil), trendContext...),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}, nil
}

func (m *mockPostService) GetByID(ctx context.Context, id, userID string) (*service.Post, error) {
	post := m.byID[id]
	if post == nil || post.UserID != userID {
		return nil, service.ErrPostNotFound
	}
	clone := *post
	clone.ContentJSON = append([]byte(nil), post.ContentJSON...)
	clone.TrendContext = append([]byte(nil), post.TrendContext...)
	return &clone, nil
}

func (m *mockPostService) ListByUserID(ctx context.Context, userID string) ([]service.Post, error) {
	out := []service.Post{}
	for _, post := range m.byID {
		if post.UserID == userID {
			clone := *post
			clone.ContentJSON = append([]byte(nil), post.ContentJSON...)
			clone.TrendContext = append([]byte(nil), post.TrendContext...)
			out = append(out, clone)
		}
	}
	return out, nil
}

func (m *mockPostService) UpdateStatus(ctx context.Context, id, userID, status string) (*service.Post, error) {
	if status != "pending" && status != "approved" && status != "rejected" {
		return nil, service.ErrInvalidStatus
	}
	post := m.byID[id]
	if post == nil || post.UserID != userID {
		return nil, service.ErrPostNotFound
	}
	post.Status = status
	post.UpdatedAt = time.Now()
	clone := *post
	clone.ContentJSON = append([]byte(nil), post.ContentJSON...)
	clone.TrendContext = append([]byte(nil), post.TrendContext...)
	return &clone, nil
}

func buildPostRouter(svc handler.PostServiceInterface) http.Handler {
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(jwtauth.Verifier(testTokenAuth))
		r.Use(jwtauth.Authenticator(testTokenAuth))

		h := handler.NewPostHandler(svc)
		r.Get("/api/posts", h.List)
		r.Get("/api/posts/{id}/insights", h.GetPostInsights)
		r.Patch("/api/posts/{id}/status", h.UpdateStatus)
	})
	return r
}

func TestPostInsights_Unauthenticated(t *testing.T) {
	svc := &mockPostService{}
	router := buildPostRouter(svc)

	req := httptest.NewRequest(http.MethodGet, "/api/posts/post-1/insights", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}

func TestPostInsights_ReturnsSummaryPayload(t *testing.T) {
	svc := &mockPostService{
		byID: map[string]*service.Post{
			"post-1": {
				ID:     "post-1",
				UserID: "user-abc",
				TrendContext: json.RawMessage(`{
					"competitor_gap_analysis": {
						"selection_mode":"gap_first",
						"primary_gap_theme":"delivery speed",
						"why_now_summary":"Competitors are under-serving fast delivery content.",
						"competitors_considered":["@alpha","@beta"],
						"key_signals":{"gap_strength":0.88,"trend_momentum":0.63,"brand_fit":0.79},
						"confidence_band":"high"
					}
				}`),
			},
		},
	}
	router := buildPostRouter(svc)
	token := makeTestJWT(t, "user-abc")

	req := httptest.NewRequest(http.MethodGet, "/api/posts/post-1/insights", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rr.Code, rr.Body.String())
	}

	var body map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body["post_id"] != "post-1" {
		t.Fatalf("expected post_id post-1, got %v", body["post_id"])
	}
	if body["selection_mode"] != "gap_first" {
		t.Fatalf("expected selection_mode gap_first, got %v", body["selection_mode"])
	}
	if _, ok := body["competitor_gap_analysis"]; ok {
		t.Fatalf("expected normalized response without raw competitor_gap_analysis dump")
	}
}

func TestPostInsights_EnforcesOwnership(t *testing.T) {
	svc := &mockPostService{
		byID: map[string]*service.Post{
			"post-1": {
				ID:           "post-1",
				UserID:       "user-other",
				TrendContext: json.RawMessage(`{"competitor_gap_analysis":{"selection_mode":"gap_first"}}`),
			},
		},
	}
	router := buildPostRouter(svc)
	token := makeTestJWT(t, "user-abc")

	req := httptest.NewRequest(http.MethodGet, "/api/posts/post-1/insights", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for foreign post, got %d", rr.Code)
	}
}

func TestPostInsights_ReturnsFallbackMetadata(t *testing.T) {
	svc := &mockPostService{
		byID: map[string]*service.Post{
			"post-1": {
				ID:     "post-1",
				UserID: "user-abc",
				TrendContext: json.RawMessage(`{
					"competitor_gap_analysis": {
						"selection_mode":"trend_fallback",
						"primary_gap_theme":"weekend offers",
						"why_now_summary":"No strong gap passed quality gates.",
						"competitors_considered":["@alpha"],
						"key_signals":{"gap_strength":0.22,"trend_momentum":0.71,"brand_fit":0.68},
						"confidence_band":"medium",
						"fallback_reason":"no_strong_gap_found"
					}
				}`),
			},
		},
	}
	router := buildPostRouter(svc)
	token := makeTestJWT(t, "user-abc")

	req := httptest.NewRequest(http.MethodGet, "/api/posts/post-1/insights", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rr.Code, rr.Body.String())
	}

	var body map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["selection_mode"] != "trend_fallback" {
		t.Fatalf("expected trend_fallback mode, got %v", body["selection_mode"])
	}
	if body["fallback_reason"] != "no_strong_gap_found" {
		t.Fatalf("expected fallback_reason no_strong_gap_found, got %v", body["fallback_reason"])
	}
}

func TestPostListAndUpdateStatus_Regression(t *testing.T) {
	svc := &mockPostService{
		byID: map[string]*service.Post{
			"post-1": {
				ID:          "post-1",
				UserID:      "user-abc",
				BrandID:     "brand-1",
				Status:      "pending",
				ContentJSON: json.RawMessage(`{"post_text":"hello"}`),
			},
			"post-2": {
				ID:          "post-2",
				UserID:      "user-other",
				BrandID:     "brand-2",
				Status:      "pending",
				ContentJSON: json.RawMessage(`{"post_text":"hidden"}`),
			},
		},
	}
	router := buildPostRouter(svc)
	token := makeTestJWT(t, "user-abc")

	listReq := httptest.NewRequest(http.MethodGet, "/api/posts", nil)
	listReq.Header.Set("Authorization", "Bearer "+token)
	listRR := httptest.NewRecorder()
	router.ServeHTTP(listRR, listReq)

	if listRR.Code != http.StatusOK {
		t.Fatalf("expected 200 on list, got %d", listRR.Code)
	}

	var posts []map[string]interface{}
	if err := json.Unmarshal(listRR.Body.Bytes(), &posts); err != nil {
		t.Fatalf("failed to parse list response: %v", err)
	}
	if len(posts) != 1 {
		t.Fatalf("expected 1 user-scoped post, got %d", len(posts))
	}

	body := bytes.NewBufferString(`{"status":"approved"}`)
	updateReq := httptest.NewRequest(http.MethodPatch, "/api/posts/post-1/status", body)
	updateReq.Header.Set("Authorization", "Bearer "+token)
	updateReq.Header.Set("Content-Type", "application/json")
	updateRR := httptest.NewRecorder()
	router.ServeHTTP(updateRR, updateReq)

	if updateRR.Code != http.StatusOK {
		t.Fatalf("expected 200 on update, got %d (body: %s)", updateRR.Code, updateRR.Body.String())
	}

	var updated map[string]interface{}
	if err := json.Unmarshal(updateRR.Body.Bytes(), &updated); err != nil {
		t.Fatalf("failed to parse update response: %v", err)
	}
	if updated["status"] != "approved" {
		t.Fatalf("expected updated status approved, got %v", updated["status"])
	}
}
