"use client";

import { getBrand, updateBrand, type BrandData } from "@/lib/api/brands";
import {
  getCompetitors,
  updateCompetitors,
  type CompetitorOperation,
} from "@/lib/api/competitors";
import {
  AtSign,
  Building2,
  ChevronDown,
  ChevronUp,
  FileText,
  FileVideo,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Media Upload ─────────────────────────────────────────────────────────────

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

function MediaIcon({ type }: { type: AssetType }) {
  if (type === "image")
    return <ImageIcon size={20} style={{ color: "#8c8880" }} />;
  if (type === "video")
    return <FileVideo size={20} style={{ color: "#8c8880" }} />;
  return <FileText size={20} style={{ color: "#8c8880" }} />;
}

function DropZone({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
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
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onClick={() => !disabled && inputRef.current?.click()}
      className="rounded-2xl border-2 border-dashed p-10 text-center transition-all"
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
        className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
        style={{ backgroundColor: "#f0ede7" }}
      >
        <Upload size={22} strokeWidth={1.8} style={{ color: "#0a0a0a" }} />
      </div>
      <p
        className="font-semibold text-sm"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        Arraste arquivos aqui
      </p>
      <p
        className="text-xs mt-1"
        style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
      >
        ou clique para selecionar — imagens, vídeos e documentos
      </p>
    </div>
  );
}

// ── Context Questions ─────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    id: "week_update",
    label: "O que está acontecendo na sua empresa essa semana?",
    placeholder:
      "Ex: Lançamos um novo produto, tivemos uma grande venda, estamos com promoção de aniversário...",
  },
  {
    id: "promotions",
    label: "Há alguma promoção ou oferta especial?",
    placeholder:
      "Ex: 20% de desconto no mês de março, frete grátis acima de R$150...",
  },
  {
    id: "new_products",
    label: "Novos produtos ou serviços para anunciar?",
    placeholder:
      "Ex: Acabamos de lançar nosso novo serviço de consultoria premium...",
  },
  {
    id: "monthly_goal",
    label: "Qual é o foco de marketing este mês?",
    placeholder:
      "Ex: Aumentar seguidores no Instagram, converter mais leads, reativar clientes antigos...",
  },
  {
    id: "tone_notes",
    label: "Algum contexto adicional para a IA considerar?",
    placeholder:
      "Ex: Evite falar sobre preços na semana do dia das mães, foque em conteúdo emocional...",
  },
];

// ── Competitors ───────────────────────────────────────────────────────────────

function CompetitorChip({
  handle,
  onRemove,
}: {
  handle: string;
  onRemove: () => void;
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
      style={{
        backgroundColor: "#0a0a0a",
        color: "#f8f5ef",
        fontFamily: "var(--font-body)",
      }}
    >
      <AtSign size={12} />
      <span>{handle.replace(/^@/, "")}</span>
      <button
        onClick={onRemove}
        className="opacity-60 hover:opacity-100 transition-opacity"
      >
        <X size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
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
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "#f0ede7" }}
          >
            <Icon size={18} strokeWidth={1.8} style={{ color: "#0a0a0a" }} />
          </div>
          <div>
            <p
              className="font-semibold text-sm"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {title}
            </p>
            {subtitle && (
              <p
                className="text-xs"
                style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
              >
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
        <div
          className="px-6 pb-6 space-y-4"
          style={{ borderTop: "1px solid #e4e0d8" }}
        >
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}

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

const inputStyle = {
  backgroundColor: "#f8f5ef",
  border: "1px solid #e4e0d8",
  fontFamily: "var(--font-body)",
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContextPage() {
  const [assetURLs, setAssetURLs] = useState<string[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState("");
  const [competitorLoading, setCompetitorLoading] = useState(false);

  // Track competitors as loaded from DB for computing diffs on save
  const loadedCompetitorsRef = useRef<string[]>([]);

  // Brand / company info
  const [brandLoading, setBrandLoading] = useState(true);
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [brandForm, setBrandForm] = useState<BrandData>({
    name: "",
    niche: "",
    city: "",
    state: "",
    tone_of_voice: "professional",
    tone_custom: "",
    cta_channel: "dm",
  });

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
          });
          if (brand.context_json) {
            try {
              const saved = JSON.parse(brand.context_json) as Record<
                string,
                string
              >;
              setAnswers(saved);
            } catch {
              /* ignore */
            }
          }
          if (brand.asset_urls && brand.asset_urls.length > 0) {
            setAssetURLs(brand.asset_urls);
          }
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

  const removeAsset = (url: string) => {
    setAssetURLs((prev) => prev.filter((u) => u !== url));
  };

  const addCompetitor = async () => {
    const clean = competitorInput.trim().replace(/^@/, "").toLowerCase();
    if (!clean) return;
    const handle = `@${clean}`;
    setCompetitorInput("");
    setCompetitorLoading(true);
    try {
      const res = await updateCompetitors([{ type: "add", handle }]);
      setCompetitors(
        res.competitors
          .filter((c) => c.status === "active")
          .map((c) => c.handle),
      );
    } catch {
      // revert optimistically if needed — do nothing for now
    } finally {
      setCompetitorLoading(false);
    }
  };

  const removeCompetitor = async (handle: string) => {
    setCompetitorLoading(true);
    try {
      const res = await updateCompetitors([{ type: "remove", handle }]);
      setCompetitors(
        res.competitors
          .filter((c) => c.status === "active")
          .map((c) => c.handle),
      );
    } catch {
      // ignore
    } finally {
      setCompetitorLoading(false);
    }
  };

  const handleSave = async () => {
    setBrandSaving(true);
    setBrandError(null);
    try {
      // Save brand (including asset_urls)
      await updateBrand({
        ...brandForm,
        context_json:
          Object.keys(answers).length > 0 ? JSON.stringify(answers) : undefined,
        asset_urls: assetURLs,
      });

      // Compute competitor diff and apply
      const loaded = loadedCompetitorsRef.current;
      const ops: CompetitorOperation[] = [];
      for (const h of competitors) {
        if (!loaded.includes(h)) ops.push({ type: "add", handle: h });
      }
      for (const h of loaded) {
        if (!competitors.includes(h)) ops.push({ type: "remove", handle: h });
      }
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

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Contexto da Empresa</h1>
          <p className="page-subtitle">
            A IA usa essas informações para criar posts mais precisos e relevantes.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={brandSaving || brandLoading}
          className="btn-primary shrink-0 disabled:opacity-50"
          style={{ backgroundColor: brandSaved ? "#10B981" : undefined }}
        >
          {brandSaving ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Salvando...
            </>
          ) : brandSaved ? (
            <>✓ Salvo!</>
          ) : (
            <>
              <Save size={14} /> Salvar contexto
            </>
          )}
        </button>
      </div>

      {brandError && (
        <div className="banner-error">{brandError}</div>
      )}

      {/* AI hint */}
      <div className="ai-hint">
        <Sparkles
          size={16}
          style={{ color: "#a6c8f9", marginTop: 1 }}
          className="shrink-0"
        />
        <p
          className="text-xs leading-relaxed"
          style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
        >
          Quanto mais contexto você fornecer, mais personalizados serão seus
          posts. A IA considera eventos, promoções e objetivos para criar
          conteúdo estratégico.
        </p>
      </div>

      {/* Section 0: Company Info */}
      <Section
        title="Informações da empresa"
        subtitle="Nome, nicho, localização e tom de voz"
        icon={Building2}
      >
        {brandLoading ? (
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: "#8c8880" }}
          >
            <Loader2 size={14} className="animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Company name */}
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Nome da empresa
              </label>
              <input
                type="text"
                value={brandForm.name ?? ""}
                onChange={(e) =>
                  setBrandForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Ex: Padaria do João"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-black"
                style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
              />
            </div>

            {/* Niche */}
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Nicho / Segmento
              </label>
              <input
                type="text"
                value={brandForm.niche}
                onChange={(e) =>
                  setBrandForm((p) => ({ ...p, niche: e.target.value }))
                }
                placeholder="Ex: Padaria artesanal, Clínica odontológica, Pet shop..."
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
              />
            </div>

            {/* City / State */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Cidade
                </label>
                <input
                  type="text"
                  value={brandForm.city}
                  onChange={(e) =>
                    setBrandForm((p) => ({ ...p, city: e.target.value }))
                  }
                  placeholder="São Paulo"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Estado
                </label>
                <input
                  type="text"
                  value={brandForm.state}
                  onChange={(e) =>
                    setBrandForm((p) => ({ ...p, state: e.target.value }))
                  }
                  placeholder="SP"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
                />
              </div>
            </div>

            {/* Tone of voice */}
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Tom de voz
              </label>
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setBrandForm((p) => ({ ...p, tone_of_voice: opt.value }))
                    }
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      backgroundColor:
                        brandForm.tone_of_voice === opt.value
                          ? "#0a0a0a"
                          : "#f0ede7",
                      color:
                        brandForm.tone_of_voice === opt.value
                          ? "#f8f5ef"
                          : "#0a0a0a",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {brandForm.tone_of_voice === "other" && (
                <input
                  type="text"
                  value={brandForm.tone_custom ?? ""}
                  onChange={(e) =>
                    setBrandForm((p) => ({ ...p, tone_custom: e.target.value }))
                  }
                  placeholder="Descreva o tom de voz"
                  className="mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ ...inputStyle, border: "1px solid #e4e0d8" }}
                />
              )}
            </div>

            {/* CTA Channel */}
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Canal de CTA principal
              </label>
              <div className="flex gap-2">
                {CTA_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setBrandForm((p) => ({
                        ...p,
                        cta_channel: opt.value as BrandData["cta_channel"],
                      }))
                    }
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      backgroundColor:
                        brandForm.cta_channel === opt.value
                          ? "#0a0a0a"
                          : "#f0ede7",
                      color:
                        brandForm.cta_channel === opt.value
                          ? "#f8f5ef"
                          : "#0a0a0a",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Section 1: Media */}
      <Section
        title="Arquivos de referência"
        subtitle="Imagens, vídeos e documentos do seu negócio"
        icon={ImageIcon}
        defaultOpen={false}
      >
        <DropZone onFiles={handleFiles} disabled={uploadingFile} />

        {uploadingFile && (
          <div
            className="flex items-center gap-2 text-sm mt-3"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            <Loader2 size={14} className="animate-spin" /> Enviando arquivo...
          </div>
        )}

        {uploadError && (
          <div
            className="rounded-xl px-4 py-3 text-sm mt-3"
            style={{
              backgroundColor: "#fde8e8",
              color: "#b91c1c",
              fontFamily: "var(--font-body)",
            }}
          >
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
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={url}
                      alt="asset"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center gap-2"
                      style={{ backgroundColor: "#f0ede7" }}
                    >
                      <MediaIcon type={type} />
                      <p
                        className="text-xs px-2 text-center truncate w-full"
                        style={{
                          color: "#8c8880",
                          fontFamily: "var(--font-body)",
                        }}
                      >
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

      {/* Section 2: AI Questions */}
      <Section
        title="Atualizações da empresa"
        subtitle="Conte à IA o que está acontecendo"
        icon={Sparkles}
      >
        <div className="space-y-5">
          {QUESTIONS.map(({ id, label, placeholder }) => (
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
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [id]: e.target.value }))
                }
                className="w-full rounded-xl border bg-[#f8f5ef] px-4 py-3 text-sm outline-none transition-all focus:border-foreground focus:ring-2 focus:ring-foreground/10 resize-none placeholder:text-muted-foreground"
                style={{
                  borderColor: "#e4e0d8",
                  fontFamily: "var(--font-body)",
                }}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Section 3: Competitors */}
      <Section
        title="Concorrentes monitorados"
        subtitle="Perfis do Instagram que a IA analisa para criar seus posts"
        icon={AtSign}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div
            className="flex items-center gap-2 rounded-xl border bg-[#f8f5ef] px-4 py-2.5 focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/10 transition-all"
            style={{ borderColor: "#e4e0d8" }}
          >
            <AtSign
              size={15}
              style={{ color: "#8c8880" }}
              className="shrink-0"
            />
            <input
              type="text"
              value={competitorInput}
              onChange={(e) => setCompetitorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addCompetitor();
                }
              }}
              placeholder="perfil_concorrente"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              style={{ fontFamily: "var(--font-body)" }}
            />
            <button
              type="button"
              onClick={addCompetitor}
              disabled={!competitorInput.trim() || competitorLoading}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{ backgroundColor: "#0a0a0a", color: "#f8f5ef" }}
            >
              {competitorLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={14} strokeWidth={2.5} />
              )}
            </button>
          </div>

          {competitors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {competitors.map((h) => (
                <CompetitorChip
                  key={h}
                  handle={h}
                  onRemove={() => removeCompetitor(h)}
                />
              ))}
            </div>
          ) : (
            <p
              className="text-xs"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              Adicione os @ dos seus concorrentes no Instagram.
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}
