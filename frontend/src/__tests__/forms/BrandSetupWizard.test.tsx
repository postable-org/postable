import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import BrandSetupWizard from '@/components/forms/BrandSetupWizard';

vi.mock('@/lib/api/brands', () => ({
  createBrand: vi.fn(),
}));

vi.mock('@/lib/api/competitors', () => ({
  updateCompetitors: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

import { createBrand } from '@/lib/api/brands';

async function selectState(user: ReturnType<typeof userEvent.setup>, stateCode: string) {
  const selects = screen.getAllByRole('combobox');
  const stateSelect = selects[selects.length - 1];
  await user.selectOptions(stateSelect, stateCode);
}

describe('BrandSetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step 0 (company name) on mount', () => {
    render(<BrandSetupWizard />);
    expect(screen.getByText(/como se chama sua empresa/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/studio bella|techflow|padaria/i)).toBeInTheDocument();
  });

  it('does not advance if company name is empty', async () => {
    const user = userEvent.setup();
    render(<BrandSetupWizard />);

    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(screen.getByPlaceholderText(/studio bella|techflow|padaria/i)).toBeInTheDocument();
  });

  it('advances to step 1 (niche) when step 0 is valid', async () => {
    const user = userEvent.setup();
    render(<BrandSetupWizard />);

    await user.type(screen.getByPlaceholderText(/studio bella|techflow|padaria/i), 'padaria');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => {
      expect(screen.getByText(/qual é o nicho do seu negócio/i)).toBeInTheDocument();
    });
  });

  it('StepToneOfVoice shows predefined options including Personalizado', async () => {
    const user = userEvent.setup();
    render(<BrandSetupWizard />);

    await user.type(screen.getByPlaceholderText(/studio bella|techflow|padaria/i), 'Test Co');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(screen.getByText(/nicho/i)).toBeInTheDocument());
    await user.click(screen.getByText(/alimentação/i));
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(screen.getByText(/tamanho/i)).toBeInTheDocument());
    await user.click(screen.getByText(/só eu/i));
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(screen.getByText(/onde sua empresa está/i)).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/são paulo|rio de janeiro/i), 'São Paulo');
    await selectState(user, 'SP');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(screen.getByText(/como você fala com seus clientes/i)).toBeInTheDocument());

    expect(screen.getByText(/formal/i)).toBeInTheDocument();
    expect(screen.getByText(/casual/i)).toBeInTheDocument();
    expect(screen.getByText(/ousado/i)).toBeInTheDocument();
    expect(screen.getByText(/amigável/i)).toBeInTheDocument();
    expect(screen.getByText(/profissional/i)).toBeInTheDocument();
    expect(screen.getByText(/personalizado/i)).toBeInTheDocument();
  });

  it('selecting Personalizado reveals free-text input', async () => {
    const user = userEvent.setup();
    render(<BrandSetupWizard />);

    await user.type(screen.getByPlaceholderText(/studio bella|techflow|padaria/i), 'Test');
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await waitFor(() => expect(screen.getByText(/nicho/i)).toBeInTheDocument());
    await user.click(screen.getByText(/alimentação/i));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await waitFor(() => expect(screen.getByText(/tamanho/i)).toBeInTheDocument());
    await user.click(screen.getByText(/só eu/i));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await waitFor(() => expect(screen.getByText(/onde sua empresa está/i)).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/são paulo|rio de janeiro/i), 'São Paulo');
    await selectState(user, 'SP');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(screen.getByText(/personalizado/i)).toBeInTheDocument());

    expect(screen.queryByPlaceholderText(/direto ao ponto|descreva seu tom/i)).not.toBeInTheDocument();

    await user.click(screen.getByText(/personalizado/i));

    expect(screen.getByPlaceholderText(/direto ao ponto|descreva seu tom/i)).toBeInTheDocument();
  });

  it('selecting a predefined tone hides free-text input', async () => {
    const user = userEvent.setup();
    render(<BrandSetupWizard />);

    await user.type(screen.getByPlaceholderText(/studio bella|techflow|padaria/i), 'Test');
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await waitFor(() => expect(screen.getByText(/nicho/i)).toBeInTheDocument());
    await user.click(screen.getByText(/alimentação/i));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await waitFor(() => expect(screen.getByText(/tamanho/i)).toBeInTheDocument());
    await user.click(screen.getByText(/só eu/i));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await waitFor(() => expect(screen.getByText(/onde sua empresa está/i)).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/são paulo|rio de janeiro/i), 'São Paulo');
    await selectState(user, 'SP');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(screen.getByText(/personalizado/i)).toBeInTheDocument());
    await user.click(screen.getByText(/personalizado/i));
    expect(screen.getByPlaceholderText(/direto ao ponto|descreva seu tom/i)).toBeInTheDocument();

    await user.click(screen.getByText(/formal/i));
    expect(screen.queryByPlaceholderText(/direto ao ponto|descreva seu tom/i)).not.toBeInTheDocument();
  });

  it('final step calls createBrand() with collected form data on submit', async () => {
    const mockCreateBrand = vi.mocked(createBrand);
    mockCreateBrand.mockResolvedValue({
      id: 'test-id',
      user_id: 'user-id',
      niche: 'padaria',
      city: 'São Paulo',
      state: 'SP',
      tone_of_voice: 'formal',
      tone_custom: null,
      cta_channel: 'whatsapp',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    });

    const user = userEvent.setup();
    render(<BrandSetupWizard />);

    await user.type(screen.getByPlaceholderText(/studio bella|techflow|padaria/i), 'Padaria');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(screen.getByText(/nicho/i)).toBeInTheDocument());
    await user.click(screen.getByText(/outro/i));
    await user.type(screen.getByPlaceholderText(/consultoria|pet shop|tatuagem/i), 'padaria');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(screen.getByText(/tamanho/i)).toBeInTheDocument());
    await user.click(screen.getByText(/só eu/i));
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(screen.getByText(/onde sua empresa está/i)).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/são paulo|rio de janeiro/i), 'São Paulo');
    await selectState(user, 'SP');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(screen.getByText(/como você fala com seus clientes/i)).toBeInTheDocument());
    await user.click(screen.getByText(/formal/i));
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(screen.getByText(/whatsapp/i)).toBeInTheDocument());
    await user.click(screen.getByText(/whatsapp/i));
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /pular esta etapa/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /pular esta etapa/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /criar minha marca/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /criar minha marca/i }));

    await waitFor(() => {
      expect(mockCreateBrand).toHaveBeenCalledWith(
        expect.objectContaining({
          niche: 'padaria',
          city: 'São Paulo',
          state: 'SP',
          tone_of_voice: 'formal',
          cta_channel: 'whatsapp',
        })
      );
    });
  });
});
