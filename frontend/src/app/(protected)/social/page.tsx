"use client";

import { getPostById, getPosts, type Post } from "@/lib/api/posts";
import {
  getSocialConnections,
  getSocialJobs,
  publishSocialPost,
  uploadSocialMedia,
  type SocialConnection,
  type SocialJob,
  type SocialNetwork,
} from "@/lib/api/social";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  Facebook,
  ImageIcon,
  Instagram,
  Linkedin,
  Loader2,
  Lock,
  Radio,
  Send,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ElementType,
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
];

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

function parseListField(value: string, prefix?: "#" | "@") {
  return value
    .split(/[\n,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      if (!prefix) return item;
      const clean = item.replace(/^[@#]/, "");
      return `${prefix}${clean}`;
    });
}

export default function SocialPage() {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [jobs, setJobs] = useState<SocialJob[]>([]);
  const [visibleJobsCount, setVisibleJobsCount] = useState(3);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    text: "",
    hashtags: "",
    instagramTags: "",
    publishAt: "",
  });
  const [mediaFileItems, setMediaFileItems] = useState<
    {
      id: string;
      name: string;
      url?: string;
      uploading: boolean;
      error?: string;
    }[]
  >([]);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const filteredConnections = useMemo(
    () =>
      connections.filter(
        (connection) => connection.network === publishForm.network,
      ),
    [connections, publishForm.network],
  );
  const hasAnyConnections = connections.length > 0;
  const hasConnectionsForSelectedNetwork = filteredConnections.length > 0;
  const publishBlocked =
    !hasAnyConnections || !hasConnectionsForSelectedNetwork;
  const selectedNetworkMeta = networkMeta(publishForm.network);
  const selectedNetworkConnectionsCount = filteredConnections.length;
  const visibleJobs = useMemo(
    () => jobs.slice(0, visibleJobsCount),
    [jobs, visibleJobsCount],
  );
  const hiddenJobsCount = Math.max(jobs.length - visibleJobs.length, 0);
  const failedJobsCount = useMemo(
    () => jobs.filter((job) => job.status === "failed").length,
    [jobs],
  );
  const selectedGeneratedPost = useMemo(
    () =>
      publishForm.source === "generated"
        ? posts.find((post) => post.id === publishForm.postId)
        : undefined,
    [publishForm.source, publishForm.postId, posts],
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

  async function handleMediaSelect(files: File[]) {
    for (const file of files) {
      const id = `${Date.now()}-${Math.random()}`;
      setMediaFileItems((prev) => [
        ...prev,
        { id, name: file.name, uploading: true },
      ]);
      try {
        const url = await uploadSocialMedia(file);
        setMediaFileItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, url, uploading: false } : item,
          ),
        );
      } catch (err) {
        setMediaFileItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  uploading: false,
                  error: err instanceof Error ? err.message : "Falha no upload",
                }
              : item,
          ),
        );
      }
    }
  }

  async function handlePublishSubmit(deliveryMode: "now" | "schedule") {
    if (isSubmitting) {
      return;
    }
    if (!hasAnyConnections) {
      setFeedback({
        tone: "error",
        text: "Você ainda não possui nenhuma conta conectada. Vá em Configurações para conectar.",
      });
      return;
    }
    if (!hasConnectionsForSelectedNetwork) {
      setFeedback({
        tone: "error",
        text: `Nenhuma conta ${networkMeta(publishForm.network).label} conectada. Vá em Configurações para conectar esta rede.`,
      });
      return;
    }
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
    const uploadedMediaUrls = mediaFileItems
      .filter((item) => item.url)
      .map((item) => item.url!);

    const hasUploadingMedia = mediaFileItems.some((item) => item.uploading);
    if (hasUploadingMedia) {
      setFeedback({
        tone: "error",
        text: "Aguarde o upload da imagem terminar antes de publicar.",
      });
      return;
    }

    let dbGeneratedPost: Post | undefined;
    if (publishForm.source === "generated" && publishForm.postId) {
      try {
        dbGeneratedPost = await getPostById(publishForm.postId);
      } catch {
        dbGeneratedPost = selectedGeneratedPost;
      }
    }

    const effectiveMediaUrls =
      uploadedMediaUrls.length > 0
        ? uploadedMediaUrls
        : dbGeneratedPost?.image_url
          ? [dbGeneratedPost.image_url]
          : selectedGeneratedPost?.image_url
            ? [selectedGeneratedPost.image_url]
            : [];

    if (mediaFileItems.length > 0 && effectiveMediaUrls.length === 0) {
      setFeedback({
        tone: "error",
        text: "Não foi possível usar a imagem anexada. Remova e tente anexar novamente.",
      });
      return;
    }

    const inputHashtags = parseListField(publishForm.hashtags, "#");
    const hashtags =
      inputHashtags.length > 0 ? inputHashtags : (dbGeneratedPost?.hashtags ?? []);
    const instagramTags = parseListField(publishForm.instagramTags, "@");
    if (
      publishForm.network === "instagram" &&
      publishForm.source === "manual" &&
      effectiveMediaUrls.length === 0
    ) {
      setFeedback({
        tone: "error",
        text: "No Instagram, adicione ao menos uma imagem.",
      });
      return;
    }
    if (deliveryMode === "schedule" && !publishForm.publishAt) {
      setFeedback({
        tone: "error",
        text: "Escolha data e horário para agendar.",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await publishSocialPost({
        network: publishForm.network,
        connection_id: publishForm.connectionId || undefined,
        post_id:
          publishForm.source === "generated"
            ? publishForm.postId || undefined
            : undefined,
        title: publishForm.title || undefined,
        text:
          (publishForm.text || dbGeneratedPost?.post_text || "").trim() ||
          undefined,
        media_urls: effectiveMediaUrls,
        hashtags,
        instagram_tags:
          publishForm.network === "instagram" ? instagramTags : undefined,
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
      setJobs((current) => {
        const withoutDuplicate = current.filter(
          (job) => job.id !== response.job.id,
        );
        return [response.job, ...withoutDuplicate];
      });
      setVisibleJobsCount((count) => (count < 3 ? 3 : count));
      setPublishForm((current) => ({
        ...current,
        title: "",
        text: "",
        hashtags: "",
        instagramTags: "",
        publishAt: "",
        postId: "",
      }));
      setMediaFileItems([]);
      refreshData();
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "Falha ao publicar",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Social Publishing</h1>
          <p className="page-subtitle">
            Conectar contas, publicar agora e agendar conteúdo no horário certo.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={
            feedback.tone === "success" ? "banner-success" : "banner-error"
          }
        >
          {feedback.text}
        </div>
      )}

      {/* ── Publicar ou agendar ── */}
      <section className="card-base p-6">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold">Publicar ou agendar</h2>
            <p className="page-subtitle">
              Escolha uma conta conectada e dispare agora ou no horário exato.
            </p>
          </div>
          {isPending && (
            <Loader2 className="animate-spin text-muted-foreground" size={18} />
          )}
        </div>

        {/* Rede ativa */}
        <div className="rounded-2xl px-4 py-3 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-secondary border border-border">
          <div>
            <p className="section-label mb-0.5">Rede ativa</p>
            <p className="text-sm font-medium text-foreground">
              {selectedNetworkMeta.label} • {selectedNetworkConnectionsCount}{" "}
              conta(s) conectada(s)
            </p>
          </div>
          <Link href="/settings" className="btn-primary shrink-0">
            Gerenciar conexões
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="relative">
          <div
            className={
              publishBlocked
                ? "pointer-events-none select-none blur-[3px] opacity-60 transition-all"
                : "transition-all"
            }
          >
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
                    setPublishForm((current) => {
                      const nextNetwork = event.target.value as SocialNetwork;
                      return {
                        ...current,
                        network: nextNetwork,
                        connectionId: "",
                        source: current.source,
                        postId: current.postId,
                        hashtags: current.hashtags,
                        instagramTags: current.instagramTags,
                        publishAt: current.publishAt,
                      };
                    })
                  }
                  className="input-field"
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
                  className="input-field"
                >
                  <option value="">Usar conexão mais recente da rede</option>
                  {filteredConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.account_name || connection.account_id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fonte do conteúdo */}
              <div className="pill-bar w-fit">
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
                        postId: item.id === "manual" ? "" : current.postId,
                      }))
                    }
                    className={`pill-item ${
                      publishForm.source === item.id
                        ? "pill-item-active"
                        : "pill-item-inactive"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {publishForm.source === "generated" ? (
                <select
                  value={publishForm.postId}
                  onChange={async (event) => {
                    const selectedId = event.target.value;
                    let selectedPost = posts.find(
                      (post) => post.id === selectedId,
                    );
                    if (selectedId) {
                      try {
                        selectedPost = await getPostById(selectedId);
                      } catch {
                        // fallback to local list cache
                      }
                    }
                    setPublishForm((current) => ({
                      ...current,
                      postId: selectedId,
                      text: selectedPost?.post_text ?? current.text,
                      hashtags:
                        selectedPost?.hashtags &&
                        selectedPost.hashtags.length > 0
                          ? selectedPost.hashtags
                              .map((tag) => tag.trim())
                              .filter(Boolean)
                              .map((tag) =>
                                tag.startsWith("#") ? tag : `#${tag}`,
                              )
                              .join(" ")
                          : current.hashtags,
                    }));

                    if (selectedPost?.image_url) {
                      setMediaFileItems([
                        {
                          id: `generated-${selectedPost.id}`,
                          name: "Imagem do post gerado",
                          url: selectedPost.image_url,
                          uploading: false,
                        },
                      ]);
                    } else {
                      setMediaFileItems([]);
                    }
                  }}
                  className="input-field"
                >
                  <option value="">Selecione um post gerado</option>
                  {posts.map((post) => (
                    <option key={post.id} value={post.id}>
                      {post.post_text?.slice(0, 80) ?? post.id}
                    </option>
                  ))}
                </select>
              ) : null}

              <textarea
                value={publishForm.text}
                onChange={(event) =>
                  setPublishForm((current) => ({
                    ...current,
                    text: event.target.value,
                  }))
                }
                placeholder={
                  publishForm.source === "generated"
                    ? "Legenda do post gerado (edite se quiser)"
                    : "Texto do post"
                }
                rows={5}
                className="textarea-field"
              />

              <div className="space-y-2">
                <input
                  value={publishForm.hashtags}
                  onChange={(event) =>
                    setPublishForm((current) => ({
                      ...current,
                      hashtags: event.target.value,
                    }))
                  }
                  placeholder="Hashtags (ex: #marketing #social)"
                  className="input-field"
                />
              </div>

              {publishForm.network === "instagram" && (
                <div className="space-y-2">
                  <input
                    value={publishForm.instagramTags}
                    onChange={(event) =>
                      setPublishForm((current) => ({
                        ...current,
                        instagramTags: event.target.value,
                      }))
                    }
                    placeholder="Tags de pessoas no IG (ex: @ana @marca)"
                    className="input-field"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use hashtags separadas por espaço, vírgula ou quebra de
                    linha.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                  <div
                    className="rounded-2xl border-2 border-dashed border-border p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-foreground/40 transition-colors"
                    onClick={() => mediaInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = Array.from(e.dataTransfer.files).filter(
                        (f) => f.type.startsWith("image/"),
                      );
                      if (files.length > 0) void handleMediaSelect(files);
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                      <Upload size={18} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Adicionar imagem
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Clique ou arraste um arquivo (jpeg, png, webp)
                    </p>
                    <input
                      ref={mediaInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length > 0) void handleMediaSelect(files);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  {publishForm.source === "generated" &&
                    selectedGeneratedPost?.image_url &&
                    mediaFileItems.length === 0 && (
                      <div className="rounded-xl border border-border bg-background p-2">
                        <p className="text-xs text-muted-foreground mb-2">
                          Imagem do post gerado será usada automaticamente.
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedGeneratedPost.image_url}
                          alt="Imagem do post gerado"
                          className="w-20 h-20 rounded-lg object-cover border border-border"
                        />
                      </div>
                    )}
                  {mediaFileItems.length > 0 && (
                    <div className="rounded-xl border border-border bg-background p-2 max-h-28 overflow-y-auto">
                      <div className="flex flex-wrap gap-2">
                        {mediaFileItems.map((item) => (
                          <div
                            key={item.id}
                            className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-border"
                          >
                            {item.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-secondary px-1">
                                {item.uploading ? (
                                  <Loader2
                                    size={14}
                                    className="animate-spin text-muted-foreground"
                                  />
                                ) : (
                                  <ImageIcon
                                    size={14}
                                    className="text-muted-foreground"
                                  />
                                )}
                                {item.error && (
                                  <p className="text-[9px] text-red-500 text-center leading-tight">
                                    {item.error}
                                  </p>
                                )}
                              </div>
                            )}
                            {!item.uploading && (
                              <button
                                type="button"
                                onClick={() =>
                                  setMediaFileItems((prev) =>
                                    prev.filter((f) => f.id !== item.id),
                                  )
                                }
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-foreground/70 flex items-center justify-center"
                              >
                                <X size={10} className="text-background" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              <div className="space-y-3">
                <>
                  <input
                    type="datetime-local"
                    value={publishForm.publishAt}
                    onChange={(event) =>
                      setPublishForm((current) => ({
                        ...current,
                        publishAt: event.target.value,
                      }))
                    }
                    className="input-field"
                    placeholder="Agendar para (opcional)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Preencha a data para agendar, ou deixe vazio para publicar
                    agora.
                  </p>
                </>
                <div className="flex gap-3 justify-end">
                  <button
                    type="submit"
                    disabled={publishBlocked || isSubmitting}
                    className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                    {isSubmitting ? "Publicando..." : "Publicar agora"}
                  </button>
                  <button
                    type="button"
                    disabled={publishBlocked || isSubmitting}
                    onClick={() => {
                      void handlePublishSubmit("schedule");
                    }}
                    className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Radio size={15} />
                    )}
                    {isSubmitting ? "Agendando..." : "Agendar"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {publishBlocked && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
              <div
                className="max-w-md w-full rounded-2xl p-5 text-sm text-foreground"
                style={{
                  backgroundColor: "rgba(250, 247, 241, 0.92)",
                  border: "1px solid rgba(228, 224, 216, 0.9)",
                  boxShadow: "0 16px 40px rgba(10,10,10,0.08)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div className="icon-box mb-3">
                  <Lock size={16} className="text-muted-foreground" />
                </div>
                <p className="font-semibold text-base text-foreground">
                  {!hasAnyConnections
                    ? "Nenhuma conta conectada"
                    : `Sem conta ${networkMeta(publishForm.network).label} conectada`}
                </p>
                <p className="mt-1.5 text-muted-foreground">
                  Conecte uma conta em Configurações para liberar publicação e
                  agendamento nesta rede.
                </p>
                <Link href="/settings" className="btn-primary mt-4">
                  Ir para Configurações
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Fila de publicação ── */}
      <section className="card-base p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Fila de publicação</h2>
            <p className="page-subtitle">
              Acompanhe o que já saiu e o que está agendado.
            </p>
          </div>
          <button onClick={refreshData} className="btn-secondary">
            Atualizar
          </button>
        </div>

        {failedJobsCount > 0 && (
          <div className="banner-warning mb-3">
            {failedJobsCount} publicação(ões) falharam recentemente. Atualize a
            fila após ajustar a conexão.
          </div>
        )}

        <div className="space-y-3">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum job criado ainda.
            </p>
          ) : (
            visibleJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-2xl px-4 py-4 bg-background border border-border"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">
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
                    <p className="text-sm mt-2 text-foreground">
                      {job.payload.title ? `${job.payload.title} • ` : ""}
                      {job.payload.text?.slice(0, 140) ||
                        "Post sem preview textual"}
                    </p>
                    {job.status === "failed" && job.error_message && (
                      <div className="flex items-start gap-2 mt-2 rounded-xl px-3 py-2 text-xs banner-error">
                        <AlertTriangle
                          size={12}
                          strokeWidth={2}
                          className="mt-0.5 shrink-0"
                        />
                        <span>{job.error_message}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
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
              className="btn-secondary"
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
