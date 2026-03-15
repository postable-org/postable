"use client";

import {
  createPortalSession,
  getSubscription,
  PLAN_LIMITS,
} from "@/lib/api/subscription";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CreditCard, ExternalLink } from "lucide-react";
import Link from "next/link";

import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import {
  CheckCircle2,
  ChevronRight,
  Facebook,
  Instagram,
  Link2,
  Linkedin,
  Mail,
  Shield,
  Twitter,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  advanced: "Advanced",
  agency: "Agency",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  trialing: "Em trial",
  past_due: "Pagamento pendente",
  canceled: "Cancelado",
  unpaid: "Não pago",
};

// ─── Types (ready for backend) ────────────────────────────────────────────────

export interface SocialConnection {
  platformId: string;
  accountName: string;
  connectedAt: string;
}

// ─── Platform definitions ─────────────────────────────────────────────────────

const SOCIAL_PLATFORMS = [
  {
    id: "instagram",
    label: "Instagram",
    description: "Publique fotos, reels e stories",
    Icon: Instagram,
    color: "#E1306C",
    bgColor: "#FFF0F5",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    description: "Conteúdo profissional e B2B",
    Icon: Linkedin,
    color: "#0A66C2",
    bgColor: "#EEF6FF",
  },
  {
    id: "facebook",
    label: "Facebook",
    description: "Alcance amplo e grupos",
    Icon: Facebook,
    color: "#1877F2",
    bgColor: "#EEF4FF",
  },
  {
    id: "x",
    label: "X (Twitter)",
    description: "Conversas em tempo real",
    Icon: Twitter,
    color: "#000000",
    bgColor: "#F2F2F2",
  },
] as const;

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {title}
        </h2>
        {description && (
          <p
            className="text-xs mt-0.5"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function SubscriptionCard() {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
  });

  const handlePortal = async () => {
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch {
      alert("Erro ao abrir portal de cobrança. Tente novamente.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1
        className="text-2xl font-bold mb-8"
        style={{ fontFamily: "var(--font-sans)", color: "#0a0a0a" }}
      >
        Configurações
      </h1>

      <section
        className="rounded-2xl p-7"
        style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
      >
        <div className="flex items-center gap-3 mb-6">
          <CreditCard
            size={18}
            strokeWidth={1.8}
            style={{ color: "#6b6760" }}
          />
          <h2
            className="text-base font-semibold"
            style={{ fontFamily: "var(--font-sans)", color: "#0a0a0a" }}
          >
            Assinatura
          </h2>
        </div>

        {isLoading && (
          <p className="text-sm" style={{ color: "#a09d98" }}>
            Carregando...
          </p>
        )}

        {!isLoading && !subscription && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "#6b6760" }}>
              Você não possui uma assinatura ativa.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
              style={{
                backgroundColor: "#0a0a0a",
                color: "#f8f5ef",
                fontFamily: "var(--font-body)",
              }}
            >
              Ver planos
            </Link>
          </div>
        )}

        {!isLoading && subscription && (
          <div className="space-y-5">
            {subscription.status === "past_due" && (
              <div
                className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
                style={{
                  backgroundColor: "#fff8e6",
                  border: "1px solid #f5c518",
                  color: "#7a5c00",
                }}
              >
                <AlertTriangle
                  size={16}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  Seu pagamento está pendente. Atualize suas informações de
                  pagamento para evitar interrupção do serviço.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: "#f8f5ef" }}
              >
                <p className="text-xs mb-1" style={{ color: "#a09d98" }}>
                  Plano atual
                </p>
                <p
                  className="text-base font-semibold"
                  style={{ color: "#0a0a0a" }}
                >
                  {PLAN_LABELS[subscription.plan] ?? subscription.plan}
                </p>
              </div>
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: "#f8f5ef" }}
              >
                <p className="text-xs mb-1" style={{ color: "#a09d98" }}>
                  Status
                </p>
                <p
                  className="text-base font-semibold"
                  style={{ color: "#0a0a0a" }}
                >
                  {STATUS_LABELS[subscription.status] ?? subscription.status}
                </p>
              </div>
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: "#f8f5ef" }}
              >
                <p className="text-xs mb-1" style={{ color: "#a09d98" }}>
                  Posts / plataforma / mês
                </p>
                <p
                  className="text-base font-semibold"
                  style={{ color: "#0a0a0a" }}
                >
                  {PLAN_LIMITS[subscription.plan].posts_per_platform_per_month}
                </p>
              </div>
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: "#f8f5ef" }}
              >
                <p className="text-xs mb-1" style={{ color: "#a09d98" }}>
                  Próxima cobrança
                </p>
                <p
                  className="text-base font-semibold"
                  style={{ color: "#0a0a0a" }}
                >
                  {new Date(subscription.current_period_end).toLocaleDateString(
                    "pt-BR",
                  )}
                </p>
              </div>
            </div>

            {subscription.cancel_at_period_end && (
              <p className="text-sm" style={{ color: "#c0392b" }}>
                Sua assinatura será cancelada ao final do período atual.
              </p>
            )}

            <button
              onClick={handlePortal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-[0.97]"
              style={{
                backgroundColor: "#0a0a0a",
                color: "#f8f5ef",
                fontFamily: "var(--font-body)",
              }}
            >
              <ExternalLink size={14} strokeWidth={2} />
              Gerenciar assinatura
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Profile card ─────────────────────────────────────────────────────────────

function ProfileCard({ user }: { user: User | null }) {
  const email = user?.email ?? "—";
  const initials = email.split("@")[0].slice(0, 2).toUpperCase();
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div
      className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5"
      style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
    >
      {/* Avatar */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
        style={{
          backgroundColor: "rgba(166,200,249,0.15)",
          color: "#a6c8f9",
          fontFamily: "var(--font-sans)",
          border: "1.5px solid rgba(166,200,249,0.2)",
        }}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-base font-semibold truncate"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {email.split("@")[0]}
        </p>
        <p
          className="text-xs mt-0.5 truncate"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          {email}
        </p>
        {createdAt && (
          <p
            className="text-[10px] mt-2"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            Membro desde {createdAt}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Info field ───────────────────────────────────────────────────────────────

function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4"
      style={{ borderBottom: "1px solid #f0ede7" }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: "#f0ede7" }}
      >
        <Icon size={14} strokeWidth={1.8} style={{ color: "#8c8880" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          {label}
        </p>
        <p
          className="text-sm mt-0.5 truncate"
          style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Social platform row ──────────────────────────────────────────────────────

function PlatformRow({
  platform,
  connection,
}: {
  platform: (typeof SOCIAL_PLATFORMS)[number];
  connection: SocialConnection | null;
}) {
  const { Icon, color, bgColor } = platform;
  const isConnected = connection !== null;

  return (
    <div
      className="flex items-center gap-4 px-5 py-4"
      style={{ borderBottom: "1px solid #f0ede7" }}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: bgColor }}
      >
        {Icon ? (
          <Icon size={16} strokeWidth={1.8} style={{ color }} />
        ) : (
          <span className="text-sm font-bold" style={{ color }}>
            Rd
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium"
          style={{ fontFamily: "var(--font-body)", color: "#0a0a0a" }}
        >
          {platform.label}
        </p>
        <p
          className="text-xs"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          {isConnected ? `@${connection.accountName}` : platform.description}
        </p>
      </div>

      {/* Status / action */}
      {isConnected ? (
        <div className="flex items-center gap-2 shrink-0">
          <CheckCircle2
            size={14}
            strokeWidth={2}
            style={{ color: "#10B981" }}
          />
          <span
            className="text-xs font-medium"
            style={{ color: "#10B981", fontFamily: "var(--font-body)" }}
          >
            Conectado
          </span>
          <button
            disabled
            className="ml-2 text-xs px-3 py-1.5 rounded-xl transition-all"
            style={{
              backgroundColor: "#f0ede7",
              color: "#8c8880",
              fontFamily: "var(--font-body)",
              cursor: "not-allowed",
              opacity: 0.6,
            }}
          >
            Desconectar
          </button>
        </div>
      ) : (
        <button
          disabled
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all shrink-0"
          style={{
            backgroundColor: "#f0ede7",
            color: "#8c8880",
            fontFamily: "var(--font-body)",
            cursor: "not-allowed",
          }}
          title="Em breve"
        >
          <Link2 size={12} strokeWidth={2} />
          Conectar
          <span
            className="text-[9px] px-1 py-0.5 rounded"
            style={{ backgroundColor: "#e4e0d8", color: "#8c8880" }}
          >
            Em breve
          </span>
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);

  // TODO: fetch social connections from API when backend is ready
  // const connections: SocialConnection[] = [];
  const connections: SocialConnection[] = [];

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  function getConnection(platformId: string): SocialConnection | null {
    return connections.find((c) => c.platformId === platformId) ?? null;
  }

  const connectedCount = SOCIAL_PLATFORMS.filter(
    (p) => getConnection(p.id) !== null,
  ).length;

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto space-y-10 pb-24 md:pb-8">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Configurações
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          Gerencie sua conta e conexões
        </p>
      </div>

      {/* Profile */}
      <Section title="Perfil" description="Informações da sua conta Postable">
        <ProfileCard user={user} />

        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1.5px solid #e4e0d8" }}
        >
          <InfoField
            icon={UserIcon}
            label="Nome de usuário"
            value={user?.email?.split("@")[0] ?? "—"}
          />
          <InfoField icon={Mail} label="E-mail" value={user?.email ?? "—"} />
          <div className="flex items-center gap-4 px-5 py-4">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#f0ede7" }}
            >
              <Shield
                size={14}
                strokeWidth={1.8}
                style={{ color: "#8c8880" }}
              />
            </div>
            <div className="flex-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
              >
                Senha
              </p>
              <p
                className="text-sm mt-0.5"
                style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
              >
                ••••••••
              </p>
            </div>
            <button
              disabled
              className="text-xs px-3 py-1.5 rounded-xl shrink-0"
              style={{
                backgroundColor: "#f0ede7",
                color: "#8c8880",
                fontFamily: "var(--font-body)",
                cursor: "not-allowed",
                opacity: 0.6,
              }}
            >
              Alterar
            </button>
          </div>
        </div>
      </Section>

      {/* Social connections */}
      <Section
        title="Conexões"
        description={
          connectedCount === 0
            ? "Conecte suas contas para publicar e monitorar métricas"
            : `${connectedCount} de ${SOCIAL_PLATFORMS.length} contas conectadas`
        }
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1.5px solid #e4e0d8" }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{
              backgroundColor: "#f8f5ef",
              borderBottom: "1px solid #f0ede7",
            }}
          >
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              Plataforma
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              Status
            </span>
          </div>

          {SOCIAL_PLATFORMS.map((platform) => (
            <PlatformRow
              key={platform.id}
              platform={platform}
              connection={getConnection(platform.id)}
            />
          ))}

          {/* Footer note */}
          <div className="px-5 py-3" style={{ backgroundColor: "#f8f5ef" }}>
            <p
              className="text-[10px]"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              A integração com redes sociais será disponibilizada em breve. Você
              receberá uma notificação quando estiver disponível.
            </p>
          </div>
        </div>
      </Section>

      {/* Brand setup shortcut */}
      <Section title="Marca" description="Ajuste as informações da sua marca">
        <a
          href="/brand-setup"
          className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group"
          style={{
            backgroundColor: "#ffffff",
            border: "1.5px solid #e4e0d8",
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#f0ede7" }}
          >
            <span style={{ fontSize: 16 }}>✦</span>
          </div>
          <div className="flex-1">
            <p
              className="text-sm font-medium"
              style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
            >
              Configuração da marca
            </p>
            <p
              className="text-xs"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              Tom de voz, nicho, concorrentes e mais
            </p>
          </div>
          <ChevronRight
            size={16}
            strokeWidth={1.8}
            style={{ color: "#8c8880" }}
          />
        </a>
      </Section>
      <SubscriptionCard />
    </div>
  );
}
