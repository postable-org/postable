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

interface BusinessProfile {
  niche: string;
  city: string;
  state: string;
  tone: string;
  brand_identity: string;
  asset_urls?: string[];
}

interface CampaignBrief {
  goal: string;
  target_audience: string;
  cta_channel: string;
  theme_hint: string | null;
}

export interface GenerateRequest {
  business_profile: BusinessProfile;
  competitor_handles: string[];
  post_history: string[];
  campaign_brief: CampaignBrief;
}

export interface UseSSEGenerateResult {
  status: SSEStatus;
  stageState: StageState;
  progressMessage: string;
  error: string | null;
  start: (payload: GenerateRequest) => void;
  reset: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  'competitor-analysis': 'Analisando concorrentes',
  'trend-analysis': 'Identificando tendências',
  'strategy': 'Criando estratégia',
  'image-generation': 'Gerando imagem',
  'caption': 'Escrevendo legenda',
};

const STEP_TO_STAGE: Record<string, GenerationStage> = {
  fetching_trends: 'trend-analysis',
  analyzing_competitors: 'competitor-analysis',
  generating_image: 'image-generation',
};

export function useSSEGenerate(onComplete: (content: PostContent) => void): UseSSEGenerateResult {
  const [status, setStatus] = useState<SSEStatus>('idle');
  const [stageState, setStageState] = useState<StageState>({ stage: null, status: null, message: '' });
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const finalResponseRef = useRef<PostContent | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setStageState({ stage: null, status: null, message: '' });
    setProgressMessage('');
    setError(null);
    finalResponseRef.current = null;
  }, []);

  const start = useCallback((payload: GenerateRequest) => {
    abortRef.current?.abort();
    finalResponseRef.current = null;
    setStageState({ stage: null, status: null, message: '' });
    setProgressMessage('Iniciando...');
    setError(null);
    setStatus('connecting');

    const controller = new AbortController();
    abortRef.current = controller;

    const handleData = (eventType: string, dataStr: string) => {
      if (eventType === 'done') {
        setStatus('complete');
        if (dataStr && dataStr !== 'null') {
          try {
            const parsed = JSON.parse(dataStr) as PostContent;
            onCompleteRef.current(parsed);
            return;
          } catch { /* fall through */ }
        }
        const final = finalResponseRef.current;
        if (final) onCompleteRef.current(final);
        return;
      }

      if (eventType === 'error') {
        console.error('[SSE generate] error event:', dataStr);
        setError(dataStr || 'Falha na geração');
        setStatus('error');
        return;
      }

      if (eventType === 'progress') {
        try {
          const parsed = JSON.parse(dataStr) as Record<string, unknown>;
          const stage = parsed.stage as string;
          if (parsed.status === 'complete') {
            setProgressMessage(STAGE_LABELS[stage] ? `${STAGE_LABELS[stage]} ✓` : '');
          }
        } catch { /* ignore */ }
        return;
      }

      // Default (no named event): treat as data message
      const raw = dataStr;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        if (parsed.event === 'error') {
          const msg = (parsed.message as string) || 'Falha na geração';
          console.error('[SSE generate] agent error event:', msg);
          setError(msg);
          setStatus('error');
          return;
        }

        if (parsed.event === 'status') {
          const step = parsed.step as string;
          const stage = STEP_TO_STAGE[step] ?? null;
          const msg = (parsed.message as string) || STAGE_LABELS[stage ?? ''] || '';
          setStageState({ stage, status: 'started', message: msg });
          setProgressMessage(msg);
          return;
        }

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
          return;
        }

        if (parsed.event === 'result' || parsed.post_text !== undefined) {
          finalResponseRef.current = parsed as unknown as PostContent;
          setProgressMessage('Post gerado!');
        }
      } catch {
        if (raw.trim()) setProgressMessage(raw.trim());
      }
    };

    (async () => {
      let response: Response;
      try {
        response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError('Erro de conexão — verifique se o backend está rodando e se você tem um perfil de marca configurado.');
        setStatus('error');
        return;
      }

      if (!response.ok) {
        let msg = 'Falha na geração';
        try {
          const json = await response.json() as { error?: string };
          if (json.error) msg = json.error;
        } catch { /* ignore */ }
        setError(msg);
        setStatus('error');
        return;
      }

      setStatus('streaming');

      const reader = response.body?.getReader();
      if (!reader) {
        setError('Falha na geração');
        setStatus('error');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();
              handleData(currentEvent || '', dataStr);
              currentEvent = '';
            } else if (line === '') {
              currentEvent = '';
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError('Erro de conexão — verifique se o backend está rodando e se você tem um perfil de marca configurado.');
        setStatus('error');
      } finally {
        reader.releaseLock();
      }
    })();
  }, []);

  return { status, stageState, progressMessage, error, start, reset };
}
