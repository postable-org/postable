import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompetitorSettingsCard } from '@/components/dashboard/CompetitorSettingsCard';
import { getCompetitors, updateCompetitors } from '@/lib/api/competitors';

vi.mock('@/lib/api/competitors', () => ({
  getCompetitors: vi.fn(),
  updateCompetitors: vi.fn(),
}));

const listResponse = {
  active_count: 2,
  competitors: [
    {
      id: 'c1',
      handle: '@alpha',
      source: 'user',
      is_locked: false,
      status: 'active',
      locality_basis: 'state',
      state_key: 'SP',
    },
    {
      id: 'c2',
      handle: '@beta',
      source: 'auto',
      is_locked: true,
      status: 'active',
      locality_basis: 'state',
      state_key: 'SP',
    },
  ],
};

describe('CompetitorSettingsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCompetitors).mockResolvedValue(listResponse);
    vi.mocked(updateCompetitors).mockResolvedValue({
      ...listResponse,
      replacements: [],
    });
  });

  it('loads competitors and renders source/status/lock badges', async () => {
    render(<CompetitorSettingsCard />);

    expect(await screen.findByText('@alpha')).toBeInTheDocument();
    expect(screen.getByText('@beta')).toBeInTheDocument();
    expect(screen.getByText(/ativos: 2/i)).toBeInTheDocument();
    expect(screen.getAllByText(/status: active/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/bloqueado/i)).toBeInTheDocument();
  });

  it('supports add, lock/unlock and remove operations via updateCompetitors', async () => {
    const user = userEvent.setup();

    render(<CompetitorSettingsCard />);
    await screen.findByText('@alpha');

    await user.type(screen.getByPlaceholderText(/@nome_do_concorrente/i), '@novo');
    await user.click(screen.getByRole('button', { name: /adicionar/i }));

    await waitFor(() => {
      expect(updateCompetitors).toHaveBeenCalledWith([{ type: 'add', handle: '@novo' }]);
    });

    const lockButtons = screen.getAllByRole('button', { name: /bloquear concorrente/i });
    await user.click(lockButtons[0]);
    expect(updateCompetitors).toHaveBeenCalledWith([{ type: 'lock', handle: '@alpha' }]);

    const removeButtons = screen.getAllByRole('button', { name: /remover/i });
    await user.click(removeButtons[0]);
    expect(updateCompetitors).toHaveBeenCalledWith([{ type: 'remove', handle: '@alpha' }]);
  });

  it('shows replacement notices from backend response', async () => {
    const user = userEvent.setup();
    vi.mocked(updateCompetitors).mockResolvedValueOnce({
      ...listResponse,
      replacements: [
        {
          handle: '@bad',
          replacement_handle: '@auto_sp_1',
          reason: 'invalid',
        },
      ],
    });

    render(<CompetitorSettingsCard />);
    await screen.findByText('@alpha');

    await user.type(screen.getByPlaceholderText(/@nome_do_concorrente/i), '@bad');
    await user.click(screen.getByRole('button', { name: /adicionar/i }));

    expect(await screen.findByText(/substituicoes automaticas/i)).toBeInTheDocument();
    expect(screen.getByText(/@bad foi substituido por @auto_sp_1/i)).toBeInTheDocument();
  });
});
