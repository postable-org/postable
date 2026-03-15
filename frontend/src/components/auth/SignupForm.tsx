"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signUp } from "@/lib/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";

const schema = z
  .object({
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

const fieldBase =
  "w-full rounded-xl border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10 disabled:opacity-50";
const fieldBorder = "border-[#e4e0d8]";
const fieldError = "border-destructive ring-2 ring-destructive/10";

export default function SignupForm() {
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { data: authData, error } = await signUp(data.email, data.password);
    if (error) {
      setServerError(error.message);
    } else if (authData?.session) {
      // Email confirmation is disabled — go straight to onboarding
      router.push('/brand-setup');
    } else {
      // Email confirmation is enabled — show "check your email" message
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div
        role="status"
        className="py-8 px-6 rounded-2xl text-center space-y-2"
        style={{ backgroundColor: "#f0ede7", border: "1px solid #e4e0d8" }}
      >
        <div className="text-2xl mb-3">📬</div>
        <p
          className="font-semibold"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Confirme seu email
        </p>
        <p className="text-sm" style={{ color: "#8c8880" }}>
          Enviamos um link de confirmação. Verifique sua caixa de entrada.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-4"
      style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}
    >
      {/* Email */}
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-sm font-medium"
          style={{ color: "#0a0a0a" }}
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          placeholder="seu@email.com"
          {...register("email")}
          className={`${fieldBase} ${errors.email ? fieldError : fieldBorder}`}
        />
        {errors.email && (
          <p role="alert" className="text-xs" style={{ color: "oklch(0.577 0.245 27.325)" }}>
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium"
          style={{ color: "#0a0a0a" }}
        >
          Senha
        </label>
        <input
          id="password"
          type="password"
          placeholder="Mínimo 8 caracteres"
          {...register("password")}
          className={`${fieldBase} ${errors.password ? fieldError : fieldBorder}`}
        />
        {errors.password && (
          <p role="alert" className="text-xs" style={{ color: "oklch(0.577 0.245 27.325)" }}>
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Confirm password */}
      <div className="space-y-1.5">
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium"
          style={{ color: "#0a0a0a" }}
        >
          Confirmar senha
        </label>
        <input
          id="confirmPassword"
          type="password"
          placeholder="Repita a senha"
          {...register("confirmPassword")}
          className={`${fieldBase} ${
            errors.confirmPassword ? fieldError : fieldBorder
          }`}
        />
        {errors.confirmPassword && (
          <p role="alert" className="text-xs" style={{ color: "oklch(0.577 0.245 27.325)" }}>
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription role="alert">{serverError}</AlertDescription>
        </Alert>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full py-3 text-sm font-semibold transition-all disabled:opacity-50 active:scale-[0.98]"
        style={{
          backgroundColor: "#0a0a0a",
          color: "#f8f5ef",
        }}
      >
        {isSubmitting ? "Criando conta..." : "Criar conta"}
      </button>

      <p className="text-xs text-center" style={{ color: "#8c8880" }}>
        Ao criar uma conta você concorda com nossos{" "}
        <a href="#" className="underline-offset-4 hover:underline">
          Termos de Uso
        </a>
        .
      </p>
    </form>
  );
}
