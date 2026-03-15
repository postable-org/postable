"use client";

import { useEffect, useState } from "react";
import type { SSEStatus, StageState } from "@/lib/hooks/useSSEGenerate";
import { Check, X, Sparkles, ImageIcon } from "lucide-react";

interface GenerationOverlayProps {
  status: SSEStatus;
  stageState: StageState;
  progressMessage: string;
  platform: string;
  onCancel: () => void;
}

const STAGES = [
  { id: "competitor-analysis", label: "Analisando concorrentes" },
  { id: "trend-analysis", label: "Identificando tendências" },
  { id: "strategy", label: "Criando estratégia" },
  { id: "image-generation", label: "Gerando imagem" },
  { id: "caption", label: "Escrevendo legenda" },
] as const;

type StageId = (typeof STAGES)[number]["id"];

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X (Twitter)",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  linkedin: "#0A66C2",
  facebook: "#1877F2",
  x: "#888888",
};

// Caption skeleton line widths (%)
const CAPTION_LINES = [88, 72, 80, 55, 68];

export function GenerationOverlay({
  status,
  stageState,
  progressMessage,
  platform,
  onCancel,
}: GenerationOverlayProps) {
  const [completedStages, setCompletedStages] = useState<StageId[]>([]);
  const [activeStage, setActiveStage] = useState<StageId | null>(null);

  // Track stage history as SSE events come in
  useEffect(() => {
    if (!stageState.stage) return;
    const currentId = stageState.stage as StageId;
    const currentIdx = STAGES.findIndex((s) => s.id === currentId);

    if (stageState.status === "started") {
      // Everything before this is implicitly done
      setCompletedStages(STAGES.slice(0, currentIdx).map((s) => s.id as StageId));
      setActiveStage(currentId);
    } else if (stageState.status === "complete") {
      setCompletedStages((prev) =>
        prev.includes(currentId) ? prev : [...prev, currentId]
      );
    } else if (stageState.status === "skipped") {
      setCompletedStages((prev) =>
        prev.includes(currentId) ? prev : [...prev, currentId]
      );
    }
  }, [stageState]);

  const activeIdx = activeStage ? STAGES.findIndex((s) => s.id === activeStage) : -1;
  const completedCount = completedStages.length;

  // Progress 0-100
  const progress =
    status === "connecting"
      ? 5
      : activeIdx >= 0
      ? Math.round(((completedCount + 0.5) / STAGES.length) * 100)
      : 5;

  const isImageActive = activeStage === "image-generation";
  const isCaptionActive = activeStage === "caption";
  const imageReady = completedStages.includes("image-generation");
  const captionReady = completedStages.includes("caption");

  if (status !== "connecting" && status !== "streaming") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(10,10,10,0.72)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        className="w-full max-w-[420px] rounded-3xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: "#f8f5ef", border: "1.5px solid #e4e0d8" }}
      >
        {/* Top progress bar */}
        <div style={{ height: "3px", backgroundColor: "#e4e0d8" }}>
          <div
            className="h-full transition-all duration-700 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #0a0a0a 0%, #555 100%)",
            }}
          />
        </div>

        <div className="p-6 space-y-5">
          {/* Header row */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#0a0a0a" }}
                >
                  <Sparkles size={14} style={{ color: "#f8f5ef" }} />
                </div>
                <p
                  className="font-semibold text-sm"
                  style={{ fontFamily: "var(--font-sans)", color: "#0a0a0a" }}
                >
                  Postable IA
                </p>
              </div>
              <p
                className="text-xs mt-1.5 pl-9"
                style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
              >
                Criando post para{" "}
                <span
                  className="font-semibold"
                  style={{ color: PLATFORM_COLORS[platform] ?? "#0a0a0a" }}
                >
                  {PLATFORM_LABELS[platform] ?? platform}
                </span>
              </p>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[#e4e0d8] shrink-0"
              title="Cancelar"
            >
              <X size={15} style={{ color: "#8c8880" }} />
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", backgroundColor: "#e4e0d8" }} />

          {/* Step list */}
          <div className="space-y-0.5">
            {STAGES.map((stage) => {
              const isComplete = completedStages.includes(stage.id as StageId);
              const isActive = activeStage === stage.id;
              const isPending = !isComplete && !isActive;

              return (
                <div
                  key={stage.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    backgroundColor: isActive
                      ? "rgba(10,10,10,0.05)"
                      : "transparent",
                  }}
                >
                  {/* Indicator */}
                  <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                    {isComplete ? (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "#10B981" }}
                      >
                        <Check size={11} strokeWidth={3} style={{ color: "#fff" }} />
                      </div>
                    ) : isActive ? (
                      <div className="relative w-5 h-5">
                        <div
                          className="absolute inset-0 rounded-full animate-ping"
                          style={{
                            backgroundColor: "#0a0a0a",
                            opacity: 0.15,
                          }}
                        />
                        <div
                          className="w-5 h-5 rounded-full border-2 animate-spin"
                          style={{
                            borderColor: "rgba(10,10,10,0.15)",
                            borderTopColor: "#0a0a0a",
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className="w-5 h-5 rounded-full border-2"
                        style={{ borderColor: "#d4d0ca" }}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className="flex-1 text-sm transition-all"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontWeight: isActive ? 500 : 400,
                      color: isComplete
                        ? "#10B981"
                        : isActive
                        ? "#0a0a0a"
                        : "#c0bcb6",
                    }}
                  >
                    {stage.label}
                  </span>

                  {/* Right badge */}
                  {isActive && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: "rgba(10,10,10,0.07)",
                        color: "#8c8880",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      em andamento
                    </span>
                  )}
                  {isComplete && (
                    <span
                      className="text-xs font-medium"
                      style={{ color: "#10B981", fontFamily: "var(--font-body)" }}
                    >
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ height: "1px", backgroundColor: "#e4e0d8" }} />

          {/* Preview placeholders */}
          <div className="flex gap-3">
            {/* Image preview */}
            <div
              className="w-[88px] h-[88px] rounded-2xl shrink-0 overflow-hidden flex items-center justify-center"
              style={{
                border: "1.5px solid #e4e0d8",
                backgroundColor: "#f0ede7",
              }}
            >
              {isImageActive ? (
                <div className="w-full h-full animate-shimmer" />
              ) : imageReady ? (
                <div
                  className="w-full h-full"
                  style={{
                    background:
                      "linear-gradient(135deg, #d4d0ca 0%, #c0bcb6 100%)",
                  }}
                />
              ) : (
                <ImageIcon
                  size={24}
                  strokeWidth={1.5}
                  style={{ color: "#c8c4be" }}
                />
              )}
            </div>

            {/* Caption skeleton */}
            <div className="flex-1 flex flex-col justify-center gap-2">
              {CAPTION_LINES.map((w, i) => (
                <div
                  key={i}
                  className={`h-2.5 rounded-full transition-all ${
                    isCaptionActive ? "animate-pulse" : ""
                  }`}
                  style={{
                    width: `${w}%`,
                    backgroundColor:
                      captionReady || isCaptionActive ? "#b8b4ae" : "#e4e0d8",
                    transitionDuration: "600ms",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Status message */}
          <p
            className="text-xs text-center"
            style={{ color: "#a8a49e", fontFamily: "var(--font-body)" }}
          >
            {progressMessage || "Iniciando..."}
          </p>
        </div>
      </div>
    </div>
  );
}
