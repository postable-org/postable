'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PostInsights } from '@/lib/api/posts';

interface InsightsPanelProps {
  open: boolean;
  insights: PostInsights | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onRegenerateWithDifferentAngle: () => void;
}

function toPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSelectionMode(selectionMode: PostInsights['selection_mode']) {
  return selectionMode === 'gap_first' ? 'Gap-first' : 'Trend fallback';
}

function formatFallbackReason(reason: string) {
  return reason.replaceAll('_', ' ');
}

export function InsightsPanel({
  open,
  insights,
  loading,
  error,
  onClose,
  onRetry,
  onRegenerateWithDifferentAngle,
}: InsightsPanelProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/35"
      role="dialog"
      aria-modal="true"
      aria-label="Insights do post"
    >
      <button
        type="button"
        aria-label="Fechar insights"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <Card className="relative h-full w-full max-w-xl overflow-y-auto rounded-none border-0 border-l">
        <CardHeader className="space-y-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Insights da sugestao</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Entenda por que este angulo foi escolhido e decida se quer regenerar.
          </p>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          {loading && <p className="text-sm text-muted-foreground">Carregando insights...</p>}

          {!loading && error && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                Tentar novamente
              </Button>
            </div>
          )}

          {!loading && !error && !insights && (
            <p className="text-sm text-muted-foreground">
              Este post ainda nao possui insights estruturados disponiveis.
            </p>
          )}

          {!loading && !error && insights && (
            <>
              <section className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tema principal</h3>
                <p className="text-sm font-medium">{insights.primary_gap_theme || 'Nao informado'}</p>
              </section>

              <section className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por que agora</h3>
                <p className="text-sm">{insights.why_now_summary || 'Sem resumo disponivel.'}</p>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sinais-chave</h3>
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">Gap coverage</p>
                    <p className="font-medium">{toPercent(insights.key_signals.gap_strength)}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">Trend momentum</p>
                    <p className="font-medium">{toPercent(insights.key_signals.trend_momentum)}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">Brand fit</p>
                    <p className="font-medium">{toPercent(insights.key_signals.brand_fit)}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Concorrentes considerados</h3>
                {insights.competitors_considered.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {insights.competitors_considered.map((handle) => (
                      <Badge key={handle} variant="outline">
                        {handle}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum concorrente informado.</p>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contexto da decisao</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Modo: {formatSelectionMode(insights.selection_mode)}</Badge>
                  <Badge variant="outline">Confianca: {insights.confidence_band}</Badge>
                </div>
              </section>

              {insights.selection_mode === 'trend_fallback' && (
                <section className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">Fallback aplicado: nenhum gap forte foi encontrado.</p>
                  <p className="mt-1">
                    Motivo: {formatFallbackReason(insights.fallback_reason || 'sem detalhe adicional')}
                  </p>
                </section>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" onClick={onRegenerateWithDifferentAngle}>
                  Regenerar com outro angulo
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
