"use client";

import { XLogo } from "@/components/icons/XLogo";
import {
  deleteSocialConnection,
  getSocialConnections,
  startSocialOAuth,
  type SocialConnection as ApiSocialConnection,
  type SocialNetwork,
} from "@/lib/api/social";
import {
  createPortalSession,
  getSubscription,
  PLAN_LIMITS,
} from "@/lib/api/subscription";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Facebook,
  Instagram,
  Link2,
  Linkedin,
  Mail,
  Shield,
  User as UserIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type SocialConnection = ApiSocialConnection;

const SOCIAL_PLATFORMS = [
  {
    id: "instagram",
    label: "Instagram",
    description: "Publique fotos, reels e stories",
    oauth: "facebook",
    Icon: Instagram,
    color: "#E1306C",
    bgColor: "#FFF0F5",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    description: "Conteúdo profissional e B2B",
    oauth: "linkedin",
    Icon: Linkedin,
    color: "#0A66C2",
    bgColor: "#EEF6FF",
  },
  {
    id: "facebook",
    label: "Facebook",
    description: "Alcance amplo e grupos",
    oauth: "facebook",
    Icon: Facebook,
    color: "#1877F2",
    bgColor: "#EEF4FF",
  },
  {
    id: "x",
    label: "X (Twitter)",
    description: "Conversas em tempo real",
    oauth: "x",
    Icon: XLogo,
    color: "#000000",
    bgColor: "#F2F2F2",
  },
] as const;

// ── Section wrapper — mesmo padrão do Contexto da Empresa ────────────────────

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
          className="text-sm font-semibold"
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

// ── Profile card ─────────────────────────────────────────────────────────────

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
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
        style={{
          backgroundColor: "rgba(166,200,249,0.15)",
          color: "#a6c8f9",
          fontFamily: "var(--font-sans)",
          border: "1.5px solid rgba(166,200,249,0.2)",
        }}
      >
        {initials}
      </div>
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

// ── Info field row ────────────────────────────────────────────────────────────

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
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
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

// ── Platform row ─────────────────────────────────────────────────────────────

function PlatformRow({
  platform,
  connection,
  isConnecting,
  isDisconnecting,
  onConnect,
  onDisconnect,
}: {
  platform: (typeof SOCIAL_PLATFORMS)[number];
  connection: SocialConnection | null;
  isConnecting: boolean;
  isDisconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const { Icon, color, bgColor } = platform;
  const isConnected = connection !== null;
  return (
    <div
      className="flex items-center gap-4 px-5 py-4"
      style={{ borderBottom: "1px solid #f0ede7" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: bgColor }}
      >
        <Icon size={16} strokeWidth={1.8} style={{ color }} />
      </div>
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
          {isConnected
            ? `@${connection.account_name || connection.account_id}`
            : platform.description}
        </p>
      </div>

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
            onClick={onDisconnect}
            disabled={isDisconnecting}
            className="ml-2 text-xs px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
            style={{
              backgroundColor: "#fde8e8",
              color: "#b91c1c",
              fontFamily: "var(--font-body)",
            }}
          >
            {isDisconnecting ? "Desconectando..." : "Desconectar"}
          </button>
        </div>
      ) : (
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all shrink-0 disabled:opacity-50"
          style={{
            backgroundColor: isConnecting ? "#f0ede7" : "#0a0a0a",
            color: isConnecting ? "#8c8880" : "#f8f5ef",
            fontFamily: "var(--font-body)",
          }}
        >
          <Link2 size={12} strokeWidth={2} />
          {isConnecting ? "Conectando..." : "Conectar"}
        </button>
      )}
    </div>
  );
}

// ── Subscription card — usa o mesmo padrão de Section com card ───────────────

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
    <Section title="Assinatura" description="Gerencie seu plano e cobrança">
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1.5px solid #e4e0d8" }}
      >
        {/* Card header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{
            backgroundColor: "#f8f5ef",
            borderBottom: "1px solid #f0ede7",
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#f0ede7" }}
          >
            <CreditCard
              size={18}
              strokeWidth={1.8}
              style={{ color: "#0a0a0a" }}
            />
          </div>
          <p
            className="text-sm font-semibold"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Plano atual
          </p>
        </div>

        <div className="px-5 py-5">
          {isLoading && (
            <p
              className="text-sm"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              Carregando...
            </p>
          )}

          {!isLoading && !subscription && (
            <div className="space-y-4">
              <p
                className="text-sm"
                style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
              >
                Você não possui uma assinatura ativa.
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
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
            <div className="space-y-4">
              {subscription.status === "past_due" && (
                <div
                  className="flex items-start gap-3 rounded-xl px-4 py-3 text-xs"
                  style={{
                    backgroundColor: "#fff8e6",
                    border: "1px solid #f5c518",
                    color: "#7a5c00",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <AlertTriangle
                    size={14}
                    strokeWidth={2}
                    className="mt-0.5 shrink-0"
                  />
                  <span>
                    Pagamento pendente. Atualize suas informações para evitar
                    interrupção.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Plano atual",
                    value: PLAN_LABELS[subscription.plan] ?? subscription.plan,
                  },
                  {
                    label: "Status",
                    value:
                      STATUS_LABELS[subscription.status] ?? subscription.status,
                  },
                  {
                    label: "Posts / plataforma / mês",
                    value: String(
                      PLAN_LIMITS[subscription.plan]
                        .posts_per_platform_per_month,
                    ),
                  },
                  {
                    label: "Próxima cobrança",
                    value: new Date(
                      subscription.current_period_end,
                    ).toLocaleDateString("pt-BR"),
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: "#f8f5ef" }}
                  >
                    <p
                      className="text-[10px] uppercase tracking-wider mb-1"
                      style={{
                        color: "#8c8880",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {label}
                    </p>
                    <p
                      className="text-sm font-semibold"
                      style={{
                        color: "#0a0a0a",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {subscription.cancel_at_period_end && (
                <p
                  className="text-xs"
                  style={{ color: "#b91c1c", fontFamily: "var(--font-body)" }}
                >
                  Sua assinatura será cancelada ao final do período atual.
                </p>
              )}

              <button
                onClick={handlePortal}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
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
        </div>
      </div>
    </Section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [connectingNetwork, setConnectingNetwork] =
    useState<SocialNetwork | null>(null);
  const [disconnectingConnectionId, setDisconnectingConnectionId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    getSocialConnections()
      .then((data) => {
        setConnections(data);
        setConnectionsError(null);
      })
      .catch((error: unknown) =>
        setConnectionsError(
          error instanceof Error ? error.message : "Falha ao carregar conexões",
        ),
      )
      .finally(() => setConnectionsLoading(false));
  }, []);

  const latestConnectionsByNetwork = useMemo(() => {
    const sorted = [...connections].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    const grouped = new Map<SocialNetwork, SocialConnection>();
    sorted.forEach((c) => {
      if (!grouped.has(c.network)) grouped.set(c.network, c);
    });
    return grouped;
  }, [connections]);

  const getConnection = (platformId: string) =>
    latestConnectionsByNetwork.get(platformId as SocialNetwork) ?? null;

  async function handleConnect(platform: (typeof SOCIAL_PLATFORMS)[number]) {
    setConnectingNetwork(platform.oauth as SocialNetwork);
    try {
      const authURL = await startSocialOAuth(platform.oauth);
      window.location.href = authURL;
    } catch (error) {
      setConnectionsError(
        error instanceof Error ? error.message : "Falha ao iniciar OAuth",
      );
      setConnectingNetwork(null);
    }
  }

  async function handleDisconnect(connection: SocialConnection) {
    setDisconnectingConnectionId(connection.id);
    try {
      await deleteSocialConnection(connection.id);
      setConnections((prev) =>
        prev.filter((item) => item.id !== connection.id),
      );
      setConnectionsError(null);
    } catch (error) {
      setConnectionsError(
        error instanceof Error ? error.message : "Falha ao desconectar conta",
      );
    } finally {
      setDisconnectingConnectionId(null);
    }
  }

  const connectedCount = SOCIAL_PLATFORMS.filter(
    (p) => getConnection(p.id) !== null,
  ).length;

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">
            Gerencie sua conta, conexões sociais e preferências.
          </p>
        </div>
      </div>

      {/* ── Perfil ── */}
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
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
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
              className="text-xs px-3 py-1.5 rounded-xl shrink-0 disabled:opacity-50"
              style={{
                backgroundColor: "#f0ede7",
                color: "#8c8880",
                fontFamily: "var(--font-body)",
              }}
            >
              Alterar
            </button>
          </div>
        </div>
      </Section>

      {/* ── Conexões ── */}
      <Section
        title="Conexões sociais"
        description={
          connectionsLoading
            ? "Carregando conexões..."
            : connectedCount === 0
              ? "Conecte suas contas para publicar e monitorar métricas"
              : `${connectedCount} de ${SOCIAL_PLATFORMS.length} contas conectadas`
        }
      >
        {connectionsError && (
          <div
            className="rounded-xl px-4 py-3 text-xs"
            style={{
              backgroundColor: "#fde8e8",
              border: "1px solid #f5c2c2",
              color: "#b91c1c",
              fontFamily: "var(--font-body)",
            }}
          >
            {connectionsError}
          </div>
        )}

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
              isConnecting={connectingNetwork === platform.oauth}
              isDisconnecting={
                disconnectingConnectionId === getConnection(platform.id)?.id
              }
              onConnect={() => void handleConnect(platform)}
              onDisconnect={() => {
                const c = getConnection(platform.id);
                if (c) void handleDisconnect(c);
              }}
            />
          ))}

          <div className="px-5 py-3" style={{ backgroundColor: "#f8f5ef" }}>
            <p
              className="text-[10px]"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              A conexão OAuth é utilizada para publicar na aba Social com a
              conta correta.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Marca ── */}
      <Section title="Marca" description="Ajuste as informações da sua marca">
        <a
          href="/brand-setup"
          className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all"
          style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
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

      {/* ── Assinatura ── */}
      <SubscriptionCard />
    </div>
  );
}
