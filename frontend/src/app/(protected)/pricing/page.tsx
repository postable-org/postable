"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { createCheckoutSession } from "@/lib/api/subscription";

const PLANS = [
  {
    name: "Basic",
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY ?? "",
    yearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_YEARLY ?? "",
    postsPerMonth: 10,
    analyticsEnabled: false,
    monthlyPrice: "R$ 97",
    yearlyPrice: "R$ 78",
    description: "Para quem está começando nas redes sociais.",
  },
  {
    name: "Advanced",
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ADVANCED_MONTHLY ?? "",
    yearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ADVANCED_YEARLY ?? "",
    postsPerMonth: 25,
    analyticsEnabled: true,
    monthlyPrice: "R$ 197",
    yearlyPrice: "R$ 158",
    description: "Para criadores que querem crescer com estratégia.",
    highlight: true,
  },
  {
    name: "Agency",
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_MONTHLY ?? "",
    yearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_YEARLY ?? "",
    postsPerMonth: 60,
    analyticsEnabled: true,
    monthlyPrice: "R$ 297",
    yearlyPrice: "R$ 238",
    description: "Para agências e times que gerenciam múltiplas marcas.",
  },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (plan: (typeof PLANS)[0]) => {
    const priceId =
      billing === "yearly" ? plan.yearlyPriceId : plan.monthlyPriceId;
    if (!priceId) {
      setError("Plano não configurado. Contate o suporte.");
      return;
    }
    try {
      setLoading(plan.name);
      setError(null);
      const { url } = await createCheckoutSession(priceId);
      window.location.href = url;
    } catch {
      setError("Erro ao criar sessão de pagamento. Tente novamente.");
      setLoading(null);
    }
  };

  return (
    // Pricing usa layout centrado de tela cheia — não tem sidebar wrapper
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{ backgroundColor: "#f8f5ef" }}
    >
      <div className="max-w-5xl w-full space-y-8">
        {/* ── Header — mesma estrutura de título/subtítulo ── */}
        <div className="text-center">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-sans)", color: "#0a0a0a" }}
          >
            Escolha seu plano
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            Posts gerados por IA, por plataforma, todo mês.
          </p>

          {/* Billing toggle — mesmo padrão pill */}
          <div
            className="inline-flex items-center p-1 rounded-xl mt-6"
            style={{ backgroundColor: "#f0ede7" }}
          >
            <button
              onClick={() => setBilling("monthly")}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor:
                  billing === "monthly" ? "#0a0a0a" : "transparent",
                color: billing === "monthly" ? "#f8f5ef" : "#8c8880",
                fontFamily: "var(--font-body)",
              }}
            >
              Mensal
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor:
                  billing === "yearly" ? "#0a0a0a" : "transparent",
                color: billing === "yearly" ? "#f8f5ef" : "#8c8880",
                fontFamily: "var(--font-body)",
              }}
            >
              Anual
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor:
                    billing === "yearly" ? "rgba(166,200,249,0.25)" : "#d4f0d4",
                  color: billing === "yearly" ? "#a6c8f9" : "#166534",
                }}
              >
                -20%
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm text-center"
            style={{
              backgroundColor: "#fde8e8",
              color: "#b91c1c",
              fontFamily: "var(--font-body)",
            }}
          >
            {error}
          </div>
        )}

        {/* ── Plan cards ── */}
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const price =
              billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
            return (
              <div
                key={plan.name}
                className="rounded-2xl p-7 flex flex-col"
                style={{
                  backgroundColor: plan.highlight ? "#0a0a0a" : "#ffffff",
                  border: plan.highlight ? "none" : "1.5px solid #e4e0d8",
                  color: plan.highlight ? "#f8f5ef" : "#0a0a0a",
                }}
              >
                <div className="mb-6">
                  <span
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{
                      color: plan.highlight
                        ? "rgba(248,245,239,0.5)"
                        : "#8c8880",
                    }}
                  >
                    {plan.name}
                  </span>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span
                      className="text-3xl font-bold"
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      {price}
                    </span>
                    <span
                      className="text-sm"
                      style={{
                        color: plan.highlight
                          ? "rgba(248,245,239,0.5)"
                          : "#8c8880",
                      }}
                    >
                      /mês
                    </span>
                  </div>
                  {billing === "yearly" && (
                    <p
                      className="text-xs mt-1"
                      style={{
                        color: plan.highlight
                          ? "rgba(166,200,249,0.7)"
                          : "#6b9e6b",
                      }}
                    >
                      Cobrado anualmente
                    </p>
                  )}
                  <p
                    className="mt-2 text-sm"
                    style={{
                      color: plan.highlight
                        ? "rgba(248,245,239,0.6)"
                        : "#8c8880",
                    }}
                  >
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-center gap-2.5 text-sm">
                    <Check
                      size={14}
                      strokeWidth={2.5}
                      style={{
                        color: plan.highlight ? "#a6c8f9" : "#22c55e",
                        flexShrink: 0,
                      }}
                    />
                    {plan.postsPerMonth} posts / plataforma / mês
                  </li>
                  <li className="flex items-center gap-2.5 text-sm">
                    {plan.analyticsEnabled ? (
                      <Check
                        size={14}
                        strokeWidth={2.5}
                        style={{
                          color: plan.highlight ? "#a6c8f9" : "#22c55e",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <X
                        size={14}
                        strokeWidth={2.5}
                        style={{
                          color: plan.highlight
                            ? "rgba(248,245,239,0.3)"
                            : "#d1cfc9",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span
                      style={{
                        color: plan.analyticsEnabled
                          ? undefined
                          : plan.highlight
                            ? "rgba(248,245,239,0.4)"
                            : "#8c8880",
                      }}
                    >
                      Analytics e insights
                    </span>
                  </li>
                </ul>

                {/* CTA — mesmo padrão de botão da app */}
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={loading === plan.name}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] disabled:opacity-60"
                  style={{
                    backgroundColor: plan.highlight ? "#f8f5ef" : "#0a0a0a",
                    color: plan.highlight ? "#0a0a0a" : "#f8f5ef",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {loading === plan.name ? "Redirecionando..." : "Assinar"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
