package main

import (
	"bufio"
	"context"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	stripe "github.com/stripe/stripe-go/v76"

	"postable/internal/handler"
	"postable/internal/middleware"
	"postable/internal/service"
	"postable/internal/storage"
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

	// Configure Stripe
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")

	allowedOriginsRaw := os.Getenv("ALLOWED_ORIGINS")
	if allowedOriginsRaw == "" {
		allowedOriginsRaw = "http://localhost:*,http://127.0.0.1:*"
	}
	var allowedOrigins []string
	for _, o := range strings.Split(allowedOriginsRaw, ",") {
		if trimmed := strings.TrimSpace(o); trimmed != "" {
			allowedOrigins = append(allowedOrigins, trimmed)
		}
	}

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
	slog.Info("configured CORS origins", "origins", allowedOrigins)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)

	// Public routes
	healthHandler := handler.NewHealthHandler()
	r.Get("/health", healthHandler.ServeHTTP)

	// Initialize DB pool if DATABASE_URL is set
	var dbPool *pgxpool.Pool
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		cfg, err := pgxpool.ParseConfig(databaseURL)
		if err != nil {
			slog.Error("failed to parse database URL", "error", err)
			os.Exit(1)
		}
		// Force IPv4 — pgconn resolves DNS before calling DialFunc, so we must
		// intercept at the lookup stage too; otherwise it hands us an IPv6 literal
		// which tcp4 cannot dial (Railway free plan has no IPv6 outbound routing).
		cfg.ConnConfig.LookupFunc = func(ctx context.Context, host string) ([]string, error) {
			ips, err := net.DefaultResolver.LookupIP(ctx, "ip4", host)
			if err != nil || len(ips) == 0 {
				// fall back to default resolution so we don't break local dev
				return net.DefaultResolver.LookupHost(ctx, host)
			}
			addrs := make([]string, len(ips))
			for i, ip := range ips {
				addrs[i] = ip.String()
			}
			return addrs, nil
		}
		// Try IPv4 first (required on Railway which has no IPv6 outbound routing).
		// Fall back to dual-stack tcp so local dev works when Supabase resolves to IPv6.
		cfg.ConnConfig.DialFunc = func(ctx context.Context, network, addr string) (net.Conn, error) {
			d := &net.Dialer{}
			if conn, err := d.DialContext(ctx, "tcp4", addr); err == nil {
				return conn, nil
			}
			return d.DialContext(ctx, "tcp", addr)
		}
		pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
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
	subSvc := service.NewSubscriptionService(dbPool)
	storageSvc := storage.NewSupabaseStorageClient()
	socialSvc := service.NewSocialService(dbPool, nil)
	analyticsSvc := service.NewAnalyticsService(dbPool)
	socialOAuthSvc := service.NewSocialOAuthService(socialSvc)
	socialSvc.SetTokenRefresher(socialOAuthSvc)
	socialOAuthHandler := handler.NewSocialOAuthHandler(socialOAuthSvc)
	r.Get("/api/social/oauth/{network}/callback", socialOAuthHandler.Callback)

	if dbPool != nil {
		go service.StartSocialScheduler(context.Background(), socialSvc, 15*time.Second, 20)
	}

	// Stripe price → plan mapping (monthly + yearly for each plan)
	priceToplan := map[string]string{
		os.Getenv("STRIPE_PRICE_BASIC_MONTHLY"):    "basic",
		os.Getenv("STRIPE_PRICE_BASIC_YEARLY"):     "basic",
		os.Getenv("STRIPE_PRICE_ADVANCED_MONTHLY"): "advanced",
		os.Getenv("STRIPE_PRICE_ADVANCED_YEARLY"):  "advanced",
		os.Getenv("STRIPE_PRICE_AGENCY_MONTHLY"):   "agency",
		os.Getenv("STRIPE_PRICE_AGENCY_YEARLY"):    "agency",
	}

	// Webhook handler (public — no JWT)
	webhookHandler := handler.NewWebhookHandler(subSvc, os.Getenv("STRIPE_WEBHOOK_SECRET"), priceToplan)
	r.Post("/api/webhook/stripe", webhookHandler.Handle)

	// JWT-authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Verifier())
		r.Use(middleware.Authenticator())

		// Brand setup (subscription-free — needed before subscribing)
		brandHandler := handler.NewBrandHandler(brandSvc)
		r.Post("/api/brands", brandHandler.Create)
		r.Get("/api/brands", brandHandler.Get)
		r.Put("/api/brands", brandHandler.Update)

		// Subscription management
		checkoutHandler := handler.NewCheckoutHandler(subSvc)
		r.Get("/api/subscription", checkoutHandler.GetSubscription)
		r.Post("/api/checkout/session", checkoutHandler.CreateSession)
		r.Post("/api/billing/portal", checkoutHandler.CreatePortalSession)

		// Subscription-gated routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireActiveSubscription(subSvc))

			competitorHandler := handler.NewCompetitorHandler(competitorSvc, brandSvc)
			r.Get("/api/competitors", competitorHandler.List)
			r.Put("/api/competitors", competitorHandler.Upsert)

			postHandler := handler.NewPostHandler(postSvc)
			r.Get("/api/posts", postHandler.List)
			r.Get("/api/posts/{id}", postHandler.Get)
			r.Get("/api/posts/{id}/insights", postHandler.GetPostInsights)
			r.Patch("/api/posts/{id}/status", postHandler.UpdateStatus)

			generateHandler := handler.NewGenerateHandlerWithQuota(generateSvc, brandSvc, postSvc, competitorSvc, subSvc, storageSvc)
			r.Post("/api/generate", generateHandler.Generate)
		})
		uploadHandler := handler.NewUploadHandler(storageSvc)
		socialHandler := handler.NewSocialHandler(socialSvc)
		analyticsHandler := handler.NewAnalyticsHandler(analyticsSvc)
		r.Post("/api/images/upload", uploadHandler.UploadImage)
		r.Get("/api/social/oauth/{network}/start", socialOAuthHandler.Start)
		r.Get("/api/social/connections", socialHandler.ListConnections)
		r.Post("/api/social/connections", socialHandler.UpsertConnection)
		r.Delete("/api/social/connections/{id}", socialHandler.DeleteConnection)
		r.Post("/api/social/publish", socialHandler.Publish)
		r.Get("/api/social/jobs", socialHandler.ListJobs)
		r.Post("/api/social/jobs/run-due", socialHandler.RunDueJobs)
		r.Post("/api/social/insights/refresh", socialHandler.RefreshInsights)
		r.Get("/api/analytics", analyticsHandler.Overview)
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
