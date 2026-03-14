"use client";

import { MessageCircle, Globe, Send } from "lucide-react";

type CTAChannel = "" | "whatsapp" | "landing_page" | "dm";

const CTA_OPTIONS = [
  {
    value: "whatsapp" as const,
    label: "WhatsApp",
    desc: "Direcione clientes por mensagem direta — conversão imediata.",
    Icon: MessageCircle,
    badge: "Mais popular",
  },
  {
    value: "landing_page" as const,
    label: "Landing Page",
    desc: "Envie para seu site, página de captura ou loja online.",
    Icon: Globe,
    badge: null,
  },
  {
    value: "dm" as const,
    label: "Direct Message",
    desc: "Engaje diretamente pelo Instagram DM — íntimo e eficaz.",
    Icon: Send,
    badge: null,
  },
];

interface Props {
  value: CTAChannel;
  onChange: (value: CTAChannel) => void;
  // Legacy compat
  defaultChannel?: CTAChannel;
  onNext?: (channel: "whatsapp" | "landing_page" | "dm") => void;
}

export default function StepCTAChannel({ value, onChange }: Props) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <p
          className="text-sm font-medium uppercase tracking-widest"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          Passo 6 de 8
        </p>
        <h2
          className="text-4xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Qual é o seu canal de conversão?
        </h2>
        <p className="text-base" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
          Para onde você direciona clientes interessados?
        </p>
      </div>

      <div className="space-y-3 max-w-sm mx-auto">
        {CTA_OPTIONS.map(({ value: v, label, desc, Icon, badge }) => {
          const selected = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className="select-card w-full flex items-start gap-4 px-5 py-5 text-left"
              style={
                selected
                  ? { background: "#0a0a0a", borderColor: "#0a0a0a" }
                  : {}
              }
            >
              <div
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5"
                style={{
                  backgroundColor: selected
                    ? "rgba(248,245,239,0.12)"
                    : "#f0ede7",
                }}
              >
                <Icon
                  size={18}
                  strokeWidth={1.8}
                  style={{ color: selected ? "#f8f5ef" : "#0a0a0a" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-sm font-semibold"
                    style={{
                      fontFamily: "var(--font-body)",
                      color: selected ? "#f8f5ef" : "#0a0a0a",
                    }}
                  >
                    {label}
                  </span>
                  {badge && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: selected
                          ? "rgba(166,200,249,0.2)"
                          : "#e4e0d8",
                        color: selected ? "#a6c8f9" : "#8c8880",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </div>
                <p
                  className="text-xs mt-1 leading-relaxed"
                  style={{
                    fontFamily: "var(--font-body)",
                    color: selected ? "rgba(248,245,239,0.55)" : "#8c8880",
                  }}
                >
                  {desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
