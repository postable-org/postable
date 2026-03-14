export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-foreground flex-col justify-between p-12">
        <div>
          <span
            className="text-2xl font-bold text-background"
            style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
          >
            Postable
          </span>
        </div>
        <div>
          <p
            className="text-4xl font-bold leading-tight"
            style={{
              fontFamily: "var(--font-sans), system-ui, sans-serif",
              color: "rgba(255,255,255,0.9)",
            }}
          >
            Conteúdo que converte.
            <br />
            Inteligência que diferencia.
          </p>
          <p
            className="mt-4 text-sm"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Social media content powered by competitive intelligence.
          </p>
        </div>
        <div />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile wordmark */}
          <div className="lg:hidden mb-8">
            <span
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
            >
              Postable
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
