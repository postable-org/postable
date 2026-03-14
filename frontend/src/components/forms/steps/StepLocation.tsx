"use client";

const BR_STATES: { code: string; name: string }[] = [
  { code: "AC", name: "Acre" },
  { code: "AL", name: "Alagoas" },
  { code: "AM", name: "Amazonas" },
  { code: "AP", name: "Amapá" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" },
  { code: "MG", name: "Minas Gerais" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MT", name: "Mato Grosso" },
  { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" },
  { code: "PE", name: "Pernambuco" },
  { code: "PI", name: "Piauí" },
  { code: "PR", name: "Paraná" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" },
  { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SE", name: "Sergipe" },
  { code: "SP", name: "São Paulo" },
  { code: "TO", name: "Tocantins" },
];

const COUNTRIES = [
  { code: "BR", name: "🇧🇷  Brasil" },
  { code: "US", name: "🇺🇸  Estados Unidos" },
  { code: "PT", name: "🇵🇹  Portugal" },
  { code: "AR", name: "🇦🇷  Argentina" },
  { code: "MX", name: "🇲🇽  México" },
  { code: "CO", name: "🇨🇴  Colômbia" },
  { code: "CL", name: "🇨🇱  Chile" },
  { code: "GB", name: "🇬🇧  Reino Unido" },
  { code: "ES", name: "🇪🇸  Espanha" },
  { code: "OTHER", name: "🌎  Outro país" },
];

interface Props {
  country: string;
  state: string;
  city: string;
  onChange: (patch: { country?: string; state?: string; city?: string }) => void;
}

const selectClass =
  "w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition-all focus:border-foreground focus:ring-2 focus:ring-foreground/10 appearance-none";
const inputClass =
  "w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition-all focus:border-foreground focus:ring-2 focus:ring-foreground/10 placeholder:text-muted-foreground";
const borderStyle = { borderColor: "#e4e0d8", fontFamily: "var(--font-body)" };

export default function StepLocation({ country, state, city, onChange }: Props) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <p
          className="text-sm font-medium uppercase tracking-widest"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          Passo 4 de 8
        </p>
        <h2
          className="text-4xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Onde sua empresa está?
        </h2>
        <p className="text-base" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
          Isso nos ajuda a criar conteúdo com relevância local.
        </p>
      </div>

      <div className="max-w-sm mx-auto space-y-4">
        {/* Country */}
        <div className="space-y-1.5">
          <label
            className="block text-sm font-medium"
            style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
          >
            País
          </label>
          <div className="relative">
            <select
              value={country}
              onChange={(e) =>
                onChange({ country: e.target.value, state: "", city: "" })
              }
              className={selectClass}
              style={borderStyle}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* State — Brazil only */}
        {country === "BR" && (
          <div className="space-y-1.5">
            <label
              className="block text-sm font-medium"
              style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
            >
              Estado
            </label>
            <div className="relative">
              <select
                value={state}
                onChange={(e) => onChange({ state: e.target.value })}
                className={selectClass}
                style={borderStyle}
              >
                <option value="">Selecione um estado</option>
                {BR_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* City */}
        <div className="space-y-1.5">
          <label
            className="block text-sm font-medium"
            style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
          >
            Cidade
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="Ex: São Paulo, Rio de Janeiro..."
            className={inputClass}
            style={borderStyle}
          />
        </div>
      </div>
    </div>
  );
}
