"use client";

import type { Post } from "@/lib/api/posts";
import { getPosts, updatePostStatus } from "@/lib/api/posts";
import {
  CheckCircle2,
  Clock,
  Facebook,
  GripVertical,
  Instagram,
  Linkedin,
  Plus,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { XLogo } from "@/components/icons/XLogo";

type ColumnId = "draft" | "pending" | "approved" | "published" | "rejected";

interface BoardPost extends Post {
  platform: string;
}

type BoardState = Record<ColumnId, BoardPost[]>;

const COLUMN_DEFS = [
  {
    id: "draft" as ColumnId,
    label: "Rascunho",
    color: "#8c8880",
    bgLight: "#f0ede7",
    Icon: Sparkles,
  },
  {
    id: "pending" as ColumnId,
    label: "Aguardando",
    color: "#D97706",
    bgLight: "#FEF3C7",
    Icon: Clock,
  },
  {
    id: "approved" as ColumnId,
    label: "Aprovado",
    color: "#059669",
    bgLight: "#D1FAE5",
    Icon: CheckCircle2,
  },
  {
    id: "published" as ColumnId,
    label: "Publicado",
    color: "#7C3AED",
    bgLight: "#EDE9FE",
    Icon: Send,
  },
  {
    id: "rejected" as ColumnId,
    label: "Rejeitado",
    color: "#DC2626",
    bgLight: "#FEE2E2",
    Icon: XCircle,
  },
] as const;

const PLATFORMS = [
  { id: "all", label: "Todas", Icon: null, color: "#0a0a0a" },
  { id: "instagram", label: "Instagram", Icon: Instagram, color: "#E1306C" },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin, color: "#0A66C2" },
  { id: "facebook", label: "Facebook", Icon: Facebook, color: "#1877F2" },
  { id: "x", label: "X", Icon: XLogo, color: "#000000" },
];

const FORMAT_LABEL: Record<string, string> = {
  carousel: "Carrossel",
  feed_post: "Feed",
  story: "Story",
};

function getPlatformEntry(id: string) {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[1];
}

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 1) return "Agora mesmo";
  if (hours < 24) return `${hours}h atrás`;
  if (days === 1) return "Ontem";
  return `${days}d atrás`;
}

function PipelineCard({
  post,
  columnId,
  onDragStart,
  isDragging,
}: {
  post: BoardPost;
  columnId: ColumnId;
  onDragStart: (e: React.DragEvent, id: string, col: ColumnId) => void;
  isDragging: boolean;
}) {
  const plat = getPlatformEntry(post.platform);
  const formatLabel =
    FORMAT_LABEL[post.suggested_format] ?? "Post";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, post.id, columnId)}
      className="rounded-2xl p-4 transition-all select-none"
      style={{
        backgroundColor: "#ffffff",
        border: "1.5px solid #e4e0d8",
        opacity: isDragging ? 0.35 : 1,
        cursor: isDragging ? "grabbing" : "grab",
        boxShadow: isDragging
          ? "0 12px 32px rgba(0,0,0,0.14)"
          : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: plat.color }}
          />
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: plat.color, fontFamily: "var(--font-body)" }}
          >
            {plat.label}
          </span>
        </div>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
          style={{
            backgroundColor: "#f0ede7",
            color: "#8c8880",
            fontFamily: "var(--font-body)",
          }}
        >
          {formatLabel}
        </span>
      </div>

      <p
        className="text-xs leading-relaxed line-clamp-3"
        style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
      >
        {post.post_text}
      </p>

      {post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {post.hashtags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-md"
              style={{
                backgroundColor: "#f0ede7",
                color: "#8c8880",
                fontFamily: "var(--font-body)",
              }}
            >
              {tag}
            </span>
          ))}
          {post.hashtags.length > 3 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-md"
              style={{
                backgroundColor: "#f0ede7",
                color: "#8c8880",
                fontFamily: "var(--font-body)",
              }}
            >
              +{post.hashtags.length - 3}
            </span>
          )}
        </div>
      )}

      <div
        className="flex items-center justify-between mt-3 pt-3"
        style={{ borderTop: "1px solid #f0ede7" }}
      >
        <span
          className="text-[10px]"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          {formatRelativeDate(post.created_at)}
        </span>
        <GripVertical
          size={13}
          strokeWidth={1.5}
          style={{ color: "#d0cdc7" }}
        />
      </div>
    </div>
  );
}

function BoardColumn({
  colDef,
  posts,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  colDef: (typeof COLUMN_DEFS)[number];
  posts: BoardPost[];
  dragging: { id: string; fromColumn: ColumnId } | null;
  dragOver: ColumnId | null;
  onDragStart: (e: React.DragEvent, id: string, col: ColumnId) => void;
  onDragOver: (e: React.DragEvent, col: ColumnId) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, col: ColumnId) => void;
}) {
  const { Icon } = colDef;
  const isOver = dragOver === colDef.id;

  return (
    <div
      className="flex flex-col shrink-0 rounded-2xl"
      style={{
        width: 280,
        backgroundColor: isOver ? colDef.bgLight : "#f8f5ef",
        border: isOver
          ? `2px solid ${colDef.color}40`
          : "2px solid transparent",
        transition: "background-color 0.15s, border-color 0.15s",
      }}
      onDragOver={(e) => onDragOver(e, colDef.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, colDef.id)}
    >
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${colDef.color}18` }}
        >
          <Icon size={14} strokeWidth={2} style={{ color: colDef.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-semibold truncate"
              style={{ fontFamily: "var(--font-sans)", color: "#0a0a0a" }}
            >
              {colDef.label}
            </span>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `${colDef.color}18`,
                color: colDef.color,
                fontFamily: "var(--font-body)",
              }}
            >
              {posts.length}
            </span>
          </div>
        </div>
      </div>

      <div
        className="flex flex-col gap-2.5 px-3 pb-4 overflow-y-auto"
        style={{ minHeight: 120, maxHeight: "calc(100vh - 220px)" }}
      >
        {posts.length === 0 && (
          <div
            className="rounded-xl p-5 text-center mt-1"
            style={{
              border: `1.5px dashed ${isOver ? colDef.color + "60" : "#e4e0d8"}`,
              transition: "border-color 0.15s",
            }}
          >
            <p
              className="text-[11px]"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              {isOver ? "Soltar aqui" : "Nenhum post"}
            </p>
          </div>
        )}
        {posts.map((post) => (
          <PipelineCard
            key={post.id}
            post={post}
            columnId={colDef.id}
            onDragStart={onDragStart}
            isDragging={dragging?.id === post.id}
          />
        ))}
      </div>

      <div className="px-3 pb-3 mt-auto">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              `${colDef.color}10`;
            (e.currentTarget as HTMLElement).style.color = colDef.color;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              "transparent";
            (e.currentTarget as HTMLElement).style.color = "#8c8880";
          }}
        >
          <Plus size={13} strokeWidth={2} />
          Adicionar
        </button>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [board, setBoard] = useState<BoardState>({
    draft: [],
    pending: [],
    approved: [],
    published: [],
    rejected: [],
  });
  const [activePlatform, setActivePlatform] = useState("all");
  const [dragging, setDragging] = useState<{
    id: string;
    fromColumn: ColumnId;
  } | null>(null);
  const [dragOver, setDragOver] = useState<ColumnId | null>(null);

  useEffect(() => {
    getPosts()
      .then((posts) => {
        setBoard((prev) => ({
          ...prev,
          pending: posts
            .filter((p) => p.status === "pending")
            .map((p) => ({ ...p, platform: "instagram" })),
          approved: posts
            .filter((p) => p.status === "approved")
            .map((p) => ({ ...p, platform: "instagram" })),
          rejected: posts
            .filter((p) => p.status === "rejected")
            .map((p) => ({ ...p, platform: "instagram" })),
        }));
      })
      .catch(() => {});
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, id: string, fromColumn: ColumnId) => {
      setDragging({ id, fromColumn });
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, columnId: ColumnId) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOver(columnId);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOver(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, toColumn: ColumnId) => {
      e.preventDefault();
      setDragOver(null);
      if (!dragging || dragging.fromColumn === toColumn) {
        setDragging(null);
        return;
      }
      const { id, fromColumn } = dragging;
      setDragging(null);

      setBoard((prev) => {
        const post = prev[fromColumn].find((p) => p.id === id);
        if (!post) return prev;
        return {
          ...prev,
          [fromColumn]: prev[fromColumn].filter((p) => p.id !== id),
          [toColumn]: [{ ...post }, ...prev[toColumn]],
        };
      });

      if (toColumn === "approved" || toColumn === "rejected") {
        try {
          await updatePostStatus(id, toColumn);
        } catch {
          setBoard((prev) => {
            const post = prev[toColumn].find((p) => p.id === id);
            if (!post) return prev;
            return {
              ...prev,
              [toColumn]: prev[toColumn].filter((p) => p.id !== id),
              [fromColumn]: [{ ...post }, ...prev[fromColumn]],
            };
          });
        }
      }
    },
    [dragging],
  );

  const filteredBoard: BoardState =
    activePlatform === "all"
      ? board
      : {
          draft: board.draft.filter((p) => p.platform === activePlatform),
          pending: board.pending.filter((p) => p.platform === activePlatform),
          approved: board.approved.filter((p) => p.platform === activePlatform),
          published: board.published.filter(
            (p) => p.platform === activePlatform,
          ),
          rejected: board.rejected.filter((p) => p.platform === activePlatform),
        };

  const totalPosts =
    board.draft.length +
    board.pending.length +
    board.approved.length +
    board.published.length +
    board.rejected.length;

  return (
    <div className="flex flex-col flex-1 h-full min-h-screen pb-24 md:pb-0 min-w-0">
      {/* Header */}
      <div
        className="px-6 py-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 shrink-0"
        style={{ borderBottom: "1px solid #e4e0d8" }}
      >
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Pipeline
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            {totalPosts} {totalPosts === 1 ? "post" : "posts"} no pipeline
          </p>
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-2xl overflow-x-auto shrink-0"
          style={{ backgroundColor: "#f0ede7" }}
        >
          {PLATFORMS.map(({ id, label, Icon, color }) => {
            const active = activePlatform === id;
            return (
              <button
                key={id}
                onClick={() => setActivePlatform(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0"
                style={{
                  backgroundColor: active ? "#ffffff" : "transparent",
                  color: active ? "#0a0a0a" : "#8c8880",
                  fontFamily: "var(--font-body)",
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {Icon ? (
                  <Icon
                    size={13}
                    strokeWidth={1.8}
                    style={{ color: active ? color : "#8c8880" }}
                  />
                ) : null}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Board */}
      <div
        className="flex gap-4 px-6 py-5 overflow-x-auto"
        style={{ alignItems: "flex-start", flex: 1 }}
        onDragEnd={() => {
          setDragging(null);
          setDragOver(null);
        }}
      >
        {COLUMN_DEFS.map((col) => (
          <BoardColumn
            key={col.id}
            colDef={col}
            posts={filteredBoard[col.id]}
            dragging={dragging}
            dragOver={dragOver}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        ))}
        <div className="shrink-0 w-2" />
      </div>

      {dragging && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-medium pointer-events-none z-50"
          style={{
            backgroundColor: "#0a0a0a",
            color: "#f8f5ef",
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          }}
        >
          Arraste para outra coluna
        </div>
      )}
    </div>
  );
}
