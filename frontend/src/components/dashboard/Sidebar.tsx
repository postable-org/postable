"use client";

import { XLogo } from "@/components/icons/XLogo";
import { createPortalSession, getSubscription } from "@/lib/api/subscription";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  Brain,
  Facebook,
  FileText,
  Instagram,
  Kanban,
  LayoutDashboard,
  Linkedin,
  PanelLeft,
  Settings,
  Share2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Visão Geral", Icon: LayoutDashboard },
  { href: "/posts", label: "Posts", Icon: FileText },
  { href: "/social", label: "Social", Icon: Share2 },
  { href: "/pipeline", label: "Pipeline", Icon: Kanban },
  { href: "/analytics", label: "Métricas", Icon: BarChart2 },
  { href: "/context", label: "Contexto", Icon: Brain },
];

const PLATFORMS = [
  { id: "instagram", label: "Instagram", Icon: Instagram, color: "#E1306C" },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin, color: "#0A66C2" },
  { id: "facebook", label: "Facebook", Icon: Facebook, color: "#1877F2" },
  { id: "x", label: "X", Icon: XLogo, color: "#FFFFFF" },
];

interface SidebarProps {
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
  userName?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  advanced: "Advanced",
  agency: "Agency",
};

export function Sidebar({
  selectedPlatform,
  onPlatformChange,
  userName,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
    staleTime: 60_000,
  });

  const handlePortal = async () => {
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch {
      // ignore
    }
  };

  return (
    <aside
      className="fixed left-0 top-0 h-full flex flex-col z-40 overflow-y-auto overflow-x-hidden transition-all duration-200 hide-scrollbar"
      style={{
        width: isCollapsed ? "64px" : "220px",
        backgroundColor: "#0a0a0a",
        borderRight: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Logo + Toggle */}
      <div
        className="px-3 py-4 flex items-center shrink-0"
        style={{
          gap: isCollapsed ? 0 : "10px",
          justifyContent: isCollapsed ? "center" : "space-between",
        }}
      >
        <div
          className={`flex items-center gap-2.5 ${isCollapsed ? "hidden" : "flex"}`}
        >
          <div className="logo-glow shrink-0">
            <Image
              src="/logo.webp"
              alt="Postable"
              width={26}
              height={26}
              className="rounded-lg"
            />
          </div>
          <span
            className="font-semibold text-[15px] tracking-tight whitespace-nowrap"
            style={{ color: "#f8f5ef", fontFamily: "var(--font-sans)" }}
          >
            Postable
          </span>
        </div>

        {isCollapsed && (
          <div className="logo-glow shrink-0">
            <Image
              src="/logo.webp"
              alt="Postable"
              width={26}
              height={26}
              className="rounded-lg"
            />
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all cursor-pointer ${isCollapsed ? "hidden" : "flex"}`}
          style={{
            color: "rgba(248,245,239,0.3)",
          }}
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          <PanelLeft size={15} strokeWidth={1.8} />
        </button>
      </div>

      {/* Collapse toggle when collapsed */}
      {isCollapsed && (
        <div className="flex justify-center px-2 pb-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all cursor-pointer"
            style={{
              color: "rgba(248,245,239,0.3)",
            }}
            title="Expandir menu"
          >
            <PanelLeft size={15} strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* Divider */}
      <div
        style={{
          height: "1px",
          backgroundColor: "rgba(255,255,255,0.07)",
          margin: isCollapsed ? "0 10px" : "0 16px",
        }}
      />

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-2 py-3">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center rounded-xl transition-all text-sm"
              style={{
                gap: isCollapsed ? 0 : "12px",
                justifyContent: isCollapsed ? "center" : "flex-start",
                padding: isCollapsed ? "10px 0" : "9px 10px",
                backgroundColor: isActive
                  ? "rgba(248,245,239,0.09)"
                  : "transparent",
                color: isActive ? "#f8f5ef" : "rgba(248,245,239,0.5)",
                fontFamily: "var(--font-body)",
                fontWeight: isActive ? 500 : 400,
              }}
              title={isCollapsed ? label : undefined}
            >
              <Icon
                size={16}
                strokeWidth={isActive ? 2 : 1.8}
                style={{
                  color: isActive ? "#f8f5ef" : "rgba(248,245,239,0.4)",
                  flexShrink: 0,
                }}
              />
              {!isCollapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div
        style={{
          height: "1px",
          backgroundColor: "rgba(255,255,255,0.07)",
          margin: isCollapsed ? "4px 10px 8px" : "4px 16px 8px",
        }}
      />

      {/* Platform selector — hidden when collapsed */}
      {!isCollapsed && (
        <div className="px-4 pb-3">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-2.5"
            style={{
              color: "rgba(248,245,239,0.25)",
              fontFamily: "var(--font-body)",
            }}
          >
            Gerar para
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {PLATFORMS.map(({ id, label, Icon, color }) => {
              const isSelected = selectedPlatform === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPlatformChange(id)}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all cursor-pointer"
                  style={{
                    backgroundColor: isSelected
                      ? `${color}22`
                      : "rgba(248,245,239,0.04)",
                    border: isSelected
                      ? `1px solid ${color}55`
                      : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <Icon
                    size={17}
                    strokeWidth={1.8}
                    style={{
                      color: isSelected ? color : "rgba(248,245,239,0.3)",
                    }}
                  />
                  <span
                    className="text-[10px] font-medium leading-none"
                    style={{
                      color: isSelected ? "#f8f5ef" : "rgba(248,245,239,0.35)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* When collapsed, show platform icons as small dots */}
      {isCollapsed && (
        <div className="flex flex-col items-center gap-2 pb-3 px-2">
          {PLATFORMS.map(({ id, Icon, color, label }) => {
            const isSelected = selectedPlatform === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPlatformChange(id)}
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all cursor-pointer"
                title={label}
                style={{
                  backgroundColor: isSelected
                    ? `${color}22`
                    : "rgba(248,245,239,0.04)",
                  border: isSelected
                    ? `1px solid ${color}55`
                    : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Icon
                  size={15}
                  strokeWidth={1.8}
                  style={{
                    color: isSelected ? color : "rgba(248,245,239,0.3)",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Divider */}
      <div
        style={{
          height: "1px",
          backgroundColor: "rgba(255,255,255,0.07)",
          margin: isCollapsed ? "0 10px 8px" : "0 16px 8px",
        }}
      />

      {/* Plan badge */}
      {!isCollapsed &&
        (subscription ? (
          <div className="px-4 pb-2">
            <button
              type="button"
              onClick={handlePortal}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all"
              style={{
                backgroundColor: "rgba(166,200,249,0.08)",
                border: "1px solid rgba(166,200,249,0.15)",
              }}
            >
              <span
                style={{
                  color: "rgba(248,245,239,0.5)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Plano
              </span>
              <span
                className="font-semibold"
                style={{ color: "#a6c8f9", fontFamily: "var(--font-body)" }}
              >
                {PLAN_LABELS[subscription.plan] ?? subscription.plan}
              </span>
            </button>
          </div>
        ) : (
          <div className="px-4 pb-2">
            <Link
              href="/pricing"
              className="w-full flex items-center justify-center px-3 py-2 rounded-xl text-xs"
              style={{
                backgroundColor: "rgba(166,200,249,0.08)",
                border: "1px solid rgba(166,200,249,0.15)",
                color: "#a6c8f9",
                fontFamily: "var(--font-body)",
              }}
            >
              Fazer upgrade
            </Link>
          </div>
        ))}

      {/* Settings */}
      <div className="px-2 pb-1">
        <Link
          href="/settings"
          className="flex items-center rounded-xl transition-all text-sm w-full"
          style={{
            gap: isCollapsed ? 0 : "12px",
            justifyContent: isCollapsed ? "center" : "flex-start",
            padding: isCollapsed ? "10px 0" : "9px 10px",
            backgroundColor:
              pathname === "/settings"
                ? "rgba(248,245,239,0.09)"
                : "transparent",
            color:
              pathname === "/settings" ? "#f8f5ef" : "rgba(248,245,239,0.4)",
            fontFamily: "var(--font-body)",
            fontWeight: pathname === "/settings" ? 500 : 400,
          }}
          title={isCollapsed ? "Configurações" : undefined}
        >
          <Settings
            size={15}
            strokeWidth={pathname === "/settings" ? 2 : 1.8}
            style={{
              color:
                pathname === "/settings" ? "#f8f5ef" : "rgba(248,245,239,0.3)",
              flexShrink: 0,
            }}
          />
          {!isCollapsed && "Configurações"}
        </Link>
      </div>

      {/* User + Logout */}
      <div className="px-2 pb-4">
        {isCollapsed ? (
          <div className="flex justify-center py-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{
                backgroundColor: "rgba(166,200,249,0.15)",
                color: "#a6c8f9",
              }}
              title={userName ?? "Usuário"}
            >
              {(userName?.[0] ?? "U").toUpperCase()}
            </div>
          </div>
        ) : (
          <>
            <div
              className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-xl"
              style={{ backgroundColor: "rgba(248,245,239,0.04)" }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                style={{
                  backgroundColor: "rgba(166,200,249,0.15)",
                  color: "#a6c8f9",
                }}
              >
                {(userName?.[0] ?? "U").toUpperCase()}
              </div>
              <span
                className="text-xs truncate"
                style={{
                  color: "rgba(248,245,239,0.55)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {userName ?? "Usuário"}
              </span>
            </div>
            <LogoutButton />
          </>
        )}
      </div>
    </aside>
  );
}
