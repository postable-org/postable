"use client";

import { useState, useRef } from "react";
import { X, Plus, AtSign } from "lucide-react";

const SUGGESTIONS = [
  "@concorrente1",
  "@marca_rival",
  "@outra_empresa",
  "@competidor_local",
];

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
}

export default function StepCompetitors({ value, onChange }: Props) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addHandle = (handle: string) => {
    const clean = handle.trim().replace(/^@/, "").toLowerCase();
    if (!clean || value.includes(`@${clean}`) || value.includes(clean)) return;
    onChange([...value, `@${clean}`]);
    setInput("");
    inputRef.current?.focus();
  };

  const remove = (handle: string) => {
    onChange(value.filter((h) => h !== handle));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addHandle(input);
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <p
          className="text-sm font-medium uppercase tracking-widest"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          Passo 7 de 8 · Opcional
        </p>
        <h2
          className="text-4xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Quem são seus concorrentes?
        </h2>
        <p className="text-base" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
          Adicione os perfis do Instagram dos seus concorrentes. Usamos isso para
          gerar conteúdo com inteligência competitiva.
        </p>
      </div>

      <div className="max-w-sm mx-auto space-y-4">
        {/* Input */}
        <div
          className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 transition-all focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/10"
          style={{ borderColor: "#e4e0d8" }}
          onClick={() => inputRef.current?.focus()}
        >
          <AtSign size={16} style={{ color: "#8c8880" }} className="shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="perfil_concorrente"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            style={{ fontFamily: "var(--font-body)" }}
          />
          <button
            type="button"
            onClick={() => addHandle(input)}
            disabled={!input.trim()}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
            style={{ backgroundColor: "#0a0a0a", color: "#f8f5ef" }}
          >
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>

        <p className="text-xs text-center" style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}>
          Pressione{" "}
          <kbd
            className="px-1.5 py-0.5 rounded-md text-[10px] font-medium"
            style={{ backgroundColor: "#e4e0d8", color: "#0a0a0a" }}
          >
            Enter
          </kbd>{" "}
          ou{" "}
          <kbd
            className="px-1.5 py-0.5 rounded-md text-[10px] font-medium"
            style={{ backgroundColor: "#e4e0d8", color: "#0a0a0a" }}
          >
            ,
          </kbd>{" "}
          para adicionar
        </p>

        {/* Chips */}
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {value.map((handle) => (
              <div
                key={handle}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: "#0a0a0a",
                  color: "#f8f5ef",
                  fontFamily: "var(--font-body)",
                }}
              >
                <AtSign size={12} />
                <span>{handle.replace(/^@/, "")}</span>
                <button
                  type="button"
                  onClick={() => remove(handle)}
                  className="opacity-60 hover:opacity-100 transition-opacity ml-0.5"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Suggestion hint */}
        {value.length === 0 && (
          <div className="text-center">
            <p
              className="text-xs mb-2"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              Dica: adicione o @ do perfil do Instagram
            </p>
            <div
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs"
              style={{
                backgroundColor: "#f0ede7",
                color: "#8c8880",
                fontFamily: "var(--font-body)",
                border: "1px solid #e4e0d8",
              }}
            >
              <AtSign size={11} />
              nome_do_concorrente
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
