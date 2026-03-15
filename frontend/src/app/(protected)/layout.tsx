"use client";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { PlatformProvider, usePlatform } from "@/lib/context/PlatformContext";
import { createClient } from "@/lib/supabase";
import {
  BarChart2,
  Brain,
  FileText,
  Kanban,
  LayoutDashboard,
  Share2,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

function nameFromEmail(email: string): string {
  return email.split("@")[0];
}

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Início", Icon: LayoutDashboard },
  { href: "/posts", label: "Posts", Icon: FileText },
  { href: "/pipeline", label: "Pipeline", Icon: Kanban },
  { href: "/analytics", label: "Métricas", Icon: BarChart2 },
  { href: "/social", label: "Social", Icon: Share2 },
  { href: "/context", label: "IA", Icon: Brain },
] as const;

function ProtectedLayoutInner({ children }: { children: React.ReactNode }) {
  const { platform, setPlatform } = usePlatform();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userName, setUserName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email;
      if (email) setUserName(nameFromEmail(email));
    });
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — desktop only */}
      <div className="hidden md:block">
        <Sidebar
          selectedPlatform={platform}
          onPlatformChange={setPlatform}
          isCollapsed={!sidebarOpen}
          onToggleCollapse={() => setSidebarOpen((v) => !v)}
          userName={userName}
        />
      </div>

      {/* Main content */}
      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-200 ${sidebarOpen ? "md:ml-[220px]" : "md:ml-[64px]"}`}
      >
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 z-30 bg-background">
          <span className="font-semibold font-sans text-foreground">
            Postable
          </span>
          {/* Mobile platform selector */}
          <div className="flex items-center gap-1">
            {["Instagram", "LinkedIn", "X"].map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p.toLowerCase())}
                className={`text-xs px-2 py-1 rounded-lg transition-all ${
                  platform === p.toLowerCase()
                    ? "bg-foreground text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Page content with platform in context via data attr */}
        <main className="flex-1 min-w-0 flex flex-col" data-platform={platform}>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex z-40 bg-foreground border-t border-white/[0.08]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MOBILE_NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <a
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors"
              style={{
                color: isActive
                  ? "rgba(248,245,239,0.95)"
                  : "rgba(248,245,239,0.4)",
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2 : 1.6} />
              <span>{label}</span>
            </a>
          );
        })}
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
