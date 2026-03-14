import SignupForm from "@/components/auth/SignupForm";
import Link from "next/link";

export const metadata = {
  title: "Criar Conta — Postable",
};

export default function SignupPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
        >
          Comece agora
        </h1>
        <p
          className="text-sm"
          style={{
            color: "#8c8880",
            fontFamily: "var(--font-body), system-ui, sans-serif",
          }}
        >
          Crie sua conta gratuitamente. Sem cartão de crédito.
        </p>
      </div>

      <SignupForm />

      <p
        className="text-sm text-center"
        style={{
          color: "#8c8880",
          fontFamily: "var(--font-body), system-ui, sans-serif",
        }}
      >
        Já tem uma conta?{" "}
        <Link
          href="/login"
          className="font-medium underline-offset-4 hover:underline transition-colors"
          style={{ color: "#0a0a0a" }}
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
