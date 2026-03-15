'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PostContent } from '@/lib/api/posts';

export type SSEStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';

export type GenerationStage =
  | 'competitor-analysis'
  | 'trend-analysis'
  | 'strategy'
  | 'image-generation'
  | 'caption'
  | null;

export interface StageState {
  stage: GenerationStage;
  status: 'started' | 'complete' | 'skipped' | null;
  message: string;
}

export interface UseSSEGenerateResult {
  status: SSEStatus;
  stageState: StageState;
  progressMessage: string;
  error: string | null;
  start: () => void;
  reset: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  'competitor-analysis': 'Analisando concorrentes',
  'trend-analysis': 'Identificando tendências',
  'strategy': 'Criando estratégia',
  'image-generation': 'Gerando imagem',
  'caption': 'Escrevendo legenda',
};

export function useSSEGenerate(onComplete: (content: PostContent) => void): UseSSEGenerateResult {
  const [status, setStatus] = useState<SSEStatus>('idle');
  const [stageState, setStageState] = useState<StageState>({ stage: null, status: null, message: '' });
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const finalResponseRef = useRef<PostContent | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setStatus('idle');
    setStageState({ stage: null, status: null, message: '' });
    setProgressMessage('');
    setError(null);
    finalResponseRef.current = null;
  }, []);

  const start = useCallback(() => {
    esRef.current?.close();
    finalResponseRef.current = null;
    setStageState({ stage: null, status: null, message: '' });
    setProgressMessage('Iniciando...');
    setError(null);
    setStatus('connecting');

    const es = new EventSource('/api/generate');
    esRef.current = es;
    setStatus('streaming');

    es.onmessage = (event: MessageEvent) => {
      const raw = event.data as string;

      // Try to parse as JSON progress or final response
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        if (parsed.type === 'progress') {
          const stage = parsed.stage as GenerationStage;
          const s = parsed.status as StageState['status'];
          const msg = (parsed.message as string) || STAGE_LABELS[stage ?? ''] || '';

          setStageState({ stage, status: s, message: msg });
          setProgressMessage(msg);
          return;
        }

        if (parsed.type === 'error') {
          const msg = (parsed.message as string) || 'Erro na geração';
          setError(msg);
          setStatus('error');
          es.close();
          return;
        }

        // It's the final response JSON (has post_text field)
        if (parsed.post_text !== undefined) {
          finalResponseRef.current = parsed as unknown as PostContent;
          setProgressMessage('Post gerado!');
        }
      } catch {
        // Non-JSON line — use as display text
        if (raw.trim()) setProgressMessage(raw.trim());
      }
    };

    es.addEventListener('done', () => {
      es.close();
      setStatus('complete');
      const final = finalResponseRef.current;
      if (final) {
        onCompleteRef.current(final);
      }
    });

    es.addEventListener('progress', (event: Event) => {
      // Handle explicit SSE `event: progress` from Go layer
      try {
        const data = (event as MessageEvent).data as string;
        const parsed = JSON.parse(data) as Record<string, unknown>;
        const stage = parsed.stage as string;
        if (parsed.status === 'complete') {
          setProgressMessage(STAGE_LABELS[stage] ? `${STAGE_LABELS[stage]} ✓` : '');
        }
      } catch { /* ignore */ }
    });

    es.addEventListener('error', (event: Event) => {
      es.close();
      setStatus('error');
      const msg = 'data' in event ? (event as MessageEvent).data : null;
      setError(msg || 'Falha na geração');
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) return;
      es.close();
      setStatus('error');
      setError('Erro de conexão');
    };
  }, []);

  return { status, stageState, progressMessage, error, start, reset };
}
