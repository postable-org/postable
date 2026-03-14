"use client";

import { useState } from "react";
import {
  Utensils,
  Shirt,
  Sparkles,
  Dumbbell,
  ShoppingBag,
  Briefcase,
  BookOpen,
  Home,
  Laptop,
  PenLine,
} from "lucide-react";

const NICHES = [
  { value: "alimentacao", label: "Alimentação", Icon: Utensils },
  { value: "moda", label: "Moda", Icon: Shirt },
  { value: "saude_beleza", label: "Saúde & Beleza", Icon: Sparkles },
  { value: "fitness", label: "Fitness", Icon: Dumbbell },
  { value: "varejo", label: "Varejo", Icon: ShoppingBag },
  { value: "servicos", label: "Serviços", Icon: Briefcase },
  { value: "educacao", label: "Educação", Icon: BookOpen },
  { value: "imoveis", label: "Imóveis", Icon: Home },
  { value: "tecnologia", label: "Tecnologia", Icon: Laptop },
  { value: "outro", label: "Outro", Icon: PenLine },
];

interface Props {
  niche: string;
  nicheCustom: string;
  onChange: (niche: string, nicheCustom?: string) => void;
  // Legacy props from old step signature (kept for test compat)
  defaultValues?: { niche?: string; city?: string; state?: string };
  onNext?: (data: { niche: string; city: string; state: string }) => void;
}

export default function StepNicheLocation({
  niche,
  nicheCustom,
  onChange,
}: Props) {
  const [showCustom, setShowCustom] = useState(niche === "outro");

  const handleSelect = (value: string) => {
    const isOther = value === "outro";
    setShowCustom(isOther);
    onChange(value, isOther ? nicheCustom : "");
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <p
          className="text-sm font-medium uppercase tracking-widest"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          Passo 2 de 8
        </p>
        <h2
          className="text-4xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Qual é o nicho do seu negócio?
        </h2>
        <p className="text-base" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
          Isso nos ajuda a criar conteúdo mais relevante para sua audiência.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {NICHES.map(({ value, label, Icon }) => {
          const selected = niche === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleSelect(value)}
              className="select-card flex flex-col items-center gap-2.5 py-5 px-3 text-center"
              style={selected ? { background: "#0a0a0a", borderColor: "#0a0a0a", color: "#f8f5ef" } : {}}
            >
              <Icon
                size={22}
                strokeWidth={1.8}
                style={{ color: selected ? "#f8f5ef" : "#0a0a0a" }}
              />
              <span
                className="text-sm font-medium leading-tight"
                style={{ fontFamily: "var(--font-body)", color: selected ? "#f8f5ef" : "#0a0a0a" }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {showCustom && (
        <div className="animate-step-in">
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
          >
            Descreva seu nicho
          </label>
          <input
            type="text"
            value={nicheCustom}
            onChange={(e) => onChange("outro", e.target.value)}
            placeholder="Ex: consultoria financeira, pet shop, estúdio de tatuagem..."
            autoFocus
            className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition-all focus:border-foreground focus:ring-2 focus:ring-foreground/10"
            style={{ borderColor: "#e4e0d8", fontFamily: "var(--font-body)" }}
          />
        </div>
      )}
    </div>
  );
}
