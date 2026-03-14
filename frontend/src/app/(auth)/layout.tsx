import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* ─── Left panel (brand) ─── */}
      <div
        className="hidden lg:flex lg:w-[58%] relative flex-col justify-between p-14 overflow-hidden"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        {/* Ambient glow — logo corner */}
        <div
          className="absolute top-0 left-0 w-80 h-80 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 0% 0%, rgba(166,200,249,0.12) 0%, transparent 65%)",
          }}
        />

        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#f8f5ef 1px, transparent 1px), linear-gradient(90deg, #f8f5ef 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="logo-glow">
            <Image
              src="/logo.webp"
              alt="Postable"
              width={38}
              height={38}
              className="rounded-xl"
            />
          </div>
          <span
            className="text-xl font-semibold tracking-tight"
            style={{
              color: "#f8f5ef",
              fontFamily: "var(--font-sans), system-ui, sans-serif",
            }}
          >
            Postable
          </span>
        </div>

        {/* Statement */}
        <div className="relative z-10 max-w-md">
          <p
            className="text-[2.75rem] font-bold leading-[1.15] tracking-tight"
            style={{
              color: "rgba(248,245,239,0.92)",
              fontFamily: "var(--font-sans), system-ui, sans-serif",
            }}
          >
            Conteúdo que converte.
            <br />
            <span style={{ color: "rgba(248,245,239,0.45)" }}>
              Inteligência que diferencia.
            </span>
          </p>
          <p
            className="mt-6 text-sm leading-relaxed"
            style={{
              color: "rgba(248,245,239,0.35)",
              fontFamily: "var(--font-body), system-ui, sans-serif",
              letterSpacing: "0.01em",
            }}
          >
            Social media content powered by competitive intelligence.
          </p>
        </div>

        {/* Bottom testimonial */}
        <div className="relative z-10">
          <div
            className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              backgroundColor: "rgba(248,245,239,0.05)",
              border: "1px solid rgba(248,245,239,0.08)",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{
                backgroundColor: "rgba(166,200,249,0.15)",
                color: "#a6c8f9",
              }}
            >
              M
            </div>
            <div>
              <p
                className="text-xs leading-relaxed"
                style={{
                  color: "rgba(248,245,239,0.6)",
                  fontFamily: "var(--font-body)",
                }}
              >
                &quot;Economizamos horas toda semana. Os posts geram mais
                engajamento do que nunca.&quot;
              </p>
              <p
                className="text-xs mt-0.5 font-medium"
                style={{
                  color: "rgba(248,245,239,0.3)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Marina S. — Studio de Pilates, SP
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right panel (form) ─── */}
      <div
        className="flex-1 flex items-center justify-center p-8 min-h-screen"
        style={{ backgroundColor: "#f8f5ef" }}
      >
        <div className="w-full max-w-[22rem]">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex items-center gap-2.5">
            <div className="logo-glow">
              <Image
                src="/logo.webp"
                alt="Postable"
                width={30}
                height={30}
                className="rounded-lg"
              />
            </div>
            <span
              className="text-lg font-semibold tracking-tight"
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
