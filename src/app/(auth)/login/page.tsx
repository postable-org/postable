import LoginForm from '@/components/auth/LoginForm';
import Link from 'next/link';

export const metadata = {
  title: 'Entrar — Postable',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold mb-6">Entrar</h1>
        <LoginForm />
        <p className="mt-4 text-sm text-center">
          Não tem uma conta?{' '}
          <Link href="/signup" className="underline">
            Criar Conta
          </Link>
        </p>
      </div>
    </main>
  );
}
