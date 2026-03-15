"use client";

import {
  Activity,
  Award,
  BarChart3,
  Eye,
  Heart,
  Link2,
  MessageCircle,
  Share2,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// ─── Types (ready for backend) ────────────────────────────────────────────────

type Range = "7d" | "30d" | "90d";

export interface AnalyticsOverview {
  totalReach: number;
  totalEngagements: number;
  engagementRate: number;
  totalPostsPublished: number;
  reachTrend: number; // percentage change vs previous period
  engagementTrend: number;
  rateTrend: number;
}

export interface DailyDataPoint {
  date: string;
  reach: number;
  engagement: number;
  posts: number;
}

export interface PlatformStat {
  id: string;
  label: string;
  color: string;
  posts: number;
  reach: number;
  engagementRate: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface TopPost {
  id: string;
  text: string;
  platform: string;
  format: string;
  date: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  linkedin: "#0A66C2",
  facebook: "#1877F2",
  x: "#000000",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-xl animate-pulse ${className ?? ""}`}
      style={{ backgroundColor: "#e4e0d8" }}
    />
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  icon: Icon,
  accent,
  empty,
}: {
  label: string;
  icon: React.ElementType;
  accent: string;
  empty: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accent}15` }}
        >
          <Icon size={18} strokeWidth={1.8} style={{ color: accent }} />
        </div>
        {empty && <Skeleton className="w-16 h-7" />}
      </div>
      <div>
        {empty ? (
          <Skeleton className="w-20 h-8 mb-1" />
        ) : (
          <p
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            —
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

// ─── Empty state ──────────────────────────────────────────────────────────────

function ConnectCta() {
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
        Nenhum dado disponível
      </p>
      <p
        className="text-xs max-w-xs leading-relaxed"
        style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
      >
        Conecte suas contas de redes sociais nas configurações para começar a
        ver métricas reais de performance.
      </p>
      <Link
        href="/settings"
        className="mt-5 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all"
        style={{
          backgroundColor: "#0a0a0a",
          color: "#f8f5ef",
          fontFamily: "var(--font-body)",
        }}
      >
        <Link2 size={13} strokeWidth={2} />
        Conectar contas
      </Link>
    </div>
  );
}

// ─── Chart placeholder ────────────────────────────────────────────────────────

function ChartPlaceholder({ height = 120 }: { height?: number }) {
  // Renders a flat dashed empty chart area
  return (
    <div
      className="w-full rounded-xl flex items-center justify-center"
      style={{
        height,
        border: "1.5px dashed #e4e0d8",
      }}
    >
      <p
        className="text-xs"
        style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
      >
        Sem dados para o período
      </p>
    </div>
  );
}

// ─── Posts table (empty state) ────────────────────────────────────────────────

function PostsTable() {
  const TABLE_HEADERS = [
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
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid #e4e0d8" }}
      >
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
          borderBottom: "1px solid #f0ede7",
          backgroundColor: "#f8f5ef",
        }}
      >
        {TABLE_HEADERS.map((h) => (
          <span
            key={h}
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            {h}
          </span>
        ))}
      </div>

      <ConnectCta />
    </div>
  );
}

// ─── Platform rows (empty state) ─────────────────────────────────────────────

function PlatformBreakdown() {
  const platforms = [
    { id: "instagram", label: "Instagram", color: PLATFORM_COLORS.instagram },
    { id: "linkedin", label: "LinkedIn", color: PLATFORM_COLORS.linkedin },
    { id: "facebook", label: "Facebook", color: PLATFORM_COLORS.facebook },
    { id: "x", label: "X (Twitter)", color: PLATFORM_COLORS.x },
  ];

  return (
    <div className="flex flex-col gap-0">
      {platforms.map((p, i) => (
        <div
          key={p.id}
          className="flex items-center gap-3 py-3"
          style={{
            borderBottom:
              i < platforms.length - 1 ? "1px solid #f0ede7" : "none",
          }}
        >
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span
            className="text-xs font-medium flex-1"
            style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
          >
            {p.label}
          </span>
          <div
            className="rounded-full flex-1 max-w-[120px]"
            style={{ height: 6, backgroundColor: "#f0ede7" }}
          />
          <span
            className="text-[10px] w-8 text-right"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            —
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("30d");

  // TODO: fetch from API when backend is ready
  // const { data, isLoading } = useQuery({
  //   queryKey: ["analytics", range],
  //   queryFn: () => getAnalytics(range),
  // });

  const isConnected = false; // replace with real connection check from API

  return (
    <div className="px-6 py-8 space-y-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Métricas
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            Performance do seu conteúdo
          </p>
        </div>

        <div
          className="flex items-center gap-0.5 p-1 rounded-xl"
          style={{ backgroundColor: "#f0ede7" }}
        >
          {(["7d", "30d", "90d"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: range === r ? "#0a0a0a" : "transparent",
                color: range === r ? "#f8f5ef" : "#8c8880",
                fontFamily: "var(--font-body)",
              }}
            >
              {r === "7d" ? "7 dias" : r === "30d" ? "30 dias" : "90 dias"}
            </button>
          ))}
        </div>
      </div>

      {/* Connection notice */}
      {!isConnected && (
        <div
          className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl"
          style={{ backgroundColor: "#f0ede7", border: "1px solid #e4e0d8" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#e4e0d8" }}
            >
              <TrendingUp
                size={15}
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
                Métricas reais disponíveis após conectar suas contas.
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
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
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Alcance total"
          icon={Eye}
          accent="#6366F1"
          empty={!isConnected}
        />
        <KpiCard
          label="Engajamentos"
          icon={Heart}
          accent="#E1306C"
          empty={!isConnected}
        />
        <KpiCard
          label="Taxa de engajamento"
          icon={Activity}
          accent="#10B981"
          empty={!isConnected}
        />
        <KpiCard
          label="Posts publicados"
          icon={Award}
          accent="#D97706"
          empty={!isConnected}
        />
      </div>

      {/* Chart + platform breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div
          className="lg:col-span-2 rounded-2xl p-6"
          style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
        >
          <div className="flex items-center justify-between mb-1">
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
            Últimos {range === "7d" ? 7 : range === "30d" ? 30 : 90} dias
          </p>
          <ChartPlaceholder height={140} />
        </div>

        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
        >
          <h2
            className="text-sm font-semibold mb-4"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Por plataforma
          </h2>
          <PlatformBreakdown />
        </div>
      </div>

      {/* Engagement breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Curtidas", Icon: Heart, color: "#E1306C" },
          { label: "Comentários", Icon: MessageCircle, color: "#6366F1" },
          { label: "Compartilhamentos", Icon: Share2, color: "#10B981" },
          { label: "Seguidores alcançados", Icon: Users, color: "#D97706" },
        ].map(({ label, Icon, color }) => (
          <div
            key={label}
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{
              backgroundColor: "#ffffff",
              border: "1.5px solid #e4e0d8",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon size={16} strokeWidth={1.8} style={{ color }} />
            </div>
            <div>
              <p
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: "var(--font-sans)", color: "#8c8880" }}
              >
                —
              </p>
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

      {/* Top posts table */}
      <PostsTable />
    </div>
  );
}
