import SignupForm from '@/components/auth/SignupForm';
import Link from 'next/link';

export const metadata = {
  title: 'Criar Conta — Postable',
};

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
        >
          Criar Conta
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comece gratuitamente hoje.
        </p>
      </div>

      <SignupForm />

      <p className="text-sm text-center text-muted-foreground">
        Já tem uma conta?{' '}
        <Link
          href="/login"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
