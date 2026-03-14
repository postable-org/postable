"use client";

import { Pencil } from "lucide-react";
import type { WizardFormData } from "../BrandSetupWizard";

const NICHE_LABELS: Record<string, string> = {
  alimentacao: "Alimentação",
  moda: "Moda",
  saude_beleza: "Saúde & Beleza",
  fitness: "Fitness",
  varejo: "Varejo",
  servicos: "Serviços",
  educacao: "Educação",
  imoveis: "Imóveis",
  tecnologia: "Tecnologia",
  outro: "Outro",
};

const SCALE_LABELS: Record<string, string> = {
  solo: "Só eu",
  "2-10": "2 a 10 pessoas",
  "11-50": "11 a 50 pessoas",
  "50+": "Mais de 50 pessoas",
};

const TONE_LABELS: Record<string, string> = {
  formal: "Formal",
  casual: "Casual",
  bold: "Ousado",
  friendly: "Amigável",
  professional: "Profissional",
  other: "Personalizado",
};

const CTA_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  landing_page: "Landing Page",
  dm: "Direct Message",
};

interface Props {
  formData: WizardFormData;
  error: string;
  onEditStep: (step: number) => void;
  // Legacy compat
  onSubmit?: () => void;
  onBack?: () => void;
  isLoading?: boolean;
}

interface ReviewRowProps {
  label: string;
  value: string;
  step: number;
  onEdit: (step: number) => void;
}

function ReviewRow({ label, value, step, onEdit }: ReviewRowProps) {
  return (
    <div
      className="flex items-center justify-between py-3.5"
      style={{ borderBottom: "1px solid #e4e0d8" }}
    >
      <div>
        <p
          className="text-xs font-medium uppercase tracking-wider mb-0.5"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          {label}
        </p>
        <p
          className="text-sm font-medium"
          style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
        >
          {value || "—"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onEdit(step)}
        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors hover:bg-foreground/5"
        style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
      >
        <Pencil size={11} />
        Editar
      </button>
    </div>
  );
}

export default function StepReview({ formData, error, onEditStep }: Props) {
  const niche =
    formData.niche === "outro"
      ? formData.niche_custom || "Outro"
      : NICHE_LABELS[formData.niche] || formData.niche;

  const location =
    formData.country === "BR"
      ? [formData.city, formData.state].filter(Boolean).join(", ")
      : formData.city
      ? `${formData.city} (${formData.country})`
      : formData.country;

  const tone =
    formData.tone_of_voice === "other"
      ? `Personalizado${formData.tone_custom ? `: ${formData.tone_custom}` : ""}`
      : TONE_LABELS[formData.tone_of_voice] || formData.tone_of_voice;

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <p
          className="text-sm font-medium uppercase tracking-widest"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          Quase lá!
        </p>
        <h2
          className="text-4xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Tudo certo?
        </h2>
        <p className="text-base" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
          Revise as informações antes de criar sua marca.
        </p>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#ffffff",
          border: "1.5px solid #e4e0d8",
        }}
      >
        {/* Company header */}
        <div
          className="px-5 py-4"
          style={{ backgroundColor: "#f0ede7", borderBottom: "1px solid #e4e0d8" }}
        >
          <p
            className="text-xs font-medium uppercase tracking-wider mb-0.5"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            Empresa
          </p>
          <p
            className="text-lg font-bold tracking-tight"
            style={{ color: "#0a0a0a", fontFamily: "var(--font-sans)" }}
          >
            {formData.company_name || "—"}
          </p>
        </div>

        <div className="px-5">
          <ReviewRow label="Nicho" value={niche} step={1} onEdit={onEditStep} />
          <ReviewRow
            label="Tamanho"
            value={SCALE_LABELS[formData.scale] || formData.scale}
            step={2}
            onEdit={onEditStep}
          />
          <ReviewRow label="Localização" value={location} step={3} onEdit={onEditStep} />
          <ReviewRow label="Tom de voz" value={tone} step={4} onEdit={onEditStep} />
          <ReviewRow
            label="Canal de CTA"
            value={CTA_LABELS[formData.cta_channel] || formData.cta_channel}
            step={5}
            onEdit={onEditStep}
          />
          {formData.competitors.length > 0 && (
            <ReviewRow
              label="Concorrentes"
              value={formData.competitors.join(", ")}
              step={6}
              onEdit={onEditStep}
            />
          )}
        </div>
      </div>

      {error && (
        <p
          className="text-sm text-center"
          style={{ color: "oklch(0.577 0.245 27.325)", fontFamily: "var(--font-body)" }}
        >
          {error}
        </p>
      )}

      <p
        className="text-xs text-center"
        style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
      >
        Você pode editar essas informações a qualquer momento no dashboard.
      </p>
    </div>
  );
}
