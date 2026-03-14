import LoginForm from "@/components/auth/LoginForm";
import Link from "next/link";

export const metadata = {
  title: "Entrar — Postable",
};

const ERROR_MESSAGES: Record<string, string> = {
  otp_expired: "O link de email expirou. Por favor, solicite um novo.",
  access_denied: "Acesso negado. Por favor, tente novamente.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const errorCode = params["error_code"] ?? params["error"];
  const errorDescription = params["error_description"];
  const authError = errorCode
    ? (ERROR_MESSAGES[errorCode] ??
        decodeURIComponent(
          errorDescription ?? "Ocorreu um erro. Tente novamente."
        ))
    : null;

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
        >
          Bem-vindo de volta
        </h1>
        <p
          className="text-sm"
          style={{
            color: "#8c8880",
            fontFamily: "var(--font-body), system-ui, sans-serif",
          }}
        >
          Entre com sua conta para continuar.
        </p>
      </div>

      <LoginForm initialError={authError} />

      <p
        className="text-sm text-center"
        style={{
          color: "#8c8880",
          fontFamily: "var(--font-body), system-ui, sans-serif",
        }}
      >
        Não tem uma conta?{" "}
        <Link
          href="/signup"
          className="font-medium underline-offset-4 hover:underline transition-colors"
          style={{ color: "#0a0a0a" }}
        >
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}
