import { apiFetch } from "@/lib/api-client";

export type AnalyticsRange = "7d" | "30d" | "90d";

export interface AnalyticsOverview {
  total_reach: number;
  total_engagements: number;
  engagement_rate: number;
  total_posts_published: number;
  reach_trend: number;
  engagement_trend: number;
  rate_trend: number;
  scheduled_posts: number;
  failed_posts: number;
  connected_accounts: number;
  connected_platforms: number;
}

export interface AnalyticsDailyPoint {
  date: string;
  reach: number;
  engagement: number;
  posts: number;
}

export interface AnalyticsPlatformStat {
  id: string;
  network: string;
  label: string;
  account_name: string;
  color: string;
  posts: number;
  reach: number;
  engagement_rate: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface AnalyticsTopPost {
  id: string;
  text: string;
  platform: string;
  account_name: string;
  format: string;
  date: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  engagements: number;
}

export interface AnalyticsBreakdown {
  likes: number;
  comments: number;
  shares: number;
  followers_reached: number;
}

export interface AnalyticsResponse {
  range: AnalyticsRange;
  generated_at: string;
  overview: AnalyticsOverview;
  daily: AnalyticsDailyPoint[];
  platforms: AnalyticsPlatformStat[];
  top_posts: AnalyticsTopPost[];
  breakdown: AnalyticsBreakdown;
  has_connected_social: boolean;
  has_performance_data: boolean;
}

async function ensureOk(response: Response) {
  if (response.ok) {
    return response;
  }

  let message = "Falha ao carregar métricas";
  try {
    const body = await response.json();
    message = body.error ?? message;
  } catch {}
  throw new Error(message);
}

export async function getAnalytics(
  range: AnalyticsRange,
): Promise<AnalyticsResponse> {
  const response = await ensureOk(
    await apiFetch(`/api/analytics?range=${range}`),
  );
  return response.json();
}

export async function refreshInsights(): Promise<{ updated: number }> {
  const response = await ensureOk(
    await apiFetch("/api/social/insights/refresh", { method: "POST" }),
  );
  return response.json();
}
