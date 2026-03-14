"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";

interface Props {
  collapsed?: boolean;
}

export function LogoutButton({ collapsed }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all text-sm disabled:opacity-50"
      style={{
        color: "rgba(248,245,239,0.45)",
        fontFamily: "var(--font-body)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor =
          "rgba(248,245,239,0.06)";
        (e.currentTarget as HTMLElement).style.color = "rgba(248,245,239,0.8)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
        (e.currentTarget as HTMLElement).style.color = "rgba(248,245,239,0.45)";
      }}
    >
      <LogOut size={16} strokeWidth={1.8} className="shrink-0" />
      {!collapsed && <span>Sair</span>}
    </button>
  );
}
