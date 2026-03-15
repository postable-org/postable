'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPostInsights, updatePostStatus, PlanUpgradeRequiredError } from '@/lib/api/posts';
import type { Post, PostInsights } from '@/lib/api/posts';
import { InsightsPanel } from './InsightsPanel';

interface PostCardProps {
  post: Post;
  onStatusChange: (id: string, status: 'approved' | 'rejected') => void;
  onRegenerate: (id: string) => void;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? 'Copiado!' : label}
    </Button>
  );
}

function StatusBadge({ status }: { status: Post['status'] }) {
  if (status === 'pending') {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
        Pendente
      </Badge>
    );
  }
  if (status === 'approved') {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-300">
        Aprovado
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800 border-red-300">
      Rejeitado
    </Badge>
  );
}

export function PostCard({ post, onStatusChange, onRegenerate }: PostCardProps) {
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insights, setInsights] = useState<PostInsights | null>(null);
  const [planLocked, setPlanLocked] = useState(false);
  const handleApprove = async () => {
    setLoading(true);
    try {
      await updatePostStatus(post.id, 'approved');
      onStatusChange(post.id, 'approved');
    } catch {
      // TODO: show error
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await updatePostStatus(post.id, 'rejected');
      onStatusChange(post.id, 'rejected');
    } catch {
      // TODO: show error
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = new Date(post.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const loadInsights = async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    setPlanLocked(false);
    try {
      const data = await getPostInsights(post.id);
      setInsights(data);
    } catch (err) {
      if (err instanceof PlanUpgradeRequiredError) {
        setPlanLocked(true);
      } else {
        setInsightsError('Nao foi possivel carregar os insights.');
      }
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleOpenInsights = async () => {
    setPanelOpen(true);
    await loadInsights();
  };

  const handleRegenerateWithDifferentAngle = () => {
    setPanelOpen(false);
    onRegenerate(post.id);
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
            <StatusBadge status={post.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Generated image */}
          {post.image_url && (
            <div className="rounded-md overflow-hidden">
              <img
                src={post.image_url}
                alt="Imagem gerada para o post"
                className="w-full object-cover max-h-64"
              />
            </div>
          )}

          {/* Post text */}
          <p className="text-sm whitespace-pre-wrap">{post.post_text}</p>

          {/* CTA */}
          {post.cta && (
            <p className="text-sm font-medium text-primary">{post.cta}</p>
          )}

          {/* Hashtags */}
          {post.hashtags && post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {post.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Format label */}
          {post.suggested_format && (
            <p className="text-xs text-muted-foreground">
              Formato: <span className="font-medium">{post.suggested_format}</span>
            </p>
          )}

          {/* Placement badge */}
          {post.placement && (
            <span className="text-xs font-medium text-muted-foreground border rounded px-2 py-0.5 inline-block">
              {post.placement.charAt(0).toUpperCase() + post.placement.slice(1)}
              {post.creative_spec?.aspect_ratio ? ` · ${post.creative_spec.aspect_ratio}` : ''}
            </span>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleOpenInsights}
            >
              Ver insights
            </Button>

            {post.status === 'pending' && (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-600 text-white hover:bg-green-700"
                  onClick={handleApprove}
                  disabled={loading}
                >
                  Aprovar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleReject}
                  disabled={loading}
                >
                  Rejeitar
                </Button>
              </>
            )}

            {post.status === 'rejected' && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onRegenerate(post.id)}
              >
                Regenerar
              </Button>
            )}

            {post.status === 'approved' && (
              <>
                <CopyButton
                  text={`${post.post_text}\n\n${post.cta}`}
                  label="Copiar Texto"
                />
                <CopyButton
                  text={post.hashtags.join(' ')}
                  label="Copiar Hashtags"
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <InsightsPanel
        open={panelOpen}
        insights={insights}
        loading={insightsLoading}
        error={insightsError}
        planLocked={planLocked}
        onClose={() => setPanelOpen(false)}
        onRetry={loadInsights}
        onRegenerateWithDifferentAngle={handleRegenerateWithDifferentAngle}
      />
    </>
  );
}
