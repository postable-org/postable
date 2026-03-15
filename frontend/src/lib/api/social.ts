import { apiFetch } from "@/lib/api-client";

export type SocialNetwork =
  | "linkedin"
  | "facebook"
  | "instagram"
  | "reddit"
  | "x";

export interface SocialConnection {
  id: string;
  user_id: string;
  network: SocialNetwork;
  account_id: string;
  account_name: string;
  token_expires_at?: string | null;
  metadata_json?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SocialJob {
  id: string;
  user_id: string;
  post_id?: string | null;
  connection_id: string;
  network: SocialNetwork;
  status: "queued" | "processing" | "published" | "failed";
  scheduled_for: string;
  published_at?: string | null;
  provider_post_id?: string | null;
  error_message?: string | null;
  payload: {
    title?: string;
    subreddit?: string;
    text: string;
    link?: string;
    media_urls?: string[];
    post_id?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface PublishPayload {
  network: SocialNetwork;
  connection_id?: string;
  post_id?: string;
  title?: string;
  subreddit?: string;
  text?: string;
  link?: string;
  media_urls?: string[];
  publish_at?: string;
}

export interface ManualConnectionPayload {
  network: SocialNetwork;
  account_id: string;
  account_name: string;
  access_token: string;
  refresh_token?: string;
}

async function ensureOk(res: Response) {
  if (res.ok) {
    return res;
  }
  let message = "Request failed";
  try {
    const body = await res.json();
    message = body.error ?? message;
  } catch {}
  throw new Error(message);
}

export async function getSocialConnections(): Promise<SocialConnection[]> {
  const res = await ensureOk(await apiFetch("/api/social/connections"));
  return res.json();
}

export async function getSocialJobs(): Promise<SocialJob[]> {
  const res = await ensureOk(await apiFetch("/api/social/jobs"));
  return res.json();
}

export async function upsertSocialConnection(
  payload: ManualConnectionPayload,
): Promise<SocialConnection> {
  const res = await ensureOk(
    await apiFetch("/api/social/connections", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
  return res.json();
}

export async function startSocialOAuth(
  network: SocialNetwork,
): Promise<string> {
  const res = await apiFetch(`/api/social/oauth/${network}/start`);
  if (res.status === 401) {
    throw new Error(
      "Sua sessão expirou. Faça login novamente e tente conectar a rede.",
    );
  }
  if (!res.ok) {
    let message = "Falha ao iniciar OAuth";
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {}
    throw new Error(message);
  }
  const body = await res.json();
  return body.auth_url as string;
}

export async function deleteSocialConnection(id: string): Promise<void> {
  const res = await apiFetch(`/api/social/connections/${id}`, { method: 'DELETE' });
  if (res.status === 204) return;
  await ensureOk(res);
}

export async function publishSocialPost(
  payload: PublishPayload,
): Promise<{ mode: string; job: SocialJob }> {
  const res = await ensureOk(
    await apiFetch("/api/social/publish", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
  return res.json();
}
