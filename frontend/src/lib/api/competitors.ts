import { apiFetch } from '@/lib/api-client';

export type CompetitorOperationType = 'add' | 'remove' | 'lock' | 'unlock';

export interface CompetitorOperation {
  type: CompetitorOperationType;
  handle: string;
}

export interface Competitor {
  id: string;
  handle: string;
  source: 'user' | 'auto' | string;
  is_locked: boolean;
  status: 'active' | 'invalid' | 'private' | 'inactive' | 'replaced' | string;
  replacement_handle?: string;
  locality_basis: string;
  state_key: string;
}

export interface CompetitorReplacementNotice {
  handle: string;
  replacement_handle: string;
  reason: string;
}

export interface CompetitorListResponse {
  competitors: Competitor[];
  active_count: number;
}

export interface CompetitorUpdateResponse extends CompetitorListResponse {
  replacements: CompetitorReplacementNotice[];
}

export async function getCompetitors(): Promise<CompetitorListResponse> {
  const res = await apiFetch('/api/competitors');
  if (!res.ok) throw new Error('Failed to fetch competitors');
  return res.json();
}

export async function updateCompetitors(ops: CompetitorOperation[]): Promise<CompetitorUpdateResponse> {
  const res = await apiFetch('/api/competitors', {
    method: 'PUT',
    body: JSON.stringify({ ops }),
  });
  if (!res.ok) throw new Error('Failed to update competitors');
  return res.json();
}
