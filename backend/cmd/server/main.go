package main

import (
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"

	"postable/internal/handler"
	"postable/internal/middleware"
	"postable/internal/service"
)

func main() {
	r := chi.NewRouter()
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)

	// Public routes
	healthHandler := handler.NewHealthHandler()
	r.Get("/health", healthHandler.ServeHTTP)

	// Initialize services
	brandSvc := service.NewBrandService(nil) // DB pool injected later (Phase 2)
	generateSvc := service.NewGenerateService()

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Verifier())
		r.Use(middleware.Authenticator())

		brandHandler := handler.NewBrandHandler(brandSvc)
		r.Post("/api/brands", brandHandler.Create)
		r.Get("/api/brands", brandHandler.Get)
		r.Put("/api/brands", brandHandler.Update)

		generateHandler := handler.NewGenerateHandler(generateSvc, brandSvc)
		r.Get("/api/generate", generateHandler.Generate)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.ListenAndServe(":"+port, r)
}
