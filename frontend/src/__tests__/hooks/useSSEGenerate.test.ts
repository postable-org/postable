import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll import after the mock is set up
let useSSEGenerate: typeof import('@/lib/hooks/useSSEGenerate').useSSEGenerate;

// ---- MockEventSource ----
type EventHandler = ((event: MessageEvent | Event) => void) | null;

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  onmessage: EventHandler = null;
  onerror: EventHandler = null;
  onopen: EventHandler = null;
  private listeners: Record<string, ((event: MessageEvent | Event) => void)[]> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (event: MessageEvent | Event) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  removeEventListener(type: string, handler: (event: MessageEvent | Event) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((h) => h !== handler);
    }
  }

  close() {
    this.closed = true;
  }

  // Test helpers
  simulateMessage(data: string) {
    const event = { data } as MessageEvent;
    if (this.onmessage) this.onmessage(event);
    (this.listeners['message'] ?? []).forEach((h) => h(event));
  }

  simulateNamedEvent(type: string, data: string) {
    const event = { data } as MessageEvent;
    (this.listeners[type] ?? []).forEach((h) => h(event));
  }

  simulateError(message = 'Connection failed') {
    const event = { data: message } as MessageEvent;
    (this.listeners['error'] ?? []).forEach((h) => h(event));
    if (this.onerror) this.onerror(event);
  }

  simulateNativeError() {
    const event = new Event('error');
    if (this.onerror) this.onerror(event);
  }
}

beforeEach(async () => {
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
  // Import after mock is registered
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
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('transitions idle -> connecting -> streaming when start() is called', async () => {
    const { result } = renderHook(() => useSSEGenerate(() => {}));

    expect(result.current.status).toBe('idle');

    await act(async () => {
      result.current.start();
      // Allow async getSession to resolve
      await new Promise((r) => setTimeout(r, 10));
    });

    // After start, should be connecting or streaming (EventSource opened)
    expect(['connecting', 'streaming']).toContain(result.current.status);
    expect(MockEventSource.instances.length).toBeGreaterThan(0);
  });

  it('accumulates messages from data events', async () => {
    const { result } = renderHook(() => useSSEGenerate(() => {}));

    await act(async () => {
      result.current.start();
      await new Promise((r) => setTimeout(r, 10));
    });

    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateMessage('Buscando tendências...');
    });
    expect(result.current.messages).toContain('Buscando tendências...');

    act(() => {
      es.simulateMessage('Gerando conteúdo...');
    });
    expect(result.current.messages).toContain('Buscando tendências...');
    expect(result.current.messages).toContain('Gerando conteúdo...');
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

    const onComplete = vi.fn();
    const { result } = renderHook(() => useSSEGenerate(onComplete));

    await act(async () => {
      result.current.start();
      await new Promise((r) => setTimeout(r, 10));
    });

    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateMessage(JSON.stringify(postContent));
    });

    act(() => {
      es.simulateNamedEvent('done', 'null');
    });

    expect(result.current.status).toBe('complete');
    expect(onComplete).toHaveBeenCalledWith(postContent);
    expect(es.closed).toBe(true);
  });

  it('sets status=error and closes EventSource on error event', async () => {
    const { result } = renderHook(() => useSSEGenerate(() => {}));

    await act(async () => {
      result.current.start();
      await new Promise((r) => setTimeout(r, 10));
    });

    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateError('Something went wrong');
    });

    expect(result.current.status).toBe('error');
    expect(es.closed).toBe(true);
  });

  it('cleans up EventSource on unmount', async () => {
    const { result, unmount } = renderHook(() => useSSEGenerate(() => {}));

    await act(async () => {
      result.current.start();
      await new Promise((r) => setTimeout(r, 10));
    });

    const es = MockEventSource.instances[0];
    unmount();

    expect(es.closed).toBe(true);
  });
});
