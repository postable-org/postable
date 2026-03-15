import { apiFetch } from '@/lib/api-client';

export interface Subscription {
  plan: 'basic' | 'advanced' | 'agency';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_customer_id?: string;
}

export const PLAN_LIMITS = {
  basic:    { posts_per_platform_per_month: 10,  analytics_enabled: false },
  advanced: { posts_per_platform_per_month: 25,  analytics_enabled: true  },
  agency:   { posts_per_platform_per_month: 60,  analytics_enabled: true  },
} as const;

export async function getSubscription(): Promise<Subscription | null> {
  const res = await apiFetch('/api/subscription');
  if (res.status === 402 || res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch subscription');
  return res.json();
}

export async function createCheckoutSession(priceId: string): Promise<{ url: string }> {
  const res = await apiFetch('/api/checkout/session', {
    method: 'POST',
    body: JSON.stringify({ price_id: priceId }),
  });
  if (!res.ok) throw new Error('Failed to create checkout session');
  return res.json();
}

export async function createPortalSession(): Promise<{ url: string }> {
  const res = await apiFetch('/api/billing/portal', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create portal session');
  return res.json();
}
