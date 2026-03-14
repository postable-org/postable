import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignupForm from '@/components/auth/SignupForm';

// Mock auth module
vi.mock('@/lib/auth', () => ({
  signUp: vi.fn(),
}));

import { signUp } from '@/lib/auth';

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password fields', () => {
    render(<SignupForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    // Two password fields: Senha and Confirmar Senha
    const passwordFields = screen.getAllByLabelText(/senha/i);
    expect(passwordFields.length).toBeGreaterThanOrEqual(1);
  });

  it('shows validation error when email is empty on submit', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    const submitButton = screen.getByRole('button', { name: /criar conta/i });
    await user.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText(/email inválido/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when password is shorter than 8 characters', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getAllByLabelText(/senha/i)[0];
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'short');
    const submitButton = screen.getByRole('button', { name: /criar conta/i });
    await user.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText(/8 caracteres/i)).toBeInTheDocument();
    });
  });

  it('calls signUp() with correct email+password on valid submit', async () => {
    const mockSignUp = vi.mocked(signUp);
    mockSignUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: null });
    const user = userEvent.setup();
    render(<SignupForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInputs = screen.getAllByLabelText(/senha/i);
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInputs[0], 'password123');
    await user.type(passwordInputs[1], 'password123');
    const submitButton = screen.getByRole('button', { name: /criar conta/i });
    await user.click(submitButton);
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });
});
