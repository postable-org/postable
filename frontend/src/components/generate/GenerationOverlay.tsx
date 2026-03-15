"use client";

import type { SSEStatus, StageState } from "@/lib/hooks/useSSEGenerate";
import { Check, ImageIcon, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

interface GenerationOverlayProps {
  status: SSEStatus;
  stageState: StageState;
  progressMessage: string;
  platform: string;
  onCancel: () => void;
}

const STAGES = [
  { id: "trend-analysis", label: "Identificando tendências" },
  { id: "competitor-analysis", label: "Analisando concorrentes" },
  { id: "strategy", label: "Criando estratégia" },
  { id: "caption", label: "Escrevendo legenda" },
  { id: "image-generation", label: "Gerando imagem" },
] as const;

type StageId = (typeof STAGES)[number]["id"];

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  linkedin: "#0A66C2",
  facebook: "#1877F2",
};

const CAPTION_LINES = [92, 78, 85, 60, 72];

export function GenerationOverlay({
  status,
  stageState,
  progressMessage,
  platform,
  onCancel,
}: GenerationOverlayProps) {
  const [completedStages, setCompletedStages] = useState<StageId[]>([]);
  const [activeStage, setActiveStage] = useState<StageId | null>(null);

  useEffect(() => {
    if (status === 'complete') {
      setCompletedStages(STAGES.map((s) => s.id as StageId));
      setActiveStage(null);
    }
  }, [status]);

  useEffect(() => {
    if (!stageState.stage) return;
    const currentId = stageState.stage as StageId;
    const currentIdx = STAGES.findIndex((s) => s.id === currentId);

    if (stageState.status === "started") {
      setCompletedStages(
        STAGES.slice(0, currentIdx).map((s) => s.id as StageId),
      );
      setActiveStage(currentId);
    } else if (
      stageState.status === "complete" ||
      stageState.status === "skipped"
    ) {
      setCompletedStages((prev) =>
        prev.includes(currentId) ? prev : [...prev, currentId],
      );
    }
  }, [stageState]);

  const activeIdx = activeStage
    ? STAGES.findIndex((s) => s.id === activeStage)
    : -1;
  const completedCount = completedStages.length;

  const progress =
    status === "connecting"
      ? 4
      : activeIdx >= 0
        ? Math.round(((completedCount + 0.5) / STAGES.length) * 100)
        : 4;

  const isImageActive = activeStage === "image-generation";
  const isCaptionActive = activeStage === "caption";
  const imageReady = completedStages.includes("image-generation");
  const captionReady = completedStages.includes("caption");

  if (status !== "connecting" && status !== "streaming") return null;

  const platformColor = PLATFORM_COLORS[platform] ?? "#0a0a0a";
  const platformLabel = PLATFORM_LABELS[platform] ?? platform;

  return (
    <>
      <style>{`
        @keyframes spin-smooth {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.12; transform: scale(1); }
          50% { opacity: 0.24; transform: scale(1.15); }
        }
        @keyframes shimmer-slide {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes progress-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(10,10,10,0); }
          50% { box-shadow: 0 0 6px 1px rgba(10,10,10,0.15); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .gen-overlay-card {
          animation: fade-in-up 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .stage-spin {
          animation: spin-smooth 0.9s linear infinite;
        }
        .stage-pulse-ring {
          animation: pulse-ring 1.8s ease-in-out infinite;
        }
        .shimmer-bg {
          background: linear-gradient(
            90deg,
            #e8e4dc 0%,
            #f0ede7 30%,
            #d8d4cc 50%,
            #f0ede7 70%,
            #e8e4dc 100%
          );
          background-size: 200% 100%;
          animation: shimmer-slide 1.6s ease-in-out infinite;
        }
        .caption-line-pulse {
          animation: skeleton-pulse 1.4s ease-in-out infinite;
        }
        .progress-bar-inner {
          animation: progress-glow 2.5s ease-in-out infinite;
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          backgroundColor: "rgba(10,10,10,0.72)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <div className="gen-overlay-card w-full" style={{ maxWidth: "580px" }}>
          <div
            className="rounded-3xl overflow-hidden shadow-2xl"
            style={{
              backgroundColor: "#f8f5ef",
              border: "1.5px solid #e4e0d8",
              boxShadow:
                "0 32px 64px rgba(10,10,10,0.22), 0 8px 24px rgba(10,10,10,0.10)",
            }}
          >
            {/* Progress bar */}
            <div style={{ height: "3px", backgroundColor: "#e8e4dc" }}>
              <div
                className="h-full progress-bar-inner transition-all duration-700 ease-out"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #1a1a1a 0%, #555 100%)",
                }}
              />
            </div>

            <div className="p-7 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "#0a0a0a" }}
                    >
                      <Sparkles size={15} style={{ color: "#f8f5ef" }} />
                    </div>
                    <p
                      className="font-semibold text-[15px] tracking-tight"
                      style={{
                        fontFamily: "var(--font-sans)",
                        color: "#0a0a0a",
                      }}
                    >
                      Postable IA
                    </p>
                  </div>
                  <p
                    className="text-[13px] pl-[42px]"
                    style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                  >
                    Criando post para{" "}
                    <span
                      className="font-semibold"
                      style={{ color: platformColor }}
                    >
                      {platformLabel}
                    </span>
                  </p>
                </div>
                <button
                  onClick={onCancel}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 mt-0.5"
                  style={{ backgroundColor: "transparent" }}
                  onMouseEnter={(e) => {
                    (
                      e.currentTarget as HTMLButtonElement
                    ).style.backgroundColor = "#e8e4dc";
                  }}
                  onMouseLeave={(e) => {
                    (
                      e.currentTarget as HTMLButtonElement
                    ).style.backgroundColor = "transparent";
                  }}
                  title="Cancelar geração"
                >
                  <X size={15} style={{ color: "#8c8880" }} />
                </button>
              </div>

              {/* Divider */}
              <div style={{ height: "1px", backgroundColor: "#e8e4dc" }} />

              {/* Stage list */}
              <div className="space-y-1">
                {STAGES.map((stage, stageIdx) => {
                  const isComplete = completedStages.includes(
                    stage.id as StageId,
                  );
                  const isActive = activeStage === stage.id;
                  const isPending = !isComplete && !isActive;
                  const stageNumber = stageIdx + 1;

                  return (
                    <div
                      key={stage.id}
                      className="flex items-center gap-3.5 px-3 py-3 rounded-2xl transition-all duration-300"
                      style={{
                        backgroundColor: isActive
                          ? "rgba(10,10,10,0.055)"
                          : "transparent",
                      }}
                    >
                      {/* Stage indicator */}
                      <div className="w-6 h-6 shrink-0 flex items-center justify-center relative">
                        {isComplete ? (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: "#10B981" }}
                          >
                            <Check
                              size={12}
                              strokeWidth={3}
                              style={{ color: "#fff" }}
                            />
                          </div>
                        ) : isActive ? (
                          <div className="relative w-6 h-6 flex items-center justify-center">
                            {/* Pulse ring */}
                            <div
                              className="absolute inset-0 rounded-full stage-pulse-ring"
                              style={{ backgroundColor: "#0a0a0a" }}
                            />
                            {/* Spinner */}
                            <div
                              className="w-6 h-6 rounded-full border-2 stage-spin absolute inset-0"
                              style={{
                                borderColor: "rgba(10,10,10,0.12)",
                                borderTopColor: "#0a0a0a",
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ border: "1.5px solid #d8d4cc" }}
                          >
                            <span
                              className="text-[10px] font-medium"
                              style={{
                                color: "#c4c0ba",
                                fontFamily: "var(--font-body)",
                              }}
                            >
                              {stageNumber}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Label */}
                      <span
                        className="flex-1 text-[13.5px] transition-all duration-300"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontWeight: isActive ? 500 : 400,
                          color: isComplete
                            ? "#10B981"
                            : isActive
                              ? "#0a0a0a"
                              : "#c4c0ba",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {stage.label}
                      </span>

                      {/* Status badge */}
                      {isActive && (
                        <span
                          className="text-[11px] px-2.5 py-1 rounded-full shrink-0"
                          style={{
                            backgroundColor: "rgba(10,10,10,0.07)",
                            color: "#6c6862",
                            fontFamily: "var(--font-body)",
                            letterSpacing: "0.01em",
                          }}
                        >
                          em andamento
                        </span>
                      )}
                      {isComplete && (
                        <span
                          className="text-[11px] font-semibold shrink-0"
                          style={{
                            color: "#10B981",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          concluído
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Divider */}
              <div style={{ height: "1px", backgroundColor: "#e8e4dc" }} />

              {/* Preview area */}
              <div className="flex gap-4 items-start">
                {/* Image placeholder */}
                <div
                  className="shrink-0 rounded-2xl overflow-hidden flex items-center justify-center"
                  style={{
                    width: "118px",
                    height: "118px",
                    border: "1.5px solid #e4e0d8",
                    backgroundColor: "#ece9e3",
                  }}
                >
                  {isImageActive ? (
                    <div className="w-full h-full shimmer-bg" />
                  ) : imageReady ? (
                    <div
                      className="w-full h-full"
                      style={{
                        background:
                          "linear-gradient(135deg, #d4d0ca 0%, #b8b4ae 100%)",
                      }}
                    />
                  ) : (
                    <ImageIcon
                      size={26}
                      strokeWidth={1.5}
                      style={{ color: "#c4c0ba" }}
                    />
                  )}
                </div>

                {/* Caption skeleton */}
                <div className="flex-1 flex flex-col justify-center gap-2.5 pt-2">
                  {CAPTION_LINES.map((w, i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all duration-500 ${
                        isCaptionActive ? "caption-line-pulse" : ""
                      }`}
                      style={{
                        width: `${w}%`,
                        height: "10px",
                        backgroundColor: captionReady
                          ? "#a8a49e"
                          : isCaptionActive
                            ? "#b8b4ae"
                            : "#e4e0d8",
                        transitionDuration: "500ms",
                        animationDelay: isCaptionActive ? `${i * 80}ms` : "0ms",
                      }}
                    />
                  ))}
                  {/* Hashtag pills skeleton */}
                  <div className="flex gap-1.5 mt-1">
                    {[40, 52, 36].map((w, i) => (
                      <div
                        key={i}
                        className={`rounded-full ${isCaptionActive ? "caption-line-pulse" : ""}`}
                        style={{
                          width: `${w}px`,
                          height: "18px",
                          backgroundColor: isCaptionActive
                            ? "#c8c4be"
                            : "#e8e4dc",
                          animationDelay: isCaptionActive
                            ? `${(i + 5) * 80}ms`
                            : "0ms",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Status message */}
              <p
                className="text-[12px] text-center"
                style={{
                  color: "#a8a49e",
                  fontFamily: "var(--font-body)",
                  letterSpacing: "0.01em",
                  minHeight: "16px",
                }}
              >
                {progressMessage || "Iniciando..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
