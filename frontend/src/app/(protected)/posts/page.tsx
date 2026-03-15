"use client";

import { GenerateButton } from "@/components/dashboard/GenerateButton";
import { PostCard } from "@/components/dashboard/PostCard";
import type { Post, PostContent } from "@/lib/api/posts";
import { getPosts } from "@/lib/api/posts";
import {
  Calendar,
  Facebook,
  Instagram,
  LayoutGrid,
  Linkedin,
  List,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const PLATFORMS = [
  { id: "instagram", label: "Instagram", Icon: Instagram, color: "#E1306C" },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin, color: "#0A66C2" },
  { id: "facebook", label: "Facebook", Icon: Facebook, color: "#1877F2" },
];

type ViewMode = "list" | "grid" | "calendar";

function groupByDate(posts: Post[]): Record<string, Post[]> {
  const g: Record<string, Post[]> = {};
  for (const p of posts) {
    const d = new Date(p.created_at).toLocaleDateString("pt-BR");
    g[d] = g[d] ? [...g[d], p] : [p];
  }
  return g;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activePlatform, setActivePlatform] = useState("instagram");
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const triggerRef = useRef<(() => void) | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getPosts()
      .then(setPosts)
      .catch(() => {});
  }, []);

  useLayoutEffect(() => {
    const activeIndex = PLATFORMS.findIndex((p) => p.id === activePlatform);
    const btn = tabRefs.current[activeIndex];
    const container = tabsContainerRef.current;
    if (btn && container) {
      const btnRect = btn.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setPillStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
        opacity: 1,
      });
    }
  }, [activePlatform]);

  const handleGenerated = useCallback(async (content: PostContent) => {
    const optimistic: Post = {
      id: Date.now().toString(),
      user_id: "",
      brand_id: "",
      status: "pending",
      platform: "instagram",
      post_text: content.post_text,
      cta: content.cta,
      hashtags: content.hashtags ?? [],
      suggested_format: content.suggested_format,
      strategic_justification: content.strategic_justification,
      tokens_used: content.tokens_used,
      image_url: content.image_url,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setPosts((prev) => [optimistic, ...prev]);
    try {
      const fresh = await getPosts();
      setPosts(fresh);
    } catch {}
  }, []);

  const handleStatusChange = useCallback(
    (id: string, status: "approved" | "rejected") => {
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    },
    [],
  );

  const handleRegenerate = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    triggerRef.current?.();
  }, []);

  const filteredPosts =
    statusFilter === "all"
      ? posts
      : posts.filter((p) => p.status === statusFilter);
  const grouped = groupByDate(filteredPosts);
  const dates = Array.from(
    new Set(
      filteredPosts.map((p) =>
        new Date(p.created_at).toLocaleDateString("pt-BR"),
      ),
    ),
  );
  const activePlatformData = PLATFORMS.find((p) => p.id === activePlatform);

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Posts</h1>
          <p className="page-subtitle">
            Biblioteca de conteúdo gerado e histórico por plataforma.
          </p>
        </div>
        <GenerateButton onGenerated={handleGenerated} triggerRef={triggerRef} />
      </div>

      {/* ── Platform tabs — sliding pill ── */}
      <div
        ref={tabsContainerRef}
        className="relative flex items-center gap-1 p-1 rounded-2xl overflow-x-auto"
        style={{ backgroundColor: "#f0ede7" }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 4,
            bottom: 4,
            left: pillStyle.left,
            width: pillStyle.width,
            opacity: pillStyle.opacity,
            backgroundColor: "#ffffff",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            transition:
              "left 220ms cubic-bezier(0.4,0,0.2,1), width 220ms cubic-bezier(0.4,0,0.2,1), opacity 150ms ease",
            pointerEvents: "none",
          }}
        />
        {PLATFORMS.map(({ id, label, Icon, color }, index) => {
          const active = activePlatform === id;
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              onClick={() => setActivePlatform(id)}
              className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap shrink-0"
              style={{
                color: active ? "#0a0a0a" : "#8c8880",
                fontFamily: "var(--font-body)",
                backgroundColor: "transparent",
                transition: "color 200ms ease",
              }}
            >
              <Icon
                size={14}
                strokeWidth={1.8}
                style={{
                  color: active ? color : "#8c8880",
                  transition: "color 200ms ease",
                }}
              />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Filters + view toggle ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          {(
            [
              { id: "all", label: "Todos" },
              { id: "pending", label: "Pendentes" },
              { id: "approved", label: "Aprovados" },
              { id: "rejected", label: "Rejeitados" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id)}
              className={`filter-chip transition-all ${
                statusFilter === id
                  ? "filter-chip-active"
                  : "filter-chip-inactive"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="pill-bar">
          {[
            { id: "grid" as const, Icon: LayoutGrid },
            { id: "list" as const, Icon: List },
            { id: "calendar" as const, Icon: Calendar },
          ].map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={`p-2 rounded-lg transition-all ${
                viewMode === id
                  ? "bg-card text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <Icon size={14} strokeWidth={1.8} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Platform hint — mesmo padrão de info banner do Contexto ── */}
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs"
        style={{
          backgroundColor: "rgba(166,200,249,0.1)",
          border: "1px solid rgba(166,200,249,0.3)",
          fontFamily: "var(--font-body)",
          color: "#8c8880",
        }}
      >
        <span>Posts otimizados para</span>
        <span className="font-semibold" style={{ color: "#0a0a0a" }}>
          {activePlatformData?.label}
        </span>
        <span className="ml-auto opacity-60">
          O filtro por plataforma será disponível em breve
        </span>
      </div>

      {/* ── Posts ── */}
      {filteredPosts.length === 0 ? (
        <div className="empty-box">
          <p className="text-sm text-muted-foreground">
            Nenhum post encontrado. Gere seu primeiro post!
          </p>
        </div>
      ) : viewMode === "calendar" ? (
        <div className="space-y-8">
          {dates.map((date) => (
            <section key={date}>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
              >
                {date}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[date].map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onStatusChange={handleStatusChange}
                    onRegenerate={handleRegenerate}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onStatusChange={handleStatusChange}
              onRegenerate={handleRegenerate}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onStatusChange={handleStatusChange}
              onRegenerate={handleRegenerate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
