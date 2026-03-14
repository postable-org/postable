"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  X,
  ImageIcon,
  FileVideo,
  FileText,
  Save,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AtSign,
  Plus,
} from "lucide-react";

// ── Media Upload ─────────────────────────────────────────────────────────────

interface MediaFile {
  id: string;
  file: File;
  preview?: string;
  type: "image" | "video" | "document";
}

function getFileType(file: File): MediaFile["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

function MediaIcon({ type }: { type: MediaFile["type"] }) {
  if (type === "image") return <ImageIcon size={20} style={{ color: "#8c8880" }} />;
  if (type === "video") return <FileVideo size={20} style={{ color: "#8c8880" }} />;
  return <FileText size={20} style={{ color: "#8c8880" }} />;
}

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
      className="rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all"
      style={{
        borderColor: dragging ? "#0a0a0a" : "#e4e0d8",
        backgroundColor: dragging ? "rgba(10,10,10,0.02)" : "#ffffff",
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
      <p className="font-semibold text-sm" style={{ fontFamily: "var(--font-sans)" }}>
        Arraste arquivos aqui
      </p>
      <p className="text-xs mt-1" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
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
            <p className="font-semibold text-sm" style={{ fontFamily: "var(--font-sans)" }}>
              {title}
            </p>
            {subtitle && (
              <p className="text-xs" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContextPage() {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState("");
  const [saved, setSaved] = useState(false);

  const handleFiles = useCallback((files: File[]) => {
    const newFiles: MediaFile[] = files.map((file) => {
      const type = getFileType(file);
      const preview =
        type === "image" ? URL.createObjectURL(file) : undefined;
      return { id: `${Date.now()}-${Math.random()}`, file, preview, type };
    });
    setMediaFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = (id: string) => {
    setMediaFiles((prev) => {
      const f = prev.find((m) => m.id === id);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((m) => m.id !== id);
    });
  };

  const addCompetitor = () => {
    const clean = competitorInput.trim().replace(/^@/, "").toLowerCase();
    if (!clean) return;
    const handle = `@${clean}`;
    if (!competitors.includes(handle)) {
      setCompetitors((prev) => [...prev, handle]);
    }
    setCompetitorInput("");
  };

  const handleSave = () => {
    // UI-only for now — backend integration pending
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="px-6 py-8 space-y-5 pb-24 md:pb-8 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Contexto da Empresa
          </h1>
          <p className="text-sm mt-1" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
            A IA usa essas informações para criar posts mais precisos e relevantes.
          </p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold shrink-0 transition-all"
          style={{
            backgroundColor: saved ? "#10B981" : "#0a0a0a",
            color: "#f8f5ef",
            fontFamily: "var(--font-body)",
          }}
        >
          {saved ? (
            <>✓ Salvo!</>
          ) : (
            <>
              <Save size={14} />
              Salvar contexto
            </>
          )}
        </button>
      </div>

      {/* AI hint */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl"
        style={{ backgroundColor: "rgba(166,200,249,0.1)", border: "1px solid rgba(166,200,249,0.3)" }}
      >
        <Sparkles size={16} style={{ color: "#a6c8f9", marginTop: 1 }} className="shrink-0" />
        <p className="text-xs leading-relaxed" style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}>
          Quanto mais contexto você fornecer, mais personalizados serão seus posts. A IA considera
          eventos, promoções e objetivos para criar conteúdo estratégico.
        </p>
      </div>

      {/* Section 1: Media */}
      <Section
        title="Arquivos de referência"
        subtitle="Imagens, vídeos e documentos do seu negócio"
        icon={ImageIcon}
      >
        <DropZone onFiles={handleFiles} />

        {mediaFiles.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            {mediaFiles.map((mf) => (
              <div
                key={mf.id}
                className="relative rounded-xl overflow-hidden"
                style={{ border: "1px solid #e4e0d8", aspectRatio: "1" }}
              >
                {mf.preview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={mf.preview}
                    alt={mf.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center gap-2"
                    style={{ backgroundColor: "#f0ede7" }}
                  >
                    <MediaIcon type={mf.type} />
                    <p
                      className="text-xs px-2 text-center truncate w-full"
                      style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                    >
                      {mf.file.name}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => removeFile(mf.id)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(10,10,10,0.7)" }}
                >
                  <X size={12} style={{ color: "#f8f5ef" }} />
                </button>
              </div>
            ))}
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
                style={{ borderColor: "#e4e0d8", fontFamily: "var(--font-body)" }}
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
            <AtSign size={15} style={{ color: "#8c8880" }} className="shrink-0" />
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
              disabled={!competitorInput.trim()}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{ backgroundColor: "#0a0a0a", color: "#f8f5ef" }}
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          </div>

          {competitors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {competitors.map((h) => (
                <CompetitorChip
                  key={h}
                  handle={h}
                  onRemove={() =>
                    setCompetitors((prev) => prev.filter((c) => c !== h))
                  }
                />
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
