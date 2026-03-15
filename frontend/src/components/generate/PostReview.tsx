"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { PostContent } from "@/lib/api/posts";
import {
  X,
  ThumbsUp,
  ThumbsDown,
  ImageIcon,
  Trash2,
  Save,
  Send,
  Plus,
  ChevronRight,
  Hash,
  Sparkles,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtraMedia {
  id: string;
  preview?: string;
  name: string;
}

interface PostReviewProps {
  content: PostContent;
  onSave: (content: PostContent, extraMedia: File[]) => void;
  onPublish: (content: PostContent, extraMedia: File[]) => void;
  onCancel: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: "rgba(10,10,10,0.07)",
        color: "#0a0a0a",
        fontFamily: "var(--font-body)",
      }}
    >
      {children}
    </span>
  );
}

function ActionBtn({
  onClick,
  active,
  children,
  variant = "default",
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  variant?: "default" | "danger" | "primary" | "success";
  disabled?: boolean;
}) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    default: { bg: active ? "#0a0a0a" : "#f0ede7", color: active ? "#f8f5ef" : "#0a0a0a", border: "transparent" },
    danger: { bg: "#fee2e2", color: "#dc2626", border: "transparent" },
    primary: { bg: "#0a0a0a", color: "#f8f5ef", border: "transparent" },
    success: { bg: "#d1fae5", color: "#065f46", border: "transparent" },
  };
  const c = colors[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-40"
      style={{
        backgroundColor: c.bg,
        color: c.color,
        border: `1.5px solid ${c.border}`,
        fontFamily: "var(--font-body)",
      }}
    >
      {children}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PostReview({ content, onSave, onPublish, onCancel }: PostReviewProps) {
  const [caption, setCaption] = useState(content.post_text);
  const [hashtags, setHashtags] = useState<string[]>(content.hashtags ?? []);
  const [imageUrl, setImageUrl] = useState<string | null>(content.image_url ?? null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [extraMedia, setExtraMedia] = useState<ExtraMedia[]>([]);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const [editingTag, setEditingTag] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (editingCaption && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [caption, editingCaption]);

  const handleAddMedia = useCallback((files: File[]) => {
    const newMedia = files.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      name: f.name,
    }));
    setExtraMedia((prev) => [...prev, ...newMedia]);
    setExtraFiles((prev) => [...prev, ...files]);
  }, []);

  const removeExtraMedia = (id: string, idx: number) => {
    setExtraMedia((prev) => {
      const m = prev.find((x) => x.id === id);
      if (m?.preview) URL.revokeObjectURL(m.preview);
      return prev.filter((x) => x.id !== id);
    });
    setExtraFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeHashtag = (tag: string) => {
    setHashtags((prev) => prev.filter((t) => t !== tag));
  };

  const addHashtag = () => {
    const clean = editingTag.trim().replace(/^#/, "");
    if (clean && !hashtags.includes(`#${clean}`)) {
      setHashtags((prev) => [...prev, `#${clean}`]);
    }
    setEditingTag("");
  };

  const buildFinalContent = (): PostContent => ({
    ...content,
    post_text: caption,
    hashtags,
    image_url: imageRemoved ? undefined : imageUrl ?? undefined,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full sm:max-w-4xl max-h-[95dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl flex flex-col"
        style={{ backgroundColor: "#f8f5ef", border: "1.5px solid #e4e0d8" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{
            backgroundColor: "#f8f5ef",
            borderBottom: "1px solid #e4e0d8",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#0a0a0a" }}
            >
              <Sparkles size={14} style={{ color: "#f8f5ef" }} />
            </div>
            <p
              className="font-semibold text-sm"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Post gerado pela IA
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[#e4e0d8]"
          >
            <X size={16} style={{ color: "#0a0a0a" }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row gap-0 flex-1 min-h-0">
          {/* Left: Image area */}
          <div
            className="lg:w-[420px] shrink-0 p-5 space-y-3"
            style={{ borderRight: "1px solid #e4e0d8" }}
          >
            {/* Main generated image */}
            <div
              className="w-full rounded-2xl overflow-hidden relative bg-[#f0ede7]"
              style={{ aspectRatio: "1", border: "1px solid #e4e0d8" }}
            >
              {imageUrl && !imageRemoved ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Post gerado"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setImageRemoved(true)}
                    className="absolute top-2.5 right-2.5 w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                    style={{ backgroundColor: "rgba(10,10,10,0.75)" }}
                    title="Remover imagem"
                  >
                    <Trash2 size={14} style={{ color: "#f8f5ef" }} />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <ImageIcon size={32} style={{ color: "#c8c4be" }} strokeWidth={1.5} />
                  <p
                    className="text-xs text-center px-4"
                    style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                  >
                    {imageRemoved ? "Imagem removida" : "Nenhuma imagem gerada"}
                  </p>
                  {imageRemoved && (
                    <button
                      onClick={() => setImageRemoved(false)}
                      className="text-xs underline"
                      style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                    >
                      Restaurar
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Add more media */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p
                  className="text-xs font-medium"
                  style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                >
                  Mídias adicionais ({extraMedia.length})
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-xs font-medium transition-colors"
                  style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
                >
                  <Plus size={12} strokeWidth={2.5} />
                  Adicionar
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) handleAddMedia(files);
                    e.target.value = "";
                  }}
                />
              </div>

              {extraMedia.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {extraMedia.map((m, idx) => (
                    <div
                      key={m.id}
                      className="relative rounded-xl overflow-hidden"
                      style={{ aspectRatio: "1", border: "1px solid #e4e0d8" }}
                    >
                      {m.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.preview}
                          alt={m.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ backgroundColor: "#e4e0d8" }}
                        >
                          <ImageIcon size={14} style={{ color: "#8c8880" }} />
                        </div>
                      )}
                      <button
                        onClick={() => removeExtraMedia(m.id, idx)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "rgba(10,10,10,0.7)" }}
                      >
                        <X size={10} style={{ color: "#f8f5ef" }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reaction */}
            <div className="flex items-center gap-2 pt-1">
              <p
                className="text-xs"
                style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
              >
                O que achou?
              </p>
              <button
                onClick={() => setReaction(reaction === "like" ? null : "like")}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                style={{
                  backgroundColor: reaction === "like" ? "#d1fae5" : "#f0ede7",
                  color: reaction === "like" ? "#065f46" : "#8c8880",
                }}
              >
                <ThumbsUp size={14} strokeWidth={reaction === "like" ? 2.5 : 1.8} />
              </button>
              <button
                onClick={() => setReaction(reaction === "dislike" ? null : "dislike")}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                style={{
                  backgroundColor: reaction === "dislike" ? "#fee2e2" : "#f0ede7",
                  color: reaction === "dislike" ? "#dc2626" : "#8c8880",
                }}
              >
                <ThumbsDown size={14} strokeWidth={reaction === "dislike" ? 2.5 : 1.8} />
              </button>
            </div>
          </div>

          {/* Right: Caption + meta */}
          <div className="flex-1 min-w-0 p-5 space-y-4 flex flex-col">
            {/* Caption */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                >
                  Legenda
                </p>
                <button
                  onClick={() => setEditingCaption((v) => !v)}
                  className="text-xs font-medium underline"
                  style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
                >
                  {editingCaption ? "Fechar edição" : "Editar"}
                </button>
              </div>

              {editingCaption ? (
                <textarea
                  ref={textareaRef}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none resize-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#0a0a0a]/10 transition-all"
                  style={{
                    borderColor: "#e4e0d8",
                    fontFamily: "var(--font-body)",
                    minHeight: "140px",
                    lineHeight: "1.6",
                  }}
                />
              ) : (
                <div
                  className="rounded-xl px-4 py-3 text-sm whitespace-pre-wrap cursor-text"
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1.5px solid #e4e0d8",
                    fontFamily: "var(--font-body)",
                    lineHeight: "1.6",
                    color: "#0a0a0a",
                    minHeight: "100px",
                  }}
                  onClick={() => setEditingCaption(true)}
                >
                  {caption || (
                    <span style={{ color: "#8c8880" }}>Clique para editar a legenda...</span>
                  )}
                </div>
              )}
            </div>

            {/* CTA */}
            {content.cta && (
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
              >
                <ChevronRight size={14} style={{ color: "#0a0a0a" }} strokeWidth={2.5} />
                <p
                  className="text-sm font-medium"
                  style={{ fontFamily: "var(--font-body)", color: "#0a0a0a" }}
                >
                  {content.cta}
                </p>
              </div>
            )}

            {/* Hashtags */}
            <div className="space-y-2">
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
              >
                Hashtags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {hashtags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => removeHashtag(tag)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:opacity-70 group"
                    style={{
                      backgroundColor: "#0a0a0a",
                      color: "#f8f5ef",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    <Hash size={10} />
                    {tag.replace(/^#/, "")}
                    <X size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
                <div
                  className="flex items-center rounded-full overflow-hidden"
                  style={{ border: "1.5px dashed #c8c4be" }}
                >
                  <input
                    type="text"
                    value={editingTag}
                    onChange={(e) => setEditingTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        addHashtag();
                      }
                    }}
                    placeholder="+ tag"
                    className="pl-2.5 pr-1 py-1 text-xs bg-transparent outline-none w-16"
                    style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                  />
                  {editingTag && (
                    <button
                      onClick={addHashtag}
                      className="pr-2 text-xs"
                      style={{ color: "#0a0a0a" }}
                    >
                      ↵
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Strategic context */}
            {content.strategic_justification && (
              <div
                className="rounded-xl px-4 py-3 space-y-1"
                style={{
                  backgroundColor: "rgba(166,200,249,0.08)",
                  border: "1px solid rgba(166,200,249,0.2)",
                }}
              >
                <p
                  className="text-xs font-semibold"
                  style={{ color: "#4a90d9", fontFamily: "var(--font-body)" }}
                >
                  Por que este post agora?
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
                >
                  {content.strategic_justification}
                </p>
              </div>
            )}

            {/* Format badge */}
            {content.suggested_format && (
              <Pill>
                {content.suggested_format === "feed_post"
                  ? "Feed"
                  : content.suggested_format === "carousel"
                  ? "Carrossel"
                  : "Story"}
              </Pill>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 sticky bottom-0"
          style={{
            backgroundColor: "#f8f5ef",
            borderTop: "1px solid #e4e0d8",
          }}
        >
          <ActionBtn onClick={onCancel} variant="default">
            <X size={14} />
            Cancelar
          </ActionBtn>

          <div className="flex items-center gap-2">
            <ActionBtn
              onClick={() => onSave(buildFinalContent(), extraFiles)}
              variant="default"
            >
              <Save size={14} />
              Salvar para depois
            </ActionBtn>
            <ActionBtn
              onClick={() => onPublish(buildFinalContent(), extraFiles)}
              variant="primary"
            >
              <Send size={14} />
              Publicar
            </ActionBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
