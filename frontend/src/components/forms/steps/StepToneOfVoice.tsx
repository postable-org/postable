"use client";

const TONES = [
  {
    value: "formal",
    label: "Formal",
    example: '"Com prazer em atendê-lo."',
  },
  {
    value: "casual",
    label: "Casual",
    example: '"Oi! Tudo bem?"',
  },
  {
    value: "bold",
    label: "Ousado",
    example: '"Seja diferente. Seja você."',
  },
  {
    value: "friendly",
    label: "Amigável",
    example: '"Adoramos ter você aqui!"',
  },
  {
    value: "professional",
    label: "Profissional",
    example: '"Qualidade que você pode confiar."',
  },
  {
    value: "other",
    label: "Personalizado",
    example: "Defina seu próprio estilo",
  },
];

interface Props {
  value: string;
  custom: string;
  onChange: (tone: string, custom?: string) => void;
  // Legacy compat
  defaultTone?: string;
  defaultToneCustom?: string;
  onNext?: (tone: string, custom?: string) => void;
}

export default function StepToneOfVoice({ value, custom, onChange }: Props) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <p
          className="text-sm font-medium uppercase tracking-widest"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          Passo 5 de 8
        </p>
        <h2
          className="text-4xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Como você fala com seus clientes?
        </h2>
        <p className="text-base" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
          Escolha o tom que melhor representa sua marca.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TONES.map(({ value: v, label, example }) => {
          const selected = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v, v !== "other" ? undefined : custom)}
              className="select-card flex flex-col items-start gap-1.5 px-5 py-4 text-left"
              style={
                selected
                  ? { background: "#0a0a0a", borderColor: "#0a0a0a" }
                  : {}
              }
            >
              <span
                className="text-sm font-semibold"
                style={{
                  fontFamily: "var(--font-body)",
                  color: selected ? "#f8f5ef" : "#0a0a0a",
                }}
              >
                {label}
              </span>
              <span
                className="text-xs leading-relaxed"
                style={{
                  fontFamily: "var(--font-body)",
                  color: selected ? "rgba(248,245,239,0.55)" : "#8c8880",
                  fontStyle: v !== "other" ? "italic" : "normal",
                }}
              >
                {example}
              </span>
            </button>
          );
        })}
      </div>

      {value === "other" && (
        <div className="animate-step-in space-y-1.5">
          <label
            className="block text-sm font-medium"
            style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
          >
            Descreva seu tom de voz
          </label>
          <textarea
            rows={3}
            value={custom}
            onChange={(e) => onChange("other", e.target.value)}
            placeholder="Ex: direto ao ponto, com humor sutil e foco em resultados..."
            className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition-all focus:border-foreground focus:ring-2 focus:ring-foreground/10 resize-none placeholder:text-muted-foreground"
            style={{ borderColor: "#e4e0d8", fontFamily: "var(--font-body)" }}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
