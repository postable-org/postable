import { apiFetch } from '@/lib/api-client';

export interface BrandData {
  niche: string;
  city: string;
  state: string;
  tone_of_voice: string;
  tone_custom?: string | null;
  cta_channel: 'whatsapp' | 'landing_page' | 'dm';
}

export interface Brand extends BrandData {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export async function createBrand(data: BrandData): Promise<Brand> {
  const res = await apiFetch('/api/brands', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create brand');
  return res.json();
}

export async function getBrand(): Promise<Brand | null> {
  const res = await apiFetch('/api/brands');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to get brand');
  return res.json();
}

export async function updateBrand(data: BrandData): Promise<Brand> {
  const res = await apiFetch('/api/brands', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update brand');
  return res.json();
}
