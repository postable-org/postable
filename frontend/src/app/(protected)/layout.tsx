"use client";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { PlatformProvider, usePlatform } from "@/lib/context/PlatformContext";
import { useState } from "react";

export const dynamic = "force-dynamic";

function ProtectedLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { platform, setPlatform } = usePlatform();

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#f8f5ef" }}>
      {/* Sidebar — desktop only */}
      <div className="hidden md:block">
        <Sidebar selectedPlatform={platform} onPlatformChange={setPlatform} />
      </div>

      {/* Main content */}
      <div className="flex-1 md:ml-[220px] flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <div
          className="md:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-30"
          style={{ backgroundColor: "#f8f5ef", borderColor: "#e4e0d8" }}
        >
          <span
            className="font-semibold"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Postable
          </span>
          {/* Mobile platform selector */}
          <div className="flex items-center gap-1">
            {["Instagram", "LinkedIn", "X"].map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p.toLowerCase())}
                className="text-xs px-2 py-1 rounded-lg"
                style={{
                  backgroundColor:
                    platform === p.toLowerCase() ? "#0a0a0a" : "#f0ede7",
                  color: platform === p.toLowerCase() ? "#f8f5ef" : "#8c8880",
                  fontFamily: "var(--font-body)",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Page content with platform in context via data attr */}
        <main className="flex-1" data-platform={platform}>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex z-40"
        style={{
          backgroundColor: "#0a0a0a",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {[
          { href: "/dashboard", label: "Início", icon: "⊞" },
          { href: "/posts", label: "Posts", icon: "✦" },
          { href: "/pipeline", label: "Pipeline", icon: "⧈" },
          { href: "/analytics", label: "Métricas", icon: "◈" },
          { href: "/social", label: "Social", icon: "◉" },
          { href: "/campaigns", label: "Camps.", icon: "◎" },
          { href: "/context", label: "IA", icon: "✿" },
        ].map(({ href, label, icon }) => (
          <a
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-xs"
            style={{
              color: "rgba(248,245,239,0.5)",
              fontFamily: "var(--font-body)",
            }}
          >
            <span className="text-base leading-none">{icon}</span>
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlatformProvider>
      <ProtectedLayoutInner>{children}</ProtectedLayoutInner>
    </PlatformProvider>
  );
}
