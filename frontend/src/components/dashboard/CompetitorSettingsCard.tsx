'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  getCompetitors,
  updateCompetitors,
  type Competitor,
  type CompetitorOperation,
  type CompetitorReplacementNotice,
} from '@/lib/api/competitors';

function normalizeHandle(raw: string) {
  const normalized = raw.trim().replace(/^@+/, '').toLowerCase();
  return normalized ? `@${normalized}` : '';
}

function formatReason(reason: string) {
  return reason.replaceAll('_', ' ');
}

export function CompetitorSettingsCard() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [replacements, setReplacements] = useState<CompetitorReplacementNotice[]>([]);
  const [newHandle, setNewHandle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompetitors = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCompetitors();
      setCompetitors(response.competitors);
      setActiveCount(response.active_count);
    } catch {
      setError('Nao foi possivel carregar os concorrentes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCompetitors();
  }, []);

  const applyOps = async (ops: CompetitorOperation[]) => {
    setSaving(true);
    setError(null);
    try {
      const response = await updateCompetitors(ops);
      setCompetitors(response.competitors);
      setActiveCount(response.active_count);
      setReplacements(response.replacements ?? []);
    } catch {
      setError('Nao foi possivel atualizar os concorrentes.');
    } finally {
      setSaving(false);
    }
  };

  const activeCompetitors = useMemo(
    () => competitors.filter((competitor) => competitor.status === 'active'),
    [competitors]
  );

  const handleAddCompetitor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const handle = normalizeHandle(newHandle);
    if (!handle) return;
    await applyOps([{ type: 'add', handle }]);
    setNewHandle('');
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Concorrentes monitorados</CardTitle>
          <Badge variant="outline">Ativos: {activeCount}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Ajuste sua base de concorrentes para melhorar os insights e trocar angulos com mais confianca.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <form className="flex flex-wrap gap-2" onSubmit={handleAddCompetitor}>
          <Input
            value={newHandle}
            onChange={(event) => setNewHandle(event.target.value)}
            placeholder="@nome_do_concorrente"
            className="max-w-xs"
            disabled={saving}
          />
          <Button type="submit" size="sm" disabled={saving}>
            Adicionar
          </Button>
        </form>

        {loading && <p className="text-sm text-muted-foreground">Carregando concorrentes...</p>}
        {!loading && error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && (
          <>
            {activeCompetitors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum concorrente ativo no momento.</p>
            ) : (
              <div className="space-y-2">
                {competitors.map((competitor) => (
                  <div key={competitor.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{competitor.handle}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline">Origem: {competitor.source}</Badge>
                          <Badge variant="outline">Status: {competitor.status}</Badge>
                          {competitor.is_locked && <Badge variant="outline">Bloqueado</Badge>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={saving || competitor.status !== 'active'}
                          onClick={() =>
                            void applyOps([
                              {
                                type: competitor.is_locked ? 'unlock' : 'lock',
                                handle: competitor.handle,
                              },
                            ])
                          }
                        >
                          {competitor.is_locked ? 'Desbloquear concorrente' : 'Bloquear concorrente'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={saving || competitor.status !== 'active'}
                          onClick={() =>
                            void applyOps([
                              {
                                type: 'remove',
                                handle: competitor.handle,
                              },
                            ])
                          }
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {replacements.length > 0 && (
          <section className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <h3 className="text-sm font-medium text-amber-900">Substituicoes automaticas</h3>
            <ul className="space-y-1 text-sm text-amber-900">
              {replacements.map((replacement, index) => (
                <li key={`${replacement.handle}-${replacement.replacement_handle}-${index}`}>
                  {replacement.handle} foi substituido por {replacement.replacement_handle} ({formatReason(replacement.reason)}).
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
