import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostCard } from '@/components/dashboard/PostCard';
import type { Post } from '@/lib/api/posts';
import { getPostInsights } from '@/lib/api/posts';

vi.mock('@/lib/api/posts', () => ({
  getPostInsights: vi.fn(),
  updatePostStatus: vi.fn(),
}));

const post: Post = {
  id: 'post-1',
  user_id: 'user-1',
  brand_id: 'brand-1',
  status: 'pending',
  platform: 'instagram',
  post_text: 'Texto do post',
  cta: 'Chame no WhatsApp',
  hashtags: ['#delivery'],
  suggested_format: 'feed_post',
  strategic_justification: 'Should not be rendered inline anymore',
  tokens_used: 120,
  created_at: '2026-03-14T10:00:00.000Z',
  updated_at: '2026-03-14T10:00:00.000Z',
};

describe('PostCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps card concise and removes inline strategic justification details', () => {
    render(
      <PostCard
        post={post}
        onStatusChange={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /ver insights/i })).toBeInTheDocument();
    expect(screen.queryByText(/ver justificativa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/should not be rendered inline/i)).not.toBeInTheDocument();
  });

  it('opens insights panel and supports regenerate with different angle', async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    const mockedGetPostInsights = vi.mocked(getPostInsights);
    mockedGetPostInsights.mockResolvedValue({
      post_id: post.id,
      selection_mode: 'gap_first',
      primary_gap_theme: 'delivery speed',
      why_now_summary: 'Gap selected for fast delivery content.',
      competitors_considered: ['@alpha'],
      key_signals: {
        gap_strength: 0.8,
        trend_momentum: 0.6,
        brand_fit: 0.7,
      },
      confidence_band: 'high',
    });

    render(
      <PostCard
        post={post}
        onStatusChange={vi.fn()}
        onRegenerate={onRegenerate}
      />
    );

    await user.click(screen.getByRole('button', { name: /ver insights/i }));

    expect(mockedGetPostInsights).toHaveBeenCalledWith(post.id);
    expect(await screen.findByText(/delivery speed/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /regenerar com outro angulo/i }));
    expect(onRegenerate).toHaveBeenCalledWith(post.id);
  });
});
