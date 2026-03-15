"use client";

import { useSSEGenerate } from "@/lib/hooks/useSSEGenerate";
import { usePlatform } from "@/lib/context/PlatformContext";
import type { PostContent } from "@/lib/api/posts";
import { Sparkles, RotateCcw } from "lucide-react";

interface GenerateButtonProps {
  onGenerated: (content: PostContent) => void;
  triggerRef?: React.MutableRefObject<(() => void) | null>;
  dark?: boolean;
}

export function GenerateButton({
  onGenerated,
  triggerRef,
  dark,
}: GenerateButtonProps) {
  const { platform } = usePlatform();
  const { status, messages, error, start, reset } = useSSEGenerate(onGenerated);

  if (triggerRef) {
    triggerRef.current = () => start(platform);
  }

  const isActive = status === "connecting" || status === "streaming";
  const latestMessage = messages[messages.length - 1] ?? "";

  if (status === "error") {
    return (
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all"
        style={{
          backgroundColor: dark ? "rgba(248,245,239,0.1)" : "#f0ede7",
          color: dark ? "#f8f5ef" : "#0a0a0a",
          fontFamily: "var(--font-body)",
          border: dark ? "1px solid rgba(248,245,239,0.15)" : "1.5px solid #e4e0d8",
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
              borderColor: dark ? "rgba(10,10,10,0.2)" : "rgba(248,245,239,0.25)",
              borderTopColor: dark ? "#0a0a0a" : "#f8f5ef",
            }}
          />
          <span className="truncate max-w-[120px]">
            {latestMessage || "Gerando..."}
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
