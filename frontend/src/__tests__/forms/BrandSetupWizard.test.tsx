import { render, screen } from '@testing-library/react';
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

describe('BrandSetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('competitor handles field is NOT present anywhere in the wizard', () => {
    render(<BrandSetupWizard />);
    expect(screen.queryByText(/competitor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/concorrente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/handles/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
