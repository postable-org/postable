'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PostContent } from '@/lib/api/posts';

export type SSEStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';

export interface UseSSEGenerateResult {
  status: SSEStatus;
  messages: string[];
  error: string | null;
  start: (platform?: string) => void;
  reset: () => void;
}

export function useSSEGenerate(onComplete: (content: PostContent) => void): UseSSEGenerateResult {
  const [status, setStatus] = useState<SSEStatus>('idle');
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const lastMessageRef = useRef<string>('');
  const onCompleteRef = useRef(onComplete);

  // Keep the callback ref up-to-date without re-triggering effects
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setStatus('idle');
    setMessages([]);
    setError(null);
    lastMessageRef.current = '';
  }, []);

  const start = useCallback((platform: string = 'instagram') => {
    // Clean up any existing connection
    esRef.current?.close();
    lastMessageRef.current = '';
    setMessages([]);
    setError(null);
    setStatus('connecting');

    const es = new EventSource(`/api/generate?platform=${encodeURIComponent(platform)}`);
    esRef.current = es;

    setStatus('streaming');

    es.onmessage = (event: MessageEvent) => {
      const data = event.data as string;
      lastMessageRef.current = data;
      setMessages((prev) => [...prev, data]);
    };

    es.addEventListener('done', () => {
      es.close();
      setStatus('complete');
      if (lastMessageRef.current) {
        try {
          const content = JSON.parse(lastMessageRef.current) as PostContent;
          onCompleteRef.current(content);
        } catch {
          // ignore parse errors
        }
      }
    });

    es.addEventListener('error', (event: Event | MessageEvent) => {
      es.close();
      setStatus('error');
      const msg = 'data' in event ? (event as MessageEvent).data : 'Generation failed';
      setError(msg || 'Generation failed');
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        return; // already handled
      }
      es.close();
      setStatus('error');
      setError('Connection error');
    };
  }, []);

  return { status, messages, error, start, reset };
}
