"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

type FormData = z.infer<typeof schema>;

const fieldBase =
  "w-full rounded-xl border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10 disabled:opacity-50";
const fieldBorder = "border-[#e4e0d8]";
const fieldError = "border-destructive ring-2 ring-destructive/10";

export default function LoginForm({
  initialError,
}: {
  initialError?: string | null;
}) {
  const [serverError, setServerError] = useState<string | null>(
    initialError ?? null
  );
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { error } = await signIn(data.email, data.password);
    if (error) {
      setServerError(error.message);
    } else {
      router.push("/dashboard");
    }
  };

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
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="block text-sm font-medium"
            style={{ color: "#0a0a0a" }}
          >
            Senha
          </label>
          <a
            href="/reset-password"
            className="text-xs underline-offset-4 hover:underline transition-colors"
            style={{ color: "#8c8880" }}
          >
            Esqueceu a senha?
          </a>
        </div>
        <input
          id="password"
          type="password"
          placeholder="••••••••"
          {...register("password")}
          className={`${fieldBase} ${errors.password ? fieldError : fieldBorder}`}
        />
        {errors.password && (
          <p role="alert" className="text-xs" style={{ color: "oklch(0.577 0.245 27.325)" }}>
            {errors.password.message}
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
        {isSubmitting ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
