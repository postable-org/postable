import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { InsightsPanel } from '@/components/dashboard/InsightsPanel';
import type { PostInsights } from '@/lib/api/posts';

const baseInsights: PostInsights = {
  post_id: 'post-1',
  selection_mode: 'gap_first',
  primary_gap_theme: 'delivery speed',
  why_now_summary: 'Competitors are under-serving this topic.',
  competitors_considered: ['@alpha', '@beta'],
  key_signals: {
    gap_strength: 0.88,
    trend_momentum: 0.63,
    brand_fit: 0.79,
  },
  confidence_band: 'high',
};

describe('InsightsPanel', () => {
  it('renders summary-first insights and triggers regenerate callback', async () => {
    const user = userEvent.setup();
    const onRegenerateWithDifferentAngle = vi.fn();

    render(
      <InsightsPanel
        open
        insights={baseInsights}
        loading={false}
        error={null}
        onClose={vi.fn()}
        onRetry={vi.fn()}
        onRegenerateWithDifferentAngle={onRegenerateWithDifferentAngle}
      />
    );

    expect(screen.getByText(/insights da sugest/i)).toBeInTheDocument();
    expect(screen.getByText(/delivery speed/i)).toBeInTheDocument();
    expect(screen.getByText(/competitors are under-serving/i)).toBeInTheDocument();
    expect(screen.getByText('@alpha')).toBeInTheDocument();
    expect(screen.getByText(/modo: gap-first/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /regenerar com outro angulo/i }));
    expect(onRegenerateWithDifferentAngle).toHaveBeenCalledTimes(1);
  });

  it('shows explicit fallback message when selection mode is trend_fallback', () => {
    render(
      <InsightsPanel
        open
        insights={{
          ...baseInsights,
          selection_mode: 'trend_fallback',
          fallback_reason: 'no_strong_gap_found',
        }}
        loading={false}
        error={null}
        onClose={vi.fn()}
        onRetry={vi.fn()}
        onRegenerateWithDifferentAngle={vi.fn()}
      />
    );

    expect(screen.getByText(/fallback aplicado: nenhum gap forte foi encontrado/i)).toBeInTheDocument();
    expect(screen.getByText(/motivo: no strong gap found/i)).toBeInTheDocument();
  });

  it('renders retry action when loading fails', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <InsightsPanel
        open
        insights={null}
        loading={false}
        error="Erro"
        onClose={vi.fn()}
        onRetry={onRetry}
        onRegenerateWithDifferentAngle={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
