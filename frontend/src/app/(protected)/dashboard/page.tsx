'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getPosts } from '@/lib/api/posts';
import type { Post, PostContent } from '@/lib/api/posts';
import { GenerateButton } from '@/components/dashboard/GenerateButton';
import { CompetitorSettingsCard } from '@/components/dashboard/CompetitorSettingsCard';
import { PostCalendar } from '@/components/dashboard/PostCalendar';

export default function DashboardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const triggerGenerateRef = useRef<(() => void) | null>(null);

  // Load posts on mount
  useEffect(() => {
    getPosts()
      .then(setPosts)
      .catch(() => {
        // silently ignore if backend is unavailable
      });
  }, []);

  const handleGenerated = useCallback(async (content: PostContent) => {
    // Optimistic entry while waiting for server refresh
    const optimistic: Post = {
      id: Date.now().toString(),
      user_id: '',
      brand_id: '',
      status: 'pending',
      content_json: content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setPosts((prev) => [optimistic, ...prev]);

    // Refresh from server to replace optimistic entry
    try {
      const fresh = await getPosts();
      setPosts(fresh);
    } catch {
      // keep optimistic entry if server is unavailable
    }
  }, []);

  const handleStatusChange = useCallback((id: string, status: 'approved' | 'rejected') => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status, updated_at: new Date().toISOString() } : p))
    );
  }, []);

  const handleRegenerate = useCallback((id: string) => {
    // Remove the rejected post from local state
    setPosts((prev) => prev.filter((p) => p.id !== id));
    // Trigger generation
    if (triggerGenerateRef.current) {
      triggerGenerateRef.current();
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border px-8 py-4 flex items-center justify-between">
        <span
          className="text-lg font-bold"
          style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
        >
          Postable
        </span>
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">U</span>
        </div>
      </nav>

      <main className="px-8 py-12 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
          >
            Dashboard
          </h1>
          <GenerateButton
            onGenerated={handleGenerated}
            triggerRef={triggerGenerateRef}
          />
        </div>

        <CompetitorSettingsCard />

        <PostCalendar
          posts={posts}
          onStatusChange={handleStatusChange}
          onRegenerate={handleRegenerate}
        />
      </main>
    </div>
  );
}
