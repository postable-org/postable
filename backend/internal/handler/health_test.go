package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"postable/internal/handler"
)

func TestHealth(t *testing.T) {
	h := handler.NewHealthHandler()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rr.Code)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body["service"] != "postable-backend" {
		t.Errorf("expected service=postable-backend, got %v", body["service"])
	}

	if body["status"] != "ok" {
		t.Errorf("expected status=ok, got %v", body["status"])
	}

	if _, ok := body["uptime_seconds"]; !ok {
		t.Error("expected uptime_seconds field in response")
	}
}
