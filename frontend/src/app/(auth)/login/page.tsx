import LoginForm from '@/components/auth/LoginForm';
import Link from 'next/link';

export const metadata = {
  title: 'Entrar — Postable',
};

const ERROR_MESSAGES: Record<string, string> = {
  otp_expired: 'O link de email expirou. Por favor, solicite um novo.',
  access_denied: 'Acesso negado. Por favor, tente novamente.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const errorCode = params['error_code'] ?? params['error'];
  const errorDescription = params['error_description'];
  const authError = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? decodeURIComponent(errorDescription ?? 'Ocorreu um erro. Tente novamente.'))
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
        >
          Entrar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bem-vindo de volta.
        </p>
      </div>

      <LoginForm initialError={authError} />

      <p className="text-sm text-center text-muted-foreground">
        Não tem uma conta?{' '}
        <Link
          href="/signup"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Criar Conta
        </Link>
      </p>
    </div>
  );
}
