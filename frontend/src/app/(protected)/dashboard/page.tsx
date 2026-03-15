"use client";

import { GenerateButton } from "@/components/dashboard/GenerateButton";
import { PostCard } from "@/components/dashboard/PostCard";
import { GenerationOverlay } from "@/components/generate/GenerationOverlay";
import { PostReview } from "@/components/generate/PostReview";
import type { Post, PostContent } from "@/lib/api/posts";
import { getPosts, updatePostStatus } from "@/lib/api/posts";
import { usePlatform } from "@/lib/context/PlatformContext";
import type { SSEStatus, StageState } from "@/lib/hooks/useSSEGenerate";
import { Calendar, CheckCircle, Clock, TrendingUp, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: accent ? `${accent}15` : "#f0ede7" }}
      >
        <Icon
          size={18}
          strokeWidth={1.8}
          style={{ color: accent ?? "#0a0a0a" }}
        />
      </div>
      <div>
        <p
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {value}
        </p>
        <p
          className="text-xs mt-0.5"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { platform } = usePlatform();
  const [posts, setPosts] = useState<Post[]>([]);
  const [mode, setMode] = useState<"quick" | "calendar">("quick");
  const [reviewContent, setReviewContent] = useState<PostContent | null>(null);
  const triggerGenerateRef = useRef<(() => void) | null>(null);
  const resetGenerateRef = useRef<(() => void) | null>(null);

  const [genStatus, setGenStatus] = useState<SSEStatus>("idle");
  const [genStage, setGenStage] = useState<StageState>({
    stage: null,
    status: null,
    message: "",
  });
  const [genMessage, setGenMessage] = useState("");

  const handleGenStatusChange = useCallback(
    (status: SSEStatus, stageState: StageState, progressMessage: string) => {
      setGenStatus(status);
      setGenStage(stageState);
      setGenMessage(progressMessage);
    },
    [],
  );

  const handleCancelGeneration = useCallback(() => {
    resetGenerateRef.current?.();
    setGenStatus("idle");
    setGenStage({ stage: null, status: null, message: "" });
    setGenMessage("");
  }, []);

  useEffect(() => {
    getPosts()
      .then(setPosts)
      .catch(() => {});
  }, []);

  const handleGenerated = useCallback((content: PostContent) => {
    setReviewContent(content);
  }, []);

  const handleSavePost = useCallback(async (content: PostContent) => {
    setReviewContent(null);
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

  const handlePublishPost = useCallback(async (content: PostContent) => {
    setReviewContent(null);
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
      const created = fresh.find((p) => p.status === "pending");
      if (created) {
        await updatePostStatus(created.id, "approved");
        setPosts((prev) =>
          prev.map((p) =>
            p.id === created.id ? { ...p, status: "approved" } : p,
          ),
        );
      }
    } catch {}
  }, []);

  const handleStatusChange = useCallback(
    (id: string, status: "approved" | "rejected") => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status, updated_at: new Date().toISOString() }
            : p,
        ),
      );
    },
    [],
  );

  const handleRegenerate = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    triggerGenerateRef.current?.();
  }, []);

  const pendingPosts = posts.filter((p) => p.status === "pending");
  const approvedPosts = posts.filter((p) => p.status === "approved");
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <GenerationOverlay
        status={genStatus}
        stageState={genStage}
        progressMessage={genMessage}
        platform={platform}
        onCancel={handleCancelGeneration}
      />
      {reviewContent && (
        <PostReview
          content={reviewContent}
          onSave={handleSavePost}
          onPublish={handlePublishPost}
          onCancel={() => setReviewContent(null)}
        />
      )}

      <div className="px-6 py-8 max-w-6xl mx-auto space-y-8 pb-24 md:pb-8">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p
              className="text-sm capitalize"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              {today}
            </p>
            <h1
              className="text-3xl font-bold tracking-tight mt-1"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Visão Geral
            </h1>
          </div>

          {/* Toggle de modo — mesmo padrão pill */}
          <div
            className="flex items-center gap-0.5 p-1 rounded-xl"
            style={{ backgroundColor: "#f0ede7" }}
          >
            {(
              [
                { id: "quick", label: "Gerar Posts", Icon: Zap },
                { id: "calendar", label: "Calendário", Icon: Calendar },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: mode === id ? "#0a0a0a" : "transparent",
                  color: mode === id ? "#f8f5ef" : "#8c8880",
                  fontFamily: "var(--font-body)",
                }}
              >
                <Icon size={13} strokeWidth={mode === id ? 2.5 : 1.8} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Pendentes"
            value={pendingPosts.length}
            icon={Clock}
            accent="#F59E0B"
          />
          <StatCard
            label="Aprovados"
            value={approvedPosts.length}
            icon={CheckCircle}
            accent="#10B981"
          />
          <StatCard
            label="Total de posts"
            value={posts.length}
            icon={TrendingUp}
          />
          <StatCard
            label="Esta semana"
            value={
              posts.filter(
                (p) =>
                  Date.now() - new Date(p.created_at).getTime() <
                  7 * 24 * 60 * 60 * 1000,
              ).length
            }
            icon={Calendar}
          />
        </div>

        {/* ── Main area ── */}
        {mode === "quick" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {/* Generate card — dark inversion mantida para destaque */}
              <div
                className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                style={{ backgroundColor: "#0a0a0a" }}
              >
                <div>
                  <p
                    className="font-semibold text-base"
                    style={{ color: "#f8f5ef", fontFamily: "var(--font-sans)" }}
                  >
                    Gerar novo post
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{
                      color: "rgba(248,245,239,0.45)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    A IA analisa seus concorrentes e cria conteúdo otimizado.
                  </p>
                </div>
                <GenerateButton
                  onGenerated={handleGenerated}
                  onStatusChange={handleGenStatusChange}
                  triggerRef={triggerGenerateRef}
                  resetRef={resetGenerateRef}
                  dark
                />
              </div>

              {pendingPosts.length > 0 && (
                <div className="space-y-3">
                  <h2
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                  >
                    Aguardando aprovação ({pendingPosts.length})
                  </h2>
                  <div className="space-y-3">
                    {pendingPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onStatusChange={handleStatusChange}
                        onRegenerate={handleRegenerate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {pendingPosts.length === 0 && posts.length === 0 && (
                <div
                  className="rounded-2xl p-10 text-center"
                  style={{ border: "1.5px dashed #e4e0d8" }}
                >
                  <p className="text-3xl mb-3" style={{ opacity: 0.4 }}>
                    ✦
                  </p>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
                  >
                    Nenhum post ainda
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                  >
                    Clique em &quot;Gerar novo post&quot; para começar.
                  </p>
                </div>
              )}
            </div>

            {/* Approved column */}
            <div className="space-y-4">
              <h2
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
              >
                Posts aprovados
              </h2>
              {approvedPosts.slice(0, 3).map((post) => (
                <div
                  key={post.id}
                  className="rounded-2xl p-4"
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1.5px solid #e4e0d8",
                  }}
                >
                  {post.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={post.image_url}
                      alt="post"
                      className="w-full rounded-xl mb-3 object-cover"
                      style={{ aspectRatio: "1", maxHeight: "120px" }}
                    />
                  )}
                  <p
                    className="text-xs line-clamp-3"
                    style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
                  >
                    {post.post_text}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: "#10B981" }}
                    />
                    <span
                      className="text-xs"
                      style={{
                        color: "#8c8880",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      Aprovado
                    </span>
                  </div>
                </div>
              ))}
              {approvedPosts.length === 0 && (
                <p
                  className="text-xs"
                  style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                >
                  Nenhum post aprovado ainda.
                </p>
              )}
            </div>
          </div>
        ) : (
          <CalendarView
            posts={posts}
            onStatusChange={handleStatusChange}
            onRegenerate={handleRegenerate}
            onGenerated={handleGenerated}
            onGenStatusChange={handleGenStatusChange}
            triggerRef={triggerGenerateRef}
            resetRef={resetGenerateRef}
          />
        )}
      </div>
    </>
  );
}

function CalendarView({
  posts,
  onStatusChange,
  onRegenerate,
  onGenerated,
  onGenStatusChange,
  triggerRef,
  resetRef,
}: {
  posts: Post[];
  onStatusChange: (id: string, status: "approved" | "rejected") => void;
  onRegenerate: (id: string) => void;
  onGenerated: (c: PostContent) => void;
  onGenStatusChange: (
    status: SSEStatus,
    stageState: StageState,
    progressMessage: string,
  ) => void;
  triggerRef: React.MutableRefObject<(() => void) | null>;
  resetRef: React.MutableRefObject<(() => void) | null>;
}) {
  const grouped: Record<string, Post[]> = {};
  for (const p of posts) {
    const d = new Date(p.created_at).toLocaleDateString("pt-BR");
    grouped[d] = grouped[d] ? [...grouped[d], p] : [p];
  }
  const dates = Array.from(
    new Set(
      posts.map((p) => new Date(p.created_at).toLocaleDateString("pt-BR")),
    ),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <h2
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Calendário de posts
        </h2>
        <GenerateButton
          onGenerated={onGenerated}
          onStatusChange={onGenStatusChange}
          triggerRef={triggerRef}
          resetRef={resetRef}
        />
      </div>

      {dates.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ border: "1.5px dashed #e4e0d8" }}
        >
          <p
            className="text-sm"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            Nenhum post gerado ainda. Gere seu primeiro post para ver o
            calendário.
          </p>
        </div>
      ) : (
        dates.map((date) => (
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
                  onStatusChange={onStatusChange}
                  onRegenerate={onRegenerate}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
