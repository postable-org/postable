package handler_test

import (
	"bytes"
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

func buildCompetitorRouter(compSvc handler.CompetitorServiceInterface, brandSvc handler.BrandServiceInterface) http.Handler {
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(jwtauth.Verifier(testTokenAuth))
		r.Use(jwtauth.Authenticator(testTokenAuth))

		h := handler.NewCompetitorHandler(compSvc, brandSvc)
		r.Get("/api/competitors", h.List)
		r.Put("/api/competitors", h.Upsert)
	})
	return r
}

func TestCompetitorGet_Unauthenticated(t *testing.T) {
	compSvc := service.NewCompetitorService(nil)
	brandSvc := &MockBrandService{
		brand: &service.Brand{ID: "brand-1", UserID: "user-abc", State: "SP"},
	}
	router := buildCompetitorRouter(compSvc, brandSvc)

	req := httptest.NewRequest(http.MethodGet, "/api/competitors", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}

func TestCompetitorPut_AddRemoveLockUnlockSemantics(t *testing.T) {
	compSvc := service.NewCompetitorService(nil)
	brandSvc := &MockBrandService{
		brand: &service.Brand{ID: "brand-1", UserID: "user-abc", State: "SP"},
	}
	router := buildCompetitorRouter(compSvc, brandSvc)
	token := makeTestJWT(t, "user-abc")

	body := bytes.NewBufferString(`{
	  "ops": [
	    {"type":"add","handle":"@alpha_store"},
	    {"type":"add","handle":"@beta_store"},
	    {"type":"add","handle":"@gamma_store"},
	    {"type":"lock","handle":"@alpha_store"},
	    {"type":"unlock","handle":"@alpha_store"},
	    {"type":"remove","handle":"@beta_store"}
	  ]
	}`)
	req := httptest.NewRequest(http.MethodPut, "/api/competitors", body)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rr.Code, rr.Body.String())
	}

	var putResp service.CompetitorUpdateResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &putResp); err != nil {
		t.Fatalf("failed to decode PUT response: %v", err)
	}
	if len(putResp.AppliedOps) != 6 {
		t.Fatalf("expected 6 applied ops, got %d", len(putResp.AppliedOps))
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/competitors", nil)
	getReq.Header.Set("Authorization", "Bearer "+token)
	getRR := httptest.NewRecorder()
	router.ServeHTTP(getRR, getReq)
	if getRR.Code != http.StatusOK {
		t.Fatalf("expected 200 on GET, got %d (body: %s)", getRR.Code, getRR.Body.String())
	}

	var getResp service.CompetitorListResponse
	if err := json.Unmarshal(getRR.Body.Bytes(), &getResp); err != nil {
		t.Fatalf("failed to decode GET response: %v", err)
	}

	var alphaFound, betaRemoved bool
	for _, c := range getResp.Competitors {
		if c.Handle == "@alpha_store" {
			alphaFound = true
			if c.IsLocked {
				t.Fatalf("expected @alpha_store to be unlocked after unlock op")
			}
		}
		if c.Handle == "@beta_store" && c.Status == "replaced" {
			betaRemoved = true
		}
	}
	if !alphaFound {
		t.Fatalf("expected @alpha_store in competitor list")
	}
	if !betaRemoved {
		t.Fatalf("expected @beta_store to be marked as replaced after remove")
	}
}

func TestCompetitorPut_ReturnsReplacementNoticesForInvalidPrivateInactive(t *testing.T) {
	compSvc := service.NewCompetitorService(nil)
	brandSvc := &MockBrandService{
		brand: &service.Brand{ID: "brand-1", UserID: "user-abc", State: "SP"},
	}
	router := buildCompetitorRouter(compSvc, brandSvc)
	token := makeTestJWT(t, "user-abc")

	body := bytes.NewBufferString(`{
	  "ops": [
	    {"type":"add","handle":"@bad handle!"},
	    {"type":"add","handle":"@private_profile"},
	    {"type":"add","handle":"@inactive_shop"}
	  ]
	}`)
	req := httptest.NewRequest(http.MethodPut, "/api/competitors", body)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rr.Code, rr.Body.String())
	}

	var resp service.CompetitorUpdateResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(resp.Replacements) < 2 {
		t.Fatalf("expected replacement notices for non-active handles, got %d", len(resp.Replacements))
	}
	for _, notice := range resp.Replacements {
		if !strings.HasPrefix(notice.ReplacementHandle, "@") {
			t.Fatalf("expected replacement handle in @format, got %q", notice.ReplacementHandle)
		}
	}
}

func TestCompetitorPut_ActiveCountWithinRange3To7(t *testing.T) {
	compSvc := service.NewCompetitorService(nil)
	brandSvc := &MockBrandService{
		brand: &service.Brand{ID: "brand-1", UserID: "user-abc", State: "SP"},
	}
	router := buildCompetitorRouter(compSvc, brandSvc)
	token := makeTestJWT(t, "user-abc")

	body := bytes.NewBufferString(`{
	  "ops": [
	    {"type":"add","handle":"@h1"}, {"type":"add","handle":"@h2"}, {"type":"add","handle":"@h3"},
	    {"type":"add","handle":"@h4"}, {"type":"add","handle":"@h5"}, {"type":"add","handle":"@h6"},
	    {"type":"add","handle":"@h7"}, {"type":"add","handle":"@h8"}, {"type":"add","handle":"@h9"},
	    {"type":"add","handle":"@h10"}
	  ]
	}`)
	req := httptest.NewRequest(http.MethodPut, "/api/competitors", body)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rr.Code, rr.Body.String())
	}

	var resp service.CompetitorUpdateResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.ActiveCount < 3 || resp.ActiveCount > 7 {
		t.Fatalf("expected active_count in range [3,7], got %d", resp.ActiveCount)
	}
}

func TestCompetitorPut_StateLocalityEnforced(t *testing.T) {
	compSvc := service.NewCompetitorService(nil)
	brandSvc := &MockBrandService{
		brand: &service.Brand{ID: "brand-1", UserID: "user-abc", State: "sp"},
	}
	router := buildCompetitorRouter(compSvc, brandSvc)
	token := makeTestJWT(t, "user-abc")

	body := bytes.NewBufferString(`{
	  "ops": [
	    {"type":"add","handle":"@alpha"},
	    {"type":"add","handle":"@beta"},
	    {"type":"add","handle":"@gamma"}
	  ]
	}`)
	req := httptest.NewRequest(http.MethodPut, "/api/competitors", body)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rr.Code, rr.Body.String())
	}

	var resp service.CompetitorUpdateResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	for _, c := range resp.Competitors {
		if c.LocalityBasis != service.StateLocalityLevel {
			t.Fatalf("expected locality_basis=%q, got %q", service.StateLocalityLevel, c.LocalityBasis)
		}
		if c.StateKey != "SP" {
			t.Fatalf("expected normalized state_key SP, got %q", c.StateKey)
		}
	}
}

func TestCompetitorPut_SnapshotEvidenceIncludesPostCountThemesConfidence(t *testing.T) {
	compSvc := service.NewCompetitorService(nil)
	brandSvc := &MockBrandService{
		brand: &service.Brand{ID: "brand-1", UserID: "user-abc", State: "SP"},
	}
	router := buildCompetitorRouter(compSvc, brandSvc)
	token := makeTestJWT(t, "user-abc")

	body := bytes.NewBufferString(`{
	  "ops": [
	    {"type":"add","handle":"@alpha"},
	    {"type":"add","handle":"@beta"},
	    {"type":"add","handle":"@gamma"}
	  ]
	}`)
	req := httptest.NewRequest(http.MethodPut, "/api/competitors", body)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rr.Code, rr.Body.String())
	}

	var resp service.CompetitorUpdateResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(resp.Snapshots) == 0 {
		t.Fatalf("expected snapshots in response")
	}
	for _, snap := range resp.Snapshots {
		if snap.PostCount <= 0 {
			t.Fatalf("expected post_count > 0, got %d", snap.PostCount)
		}
		if len(snap.ThemesJSON) == 0 {
			t.Fatalf("expected themes_json to be populated")
		}
		if snap.Confidence <= 0 {
			t.Fatalf("expected confidence > 0, got %v", snap.Confidence)
		}
	}
}
