"use client";

import { getPosts, type Post } from "@/lib/api/posts";
import {
  getSocialConnections,
  getSocialJobs,
  publishSocialPost,
  startSocialOAuth,
  type SocialConnection,
  type SocialJob,
  type SocialNetwork,
} from "@/lib/api/social";
import {
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  Radio,
  Send,
  Twitter,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ElementType,
  type FormEvent,
} from "react";

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
      "Publica imagem, vídeo ou carrossel via conta profissional conectada à Meta.",
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
    description: "Publica no perfil autenticado com escopo w_member_social.",
    oauth: "linkedin",
    Icon: Linkedin,
  },
  {
    id: "reddit",
    label: "Reddit",
    color: "#FF4500",
    description: "Cria self-post ou link post em um subreddit via OAuth2.",
    oauth: "reddit",
    Icon: null,
  },
  {
    id: "x",
    label: "X",
    color: "#111111",
    description:
      "Publica texto via OAuth oficial da API v2, sem copiar token manual.",
    oauth: "x",
    Icon: Twitter,
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
        note: "Se der erro, faça logout e login novamente. O administrador precisa configurar LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET no backend.",
      };
    case "reddit":
      return {
        title: "Passo a passo para conectar Reddit",
        steps: [
          "Certifique-se de estar logado no Postable.",
          "Clique no botão abaixo para abrir o consentimento do Reddit.",
          "Autorize os escopos de identidade e publicação.",
          "Você será redirecionado de volta com a conta conectada.",
        ],
        note: "Se der erro, faça logout e login novamente. O administrador precisa configurar REDDIT_CLIENT_ID e REDDIT_CLIENT_SECRET no backend.",
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
        note: "Se der erro, faça logout e login novamente. O administrador precisa configurar X_CLIENT_ID (e opcionalmente X_CLIENT_SECRET) no backend.",
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
        note: "Se der erro, faça logout e login novamente. O administrador precisa configurar FACEBOOK_APP_ID e FACEBOOK_APP_SECRET no backend (veja SOCIAL_SETUP.md).",
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

export default function SocialPage() {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [jobs, setJobs] = useState<SocialJob[]>([]);
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
    connectionId: "",
    source: "manual" as "manual" | "generated",
    postId: "",
    title: "",
    subreddit: "",
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

  async function handlePublishSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await publishSocialPost({
        network: publishForm.network,
        connection_id: publishForm.connectionId || undefined,
        post_id:
          publishForm.source === "generated"
            ? publishForm.postId || undefined
            : undefined,
        title: publishForm.title || undefined,
        subreddit: publishForm.subreddit || undefined,
        text:
          publishForm.source === "manual"
            ? publishForm.text || undefined
            : undefined,
        link: publishForm.link || undefined,
        media_urls: publishForm.mediaUrls
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        publish_at: publishForm.publishAt
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
        title: "",
        subreddit: "",
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
              {connections.length === 0 ? (
                <p
                  className="text-sm"
                  style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
                >
                  Nenhuma conta conectada ainda.
                </p>
              ) : (
                connections.map((connection) => (
                  <div
                    key={connection.id}
                    className="rounded-2xl px-4 py-3"
                    style={{
                      backgroundColor: "#f8f5ef",
                      border: "1px solid #ece7de",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ fontFamily: "var(--font-body)" }}
                        >
                          {connection.account_name || connection.account_id}
                        </p>
                        <p
                          className="text-xs mt-1"
                          style={{
                            color: "#8c8880",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {networkMeta(connection.network).label} • expira em{" "}
                          {formatDate(connection.token_expires_at ?? null)}
                        </p>
                      </div>
                      <span
                        className="text-[11px] font-semibold px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: `${networkMeta(connection.network).color}15`,
                          color: networkMeta(connection.network).color,
                        }}
                      >
                        {connection.network}
                      </span>
                    </div>
                  </div>
                ))
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

          <form onSubmit={handlePublishSubmit} className="space-y-3">
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
                    {post.content_json.post_text?.slice(0, 80) ?? post.id}
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

            {publishForm.network === "reddit" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={publishForm.title}
                  onChange={(event) =>
                    setPublishForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Título do post no Reddit"
                  className="rounded-2xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: "#f8f5ef",
                    border: "1px solid #e4e0d8",
                    fontFamily: "var(--font-body)",
                  }}
                />
                <input
                  value={publishForm.subreddit}
                  onChange={(event) =>
                    setPublishForm((current) => ({
                      ...current,
                      subreddit: event.target.value,
                    }))
                  }
                  placeholder="Subreddit ex: brdev"
                  className="rounded-2xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: "#f8f5ef",
                    border: "1px solid #e4e0d8",
                    fontFamily: "var(--font-body)",
                  }}
                />
              </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
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
                Publicar / Agendar
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
              Acompanhe o que já saiu, o que está agendado e o que falhou.
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

        <div className="space-y-3">
          {jobs.length === 0 ? (
            <p
              className="text-sm"
              style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
            >
              Nenhum job criado ainda.
            </p>
          ) : (
            jobs.map((job) => (
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
                        {job.status}
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
                        <Instagram size={12} /> Publicado:{" "}
                        {formatDate(job.published_at)}
                      </span>
                    </div>
                  </div>
                  {job.error_message && (
                    <div
                      className="text-xs max-w-sm"
                      style={{
                        color: "#b91c1c",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {job.error_message}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
