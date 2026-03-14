import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import BrandSetupWizard from '@/components/forms/BrandSetupWizard';

// Mock the brands API
vi.mock('@/lib/api/brands', () => ({
  createBrand: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

import { createBrand } from '@/lib/api/brands';

describe('BrandSetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step 1 (niche + location) on mount', () => {
    render(<BrandSetupWizard />);
    expect(screen.getByText(/nicho/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/padaria|academia|clínica/i)).toBeInTheDocument();
  });

  it('does not advance if required fields are empty', async () => {
    const user = userEvent.setup();
    render(<BrandSetupWizard />);

    const nextButton = screen.getByRole('button', { name: /próximo/i });
    await user.click(nextButton);

    // Should still be on step 1
    expect(screen.getByPlaceholderText(/padaria|academia|clínica/i)).toBeInTheDocument();
  });

  it('advances to step 2 when step 1 is valid', async () => {
    const user = userEvent.setup();
    render(<BrandSetupWizard />);

    // Fill niche
    const nicheInput = screen.getByPlaceholderText(/padaria|academia|clínica/i);
    await user.type(nicheInput, 'padaria');

    // Fill city
    const cityInput = screen.getByPlaceholderText(/são paulo/i);
    await user.type(cityInput, 'São Paulo');

    // Select state
    const stateSelect = screen.getByRole('combobox');
    await user.selectOptions(stateSelect, 'SP');

    // Click next
    const nextButton = screen.getByRole('button', { name: /próximo/i });
    await user.click(nextButton);

    // Should now be on step 2 — tone of voice
    await waitFor(() => {
      expect(screen.getByText(/formal/i)).toBeInTheDocument();
    });
  });

  it('StepToneOfVoice shows 5 predefined options plus Outro', async () => {
    const user = userEvent.setup();
    render(<BrandSetupWizard />);

    // Navigate to step 2
    const nicheInput = screen.getByPlaceholderText(/padaria|academia|clínica/i);
    await user.type(nicheInput, 'padaria');
    const cityInput = screen.getByPlaceholderText(/são paulo/i);
    await user.type(cityInput, 'São Paulo');
    const stateSelect = screen.getByRole('combobox');
    await user.selectOptions(stateSelect, 'SP');
    await user.click(screen.getByRole('button', { name: /próximo/i }));

    await waitFor(() => {
      expect(screen.getByText(/formal/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/casual/i)).toBeInTheDocument();
    expect(screen.getByText(/ousado/i)).toBeInTheDocument();
    expect(screen.getByText(/amigável/i)).toBeInTheDocument();
    expect(screen.getByText(/profissional/i)).toBeInTheDocument();
    expect(screen.getByText(/outro/i)).toBeInTheDocument();
  });

  it('selecting Outro reveals free-text input', async () => {
    const user = userEvent.setup();
    render(<BrandSetupWizard />);

    // Navigate to step 2
    await user.type(screen.getByPlaceholderText(/padaria|academia|clínica/i), 'padaria');
    await user.type(screen.getByPlaceholderText(/são paulo/i), 'São Paulo');
    await user.selectOptions(screen.getByRole('combobox'), 'SP');
    await user.click(screen.getByRole('button', { name: /próximo/i }));

    await waitFor(() => {
      expect(screen.getByText(/outro/i)).toBeInTheDocument();
    });

    // Free text should NOT be visible yet
    expect(screen.queryByPlaceholderText(/descreva/i)).not.toBeInTheDocument();

    // Select Outro
    await user.click(screen.getByText(/outro/i));

    // Free text input should now be visible
    expect(screen.getByPlaceholderText(/descreva/i)).toBeInTheDocument();
  });

  it('selecting a predefined option hides free-text input', async () => {
    const user = userEvent.setup();
    render(<BrandSetupWizard />);

    // Navigate to step 2
    await user.type(screen.getByPlaceholderText(/padaria|academia|clínica/i), 'padaria');
    await user.type(screen.getByPlaceholderText(/são paulo/i), 'São Paulo');
    await user.selectOptions(screen.getByRole('combobox'), 'SP');
    await user.click(screen.getByRole('button', { name: /próximo/i }));

    await waitFor(() => {
      expect(screen.getByText(/outro/i)).toBeInTheDocument();
    });

    // Select Outro first
    await user.click(screen.getByText(/outro/i));
    expect(screen.getByPlaceholderText(/descreva/i)).toBeInTheDocument();

    // Now select a predefined option
    await user.click(screen.getByText(/formal/i));

    // Free text should be hidden again
    expect(screen.queryByPlaceholderText(/descreva/i)).not.toBeInTheDocument();
  });

  it('competitor handles field is NOT present anywhere in the wizard', () => {
    render(<BrandSetupWizard />);
    expect(screen.queryByText(/competitor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/concorrente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/handles/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
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

    // Step 1: niche + location
    await user.type(screen.getByPlaceholderText(/padaria|academia|clínica/i), 'padaria');
    await user.type(screen.getByPlaceholderText(/são paulo/i), 'São Paulo');
    await user.selectOptions(screen.getByRole('combobox'), 'SP');
    await user.click(screen.getByRole('button', { name: /próximo/i }));

    // Step 2: tone of voice
    await waitFor(() => expect(screen.getByText(/formal/i)).toBeInTheDocument());
    await user.click(screen.getByText(/formal/i));
    await user.click(screen.getByRole('button', { name: /próximo/i }));

    // Step 3: CTA channel
    await waitFor(() => expect(screen.getByText(/whatsapp/i)).toBeInTheDocument());
    await user.click(screen.getByText(/whatsapp/i));
    await user.click(screen.getByRole('button', { name: /próximo/i }));

    // Step 4: Review — submit
    await waitFor(() => expect(screen.getByRole('button', { name: /confirmar/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /confirmar/i }));

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
