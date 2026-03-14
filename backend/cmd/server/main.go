package main

import (
	"bufio"
	"context"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	"postable/internal/handler"
	"postable/internal/middleware"
	"postable/internal/service"
)

// loadEnv reads KEY=VALUE pairs from path and sets them as env vars,
// skipping keys that are already set (so real env always wins).
func loadEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.Trim(strings.TrimSpace(val), `"'`)
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}

func main() {
	loadEnv(".env")
	middleware.Init()

	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:3001, http://localhost:3000"
	}

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{allowedOrigins},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)

	// Public routes
	healthHandler := handler.NewHealthHandler()
	r.Get("/health", healthHandler.ServeHTTP)

	// Initialize DB pool if DATABASE_URL is set
	var dbPool *pgxpool.Pool
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		pool, err := pgxpool.New(context.Background(), databaseURL)
		if err != nil {
			slog.Error("failed to connect to database", "error", err)
			os.Exit(1)
		}
		dbPool = pool
		defer pool.Close()
		slog.Info("database pool initialized")
	} else {
		slog.Warn("DATABASE_URL not set — running without DB (stub mode)")
	}

	// Initialize services
	brandSvc := service.NewBrandService(dbPool)
	competitorSvc := service.NewCompetitorService(dbPool)
	postSvc := service.NewPostService(dbPool)
	generateSvc := service.NewGenerateService()

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Verifier())
		r.Use(middleware.Authenticator())

		brandHandler := handler.NewBrandHandler(brandSvc)
		r.Post("/api/brands", brandHandler.Create)
		r.Get("/api/brands", brandHandler.Get)
		r.Put("/api/brands", brandHandler.Update)

		competitorHandler := handler.NewCompetitorHandler(competitorSvc, brandSvc)
		// GET("/api/competitors") and PUT("/api/competitors") remain authenticated.
		r.Get("/api/competitors", competitorHandler.List)
		r.Put("/api/competitors", competitorHandler.Upsert)

		postHandler := handler.NewPostHandler(postSvc)
		r.Get("/api/posts", postHandler.List)
		r.Get("/api/posts/{id}/insights", postHandler.GetPostInsights)
		r.Patch("/api/posts/{id}/status", postHandler.UpdateStatus)

		generateHandler := handler.NewGenerateHandler(generateSvc, brandSvc, postSvc)
		r.Get("/api/generate", generateHandler.Generate)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	slog.Info("server starting", "port", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}
