"use client";

import {
  Brain,
  Facebook,
  FileText,
  Instagram,
  LayoutDashboard,
  Linkedin,
  Megaphone,
  Settings,
  Share2,
  Twitter,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Visão Geral", Icon: LayoutDashboard },
  { href: "/posts", label: "Posts", Icon: FileText },
  { href: "/social", label: "Social", Icon: Share2 },
  { href: "/campaigns", label: "Campanhas", Icon: Megaphone },
  { href: "/context", label: "Contexto", Icon: Brain },
];

const PLATFORMS = [
  {
    id: "instagram",
    label: "Instagram",
    Icon: Instagram,
    color: "#E1306C",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    Icon: Linkedin,
    color: "#0A66C2",
  },
  {
    id: "facebook",
    label: "Facebook",
    Icon: Facebook,
    color: "#1877F2",
  },
  {
    id: "x",
    label: "X",
    Icon: Twitter,
    color: "#FFFFFF",
  },
  {
    id: "reddit",
    label: "Reddit",
    // Reddit icon not in Lucide — use a styled badge
    Icon: null,
    color: "#FF4500",
  },
];

interface SidebarProps {
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
  userName?: string;
}

export function Sidebar({
  selectedPlatform,
  onPlatformChange,
  userName,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-full w-[220px] flex flex-col z-40 overflow-y-auto"
      style={{
        backgroundColor: "#0a0a0a",
        borderRight: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2.5 shrink-0">
        <div className="logo-glow">
          <Image
            src="/logo.webp"
            alt="Postable"
            width={28}
            height={28}
            className="rounded-lg"
          />
        </div>
        <span
          className="font-semibold text-[15px] tracking-tight"
          style={{ color: "#f8f5ef", fontFamily: "var(--font-sans)" }}
        >
          Postable
        </span>
      </div>

      {/* Divider */}
      <div
        style={{
          height: "1px",
          backgroundColor: "rgba(255,255,255,0.07)",
          margin: "0 16px",
        }}
      />

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-3 py-3">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm"
              style={{
                backgroundColor: isActive
                  ? "rgba(248,245,239,0.09)"
                  : "transparent",
                color: isActive ? "#f8f5ef" : "rgba(248,245,239,0.5)",
                fontFamily: "var(--font-body)",
                fontWeight: isActive ? 500 : 400,
              }}
            >
              <Icon
                size={16}
                strokeWidth={isActive ? 2 : 1.8}
                style={{
                  color: isActive ? "#f8f5ef" : "rgba(248,245,239,0.4)",
                }}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div
        style={{
          height: "1px",
          backgroundColor: "rgba(255,255,255,0.07)",
          margin: "4px 16px 8px",
        }}
      />

      {/* Platform selector */}
      <div className="px-4 pb-3">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-2"
          style={{
            color: "rgba(248,245,239,0.25)",
            fontFamily: "var(--font-body)",
          }}
        >
          Plataforma
        </p>
        <div className="flex flex-col gap-0.5">
          {PLATFORMS.map(({ id, label, Icon, color }) => {
            const isSelected = selectedPlatform === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPlatformChange(id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-sm text-left w-full"
                style={{
                  backgroundColor: isSelected
                    ? "rgba(248,245,239,0.08)"
                    : "transparent",
                  color: isSelected ? "#f8f5ef" : "rgba(248,245,239,0.45)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {Icon ? (
                  <Icon
                    size={14}
                    strokeWidth={1.8}
                    style={{
                      color: isSelected ? color : "rgba(248,245,239,0.35)",
                    }}
                  />
                ) : (
                  /* Reddit custom icon */
                  <span
                    className="text-[11px] font-bold w-3.5 text-center leading-none"
                    style={{
                      color: isSelected ? color : "rgba(248,245,239,0.35)",
                    }}
                  >
                    Rd
                  </span>
                )}
                <span className="text-xs">{label}</span>
                {isSelected && (
                  <div
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Divider */}
      <div
        style={{
          height: "1px",
          backgroundColor: "rgba(255,255,255,0.07)",
          margin: "0 16px 8px",
        }}
      />

      {/* Settings */}
      <div className="px-3 pb-1">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm w-full"
          style={{
            color: "rgba(248,245,239,0.4)",
            fontFamily: "var(--font-body)",
          }}
        >
          <Settings
            size={15}
            strokeWidth={1.8}
            style={{ color: "rgba(248,245,239,0.3)" }}
          />
          Configurações
        </Link>
      </div>

      {/* User + Logout */}
      <div className="px-3 pb-4">
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
      </div>
    </aside>
  );
}
