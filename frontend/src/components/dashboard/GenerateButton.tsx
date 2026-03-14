'use client';

import { useSSEGenerate } from '@/lib/hooks/useSSEGenerate';
import type { PostContent } from '@/lib/api/posts';
import { Button } from '@/components/ui/button';

interface GenerateButtonProps {
  onGenerated: (content: PostContent) => void;
  triggerRef?: React.MutableRefObject<(() => void) | null>;
}

export function GenerateButton({ onGenerated, triggerRef }: GenerateButtonProps) {
  const { status, messages, error, start, reset } = useSSEGenerate(onGenerated);

  // Expose start() via triggerRef so parent can trigger programmatically (for regenerate)
  if (triggerRef) {
    triggerRef.current = start;
  }

  const isActive = status === 'connecting' || status === 'streaming';
  const latestMessage = messages[messages.length - 1] ?? '';

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-destructive">{error ?? 'Erro ao gerar post. Tente novamente.'}</p>
        <Button variant="outline" onClick={reset}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={start}
        disabled={isActive}
        className="min-w-[160px]"
      >
        {isActive ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {latestMessage || 'Gerando...'}
          </span>
        ) : (
          'Gerar Novo Post'
        )}
      </Button>
    </div>
  );
}
