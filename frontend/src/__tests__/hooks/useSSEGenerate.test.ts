import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GenerateRequest } from '@/lib/hooks/useSSEGenerate';

// We'll import after the mock is set up
let useSSEGenerate: typeof import('@/lib/hooks/useSSEGenerate').useSSEGenerate;

const minimalPayload: GenerateRequest = {
  business_profile: { niche: 'food', city: 'SP', state: 'SP', tone: 'friendly', brand_identity: 'test' },
  competitor_handles: [],
  post_history: [],
  campaign_brief: { goal: '', target_audience: '', cta_channel: 'dm', theme_hint: null },
  platform: 'instagram',
};

function makeControllableSSEResponse() {
  const encoder = new TextEncoder();
  let ctrl: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(c) { ctrl = c; } });
  return {
    response: new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    push: (text: string) => ctrl.enqueue(encoder.encode(text)),
    close: () => ctrl.close(),
  };
}

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn());
  const mod = await import('@/lib/hooks/useSSEGenerate');
  useSSEGenerate = mod.useSSEGenerate;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('useSSEGenerate', () => {
  it('starts with idle status', () => {
    const { result } = renderHook(() => useSSEGenerate(() => {}));
    expect(result.current.status).toBe('idle');
    expect(result.current.progressMessage).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('transitions idle -> connecting -> streaming when start() is called', async () => {
    const { response, close } = makeControllableSSEResponse();
    vi.mocked(fetch).mockResolvedValue(response);

    const { result } = renderHook(() => useSSEGenerate(() => {}));
    expect(result.current.status).toBe('idle');

    await act(async () => {
      result.current.start(minimalPayload);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(['connecting', 'streaming']).toContain(result.current.status);
    close();
  });

  it('updates progressMessage from data events', async () => {
    const { response, push, close } = makeControllableSSEResponse();
    vi.mocked(fetch).mockResolvedValue(response);

    const { result } = renderHook(() => useSSEGenerate(() => {}));

    await act(async () => {
      result.current.start(minimalPayload);
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      push('data: Buscando tendências...\n\n');
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.progressMessage).toBe('Buscando tendências...');

    await act(async () => {
      push('data: Gerando conteúdo...\n\n');
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.progressMessage).toBe('Gerando conteúdo...');

    close();
  });

  it('calls onComplete with parsed PostContent on done event and sets status=complete', async () => {
    const postContent = {
      post_text: 'Test post',
      cta: 'Contact us',
      hashtags: ['#test'],
      suggested_format: 'feed_post',
      strategic_justification: 'Testing',
      tokens_used: 100,
    };

    const { response, push, close } = makeControllableSSEResponse();
    vi.mocked(fetch).mockResolvedValue(response);

    const onComplete = vi.fn();
    const { result } = renderHook(() => useSSEGenerate(onComplete));

    await act(async () => {
      result.current.start(minimalPayload);
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      push(`event: done\ndata: ${JSON.stringify(postContent)}\n\n`);
      close();
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(result.current.status).toBe('complete');
    expect(onComplete).toHaveBeenCalledWith(postContent);
  });

  it('sets status=error and aborts on error event', async () => {
    const { response, push, close } = makeControllableSSEResponse();
    vi.mocked(fetch).mockResolvedValue(response);

    const { result } = renderHook(() => useSSEGenerate(() => {}));

    await act(async () => {
      result.current.start(minimalPayload);
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      push('event: error\ndata: Something went wrong\n\n');
      close();
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.status).toBe('error');
  });

  it('cleans up on unmount without throwing', async () => {
    const { response, close } = makeControllableSSEResponse();
    vi.mocked(fetch).mockResolvedValue(response);

    const { result, unmount } = renderHook(() => useSSEGenerate(() => {}));

    await act(async () => {
      result.current.start(minimalPayload);
      await new Promise((r) => setTimeout(r, 10));
    });

    unmount();
    close();
    // No errors thrown — test passes
  });
});
