"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getPosts } from "@/lib/api/posts";
import type { Post, PostContent } from "@/lib/api/posts";
import { GenerateButton } from "@/components/dashboard/GenerateButton";
import { PostCard } from "@/components/dashboard/PostCard";
import { LayoutGrid, List, Calendar, Instagram, Linkedin, Facebook, Twitter } from "lucide-react";

const PLATFORMS = [
  { id: "instagram", label: "Instagram", Icon: Instagram, color: "#E1306C" },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin, color: "#0A66C2" },
  { id: "facebook", label: "Facebook", Icon: Facebook, color: "#1877F2" },
  { id: "x", label: "X", Icon: Twitter, color: "#000000" },
  { id: "reddit", label: "Reddit", Icon: null, color: "#FF4500" },
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
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const triggerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    getPosts().then(setPosts).catch(() => {});
  }, []);

  const handleGenerated = useCallback(async (content: PostContent) => {
    const optimistic: Post = {
      id: Date.now().toString(),
      user_id: "",
      brand_id: "",
      status: "pending",
      content_json: content,
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
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status } : p))
      );
    },
    []
  );

  const handleRegenerate = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    triggerRef.current?.();
  }, []);

  const filteredPosts =
    statusFilter === "all" ? posts : posts.filter((p) => p.status === statusFilter);

  const grouped = groupByDate(filteredPosts);
  const dates = Array.from(
    new Set(filteredPosts.map((p) => new Date(p.created_at).toLocaleDateString("pt-BR")))
  );

  return (
    <div className="px-6 py-8 space-y-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Posts
        </h1>
        <GenerateButton onGenerated={handleGenerated} triggerRef={triggerRef} />
      </div>

      {/* Platform tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-2xl overflow-x-auto"
        style={{ backgroundColor: "#f0ede7" }}
      >
        {PLATFORMS.map(({ id, label, Icon, color }) => {
          const active = activePlatform === id;
          return (
            <button
              key={id}
              onClick={() => setActivePlatform(id)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0"
              style={{
                backgroundColor: active ? "#ffffff" : "transparent",
                color: active ? "#0a0a0a" : "#8c8880",
                fontFamily: "var(--font-body)",
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {Icon ? (
                <Icon size={14} strokeWidth={1.8} style={{ color: active ? color : "#8c8880" }} />
              ) : (
                <span
                  className="text-[11px] font-bold"
                  style={{ color: active ? color : "#8c8880" }}
                >
                  Rd
                </span>
              )}
              {label}
            </button>
          );
        })}
      </div>

      {/* Filters + view toggle */}
      <div className="flex items-center justify-between gap-4">
        {/* Status filter */}
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
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: statusFilter === id ? "#0a0a0a" : "#f0ede7",
                color: statusFilter === id ? "#f8f5ef" : "#8c8880",
                fontFamily: "var(--font-body)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* View mode */}
        <div className="flex items-center gap-0.5 p-1 rounded-xl" style={{ backgroundColor: "#f0ede7" }}>
          {(
            [
              { id: "grid" as const, Icon: LayoutGrid },
              { id: "list" as const, Icon: List },
              { id: "calendar" as const, Icon: Calendar },
            ]
          ).map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className="p-2 rounded-lg transition-all"
              style={{
                backgroundColor: viewMode === id ? "#ffffff" : "transparent",
                color: viewMode === id ? "#0a0a0a" : "#8c8880",
              }}
            >
              <Icon size={14} strokeWidth={1.8} />
            </button>
          ))}
        </div>
      </div>

      {/* Platform note */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
        style={{
          backgroundColor: "#f0ede7",
          color: "#8c8880",
          fontFamily: "var(--font-body)",
        }}
      >
        <span>Posts otimizados para</span>
        <span className="font-semibold" style={{ color: "#0a0a0a" }}>
          {PLATFORMS.find((p) => p.id === activePlatform)?.label}
        </span>
        <span className="ml-auto opacity-60">O filtro por plataforma será disponível em breve</span>
      </div>

      {/* Posts */}
      {filteredPosts.length === 0 ? (
        <div
          className="rounded-2xl p-14 text-center"
          style={{ border: "1.5px dashed #e4e0d8" }}
        >
          <p className="text-sm" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
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
