'use client';

import { useQuery } from '@tanstack/react-query';
import { getSubscription, createPortalSession, PLAN_LIMITS } from '@/lib/api/subscription';
import { AlertTriangle, CreditCard, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic',
  advanced: 'Advanced',
  agency: 'Agency',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  trialing: 'Em trial',
  past_due: 'Pagamento pendente',
  canceled: 'Cancelado',
  unpaid: 'Não pago',
};

export default function SettingsPage() {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: getSubscription,
  });

  const handlePortal = async () => {
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch {
      alert('Erro ao abrir portal de cobrança. Tente novamente.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1
        className="text-2xl font-bold mb-8"
        style={{ fontFamily: 'var(--font-sans)', color: '#0a0a0a' }}
      >
        Configurações
      </h1>

      <section
        className="rounded-2xl p-7"
        style={{ backgroundColor: '#ffffff', border: '1.5px solid #e4e0d8' }}
      >
        <div className="flex items-center gap-3 mb-6">
          <CreditCard size={18} strokeWidth={1.8} style={{ color: '#6b6760' }} />
          <h2
            className="text-base font-semibold"
            style={{ fontFamily: 'var(--font-sans)', color: '#0a0a0a' }}
          >
            Assinatura
          </h2>
        </div>

        {isLoading && (
          <p className="text-sm" style={{ color: '#a09d98' }}>
            Carregando...
          </p>
        )}

        {!isLoading && !subscription && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: '#6b6760' }}>
              Você não possui uma assinatura ativa.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
              style={{
                backgroundColor: '#0a0a0a',
                color: '#f8f5ef',
                fontFamily: 'var(--font-body)',
              }}
            >
              Ver planos
            </Link>
          </div>
        )}

        {!isLoading && subscription && (
          <div className="space-y-5">
            {subscription.status === 'past_due' && (
              <div
                className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
                style={{ backgroundColor: '#fff8e6', border: '1px solid #f5c518', color: '#7a5c00' }}
              >
                <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
                <span>
                  Seu pagamento está pendente. Atualize suas informações de pagamento para evitar
                  interrupção do serviço.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: '#f8f5ef' }}
              >
                <p className="text-xs mb-1" style={{ color: '#a09d98' }}>
                  Plano atual
                </p>
                <p className="text-base font-semibold" style={{ color: '#0a0a0a' }}>
                  {PLAN_LABELS[subscription.plan] ?? subscription.plan}
                </p>
              </div>
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: '#f8f5ef' }}
              >
                <p className="text-xs mb-1" style={{ color: '#a09d98' }}>
                  Status
                </p>
                <p className="text-base font-semibold" style={{ color: '#0a0a0a' }}>
                  {STATUS_LABELS[subscription.status] ?? subscription.status}
                </p>
              </div>
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: '#f8f5ef' }}
              >
                <p className="text-xs mb-1" style={{ color: '#a09d98' }}>
                  Posts / plataforma / mês
                </p>
                <p className="text-base font-semibold" style={{ color: '#0a0a0a' }}>
                  {PLAN_LIMITS[subscription.plan].posts_per_platform_per_month}
                </p>
              </div>
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: '#f8f5ef' }}
              >
                <p className="text-xs mb-1" style={{ color: '#a09d98' }}>
                  Próxima cobrança
                </p>
                <p className="text-base font-semibold" style={{ color: '#0a0a0a' }}>
                  {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            {subscription.cancel_at_period_end && (
              <p className="text-sm" style={{ color: '#c0392b' }}>
                Sua assinatura será cancelada ao final do período atual.
              </p>
            )}

            <button
              onClick={handlePortal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-[0.97]"
              style={{
                backgroundColor: '#0a0a0a',
                color: '#f8f5ef',
                fontFamily: 'var(--font-body)',
              }}
            >
              <ExternalLink size={14} strokeWidth={2} />
              Gerenciar assinatura
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
