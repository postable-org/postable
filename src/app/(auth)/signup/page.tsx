import SignupForm from '@/components/auth/SignupForm';
import Link from 'next/link';

export const metadata = {
  title: 'Criar Conta — Postable',
};

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold mb-6">Criar Conta</h1>
        <SignupForm />
        <p className="mt-4 text-sm text-center">
          Já tem uma conta?{' '}
          <Link href="/login" className="underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
