import { apiFetch } from '@/lib/api-client';

export interface PostContent {
  post_text: string;
  cta: string;
  hashtags: string[];
  suggested_format: 'carousel' | 'feed_post' | 'story';
  strategic_justification: string;
  tokens_used: number;
}

export interface Post {
  id: string;
  user_id: string;
  brand_id: string;
  status: 'pending' | 'approved' | 'rejected';
  content_json: PostContent;
  created_at: string;
  updated_at: string;
}

export interface PostInsightsKeySignals {
  gap_strength: number;
  trend_momentum: number;
  brand_fit: number;
}

export interface PostInsights {
  post_id: string;
  selection_mode: 'gap_first' | 'trend_fallback';
  primary_gap_theme: string;
  why_now_summary: string;
  competitors_considered: string[];
  key_signals: PostInsightsKeySignals;
  confidence_band: 'high' | 'medium' | 'low' | string;
  fallback_reason?: string;
}

export async function getPosts(): Promise<Post[]> {
  const res = await apiFetch('/api/posts');
  if (!res.ok) throw new Error('Failed to fetch posts');
  return res.json();
}

export async function getPostInsights(postId: string): Promise<PostInsights | null> {
  const res = await apiFetch(`/api/posts/${postId}/insights`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch post insights');
  return res.json();
}

export async function updatePostStatus(id: string, status: 'approved' | 'rejected'): Promise<Post> {
  const res = await apiFetch(`/api/posts/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update post status');
  return res.json();
}
