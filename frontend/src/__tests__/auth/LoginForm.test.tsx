import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '@/components/auth/LoginForm';

// Mock auth module
vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

import { signIn } from '@/lib/auth';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password fields', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it('calls signIn() with correct email+password on valid submit', async () => {
    const mockSignIn = vi.mocked(signIn);
    mockSignIn.mockResolvedValueOnce({ data: { user: {} as any, session: {} as any }, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/senha/i);
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    const submitButton = screen.getByRole('button', { name: /entrar/i });
    await user.click(submitButton);
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('displays error message when signIn returns an error', async () => {
    const mockSignIn = vi.mocked(signIn);
    mockSignIn.mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: 'Invalid credentials', name: 'AuthError', status: 400 } as any });
    const user = userEvent.setup();
    render(<LoginForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/senha/i);
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpass');
    const submitButton = screen.getByRole('button', { name: /entrar/i });
    await user.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
