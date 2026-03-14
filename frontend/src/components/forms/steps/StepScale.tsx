"use client";

import { User, Users, Building2, Building } from "lucide-react";

const SCALES = [
  {
    value: "solo",
    label: "Só eu",
    desc: "Empreendedor individual",
    Icon: User,
  },
  {
    value: "2-10",
    label: "2 a 10 pessoas",
    desc: "Pequena equipe",
    Icon: Users,
  },
  {
    value: "11-50",
    label: "11 a 50 pessoas",
    desc: "Empresa em crescimento",
    Icon: Building2,
  },
  {
    value: "50+",
    label: "Mais de 50",
    desc: "Grande empresa",
    Icon: Building,
  },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function StepScale({ value, onChange }: Props) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <p
          className="text-sm font-medium uppercase tracking-widest"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          Passo 3 de 8
        </p>
        <h2
          className="text-4xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Qual é o tamanho da sua empresa?
        </h2>
        <p className="text-base" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
          Vamos adaptar nossa estratégia ao seu perfil.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SCALES.map(({ value: v, label, desc, Icon }) => {
          const selected = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className="select-card flex items-center gap-4 px-5 py-5 text-left"
              style={
                selected
                  ? { background: "#0a0a0a", borderColor: "#0a0a0a", color: "#f8f5ef" }
                  : {}
              }
            >
              <div
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: selected
                    ? "rgba(248,245,239,0.12)"
                    : "#f0ede7",
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={1.8}
                  style={{ color: selected ? "#f8f5ef" : "#0a0a0a" }}
                />
              </div>
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{
                    fontFamily: "var(--font-body)",
                    color: selected ? "#f8f5ef" : "#0a0a0a",
                  }}
                >
                  {label}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{
                    fontFamily: "var(--font-body)",
                    color: selected ? "rgba(248,245,239,0.6)" : "#8c8880",
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
