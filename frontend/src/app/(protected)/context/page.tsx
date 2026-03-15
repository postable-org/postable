"use client";

import { getBrand, updateBrand, type BrandData } from "@/lib/api/brands";
import {
  getCompetitors,
  updateCompetitors,
  type CompetitorOperation,
} from "@/lib/api/competitors";
import {
  AtSign,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  FileVideo,
  ImageIcon,
  Loader2,
  MessageSquare,
  Palette,
  Plus,
  Save,
  Sparkles,
  Target,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type AssetType = "image" | "video" | "document";

function getURLType(url: string): AssetType {
  const lower = url.toLowerCase().split("?")[0];
  if (/\.(jpg|jpeg|png|gif|webp|avif|svg)$/.test(lower)) return "image";
  if (/\.(mp4|mov|webm|avi|mkv)$/.test(lower)) return "video";
  return "document";
}

function getFileType(file: File): AssetType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _getFileType(file: File): AssetType { return getFileType(file); }

function MediaIcon({ type }: { type: AssetType }) {
  if (type === "image") return <ImageIcon size={20} style={{ color: "#8c8880" }} />;
  if (type === "video") return <FileVideo size={20} style={{ color: "#8c8880" }} />;
  return <FileText size={20} style={{ color: "#8c8880" }} />;
}

// ── Completeness score ────────────────────────────────────────────────────────

function calcScore(
  form: BrandData,
  answers: Record<string, string>,
  competitors: string[],
  assetURLs: string[],
): number {
  const checks = [
    !!form.name,
    !!form.niche,
    !!form.city,
    !!form.brand_tagline,
    !!form.company_history,
    (form.brand_values?.length ?? 0) > 0,
    (form.brand_key_people?.length ?? 0) > 0,
    (form.brand_colors?.length ?? 0) > 0,
    (form.brand_fonts?.length ?? 0) > 0,
    !!form.design_style,
    !!form.target_audience_description,
    form.target_gender !== "all" && !!form.target_gender,
    (form.target_age_min ?? 0) > 0 && (form.target_age_max ?? 0) > 0,
    !!form.brand_must_use,
    !!form.brand_must_avoid,
    Object.values(answers).some((v) => !!v),
    competitors.length > 0,
    assetURLs.length > 0,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "#10B981" :
    score >= 60 ? "#3B82F6" :
    score >= 35 ? "#F59E0B" :
    "#EF4444";
  const label =
    score >= 80 ? "Contexto rico — posts altamente personalizados ✦" :
    score >= 60 ? "Bom contexto — posts bem personalizados" :
    score >= 35 ? "Contexto médio — adicione mais detalhes" :
    "Contexto vazio — adicione informações para a IA";

  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={15} style={{ color }} />
          <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-sans)" }}>
            Força do contexto
          </span>
        </div>
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ fontFamily: "var(--font-sans)", color }}
        >
          {score}%
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden mb-2"
        style={{ backgroundColor: "#f0ede7" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
        {label}
      </p>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  num,
  title,
  subtitle,
  icon: Icon,
  children,
  defaultOpen = true,
  badge,
}: {
  num: string;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-6 py-5 text-left transition-colors hover:bg-[#f8f5ef]"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className="text-[10px] font-bold tabular-nums"
              style={{ color: "#8c8880", fontFamily: "var(--font-sans)", letterSpacing: "0.08em" }}
            >
              {num}
            </span>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#f0ede7" }}
            >
              <Icon size={17} strokeWidth={1.8} style={{ color: "#0a0a0a" }} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm" style={{ fontFamily: "var(--font-sans)" }}>
                {title}
              </p>
              {badge && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: "#f0ede7", color: "#8c8880", fontFamily: "var(--font-body)" }}
                >
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {open ? (
          <ChevronUp size={16} style={{ color: "#8c8880" }} />
        ) : (
          <ChevronDown size={16} style={{ color: "#8c8880" }} />
        )}
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-4" style={{ borderTop: "1px solid #e4e0d8" }}>
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}

// ── Chip tag input ─────────────────────────────────────────────────────────────

function ChipTagInput({
  value,
  onChange,
  placeholder,
  maxItems,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxItems?: number;
}) {
  const [input, setInput] = useState("");

  const addTag = useCallback(() => {
    const clean = input.trim();
    if (!clean || value.includes(clean)) { setInput(""); return; }
    if (maxItems && value.length >= maxItems) { setInput(""); return; }
    onChange([...value, clean]);
    setInput("");
  }, [input, value, onChange, maxItems]);

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: "#f0ede7", color: "#0a0a0a", fontFamily: "var(--font-body)" }}
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="opacity-50 hover:opacity-100 transition-opacity"
              >
                <X size={10} strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2.5 focus-within:border-black transition-colors"
        style={{ backgroundColor: "#f8f5ef", borderColor: "#e4e0d8" }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
          }}
          placeholder={placeholder ?? "Digite e pressione Enter"}
          className="flex-1 text-sm bg-transparent outline-none"
          style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
        />
        <button
          type="button"
          onClick={addTag}
          disabled={!input.trim()}
          className="w-6 h-6 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
          style={{ backgroundColor: "#0a0a0a", color: "#f8f5ef" }}
        >
          <Plus size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

// ── Color palette ─────────────────────────────────────────────────────────────

function ColorPalette({
  colors,
  onChange,
}: {
  colors: string[];
  onChange: (colors: string[]) => void;
}) {
  const [pickerColor, setPickerColor] = useState("#3B82F6");

  return (
    <div className="space-y-4">
      {colors.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {colors.map((color) => (
            <div key={color} className="relative group flex flex-col items-center gap-1.5">
              <div
                className="w-11 h-11 rounded-xl shadow-sm"
                style={{ backgroundColor: color, border: "2px solid #e4e0d8" }}
                title={color.toUpperCase()}
              />
              <span
                className="text-[10px] font-mono uppercase"
                style={{ color: "#8c8880", fontFamily: "monospace" }}
              >
                {color}
              </span>
              <button
                type="button"
                onClick={() => onChange(colors.filter((c) => c !== color))}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: "#0a0a0a" }}
              >
                <X size={8} style={{ color: "#f8f5ef" }} strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={pickerColor}
            onChange={(e) => setPickerColor(e.target.value)}
            className="w-11 h-11 rounded-xl cursor-pointer p-0.5"
            style={{ border: "2px solid #e4e0d8", backgroundColor: "#f8f5ef" }}
            title="Escolher cor"
          />
        </div>
        <span
          className="text-sm font-mono font-semibold uppercase"
          style={{ color: "#0a0a0a", minWidth: 72, fontFamily: "monospace" }}
        >
          {pickerColor}
        </span>
        <button
          type="button"
          onClick={() => {
            if (!colors.includes(pickerColor) && colors.length < 12) {
              onChange([...colors, pickerColor]);
            }
          }}
          disabled={colors.includes(pickerColor) || colors.length >= 12}
          className="px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
          style={{
            backgroundColor: "#0a0a0a",
            color: "#f8f5ef",
            fontFamily: "var(--font-body)",
          }}
        >
          Adicionar à paleta
        </button>
        {colors.length > 0 && (
          <span className="text-xs" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
            {colors.length}/12
          </span>
        )}
      </div>
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles, disabled],
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => !disabled && inputRef.current?.click()}
      className="rounded-2xl border-2 border-dashed p-8 text-center transition-all"
      style={{
        borderColor: dragging ? "#0a0a0a" : "#e4e0d8",
        backgroundColor: dragging ? "rgba(10,10,10,0.02)" : "#ffffff",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          e.target.value = "";
        }}
      />
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-3"
        style={{ backgroundColor: "#f0ede7" }}
      >
        <Upload size={20} strokeWidth={1.8} style={{ color: "#0a0a0a" }} />
      </div>
      <p className="font-semibold text-sm" style={{ fontFamily: "var(--font-sans)" }}>
        Arraste arquivos aqui
      </p>
      <p className="text-xs mt-1" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
        ou clique para selecionar — imagens, vídeos e documentos
      </p>
    </div>
  );
}

// ── Competitor chip ───────────────────────────────────────────────────────────

function CompetitorChip({ handle, onRemove }: { handle: string; onRemove: () => void }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
      style={{ backgroundColor: "#0a0a0a", color: "#f8f5ef", fontFamily: "var(--font-body)" }}
    >
      <AtSign size={12} />
      <span>{handle.replace(/^@/, "")}</span>
      <button onClick={onRemove} className="opacity-60 hover:opacity-100 transition-opacity">
        <X size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TONE_OPTIONS = [
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "bold", label: "Ousado" },
  { value: "friendly", label: "Amigável" },
  { value: "professional", label: "Profissional" },
  { value: "other", label: "Personalizado" },
];

const CTA_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "dm", label: "DM / Direct" },
  { value: "landing_page", label: "Site / Link" },
];

const DESIGN_STYLES = [
  "Minimalista", "Ousado", "Clássico", "Moderno", "Artesanal",
  "Luxo", "Divertido", "Técnico", "Elegante", "Jovem", "Premium", "Sustentável",
];

const GENDER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "nao-binario", label: "Não-binário" },
];

const WEEKLY_QUESTIONS = [
  {
    id: "week_update",
    label: "O que está acontecendo na sua empresa essa semana?",
    placeholder: "Ex: Lançamos um novo produto, tivemos uma grande venda, estamos com promoção de aniversário...",
  },
  {
    id: "promotions",
    label: "Há alguma promoção ou oferta especial?",
    placeholder: "Ex: 20% de desconto no mês de março, frete grátis acima de R$150...",
  },
  {
    id: "new_products",
    label: "Novos produtos ou serviços para anunciar?",
    placeholder: "Ex: Acabamos de lançar nosso novo serviço de consultoria premium...",
  },
  {
    id: "monthly_goal",
    label: "Qual é o foco de marketing este mês?",
    placeholder: "Ex: Aumentar seguidores no Instagram, converter mais leads, reativar clientes antigos...",
  },
  {
    id: "tone_notes",
    label: "Algum contexto adicional para a IA considerar?",
    placeholder: "Ex: Evite falar sobre preços na semana do dia das mães, foque em conteúdo emocional...",
  },
];

const inputStyle = {
  backgroundColor: "#f8f5ef",
  border: "1px solid #e4e0d8",
  fontFamily: "var(--font-body)",
};

// ── Field label ───────────────────────────────────────────────────────────────

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>
        {children}
      </label>
      {hint && (
        <p className="text-xs mt-0.5" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Pill selector ─────────────────────────────────────────────────────────────

function PillSelector<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
          style={{
            backgroundColor: value === opt.value ? "#0a0a0a" : "#f0ede7",
            color: value === opt.value ? "#f8f5ef" : "#0a0a0a",
            fontFamily: "var(--font-body)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const DEFAULT_BRAND_FORM: BrandData = {
  name: "",
  niche: "",
  city: "",
  state: "",
  tone_of_voice: "professional",
  tone_custom: "",
  cta_channel: "dm",
  brand_colors: [],
  brand_fonts: [],
  design_style: "",
  target_age_min: 0,
  target_age_max: 0,
  target_gender: "all",
  company_history: "",
  brand_tagline: "",
  brand_values: [],
  brand_key_people: [],
  brand_must_use: "",
  brand_must_avoid: "",
  target_audience_description: "",
};

export default function ContextPage() {
  const [brandForm, setBrandForm] = useState<BrandData>(DEFAULT_BRAND_FORM);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [assetURLs, setAssetURLs] = useState<string[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState("");
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const loadedCompetitorsRef = useRef<string[]>([]);
  const [brandLoading, setBrandLoading] = useState(true);
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);

  const score = calcScore(brandForm, answers, competitors, assetURLs);

  useEffect(() => {
    Promise.all([getBrand(), getCompetitors()])
      .then(([brand, competitorRes]) => {
        if (brand) {
          setBrandForm({
            name: brand.name ?? "",
            niche: brand.niche,
            city: brand.city,
            state: brand.state,
            tone_of_voice: brand.tone_of_voice,
            tone_custom: brand.tone_custom ?? "",
            cta_channel: brand.cta_channel as BrandData["cta_channel"],
            context_json: brand.context_json,
            brand_colors: brand.brand_colors ?? [],
            brand_fonts: brand.brand_fonts ?? [],
            design_style: brand.design_style ?? "",
            target_age_min: brand.target_age_min ?? 0,
            target_age_max: brand.target_age_max ?? 0,
            target_gender: brand.target_gender ?? "all",
            company_history: brand.company_history ?? "",
            brand_tagline: brand.brand_tagline ?? "",
            brand_values: brand.brand_values ?? [],
            brand_key_people: brand.brand_key_people ?? [],
            brand_must_use: brand.brand_must_use ?? "",
            brand_must_avoid: brand.brand_must_avoid ?? "",
            target_audience_description: brand.target_audience_description ?? "",
          });
          if (brand.context_json) {
            try {
              setAnswers(JSON.parse(brand.context_json) as Record<string, string>);
            } catch { /* ignore */ }
          }
          if (brand.asset_urls?.length) setAssetURLs(brand.asset_urls);
        }
        const handles = competitorRes.competitors.map((c) => c.handle);
        setCompetitors(handles);
        loadedCompetitorsRef.current = handles;
      })
      .catch(() => setBrandError("Falha ao carregar dados da empresa."))
      .finally(() => setBrandLoading(false));
  }, []);

  const handleFiles = useCallback(async (files: File[]) => {
    setUploadingFile(true);
    setUploadError(null);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error("upload failed");
        const json = (await res.json()) as { url: string };
        uploaded.push(json.url);
      }
      setAssetURLs((prev) => [...prev, ...uploaded]);
    } catch {
      setUploadError("Falha ao enviar arquivo. Tente novamente.");
    } finally {
      setUploadingFile(false);
    }
  }, []);

  const removeAsset = (url: string) => setAssetURLs((prev) => prev.filter((u) => u !== url));

  const addCompetitor = async () => {
    const clean = competitorInput.trim().replace(/^@/, "").toLowerCase();
    if (!clean) return;
    const handle = `@${clean}`;
    setCompetitorInput("");
    setCompetitorLoading(true);
    try {
      const res = await updateCompetitors([{ type: "add", handle }]);
      setCompetitors(res.competitors.filter((c) => c.status === "active").map((c) => c.handle));
    } finally {
      setCompetitorLoading(false);
    }
  };

  const removeCompetitor = async (handle: string) => {
    setCompetitorLoading(true);
    try {
      const res = await updateCompetitors([{ type: "remove", handle }]);
      setCompetitors(res.competitors.filter((c) => c.status === "active").map((c) => c.handle));
    } finally {
      setCompetitorLoading(false);
    }
  };

  const handleSave = async () => {
    setBrandSaving(true);
    setBrandError(null);
    try {
      await updateBrand({
        ...brandForm,
        context_json: Object.keys(answers).length > 0 ? JSON.stringify(answers) : undefined,
        asset_urls: assetURLs,
      });

      const loaded = loadedCompetitorsRef.current;
      const ops: CompetitorOperation[] = [];
      for (const h of competitors) if (!loaded.includes(h)) ops.push({ type: "add", handle: h });
      for (const h of loaded) if (!competitors.includes(h)) ops.push({ type: "remove", handle: h });
      if (ops.length > 0) {
        const res = await updateCompetitors(ops);
        const newHandles = res.competitors.map((c) => c.handle);
        setCompetitors(newHandles);
        loadedCompetitorsRef.current = newHandles;
      }

      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 3000);
    } catch {
      setBrandError("Falha ao salvar. Tente novamente.");
    } finally {
      setBrandSaving(false);
    }
  };

  const setField = <K extends keyof BrandData>(key: K, value: BrandData[K]) =>
    setBrandForm((p) => ({ ...p, [key]: value }));

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Contexto da Marca</h1>
          <p className="page-subtitle">
            Quanto mais contexto você adicionar, mais precisos e personalizados serão seus posts.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={brandSaving || brandLoading}
          className="btn-primary shrink-0 disabled:opacity-50"
          style={{ backgroundColor: brandSaved ? "#10B981" : undefined }}
        >
          {brandSaving ? (
            <><Loader2 size={14} className="animate-spin" /> Salvando...</>
          ) : brandSaved ? (
            <>✓ Salvo!</>
          ) : (
            <><Save size={14} /> Salvar contexto</>
          )}
        </button>
      </div>

      {brandError && <div className="banner-error">{brandError}</div>}

      {/* AI hint */}
      <div className="ai-hint">
        <Sparkles size={16} style={{ color: "#a6c8f9", marginTop: 1 }} className="shrink-0" />
        <p className="text-xs leading-relaxed" style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}>
          <strong>Quanto mais contexto, melhores os posts.</strong> A IA usa cada campo abaixo
          para criar conteúdo específico sobre o seu negócio — nome, história, valores, cores,
          público e regras de comunicação. Preencha o máximo possível.
        </p>
      </div>

      {/* Completeness score */}
      <ScoreBar score={score} />

      {/* ── 01 · Identidade Básica ─── */}
      <Section
        num="01"
        title="Identidade Básica"
        subtitle="Nome, nicho, localização, tom de voz e CTA"
        icon={Building2}
      >
        {brandLoading ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "#8c8880" }}>
            <Loader2 size={14} className="animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel hint="Como sua marca é conhecida pelo público">Nome da empresa</FieldLabel>
                <input
                  type="text"
                  value={brandForm.name ?? ""}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Ex: Padaria do João"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-black transition-colors"
                  style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
                />
              </div>
              <div>
                <FieldLabel hint="Seu segmento de atuação">Nicho / Segmento *</FieldLabel>
                <input
                  type="text"
                  value={brandForm.niche}
                  onChange={(e) => setField("niche", e.target.value)}
                  placeholder="Ex: Padaria artesanal, Clínica odontológica..."
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-black transition-colors"
                  style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Cidade *</FieldLabel>
                <input
                  type="text"
                  value={brandForm.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="São Paulo"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-black transition-colors"
                  style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
                />
              </div>
              <div>
                <FieldLabel>Estado *</FieldLabel>
                <input
                  type="text"
                  value={brandForm.state}
                  onChange={(e) => setField("state", e.target.value)}
                  placeholder="SP"
                  maxLength={2}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-black transition-colors uppercase"
                  style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
                />
              </div>
            </div>

            <div>
              <FieldLabel hint="Como a marca se comunica com o público">Tom de voz</FieldLabel>
              <PillSelector
                options={TONE_OPTIONS}
                value={brandForm.tone_of_voice as typeof TONE_OPTIONS[number]["value"]}
                onChange={(v) => setField("tone_of_voice", v)}
              />
              {brandForm.tone_of_voice === "other" && (
                <input
                  type="text"
                  value={brandForm.tone_custom ?? ""}
                  onChange={(e) => setField("tone_custom", e.target.value)}
                  placeholder="Descreva o tom de voz da sua marca"
                  className="mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-black"
                  style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
                />
              )}
            </div>

            <div>
              <FieldLabel hint="Onde o cliente deve entrar em contato após ver o post">Canal de CTA principal</FieldLabel>
              <PillSelector
                options={CTA_OPTIONS}
                value={brandForm.cta_channel}
                onChange={(v) => setField("cta_channel", v as BrandData["cta_channel"])}
              />
            </div>
          </div>
        )}
      </Section>

      {/* ── 02 · Identidade Visual ─── */}
      <Section
        num="02"
        title="Identidade Visual"
        subtitle="Paleta de cores, fontes e estilo de design"
        icon={Palette}
        defaultOpen={false}
        badge={(brandForm.brand_colors?.length ?? 0) + (brandForm.brand_fonts?.length ?? 0) > 0 ? "✓" : undefined}
      >
        <div className="space-y-6">
          <div>
            <FieldLabel hint="Cores oficiais da marca em formato HEX">Paleta de cores</FieldLabel>
            <ColorPalette
              colors={brandForm.brand_colors ?? []}
              onChange={(c) => setField("brand_colors", c)}
            />
          </div>

          <div>
            <FieldLabel hint="Fontes utilizadas na identidade visual (ex: Playfair Display, Montserrat)">
              Fontes da marca
            </FieldLabel>
            <ChipTagInput
              value={brandForm.brand_fonts ?? []}
              onChange={(v) => setField("brand_fonts", v)}
              placeholder="Ex: Playfair Display — pressione Enter"
              maxItems={6}
            />
          </div>

          <div>
            <FieldLabel hint="Escolha o estilo visual que melhor representa a marca">Estilo de design</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {DESIGN_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setField("design_style", brandForm.design_style === style ? "" : style)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    backgroundColor: brandForm.design_style === style ? "#0a0a0a" : "#f0ede7",
                    color: brandForm.design_style === style ? "#f8f5ef" : "#0a0a0a",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── 03 · Público-Alvo ─── */}
      <Section
        num="03"
        title="Público-Alvo"
        subtitle="Quem você quer alcançar com seus posts"
        icon={Target}
        defaultOpen={false}
        badge={brandForm.target_audience_description ? "✓" : undefined}
      >
        <div className="space-y-5">
          <div>
            <FieldLabel hint="Qual gênero predomina no seu público?">Gênero do público</FieldLabel>
            <PillSelector
              options={GENDER_OPTIONS}
              value={brandForm.target_gender ?? "all"}
              onChange={(v) => setField("target_gender", v)}
            />
          </div>

          <div>
            <FieldLabel hint="Faixa etária principal do seu público">Faixa etária</FieldLabel>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>De</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={brandForm.target_age_min || ""}
                  onChange={(e) => setField("target_age_min", parseInt(e.target.value) || 0)}
                  placeholder="18"
                  className="w-20 rounded-xl px-3 py-2.5 text-sm text-center outline-none focus:border-black transition-colors"
                  style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>a</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={brandForm.target_age_max || ""}
                  onChange={(e) => setField("target_age_max", parseInt(e.target.value) || 0)}
                  placeholder="45"
                  className="w-20 rounded-xl px-3 py-2.5 text-sm text-center outline-none focus:border-black transition-colors"
                  style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
                />
              </div>
              <span className="text-sm" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>anos</span>
            </div>
          </div>

          <div>
            <FieldLabel hint="Descreva em detalhes quem são seus clientes ideais: comportamento, dores, desejos, hábitos">
              Descrição do público
            </FieldLabel>
            <textarea
              rows={4}
              value={brandForm.target_audience_description ?? ""}
              onChange={(e) => setField("target_audience_description", e.target.value)}
              placeholder="Ex: Mulheres entre 28-45 anos, mães de família, classe média/alta, que valorizam qualidade e praticidade. Buscam produtos que facilitem o dia a dia sem abrir mão do bem-estar dos filhos..."
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-black transition-colors resize-none"
              style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
            />
          </div>
        </div>
      </Section>

      {/* ── 04 · DNA da Marca ─── */}
      <Section
        num="04"
        title="DNA da Marca"
        subtitle="História, missão, valores e pessoas-chave"
        icon={BookOpen}
        defaultOpen={false}
        badge={brandForm.company_history ? "✓" : undefined}
      >
        <div className="space-y-5">
          <div>
            <FieldLabel hint="Um slogan ou frase que resume o espírito da sua marca">Tagline / Slogan</FieldLabel>
            <input
              type="text"
              value={brandForm.brand_tagline ?? ""}
              onChange={(e) => setField("brand_tagline", e.target.value)}
              placeholder="Ex: Feito com carinho, entregue com amor"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-black transition-colors"
              style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
            />
          </div>

          <div>
            <FieldLabel hint="Quanto mais detalhe, mais a IA entende sua marca. Fale sobre a origem, missão, diferenciais, conquistas...">
              História da empresa
            </FieldLabel>
            <textarea
              rows={7}
              value={brandForm.company_history ?? ""}
              onChange={(e) => setField("company_history", e.target.value)}
              placeholder="Conte a história da sua empresa. De onde surgiu a ideia? Quais são os valores que guiam o negócio? O que vocês fazem de diferente da concorrência? Quais foram os momentos marcantes da sua trajetória?

Ex: Fundada em 2015 no interior de São Paulo, a Padaria do João nasceu do sonho do João Silva de levar o sabor do pão artesanal da avó para toda a cidade. Hoje atendemos mais de 200 famílias por dia, com foco em ingredientes naturais e fermentação lenta..."
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-black transition-colors resize-none"
              style={{ ...inputStyle, border: "1px solid #e4e0d8", lineHeight: "1.6" }}
            />
          </div>

          <div>
            <FieldLabel hint="Os valores fundamentais que guiam a empresa (ex: Qualidade, Honestidade, Inovação)">
              Valores da marca
            </FieldLabel>
            <ChipTagInput
              value={brandForm.brand_values ?? []}
              onChange={(v) => setField("brand_values", v)}
              placeholder="Ex: Qualidade — pressione Enter para adicionar"
              maxItems={10}
            />
          </div>

          <div>
            <FieldLabel hint="Fundadores, sócios, especialistas ou referências da empresa que podem ser mencionados">
              Pessoas-chave
            </FieldLabel>
            <ChipTagInput
              value={brandForm.brand_key_people ?? []}
              onChange={(v) => setField("brand_key_people", v)}
              placeholder="Ex: Dr. Carlos Silva (fundador) — pressione Enter"
              maxItems={8}
            />
          </div>
        </div>
      </Section>

      {/* ── 05 · Regras de Comunicação ─── */}
      <Section
        num="05"
        title="Regras de Comunicação"
        subtitle="O que a IA deve sempre usar ou nunca usar"
        icon={MessageSquare}
        defaultOpen={false}
        badge={(brandForm.brand_must_use || brandForm.brand_must_avoid) ? "✓" : undefined}
      >
        <div className="space-y-5">
          <div>
            <FieldLabel hint="Palavras, frases, argumentos ou elementos que devem aparecer nos posts">
              <span className="flex items-center gap-1.5">
                <Eye size={13} /> Sempre incluir
              </span>
            </FieldLabel>
            <textarea
              rows={3}
              value={brandForm.brand_must_use ?? ""}
              onChange={(e) => setField("brand_must_use", e.target.value)}
              placeholder="Ex: Sempre mencionar frete grátis acima de R$150. Usar emojis com moderação. Citar que somos os únicos certificados pelo INMETRO na região. Sempre terminar com um CTA pelo WhatsApp..."
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-black transition-colors resize-none"
              style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
            />
          </div>

          <div>
            <FieldLabel hint="Temas, palavras, abordagens ou comparações que devem ser evitados">
              <span className="flex items-center gap-1.5">
                <EyeOff size={13} /> Nunca usar
              </span>
            </FieldLabel>
            <textarea
              rows={3}
              value={brandForm.brand_must_avoid ?? ""}
              onChange={(e) => setField("brand_must_avoid", e.target.value)}
              placeholder="Ex: Nunca mencionar preços sem antes consultar a tabela. Evitar comparações diretas com concorrentes. Não usar linguagem muito formal. Nunca prometer prazo de entrega sem confirmar o estoque..."
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-black transition-colors resize-none"
              style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
            />
          </div>
        </div>
      </Section>

      {/* ── 06 · Atualizações Semanais ─── */}
      <Section
        num="06"
        title="Atualizações da Empresa"
        subtitle="Conte à IA o que está acontecendo agora"
        icon={Sparkles}
      >
        <div className="space-y-5">
          {WEEKLY_QUESTIONS.map(({ id, label, placeholder }) => (
            <div key={id}>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
              >
                {label}
              </label>
              <textarea
                rows={3}
                placeholder={placeholder}
                value={answers[id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [id]: e.target.value }))}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-black transition-colors resize-none"
                style={{ backgroundColor: "#f8f5ef", borderColor: "#e4e0d8", fontFamily: "var(--font-body)" }}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* ── 07 · Arquivos de Referência ─── */}
      <Section
        num="07"
        title="Arquivos de Referência"
        subtitle="Imagens, vídeos e documentos da marca"
        icon={ImageIcon}
        defaultOpen={false}
        badge={assetURLs.length > 0 ? `${assetURLs.length}` : undefined}
      >
        <DropZone onFiles={handleFiles} disabled={uploadingFile} />

        {uploadingFile && (
          <div className="flex items-center gap-2 text-sm mt-3" style={{ color: "#8c8880" }}>
            <Loader2 size={14} className="animate-spin" /> Enviando arquivo...
          </div>
        )}

        {uploadError && (
          <div className="rounded-xl px-4 py-3 text-sm mt-3" style={{ backgroundColor: "#fde8e8", color: "#b91c1c" }}>
            {uploadError}
          </div>
        )}

        {assetURLs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            {assetURLs.map((url) => {
              const type = getURLType(url);
              return (
                <div
                  key={url}
                  className="relative rounded-xl overflow-hidden"
                  style={{ border: "1px solid #e4e0d8", aspectRatio: "1" }}
                >
                  {type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="asset" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ backgroundColor: "#f0ede7" }}>
                      <MediaIcon type={type} />
                      <p className="text-xs px-2 text-center truncate w-full" style={{ color: "#8c8880" }}>
                        {url.split("/").pop()?.split("?")[0] ?? "arquivo"}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => removeAsset(url)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "rgba(10,10,10,0.7)" }}
                  >
                    <X size={12} style={{ color: "#f8f5ef" }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── 08 · Concorrentes ─── */}
      <Section
        num="08"
        title="Concorrentes Monitorados"
        subtitle="Perfis do Instagram que a IA analisa para criar seus posts"
        icon={Users}
        defaultOpen={false}
        badge={competitors.length > 0 ? `${competitors.length}` : undefined}
      >
        <div className="space-y-4">
          <div
            className="flex items-center gap-2 rounded-xl border px-4 py-2.5 focus-within:border-black transition-colors"
            style={{ backgroundColor: "#f8f5ef", borderColor: "#e4e0d8" }}
          >
            <AtSign size={15} style={{ color: "#8c8880" }} className="shrink-0" />
            <input
              type="text"
              value={competitorInput}
              onChange={(e) => setCompetitorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCompetitor(); }
              }}
              placeholder="perfil_concorrente"
              className="flex-1 text-sm bg-transparent outline-none"
              style={{ fontFamily: "var(--font-body)" }}
            />
            <button
              type="button"
              onClick={addCompetitor}
              disabled={!competitorInput.trim() || competitorLoading}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{ backgroundColor: "#0a0a0a", color: "#f8f5ef" }}
            >
              {competitorLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} strokeWidth={2.5} />}
            </button>
          </div>

          {competitors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {competitors.map((h) => (
                <CompetitorChip key={h} handle={h} onRemove={() => removeCompetitor(h)} />
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
              Adicione os @ dos seus concorrentes no Instagram.
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}
