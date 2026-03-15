"use client";

import {
  getAnalytics,
  refreshInsights,
  type AnalyticsBreakdown,
  type AnalyticsDailyPoint,
  type AnalyticsPlatformStat,
  type AnalyticsRange,
  type AnalyticsTopPost,
} from "@/lib/api/analytics";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  Award,
  BarChart3,
  Eye,
  Heart,
  Link2,
  MessageCircle,
  RefreshCcw,
  Share2,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
};

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-xl animate-pulse ${className ?? ""}`}
      style={{ backgroundColor: "#e4e0d8" }}
    />
  );
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPlatform(value: string) {
  const map: Record<string, string> = {
    instagram: "Instagram",
    linkedin: "LinkedIn",
    facebook: "Facebook",
    x: "X",
  };
  return map[value] ?? value;
}

function truncateText(value: string, limit = 90) {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function TrendBadge({ value }: { value: number }) {
  const tone = value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium"
      style={{
        backgroundColor:
          tone === "positive"
            ? "rgba(16,185,129,0.12)"
            : tone === "negative"
              ? "rgba(225,48,108,0.12)"
              : "#f0ede7",
        color:
          tone === "positive"
            ? "#047857"
            : tone === "negative"
              ? "#be123c"
              : "#8c8880",
        fontFamily: "var(--font-body)",
      }}
    >
      {value > 0 ? "+" : ""}
      {formatPercent(value)}
    </span>
  );
}

function KpiCard({
  label,
  icon: Icon,
  accent,
  loading,
  value,
  trend,
}: {
  label: string;
  icon: LucideIcon;
  accent: string;
  loading: boolean;
  value: string;
  trend?: number;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accent}15` }}
        >
          <Icon size={18} strokeWidth={1.8} style={{ color: accent }} />
        </div>
        {loading ? (
          <Skeleton className="w-16 h-6" />
        ) : trend !== undefined ? (
          <TrendBadge value={trend} />
        ) : null}
      </div>
      <div>
        {loading ? (
          <Skeleton className="w-24 h-8 mb-1" />
        ) : (
          <p
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {value}
          </p>
        )}
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

function EmptyState({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: "#f0ede7" }}
      >
        <BarChart3 size={24} strokeWidth={1.5} style={{ color: "#8c8880" }} />
      </div>
      <p
        className="text-sm font-semibold mb-1"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {title}
      </p>
      <p
        className="text-xs max-w-xs leading-relaxed"
        style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
      >
        {description}
      </p>
      <Link
        href={href}
        className="mt-5 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all"
        style={{
          backgroundColor: "#0a0a0a",
          color: "#f8f5ef",
          fontFamily: "var(--font-body)",
        }}
      >
        <Link2 size={13} strokeWidth={2} />
        {cta}
      </Link>
    </div>
  );
}

function ChartPlaceholder({
  height = 180,
  label = "Sem dados para o período",
}: {
  height?: number;
  label?: string;
}) {
  return (
    <div
      className="w-full rounded-xl flex items-center justify-center"
      style={{ height, border: "1.5px dashed #e4e0d8" }}
    >
      <p
        className="text-xs"
        style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
      >
        {label}
      </p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-6 flex items-center justify-between gap-4"
      style={{ backgroundColor: "#fde8e8", border: "1px solid #f5c2c2" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(225,48,108,0.1)" }}
        >
          <AlertCircle
            size={18}
            strokeWidth={1.8}
            style={{ color: "#be123c" }}
          />
        </div>
        <div>
          <p
            className="text-sm font-semibold"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Não foi possível carregar as métricas
          </p>
          <p
            className="text-xs"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            {message}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium shrink-0"
        style={{
          backgroundColor: "#0a0a0a",
          color: "#f8f5ef",
          fontFamily: "var(--font-body)",
        }}
      >
        <RefreshCcw size={12} strokeWidth={2} />
        Tentar novamente
      </button>
    </div>
  );
}

function AnalyticsChart({ data }: { data: AnalyticsDailyPoint[] }) {
  const width = 720;
  const height = 210;
  const paddingX = 18;
  const paddingTop = 14;
  const paddingBottom = 26;
  const maxValue = Math.max(...data.flatMap((p) => [p.reach, p.engagement]), 0);
  if (maxValue === 0) return <ChartPlaceholder height={height} />;
  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingTop - paddingBottom;
  const denominator = data.length > 1 ? data.length - 1 : 1;
  const xFor = (i: number) => paddingX + (graphWidth * i) / denominator;
  const yFor = (v: number) =>
    paddingTop + graphHeight - (v / maxValue) * graphHeight;
  const reachPoints = data
    .map((p, i) => `${xFor(i)},${yFor(p.reach)}`)
    .join(" ");
  const engagementPoints = data
    .map((p, i) => `${xFor(i)},${yFor(p.engagement)}`)
    .join(" ");
  const reachArea = `${reachPoints} ${xFor(data.length - 1)},${height - paddingBottom} ${xFor(0)},${height - paddingBottom}`;
  const step = Math.max(Math.floor(data.length / 5), 1);
  return (
    <div
      className="w-full overflow-hidden rounded-xl"
      style={{ backgroundColor: "#fcfaf6" }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <defs>
          <linearGradient id="reach-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingTop + graphHeight - graphHeight * ratio;
          return (
            <line
              key={ratio}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="#ebe6de"
              strokeDasharray="4 6"
              strokeWidth="1"
            />
          );
        })}
        <polygon points={reachArea} fill="url(#reach-fill)" />
        <polyline
          fill="none"
          stroke="#6366F1"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={reachPoints}
        />
        <polyline
          fill="none"
          stroke="#E1306C"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={engagementPoints}
        />
        {data.map((point, index) => (
          <g key={point.date}>
            <circle
              cx={xFor(index)}
              cy={yFor(point.reach)}
              r="3.5"
              fill="#6366F1"
            />
            <circle
              cx={xFor(index)}
              cy={yFor(point.engagement)}
              r="3.5"
              fill="#E1306C"
            />
            {(index === 0 ||
              index === data.length - 1 ||
              index % step === 0) && (
              <text
                x={xFor(index)}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#8c8880"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {formatDateLabel(point.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function PlatformBreakdown({
  platforms,
}: {
  platforms: AnalyticsPlatformStat[];
}) {
  const maxValue = Math.max(...platforms.map((p) => p.posts || p.reach), 1);
  return (
    <div className="flex flex-col gap-0">
      {platforms.map((platform, index) => {
        const volume = platform.posts > 0 ? platform.posts : platform.reach;
        return (
          <div
            key={platform.id}
            className="flex items-center gap-3 py-3"
            style={{
              borderBottom:
                index < platforms.length - 1 ? "1px solid #f0ede7" : "none",
            }}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: platform.color }}
            />
            <span
              className="text-xs font-medium flex-1"
              style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
            >
              {platform.label}
              {platform.account_name ? (
                <span
                  className="block text-[10px] font-normal"
                  style={{ color: "#8c8880" }}
                >
                  {platform.account_name}
                </span>
              ) : null}
            </span>
            <div
              className="rounded-full flex-1 max-w-[120px] overflow-hidden"
              style={{ height: 6, backgroundColor: "#f0ede7" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max((volume / maxValue) * 100, volume > 0 ? 10 : 0)}%`,
                  backgroundColor: platform.color,
                }}
              />
            </div>
            <span
              className="text-[10px] w-10 text-right"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              {platform.posts}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BreakdownCards({
  breakdown,
  loading,
}: {
  breakdown: AnalyticsBreakdown;
  loading: boolean;
}) {
  const items = [
    {
      label: "Curtidas",
      Icon: Heart,
      color: "#E1306C",
      value: breakdown.likes,
    },
    {
      label: "Comentários",
      Icon: MessageCircle,
      color: "#6366F1",
      value: breakdown.comments,
    },
    {
      label: "Compartilhamentos",
      Icon: Share2,
      color: "#10B981",
      value: breakdown.shares,
    },
    {
      label: "Seguidores alcançados",
      Icon: Users,
      color: "#D97706",
      value: breakdown.followers_reached,
    },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, Icon, color, value }) => (
        <div
          key={label}
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon size={16} strokeWidth={1.8} style={{ color }} />
          </div>
          <div>
            {loading ? (
              <Skeleton className="w-14 h-6 mb-1" />
            ) : (
              <p
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: "var(--font-sans)", color: "#0a0a0a" }}
              >
                {formatCompactNumber(value)}
              </p>
            )}
            <p
              className="text-[10px]"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              {label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PostsTable({
  posts,
  loading,
  connected,
}: {
  posts: AnalyticsTopPost[];
  loading: boolean;
  connected: boolean;
}) {
  const headers = [
    "Post",
    "Alcance",
    "Curtidas",
    "Coments.",
    "Shares",
    "Eng. Rate",
  ];
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1.5px solid #e4e0d8" }}
    >
      <div className="px-6 py-5" style={{ borderBottom: "1px solid #e4e0d8" }}>
        <h2
          className="text-sm font-semibold"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Posts com melhor performance
        </h2>
      </div>
      <div
        className="hidden sm:grid px-6 py-2.5"
        style={{
          gridTemplateColumns: "1fr 80px 80px 80px 80px 90px",
          borderBottom: posts.length > 0 ? "1px solid #f0ede7" : "none",
          backgroundColor: posts.length > 0 ? "#f8f5ef" : "transparent",
        }}
      >
        {posts.length > 0 &&
          headers.map((h) => (
            <span
              key={h}
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              {h}
            </span>
          ))}
      </div>
      {loading ? (
        <div className="p-6 space-y-3">
          <Skeleton className="w-full h-14" />
          <Skeleton className="w-full h-14" />
          <Skeleton className="w-full h-14" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          title={
            connected
              ? "Nenhuma publicação no período"
              : "Nenhum dado disponível"
          }
          description={
            connected
              ? "Publique posts nas redes conectadas para começar a comparar resultados."
              : "Conecte suas contas e publique conteúdos para ver métricas reais."
          }
          href={connected ? "/social" : "/settings"}
          cta={connected ? "Abrir social" : "Conectar contas"}
        />
      ) : (
        <div className="divide-y" style={{ borderColor: "#f0ede7" }}>
          {posts.map((post) => (
            <div
              key={post.id}
              className="grid gap-3 px-6 py-4 sm:grid-cols-[1fr_80px_80px_80px_80px_90px]"
            >
              <div className="min-w-0">
                <p
                  className="text-sm font-medium"
                  style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
                >
                  {truncateText(post.text)}
                </p>
                <p
                  className="mt-1 text-[11px]"
                  style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                >
                  {formatPlatform(post.platform)}
                  {post.account_name ? ` · ${post.account_name}` : ""} •{" "}
                  {post.format} • {formatDateTime(post.date)}
                </p>
              </div>
              {[post.reach, post.likes, post.comments, post.shares].map(
                (v, i) => (
                  <span
                    key={i}
                    className="text-xs sm:text-[12px]"
                    style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
                  >
                    {formatCompactNumber(v)}
                  </span>
                ),
              )}
              <span
                className="text-xs sm:text-[12px]"
                style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
              >
                {formatPercent(post.engagement_rate)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["analytics", range],
    queryFn: () => getAnalytics(range),
    staleTime: 60_000,
  });
  const refreshMutation = useMutation({
    mutationFn: refreshInsights,
    onSuccess: () => void refetch(),
  });

  const analytics = data;
  const isConnected = analytics?.has_connected_social ?? false;
  const platforms = analytics?.platforms ?? [];
  const daily = analytics?.daily ?? [];
  const topPosts = analytics?.top_posts ?? [];
  const breakdown = analytics?.breakdown ?? {
    likes: 0,
    comments: 0,
    shares: 0,
    followers_reached: 0,
  };

  const miniStats = useMemo(() => {
    if (!analytics) return [] as string[];
    return [
      `${analytics.overview.connected_accounts} conta${analytics.overview.connected_accounts === 1 ? "" : "s"} conectada${analytics.overview.connected_accounts === 1 ? "" : "s"}`,
      `${analytics.overview.scheduled_posts} agendada${analytics.overview.scheduled_posts === 1 ? "" : "s"}`,
      `${analytics.overview.failed_posts} falha${analytics.overview.failed_posts === 1 ? "" : "s"} no período`,
    ];
  }, [analytics]);

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Métricas</h1>
          <p className="page-subtitle">
            Performance do seu conteúdo e saúde da operação social.
          </p>
          {analytics && (
            <div className="mt-3 flex flex-wrap gap-2">
              {miniStats.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px]"
                  style={{
                    backgroundColor: "#f0ede7",
                    color: "#6b6760",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Ações do header — mesmo padrão do botão "Salvar contexto" */}
        <div className="flex items-center gap-2 shrink-0">
          {(isFetching && !isLoading) || refreshMutation.isPending ? (
            <span
              className="text-[11px]"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              {refreshMutation.isPending
                ? "Buscando métricas..."
                : "Atualizando..."}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
            style={{
              backgroundColor: "#f0ede7",
              color: "#0a0a0a",
              fontFamily: "var(--font-body)",
            }}
          >
            <RefreshCcw size={14} strokeWidth={2} />
            Atualizar métricas
          </button>

          {/* Range selector — mesmo padrão pill */}
          <div
            className="flex items-center gap-0.5 p-1 rounded-xl"
            style={{ backgroundColor: "#f0ede7" }}
          >
            {(["7d", "30d", "90d"] as AnalyticsRange[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: range === item ? "#0a0a0a" : "transparent",
                  color: range === item ? "#f8f5ef" : "#8c8880",
                  fontFamily: "var(--font-body)",
                }}
              >
                {RANGE_LABELS[item]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <ErrorState
          message={error instanceof Error ? error.message : "Erro desconhecido"}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isLoading && !isConnected ? (
        <div
          className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl"
          style={{
            backgroundColor: "rgba(166,200,249,0.1)",
            border: "1px solid rgba(166,200,249,0.3)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#f0ede7" }}
            >
              <TrendingUp
                size={18}
                strokeWidth={1.8}
                style={{ color: "#8c8880" }}
              />
            </div>
            <div>
              <p
                className="text-xs font-semibold"
                style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
              >
                Conecte suas redes sociais
              </p>
              <p
                className="text-xs"
                style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
              >
                O painel já está ativo. As métricas reais aparecem assim que
                houver conexões e publicações.
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              backgroundColor: "#0a0a0a",
              color: "#f8f5ef",
              fontFamily: "var(--font-body)",
            }}
          >
            <Link2 size={12} strokeWidth={2} />
            Configurar
          </Link>
        </div>
      ) : null}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Alcance total"
          icon={Eye}
          accent="#6366F1"
          loading={isLoading}
          value={formatCompactNumber(analytics?.overview.total_reach ?? 0)}
          trend={analytics?.overview.reach_trend}
        />
        <KpiCard
          label="Engajamentos"
          icon={Heart}
          accent="#E1306C"
          loading={isLoading}
          value={formatCompactNumber(
            analytics?.overview.total_engagements ?? 0,
          )}
          trend={analytics?.overview.engagement_trend}
        />
        <KpiCard
          label="Taxa de engajamento"
          icon={Activity}
          accent="#10B981"
          loading={isLoading}
          value={formatPercent(analytics?.overview.engagement_rate ?? 0)}
          trend={analytics?.overview.rate_trend}
        />
        <KpiCard
          label="Posts publicados"
          icon={Award}
          accent="#D97706"
          loading={isLoading}
          value={formatCompactNumber(
            analytics?.overview.total_posts_published ?? 0,
          )}
        />
      </div>

      {/* Chart + platform breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div
          className="lg:col-span-2 rounded-2xl p-6"
          style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
        >
          <div className="flex items-center justify-between mb-1 gap-4">
            <h2
              className="text-sm font-semibold"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Alcance & engajamento
            </h2>
            <div className="flex items-center gap-3">
              {[
                { color: "#6366F1", label: "Alcance" },
                { color: "#E1306C", label: "Engajamento" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span
                    className="text-[10px]"
                    style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p
            className="text-xs mb-4"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            {RANGE_LABELS[range]} • série diária baseada em publicações do
            período
          </p>
          {isLoading ? (
            <Skeleton className="w-full h-[210px]" />
          ) : (
            <AnalyticsChart data={daily} />
          )}
        </div>

        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
        >
          <h2
            className="text-sm font-semibold mb-1"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Por plataforma
          </h2>
          <p
            className="text-xs mb-4"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            Distribuição de posts publicados por rede.
          </p>
          {isLoading ? (
            <Skeleton className="w-full h-[172px]" />
          ) : (
            <PlatformBreakdown platforms={platforms} />
          )}
        </div>
      </div>

      <BreakdownCards breakdown={breakdown} loading={isLoading} />
      <PostsTable
        posts={topPosts}
        loading={isLoading}
        connected={isConnected}
      />
    </div>
  );
}
