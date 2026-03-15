"use client";

import { useSSEGenerate } from "@/lib/hooks/useSSEGenerate";
import type { SSEStatus, StageState } from "@/lib/hooks/useSSEGenerate";
import { usePlatform } from "@/lib/context/PlatformContext";
import type { PostContent } from "@/lib/api/posts";
import { RotateCcw, Sparkles } from "lucide-react";
import { useEffect } from "react";

interface GenerateButtonProps {
  onGenerated: (content: PostContent) => void;
  onStatusChange?: (
    status: SSEStatus,
    stageState: StageState,
    progressMessage: string
  ) => void;
  triggerRef?: React.MutableRefObject<(() => void) | null>;
  resetRef?: React.MutableRefObject<(() => void) | null>;
  dark?: boolean;
}

export function GenerateButton({
  onGenerated,
  onStatusChange,
  triggerRef,
  resetRef,
  dark,
}: GenerateButtonProps) {
  const { platform } = usePlatform();
  const { status, stageState, progressMessage, error, start, reset } =
    useSSEGenerate(onGenerated);

  // Expose trigger
  useEffect(() => {
    if (triggerRef) {
      triggerRef.current = () => start(platform);
    }
  }, [start, triggerRef, platform]);

  // Expose reset
  useEffect(() => {
    if (resetRef) {
      resetRef.current = reset;
    }
  }, [reset, resetRef]);

  // Notify parent of status/stage changes
  useEffect(() => {
    onStatusChange?.(status, stageState, progressMessage);
  }, [status, stageState, progressMessage, onStatusChange]);

  const isActive = status === "connecting" || status === "streaming";

  if (status === "error") {
    return (
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all"
        style={{
          backgroundColor: dark ? "rgba(248,245,239,0.1)" : "#f0ede7",
          color: dark ? "#f8f5ef" : "#0a0a0a",
          fontFamily: "var(--font-body)",
          border: dark
            ? "1px solid rgba(248,245,239,0.15)"
            : "1.5px solid #e4e0d8",
        }}
      >
        <RotateCcw size={14} strokeWidth={2} />
        Tentar novamente
      </button>
    );
  }

  return (
    <button
      onClick={() => start(platform)}
      disabled={isActive}
      className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-60 whitespace-nowrap"
      style={{
        backgroundColor: dark ? "#f8f5ef" : "#0a0a0a",
        color: dark ? "#0a0a0a" : "#f8f5ef",
        fontFamily: "var(--font-body)",
        minWidth: "160px",
        justifyContent: "center",
      }}
    >
      {isActive ? (
        <>
          <div
            className="w-4 h-4 border-2 rounded-full animate-spin shrink-0"
            style={{
              borderColor: dark
                ? "rgba(10,10,10,0.2)"
                : "rgba(248,245,239,0.25)",
              borderTopColor: dark ? "#0a0a0a" : "#f8f5ef",
            }}
          />
          <span className="truncate max-w-[130px]">
            {progressMessage || "Gerando..."}
          </span>
        </>
      ) : (
        <>
          <Sparkles size={14} strokeWidth={2} />
          Gerar novo post
        </>
      )}
    </button>
  );
}
