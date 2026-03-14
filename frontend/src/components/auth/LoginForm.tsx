'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

type FormData = z.infer<typeof schema>;

export default function LoginForm({ initialError }: { initialError?: string | null }) {
  const [serverError, setServerError] = useState<string | null>(initialError ?? null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { error } = await signIn(data.email, data.password);
    if (error) {
      setServerError(error.message);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
        />
        {errors.email && (
          <p role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          {...register('password')}
        />
        {errors.password && (
          <p role="alert" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription role="alert">{serverError}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        Entrar
      </Button>

      <a
        href="/reset-password"
        className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Esqueceu a senha?
      </a>
    </form>
  );
}
