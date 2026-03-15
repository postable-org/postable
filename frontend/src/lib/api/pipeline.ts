import { apiFetch } from "@/lib/api-client";
import type { Post } from "@/lib/api/posts";

export interface PipelineBoard {
  draft: Post[];
  pending: Post[];
  approved: Post[];
  published: Post[];
  rejected: Post[];
}

export async function getPipelineBoard(
  platform?: string,
): Promise<PipelineBoard> {
  const params = new URLSearchParams();
  if (platform && platform !== "all") {
    params.set("platform", platform);
  }

  const query = params.toString();
  const res = await apiFetch(`/api/pipeline/board${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch pipeline board");
  return res.json();
}
