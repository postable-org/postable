"use client";

import { getPosts, type Post } from "@/lib/api/posts";
import {
  deleteSocialConnection,
  getSocialConnections,
  getSocialJobs,
  publishSocialPost,
  startSocialOAuth,
  type SocialConnection,
  type SocialJob,
  type SocialNetwork,
} from "@/lib/api/social";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  Radio,
  Send,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ElementType,
} from "react";
import { XLogo } from "@/components/icons/XLogo";

const NETWORKS: Array<{
  id: SocialNetwork;
  label: string;
  color: string;
  description: string;
  oauth?: SocialNetwork;
  Icon: ElementType | null;
}> = [
  {
    id: "instagram",
    label: "Instagram",
    color: "#E1306C",
    description:
      "Publica imagem ou carrossel via conta profissional conectada à Meta.",
    oauth: "facebook",
    Icon: Instagram,
  },
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877F2",
    description: "Publica em páginas com permissão de gerenciamento de posts.",
    oauth: "facebook",
    Icon: Facebook,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    color: "#0A66C2",
    description: "Publica no perfil autenticado com escopo.",
    oauth: "linkedin",
    Icon: Linkedin,
  },
  {
    id: "x",
    label: "X",
    color: "#111111",
    description: "Publica texto e foto.",
    oauth: "x",
    Icon: XLogo,
  },
];

function oauthGuide(network: SocialNetwork | undefined): {
  title: string;
  steps: string[];
  note: string;
} {
  switch (network) {
    case "linkedin":
      return {
        title: "Passo a passo para conectar LinkedIn",
        steps: [
          "Certifique-se de estar logado no Postable.",
          "Clique no botão abaixo para abrir o login do LinkedIn.",
          "Autorize o escopo de publicação (w_member_social).",
          "Você será redirecionado de volta com a conta conectada.",
        ],
        note: "Se der erro, faça logout e login novamente.",
      };
    case "x":
      return {
        title: "Passo a passo para conectar X",
        steps: [
          "Certifique-se de estar logado no Postable.",
          "Clique no botão abaixo para abrir a autorização oficial do X.",
          "Autorize o acesso à conta para publicar via API v2.",
          "Você será redirecionado de volta com a conta conectada.",
        ],
        note: "Se der erro, faça logout e login novamente.",
      };
    case "facebook":
    case "instagram":
    default:
      return {
        title: `Passo a passo para conectar ${networkMeta(network ?? "instagram").label}`,
        steps: [
          "Certifique-se de estar logado no Postable.",
          "Clique no botão abaixo para ir ao login da Meta.",
          "Autorize o acesso à sua conta e páginas.",
          "Você será redirecionado de volta com a conta conectada.",
        ],
        note: "Se der erro, faça logout e login novamente.",
      };
  }
}

function networkMeta(network: SocialNetwork) {
  return NETWORKS.find((item) => item.id === network) ?? NETWORKS[0];
}

function formatDate(date: string | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleString("pt-BR");
}

function statusLabel(status: SocialJob["status"]) {
  switch (status) {
    case "queued":
      return "Na fila";
    case "processing":
      return "Processando";
    case "published":
      return "Publicado";
    case "failed":
      return "Falhou";
    default:
      return status;
  }
}

function readMetadataString(
  metadata: SocialConnection["metadata_json"],
  key: string,
): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const value = metadata[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function connectionAvatarURL(connection: SocialConnection): string | null {
  const fromMetadata = readMetadataString(
    connection.metadata_json,
    "avatar_url",
  );
  if (fromMetadata) {
    return fromMetadata;
  }
  if (connection.network === "facebook") {
    return `https://graph.facebook.com/v25.0/${connection.account_id}/picture?type=normal`;
  }
  return null;
}

function accountInitials(connection: SocialConnection): string {
  const source =
    connection.account_name?.trim() || connection.account_id?.trim() || "Conta";
  return (
    source
      .split(/\s+/)
      .slice(0, 2)
      .map((chunk) => chunk[0]?.toUpperCase() ?? "")
      .join("") || "C"
  );
}

export default function SocialPage() {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [jobs, setJobs] = useState<SocialJob[]>([]);
  const [visibleJobsCount, setVisibleJobsCount] = useState(3);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeNetwork, setActiveNetwork] =
    useState<SocialNetwork>("instagram");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const message = params.get("message");
    if (!status || !message) {
      return null;
    }
    return {
      tone: status === "success" ? "success" : "error",
      text: decodeURIComponent(message),
    };
  });
  const [isPending, startTransition] = useTransition();
  const [publishForm, setPublishForm] = useState({
    network: "instagram" as SocialNetwork,
    deliveryMode: "now" as "now" | "schedule",
    connectionId: "",
    source: "manual" as "manual" | "generated",
    postId: "",
    title: "",
    text: "",
    link: "",
    mediaUrls: "",
    publishAt: "",
  });

  const filteredConnections = useMemo(
    () =>
      connections.filter(
        (connection) => connection.network === publishForm.network,
      ),
    [connections, publishForm.network],
  );
  const activeNetworkMeta = networkMeta(activeNetwork);
  const oauthHelp = oauthGuide(activeNetworkMeta.oauth);
  const visibleJobs = useMemo(
    () => jobs.slice(0, visibleJobsCount),
    [jobs, visibleJobsCount],
  );
  const hiddenJobsCount = Math.max(jobs.length - visibleJobs.length, 0);
  const failedJobsCount = useMemo(
    () => jobs.filter((job) => job.status === "failed").length,
    [jobs],
  );

  useEffect(() => {
    if (window.location.search.includes("status=")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      getSocialConnections(),
      getSocialJobs(),
      getPosts().catch(() => [] as Post[]),
    ])
      .then(([connectionsData, jobsData, postsData]) => {
        setConnections(connectionsData);
        setJobs(jobsData);
        setVisibleJobsCount(3);
        setPosts(postsData);
      })
      .catch((error: unknown) => {
        setFeedback({
          tone: "error",
          text:
            error instanceof Error
              ? error.message
              : "Falha ao carregar dados sociais",
        });
      });
  }, []);

  function refreshData() {
    startTransition(() => {
      Promise.all([getSocialConnections(), getSocialJobs()])
        .then(([connectionsData, jobsData]) => {
          setConnections(connectionsData);
          setJobs(jobsData);
          setVisibleJobsCount(3);
        })
        .catch((error: unknown) => {
          setFeedback({
            tone: "error",
            text:
              error instanceof Error
                ? error.message
                : "Falha ao atualizar dados",
          });
        });
    });
  }

  async function handleOAuth(network: SocialNetwork) {
    try {
      const authURL = await startSocialOAuth(network);
      window.location.href = authURL;
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "Falha ao iniciar OAuth",
      });
    }
  }

  async function handlePublishSubmit(deliveryMode: "now" | "schedule") {
    if (publishForm.source === "manual" && !publishForm.text.trim()) {
      setFeedback({
        tone: "error",
        text: "Digite um texto para publicar agora.",
      });
      return;
    }
    if (publishForm.source === "generated" && !publishForm.postId) {
      setFeedback({
        tone: "error",
        text: "Selecione um post gerado para publicar.",
      });
      return;
    }
    if (
      publishForm.network === "instagram" &&
      publishForm.mediaUrls
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean).length === 0
    ) {
      setFeedback({
        tone: "error",
        text: "No Instagram, informe ao menos uma URL publica de midia.",
      });
      return;
    }
    if (deliveryMode === "schedule" && !publishForm.publishAt) {
      setFeedback({
        tone: "error",
        text: "Escolha data e horario para agendar.",
      });
      return;
    }

    try {
      const response = await publishSocialPost({
        network: publishForm.network,
        connection_id: publishForm.connectionId || undefined,
        post_id:
          publishForm.source === "generated"
            ? publishForm.postId || undefined
            : undefined,
        title: publishForm.title || undefined,
        text:
          publishForm.source === "manual"
            ? publishForm.text || undefined
            : undefined,
        link: publishForm.link || undefined,
        media_urls: publishForm.mediaUrls
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        publish_at:
          deliveryMode === "schedule" && publishForm.publishAt
            ? new Date(publishForm.publishAt).toISOString()
            : undefined,
      });
      setFeedback({
        tone: "success",
        text:
          response.mode === "published_now"
            ? "Post publicado agora."
            : "Post agendado com sucesso.",
      });
      setPublishForm((current) => ({
        ...current,
        deliveryMode: "now",
        title: "",
        text: "",
        link: "",
        mediaUrls: "",
        publishAt: "",
        postId: "",
      }));
      refreshData();
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "Falha ao publicar",
      });
    }
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto space-y-8 pb-24 md:pb-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p
            className="text-sm"
            style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
          >
            Conectar contas, publicar agora e agendar conteúdo no horário certo.
          </p>
          <h1
            className="text-3xl font-bold tracking-tight mt-1"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Social Publishing
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {NETWORKS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNetwork(item.id)}
              className="px-3 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor:
                  activeNetwork === item.id ? "#0a0a0a" : "#f0ede7",
                color: activeNetwork === item.id ? "#f8f5ef" : "#0a0a0a",
                fontFamily: "var(--font-body)",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{
            backgroundColor:
              feedback.tone === "success" ? "#dff7ea" : "#fde8e8",
            color: feedback.tone === "success" ? "#0f766e" : "#b91c1c",
            fontFamily: "var(--font-body)",
          }}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.25fr] gap-6">
        <section
          className="rounded-3xl p-6"
          style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
        >
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Conectar contas
              </h2>
              <p
                className="text-sm mt-1"
                style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
              >
                {activeNetworkMeta.description}
              </p>
            </div>
            {activeNetworkMeta.Icon ? (
              <activeNetworkMeta.Icon
                size={18}
                style={{ color: activeNetworkMeta.color }}
              />
            ) : (
              <span
                className="text-xs font-bold"
                style={{ color: activeNetworkMeta.color }}
              >
                Rd
              </span>
            )}
          </div>

          <div className="space-y-4">
            {activeNetworkMeta.oauth ? (
              <div className="space-y-3">
                <div
                  className="rounded-2xl p-4 space-y-2"
                  style={{
                    backgroundColor: "#f8f5ef",
                    border: "1px solid #e4e0d8",
                  }}
                >
                  <p
                    className="text-xs font-medium"
                    style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
                  >
                    {oauthHelp.title}
                  </p>
                  <ol
                    className="text-xs space-y-1 pl-4 list-decimal"
                    style={{ color: "#6b6258", fontFamily: "var(--font-body)" }}
                  >
                    {oauthHelp.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <p
                    className="text-[11px] pt-1"
                    style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                  >
                    {oauthHelp.note}
                  </p>
                </div>
                <button
                  onClick={() => handleOAuth(activeNetworkMeta.oauth!)}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-medium"
                  style={{
                    backgroundColor: "#0a0a0a",
                    color: "#f8f5ef",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Conectar {activeNetworkMeta.label} via OAuth oficial
                </button>
              </div>
            ) : null}

            <div className="space-y-2 pt-2">
              {connections.filter((c) => c.network === activeNetwork).length ===
              0 ? (
                <p
                  className="text-sm"
                  style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                >
                  Nenhuma conta {activeNetworkMeta.label} conectada ainda.
                </p>
              ) : (
                connections
                  .filter((c) => c.network === activeNetwork)
                  .map((connection) => {
                    const avatarURL = connectionAvatarURL(connection);
                    return (
                      <div
                        key={connection.id}
                        className="rounded-2xl px-4 py-3"
                        style={{
                          backgroundColor: "#f8f5ef",
                          border: "1px solid #ece7de",
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {avatarURL ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={avatarURL}
                                alt={`Avatar de ${connection.account_name || connection.account_id}`}
                                className="w-10 h-10 rounded-full object-cover border"
                                style={{ borderColor: "#ddd6cb" }}
                              />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold"
                                style={{
                                  backgroundColor: "#ece7de",
                                  color: "#4a433b",
                                  fontFamily: "var(--font-body)",
                                }}
                              >
                                {accountInitials(connection)}
                              </div>
                            )}

                            <div className="min-w-0">
                              <p
                                className="text-sm font-medium truncate"
                                style={{ fontFamily: "var(--font-body)" }}
                              >
                                {connection.account_name ||
                                  connection.account_id}
                              </p>
                              <p
                                className="text-xs mt-1"
                                style={{
                                  color: "#8c8880",
                                  fontFamily: "var(--font-body)",
                                }}
                              >
                                Expira em{" "}
                                {formatDate(
                                  connection.token_expires_at ?? null,
                                )}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                await deleteSocialConnection(connection.id);
                                setConnections((prev) =>
                                  prev.filter((c) => c.id !== connection.id),
                                );
                              } catch (err) {
                                setFeedback({
                                  tone: "error",
                                  text:
                                    err instanceof Error
                                      ? err.message
                                      : "Falha ao desconectar",
                                });
                              }
                            }}
                            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-red-100"
                            title="Desconectar"
                          >
                            <Trash2 size={14} style={{ color: "#dc2626" }} />
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </section>

        <section
          className="rounded-3xl p-6"
          style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
        >
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Publicar ou agendar
              </h2>
              <p
                className="text-sm mt-1"
                style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
              >
                Escolha uma conta conectada e dispare agora ou no horário exato.
              </p>
            </div>
            {isPending && <Loader2 className="animate-spin" size={18} />}
          </div>

          <div
            className="rounded-2xl p-3 mb-3"
            style={{ backgroundColor: "#f8f5ef", border: "1px solid #e4e0d8" }}
          >
            <p
              className="text-xs font-medium mb-2"
              style={{ color: "#6b6258", fontFamily: "var(--font-body)" }}
            >
              Modo de envio
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setPublishForm((current) => ({
                    ...current,
                    deliveryMode: "now",
                    publishAt: "",
                  }))
                }
                className="rounded-xl px-3 py-2 text-xs font-medium"
                style={{
                  backgroundColor:
                    publishForm.deliveryMode === "now" ? "#0a0a0a" : "#ece7de",
                  color:
                    publishForm.deliveryMode === "now" ? "#f8f5ef" : "#0a0a0a",
                  fontFamily: "var(--font-body)",
                }}
              >
                Publicar agora
              </button>
              <button
                type="button"
                onClick={() =>
                  setPublishForm((current) => ({
                    ...current,
                    deliveryMode: "schedule",
                  }))
                }
                className="rounded-xl px-3 py-2 text-xs font-medium"
                style={{
                  backgroundColor:
                    publishForm.deliveryMode === "schedule"
                      ? "#0a0a0a"
                      : "#ece7de",
                  color:
                    publishForm.deliveryMode === "schedule"
                      ? "#f8f5ef"
                      : "#0a0a0a",
                  fontFamily: "var(--font-body)",
                }}
              >
                Agendar
              </button>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handlePublishSubmit("now");
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={publishForm.network}
                onChange={(event) =>
                  setPublishForm((current) => ({
                    ...current,
                    network: event.target.value as SocialNetwork,
                    connectionId: "",
                  }))
                }
                className="rounded-2xl px-4 py-3 text-sm"
                style={{
                  backgroundColor: "#f8f5ef",
                  border: "1px solid #e4e0d8",
                  fontFamily: "var(--font-body)",
                }}
              >
                {NETWORKS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                value={publishForm.connectionId}
                onChange={(event) =>
                  setPublishForm((current) => ({
                    ...current,
                    connectionId: event.target.value,
                  }))
                }
                className="rounded-2xl px-4 py-3 text-sm"
                style={{
                  backgroundColor: "#f8f5ef",
                  border: "1px solid #e4e0d8",
                  fontFamily: "var(--font-body)",
                }}
              >
                <option value="">Usar conexão mais recente da rede</option>
                {filteredConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.account_name || connection.account_id}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              {(
                [
                  { id: "manual", label: "Escrever agora" },
                  { id: "generated", label: "Usar post gerado" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setPublishForm((current) => ({
                      ...current,
                      source: item.id,
                    }))
                  }
                  className="rounded-xl px-3 py-2 text-xs font-medium"
                  style={{
                    backgroundColor:
                      publishForm.source === item.id ? "#0a0a0a" : "#f0ede7",
                    color:
                      publishForm.source === item.id ? "#f8f5ef" : "#0a0a0a",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {publishForm.source === "generated" ? (
              <select
                value={publishForm.postId}
                onChange={(event) =>
                  setPublishForm((current) => ({
                    ...current,
                    postId: event.target.value,
                  }))
                }
                className="w-full rounded-2xl px-4 py-3 text-sm"
                style={{
                  backgroundColor: "#f8f5ef",
                  border: "1px solid #e4e0d8",
                  fontFamily: "var(--font-body)",
                }}
              >
                <option value="">Selecione um post gerado</option>
                {posts.map((post) => (
                  <option key={post.id} value={post.id}>
                    {post.post_text?.slice(0, 80) ?? post.id}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                value={publishForm.text}
                onChange={(event) =>
                  setPublishForm((current) => ({
                    ...current,
                    text: event.target.value,
                  }))
                }
                placeholder="Texto do post"
                rows={5}
                className="w-full rounded-2xl px-4 py-3 text-sm"
                style={{
                  backgroundColor: "#f8f5ef",
                  border: "1px solid #e4e0d8",
                  fontFamily: "var(--font-body)",
                }}
              />
            )}

            <input
              value={publishForm.link}
              onChange={(event) =>
                setPublishForm((current) => ({
                  ...current,
                  link: event.target.value,
                }))
              }
              placeholder="Link opcional"
              className="w-full rounded-2xl px-4 py-3 text-sm"
              style={{
                backgroundColor: "#f8f5ef",
                border: "1px solid #e4e0d8",
                fontFamily: "var(--font-body)",
              }}
            />

            {(publishForm.network === "instagram" ||
              publishForm.network === "facebook") && (
              <textarea
                value={publishForm.mediaUrls}
                onChange={(event) =>
                  setPublishForm((current) => ({
                    ...current,
                    mediaUrls: event.target.value,
                  }))
                }
                placeholder="Uma URL pública de mídia por linha"
                rows={4}
                className="w-full rounded-2xl px-4 py-3 text-sm"
                style={{
                  backgroundColor: "#f8f5ef",
                  border: "1px solid #e4e0d8",
                  fontFamily: "var(--font-body)",
                }}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-center">
              {publishForm.deliveryMode === "schedule" ? (
                <input
                  type="datetime-local"
                  value={publishForm.publishAt}
                  onChange={(event) =>
                    setPublishForm((current) => ({
                      ...current,
                      publishAt: event.target.value,
                    }))
                  }
                  className="rounded-2xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: "#f8f5ef",
                    border: "1px solid #e4e0d8",
                    fontFamily: "var(--font-body)",
                  }}
                />
              ) : (
                <div
                  className="rounded-2xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: "#f8f5ef",
                    border: "1px dashed #d9d3ca",
                    color: "#8c8880",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Envio imediato habilitado.
                </div>
              )}
              <button
                type="submit"
                className="rounded-2xl px-5 py-3 text-sm font-medium inline-flex items-center justify-center gap-2"
                style={{
                  backgroundColor: "#0a0a0a",
                  color: "#f8f5ef",
                  fontFamily: "var(--font-body)",
                }}
              >
                <Send size={15} />
                Publicar agora
              </button>
              <button
                type="button"
                onClick={() => {
                  void handlePublishSubmit("schedule");
                }}
                className="rounded-2xl px-5 py-3 text-sm font-medium inline-flex items-center justify-center gap-2"
                style={{
                  backgroundColor: "#ece7de",
                  color: "#0a0a0a",
                  fontFamily: "var(--font-body)",
                }}
              >
                <Radio size={15} />
                Agendar
              </button>
            </div>
          </form>
        </section>
      </div>

      <section
        className="rounded-3xl p-6"
        style={{ backgroundColor: "#ffffff", border: "1.5px solid #e4e0d8" }}
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2
              className="text-lg font-semibold"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Fila de publicação
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              Acompanhe o que já saiu e o que está agendado, com visual mais
              limpo.
            </p>
          </div>
          <button
            onClick={refreshData}
            className="text-sm font-medium"
            style={{ color: "#0a0a0a", fontFamily: "var(--font-body)" }}
          >
            Atualizar
          </button>
        </div>

        {failedJobsCount > 0 && (
          <div
            className="rounded-2xl px-4 py-3 mb-3 text-sm"
            style={{
              backgroundColor: "#fff7ed",
              border: "1px solid #f5d9ba",
              color: "#9a3412",
              fontFamily: "var(--font-body)",
            }}
          >
            {failedJobsCount} publicação(ões) falharam recentemente. Atualize a
            fila após ajustar a conexão.
          </div>
        )}

        <div className="space-y-3">
          {jobs.length === 0 ? (
            <p
              className="text-sm"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              Nenhum job criado ainda.
            </p>
          ) : (
            visibleJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-2xl px-4 py-4"
                style={{
                  backgroundColor: "#f8f5ef",
                  border: "1px solid #ece7de",
                }}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-sm font-semibold"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {networkMeta(job.network).label}
                      </span>
                      <span
                        className="px-2 py-1 rounded-full text-[11px] font-semibold"
                        style={{
                          backgroundColor:
                            job.status === "published"
                              ? "#dff7ea"
                              : job.status === "failed"
                                ? "#fde8e8"
                                : "#ede9fe",
                          color:
                            job.status === "published"
                              ? "#0f766e"
                              : job.status === "failed"
                                ? "#b91c1c"
                                : "#5b21b6",
                        }}
                      >
                        {statusLabel(job.status)}
                      </span>
                    </div>
                    <p
                      className="text-sm mt-2"
                      style={{
                        color: "#0a0a0a",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {job.payload.title ? `${job.payload.title} • ` : ""}
                      {job.payload.text?.slice(0, 140) ||
                        "Post sem preview textual"}
                    </p>
                    {job.status === "failed" && job.error_message && (
                      <div
                        className="flex items-start gap-2 mt-2 rounded-xl px-3 py-2 text-xs"
                        style={{
                          backgroundColor: "#fde8e8",
                          color: "#b91c1c",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        <AlertTriangle
                          size={12}
                          strokeWidth={2}
                          className="mt-0.5 shrink-0"
                        />
                        <span>{job.error_message}</span>
                      </div>
                    )}
                    <div
                      className="flex flex-wrap gap-4 mt-3 text-xs"
                      style={{
                        color: "#8c8880",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Radio size={12} /> Agendado:{" "}
                        {formatDate(job.scheduled_for)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle size={12} /> Publicado:{" "}
                        {formatDate(job.published_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {hiddenJobsCount > 0 && (
          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleJobsCount((current) => current + 3)}
              className="rounded-2xl px-4 py-2 text-sm inline-flex items-center gap-2"
              style={{
                backgroundColor: "#ece7de",
                color: "#0a0a0a",
                fontFamily: "var(--font-body)",
              }}
            >
              <ChevronDown size={14} />
              Carregar mais 3 ({hiddenJobsCount} restantes)
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
