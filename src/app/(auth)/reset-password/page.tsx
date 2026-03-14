import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export const metadata = {
  title: 'Recuperar Senha — Postable',
};

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold mb-6">Recuperar Senha</h1>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
