package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"

	"postable/internal/handler"
	"postable/internal/service"
)

type mockCompetitorSvc struct{}

func (m *mockCompetitorSvc) ActiveSnapshotsForGenerate(_ context.Context, _, _ string) ([]json.RawMessage, error) {
	return []json.RawMessage{}, nil
}

func buildGenerateRouter(genSvc handler.GenerateServiceInterface, brandSvc handler.BrandServiceInterface, postSvc handler.PostServiceInterface) http.Handler {
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(jwtauth.Verifier(testTokenAuth))
		r.Use(jwtauth.Authenticator(testTokenAuth))

		h := handler.NewGenerateHandler(genSvc, brandSvc, postSvc, &mockCompetitorSvc{})
		r.Get("/api/generate", h.Generate)
	})
	return r
}

func TestGenerateSSE_EmitsCompetitorStageEvent(t *testing.T) {
	python := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"post_text":"hello","cta":"dm","hashtags":["#a"],"suggested_format":"feed_post","strategic_justification":"because","tokens_used":42}`))
	}))
	defer python.Close()

	t.Setenv("PYTHON_AGENT_URL", python.URL)
	genSvc := service.NewGenerateService()
	brandSvc := &MockBrandService{brand: &service.Brand{ID: "brand-1", UserID: "user-abc", Niche: "food", City: "Sao Paulo", State: "SP", ToneOfVoice: "friendly", CTAChannel: "dm"}}
	postSvc := &mockPostService{}
	router := buildGenerateRouter(genSvc, brandSvc, postSvc)
	token := makeTestJWT(t, "user-abc")

	req := httptest.NewRequest(http.MethodGet, "/api/generate", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rr.Code, rr.Body.String())
	}

	body := rr.Body.String()
	if !strings.Contains(body, `"stage":"competitor-analysis"`) {
		t.Fatalf("expected competitor-analysis stage event in stream body: %s", body)
	}
	if !strings.Contains(body, "event: done") {
		t.Fatalf("expected done event in stream body: %s", body)
	}
	if strings.Index(body, `"stage":"competitor-analysis"`) > strings.Index(body, "event: done") {
		t.Fatalf("expected competitor-analysis stage before completion: %s", body)
	}
}

func TestGenerateCompetitorGapAnalysis_PersistsToTrendContext(t *testing.T) {
	python := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"post_text":"hello",
			"cta":"dm",
			"hashtags":["#a"],
			"suggested_format":"feed_post",
			"strategic_justification":"because",
			"tokens_used":42,
			"competitor_gap_analysis":{
				"selection_mode":"trend_fallback",
				"primary_gap_theme":"weekend offers",
				"why_now_summary":"No strong gap met quality gates.",
				"competitors_considered":["@alpha"],
				"key_signals":{"gap_strength":0.23,"trend_momentum":0.74,"brand_fit":0.66},
				"confidence_band":"medium",
				"fallback_reason":"no_strong_gap_found"
			}
		}`))
	}))
	defer python.Close()

	t.Setenv("PYTHON_AGENT_URL", python.URL)
	genSvc := service.NewGenerateService()
	brandSvc := &MockBrandService{brand: &service.Brand{ID: "brand-1", UserID: "user-abc", Niche: "food", City: "Sao Paulo", State: "SP", ToneOfVoice: "friendly", CTAChannel: "dm"}}
	postSvc := &mockPostService{}
	router := buildGenerateRouter(genSvc, brandSvc, postSvc)
	token := makeTestJWT(t, "user-abc")

	req := httptest.NewRequest(http.MethodGet, "/api/generate", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rr.Code, rr.Body.String())
	}
	if len(postSvc.lastCreateContent) == 0 {
		t.Fatalf("expected generated content to be persisted")
	}
	if len(postSvc.lastCreateTrend) == 0 {
		t.Fatalf("expected trend_context with competitor gap analysis to be persisted")
	}

	var content map[string]json.RawMessage
	if err := json.Unmarshal(postSvc.lastCreateContent, &content); err != nil {
		t.Fatalf("failed to decode persisted content JSON: %v", err)
	}
	if _, ok := content["competitor_gap_analysis"]; !ok {
		t.Fatalf("expected full final payload to include competitor_gap_analysis")
	}

	var trend map[string]json.RawMessage
	if err := json.Unmarshal(postSvc.lastCreateTrend, &trend); err != nil {
		t.Fatalf("failed to decode trend_context JSON: %v", err)
	}

	analysisRaw, ok := trend["competitor_gap_analysis"]
	if !ok {
		t.Fatalf("expected trend_context.competitor_gap_analysis field")
	}

	var analysis map[string]interface{}
	if err := json.Unmarshal(analysisRaw, &analysis); err != nil {
		t.Fatalf("failed to decode competitor_gap_analysis: %v", err)
	}
	if analysis["selection_mode"] != "trend_fallback" {
		t.Fatalf("expected trend_fallback mode, got %v", analysis["selection_mode"])
	}
	if analysis["fallback_reason"] != "no_strong_gap_found" {
		t.Fatalf("expected fallback_reason no_strong_gap_found, got %v", analysis["fallback_reason"])
	}
}
