'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { resetPassword } from '@/lib/auth';

const schema = z.object({
  email: z.string().email('Email inválido'),
});

type FormData = z.infer<typeof schema>;

export default function ResetPasswordForm() {
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { error } = await resetPassword(data.email);
    if (error) {
      setServerError(error.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div role="status">
        <p>Email enviado! Verifique sua caixa de entrada.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          {...register('email')}
        />
        {errors.email && <p role="alert">{errors.email.message}</p>}
      </div>

      {serverError && <p role="alert">{serverError}</p>}

      <button type="submit" disabled={isSubmitting}>
        Recuperar Senha
      </button>
    </form>
  );
}
