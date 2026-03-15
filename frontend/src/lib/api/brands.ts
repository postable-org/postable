import { apiFetch } from '@/lib/api-client';

export interface BrandData {
  name?: string;
  niche: string;
  city: string;
  state: string;
  tone_of_voice: string;
  tone_custom?: string | null;
  cta_channel: 'whatsapp' | 'landing_page' | 'dm';
  context_json?: string;
  asset_urls?: string[];

  // Visual identity
  brand_colors?: string[];
  brand_fonts?: string[];
  design_style?: string;

  // Target audience
  target_age_min?: number;
  target_age_max?: number;
  target_gender?: string;
  target_audience_description?: string;

  // Brand identity
  company_history?: string;
  brand_tagline?: string;
  brand_values?: string[];
  brand_key_people?: string[];

  // Communication rules
  brand_must_use?: string;
  brand_must_avoid?: string;
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
