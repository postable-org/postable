import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import Link from 'next/link';

export const metadata = {
  title: 'Recuperar Senha — Postable',
};

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
        >
          Recuperar Senha
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enviaremos um link para redefinir sua senha.
        </p>
      </div>

      <ResetPasswordForm />

      <p className="text-sm text-center text-muted-foreground">
        Lembrou a senha?{' '}
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
