"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function StepCompanyInfo({ value, onChange }: Props) {
  return (
    <div className="space-y-10 text-center">
      <div className="space-y-3">
        <p
          className="text-sm font-medium uppercase tracking-widest"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          Vamos começar
        </p>
        <h2
          className="text-4xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Como se chama sua empresa?
        </h2>
        <p className="text-base" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
          Este será o nome exibido no seu conteúdo.
        </p>
      </div>

      <div className="max-w-sm mx-auto">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex: Studio Bella, TechFlow, Padaria do João..."
          autoFocus
          className="w-full text-center text-lg rounded-2xl border bg-white px-5 py-4 placeholder:text-muted-foreground outline-none transition-all focus:border-foreground focus:ring-2 focus:ring-foreground/10"
          style={{
            borderColor: "#e4e0d8",
            fontFamily: "var(--font-body)",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim().length > 0) {
              // trigger continue via form — handled by wizard's continue button
            }
          }}
        />
        {value.trim().length > 0 && (
          <p
            className="mt-3 text-sm"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            Olá,{" "}
            <span className="font-semibold" style={{ color: "#0a0a0a" }}>
              {value}
            </span>
            ! 👋
          </p>
        )}
      </div>
    </div>
  );
}
