"use client";

import { XLogo } from "@/components/icons/XLogo";
import {
  Calendar,
  Facebook,
  Instagram,
  Linkedin,
  MoreHorizontal,
  Plus,
  Target,
  X,
} from "lucide-react";
import { useState } from "react";

type PlatformId = "instagram" | "linkedin" | "facebook" | "x";
type CampaignStatus = "draft" | "active" | "paused" | "completed";

interface Campaign {
  id: string;
  name: string;
  description: string;
  platform: PlatformId;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  postCount: number;
  goal: string;
}

const PLATFORMS: { id: PlatformId; label: string; color: string }[] = [
  { id: "instagram", label: "Instagram", color: "#E1306C" },
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2" },
  { id: "facebook", label: "Facebook", color: "#1877F2" },
  { id: "x", label: "X", color: "#000000" },
];

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; color: string; bg: string }
> = {
  draft: { label: "Rascunho", color: "#8c8880", bg: "#f0ede7" },
  active: { label: "Ativa", color: "#10B981", bg: "#d1fae5" },
  paused: { label: "Pausada", color: "#F59E0B", bg: "#fef3c7" },
  completed: { label: "Concluída", color: "#6366f1", bg: "#ede9fe" },
};

function addDaysToISODate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const PlatformIcon = ({
  id,
  color,
  size = 14,
}: {
  id: PlatformId;
  color: string;
  size?: number;
}) => {
  const props = { size, strokeWidth: 1.8, style: { color } };
  if (id === "instagram") return <Instagram {...props} />;
  if (id === "linkedin") return <Linkedin {...props} />;
  if (id === "facebook") return <Facebook {...props} />;
  if (id === "x") return <XLogo {...props} />;
  return null;
};

function CampaignCard({
  campaign,
  now,
  onDelete,
}: {
  campaign: Campaign;
  now: number;
  onDelete: (id: string) => void;
}) {
  const status = STATUS_CONFIG[campaign.status];
  const platform = PLATFORMS.find((p) => p.id === campaign.platform)!;
  const start = new Date(campaign.startDate).toLocaleDateString("pt-BR");
  const end = new Date(campaign.endDate).toLocaleDateString("pt-BR");
  const totalDays =
    (new Date(campaign.endDate).getTime() -
      new Date(campaign.startDate).getTime()) /
    (1000 * 60 * 60 * 24);
  const elapsed =
    (now - new Date(campaign.startDate).getTime()) / (1000 * 60 * 60 * 24);
  const progress = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${platform.color}15` }}
          >
            <PlatformIcon id={campaign.platform} color={platform.color} />
          </div>
          <div>
            <p
              className="font-semibold text-sm"
              style={{ fontFamily: "var(--font-sans)", color: "#0a0a0a" }}
            >
              {campaign.name}
            </p>
            <p
              className="text-xs mt-0.5 line-clamp-2"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              {campaign.description}
            </p>
          </div>
        </div>
        <button
          onClick={() => onDelete(campaign.id)}
          className="shrink-0 opacity-40 hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-[#f0ede7]"
        >
          <MoreHorizontal size={14} style={{ color: "#0a0a0a" }} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="px-2.5 py-1 rounded-full text-xs font-medium"
          style={{
            backgroundColor: status.bg,
            color: status.color,
            fontFamily: "var(--font-body)",
          }}
        >
          {status.label}
        </span>
        <span
          className="flex items-center gap-1 text-xs"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          <Target size={11} />
          {campaign.goal}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Início", value: start },
          { label: "Fim", value: end },
          { label: "Posts", value: String(campaign.postCount) },
        ].map(({ label, value }) => (
          <div key={label}>
            <p
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              {label}
            </p>
            <p
              className="text-xs font-medium mt-0.5"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {campaign.status === "active" && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[10px]"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              Progresso
            </span>
            <span
              className="text-[10px] font-medium"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {Math.round(progress)}%
            </span>
          </div>
          <div
            className="w-full h-1.5 rounded-full"
            style={{ backgroundColor: "#f0ede7" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: "#0a0a0a" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-xl border bg-[#f8f5ef] px-4 py-3 text-sm outline-none transition-all focus:border-foreground focus:ring-2 focus:ring-foreground/10 placeholder:text-muted-foreground";
const inputBorderStyle = {
  borderColor: "#e4e0d8",
  fontFamily: "var(--font-body)",
};

function NewCampaignModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (campaign: Omit<Campaign, "id">) => void;
}) {
  const [form, setForm] = useState<Omit<Campaign, "id">>({
    name: "",
    description: "",
    platform: "instagram",
    status: "draft",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: addDaysToISODate(21),
    postCount: 10,
    goal: "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: "#f8f5ef" }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid #e4e0d8" }}
        >
          <h2
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Nova Campanha
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[#e4e0d8]"
          >
            <X size={16} style={{ color: "#8c8880" }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Nome da campanha *
            </label>
            <input
              className={inputClass}
              style={inputBorderStyle}
              placeholder="Ex: Lançamento Verão 2025"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Plataforma
            </label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(({ id, label, color }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, platform: id }))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    backgroundColor:
                      form.platform === id ? "#0a0a0a" : "#f0ede7",
                    color: form.platform === id ? "#f8f5ef" : "#0a0a0a",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <PlatformIcon
                    id={id}
                    color={form.platform === id ? "#f8f5ef" : color}
                    size={12}
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Objetivo da campanha
            </label>
            <input
              className={inputClass}
              style={inputBorderStyle}
              placeholder="Ex: Aumentar reconhecimento, gerar vendas..."
              value={form.goal}
              onChange={(e) => setForm((p) => ({ ...p, goal: e.target.value }))}
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Descrição
            </label>
            <textarea
              className={`${inputClass} resize-none`}
              style={inputBorderStyle}
              rows={3}
              placeholder="Descreva o contexto e a estratégia da campanha..."
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Início",
                key: "startDate",
                type: "date",
                value: form.startDate,
              },
              {
                label: "Fim",
                key: "endDate",
                type: "date",
                value: form.endDate,
              },
              {
                label: "Nº de posts",
                key: "postCount",
                type: "number",
                value: String(form.postCount),
              },
            ].map(({ label, key, type, value }) => (
              <div key={key}>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {label}
                </label>
                <input
                  type={type}
                  className={inputClass}
                  style={inputBorderStyle}
                  value={value}
                  min={type === "number" ? 1 : undefined}
                  max={type === "number" ? 100 : undefined}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      [key]:
                        type === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {/* Modal footer */}
        <div
          className="px-6 py-4 flex justify-end gap-3"
          style={{ borderTop: "1px solid #e4e0d8" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              backgroundColor: "#f0ede7",
              color: "#0a0a0a",
              fontFamily: "var(--font-body)",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.name.trim()) return;
              onSave(form);
              onClose();
            }}
            disabled={!form.name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
            style={{
              backgroundColor: "#0a0a0a",
              color: "#f8f5ef",
              fontFamily: "var(--font-body)",
            }}
          >
            <Calendar size={14} />
            Criar Campanha
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [referenceNow] = useState(() => Date.now());
  const [showModal, setShowModal] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<PlatformId | "all">(
    "all",
  );
  const [filterStatus, setFilterStatus] = useState<CampaignStatus | "all">(
    "all",
  );

  const filtered = campaigns.filter(
    (c) =>
      (filterPlatform === "all" || c.platform === filterPlatform) &&
      (filterStatus === "all" || c.status === filterStatus),
  );

  const handleSave = (campaign: Omit<Campaign, "id">) => {
    setCampaigns((prev) => [
      ...prev,
      { ...campaign, id: Date.now().toString() },
    ]);
  };

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Campanhas</h1>
          <p className="page-subtitle">
            Organize ciclos de posts por objetivo e plataforma.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary shrink-0"
        >
          <Plus size={14} strokeWidth={2.5} />
          Nova campanha
        </button>
      </div>

      {/* ── Filters ── mesmo padrão de pill/tag do Contexto */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterPlatform("all")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: filterPlatform === "all" ? "#0a0a0a" : "#f0ede7",
              color: filterPlatform === "all" ? "#f8f5ef" : "#8c8880",
              fontFamily: "var(--font-body)",
            }}
          >
            Todas
          </button>
          {PLATFORMS.map(({ id, label, color }) => (
            <button
              key={id}
              onClick={() => setFilterPlatform(id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: filterPlatform === id ? "#0a0a0a" : "#f0ede7",
                color: filterPlatform === id ? "#f8f5ef" : "#8c8880",
                fontFamily: "var(--font-body)",
              }}
            >
              <PlatformIcon
                id={id}
                color={filterPlatform === id ? "#f8f5ef" : color}
                size={12}
              />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="h-4 w-px" style={{ backgroundColor: "#e4e0d8" }} />

        <div className="flex items-center gap-1">
          {(["all", "draft", "active", "paused", "completed"] as const).map(
            (s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: filterStatus === s ? "#0a0a0a" : "#f0ede7",
                  color: filterStatus === s ? "#f8f5ef" : "#8c8880",
                  fontFamily: "var(--font-body)",
                }}
              >
                {s === "all"
                  ? "Todos"
                  : STATUS_CONFIG[s as CampaignStatus].label}
              </button>
            ),
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="empty-box">
          <p className="text-sm text-muted-foreground">
            Nenhuma campanha encontrada. Crie sua primeira campanha!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              now={referenceNow}
              onDelete={(id) =>
                setCampaigns((prev) => prev.filter((c) => c.id !== id))
              }
            />
          ))}
        </div>
      )}

      {showModal && (
        <NewCampaignModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
