package handler

import (
	"encoding/json"
	"net/http"
	"time"
)

var startTime = time.Now()

// HealthHandler handles GET /health requests.
type HealthHandler struct{}

// NewHealthHandler creates a new HealthHandler.
func NewHealthHandler() *HealthHandler {
	return &HealthHandler{}
}

// ServeHTTP implements http.Handler for GET /health.
func (h *HealthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service":         "postable-backend",
		"status":          "ok",
		"uptime_seconds":  int(time.Since(startTime).Seconds()),
	})
}
