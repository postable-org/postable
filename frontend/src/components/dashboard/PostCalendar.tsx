'use client';

import type { Post } from '@/lib/api/posts';
import { PostCard } from './PostCard';

interface PostCalendarProps {
  posts: Post[];
  onStatusChange: (id: string, status: 'approved' | 'rejected') => void;
  onRegenerate: (id: string) => void;
}

function groupByDate(posts: Post[]): Record<string, Post[]> {
  const groups: Record<string, Post[]> = {};
  for (const post of posts) {
    const date = new Date(post.created_at).toLocaleDateString('pt-BR');
    if (!groups[date]) groups[date] = [];
    groups[date].push(post);
  }
  return groups;
}

export function PostCalendar({ posts, onStatusChange, onRegenerate }: PostCalendarProps) {
  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">
          Nenhum post gerado ainda. Clique em Gerar Novo Post para começar.
        </p>
      </div>
    );
  }

  const grouped = groupByDate(posts);
  // posts are already ordered newest-first from the API; get unique dates in insertion order
  const dates = Array.from(new Set(posts.map((p) => new Date(p.created_at).toLocaleDateString('pt-BR'))));

  return (
    <div className="space-y-8">
      {dates.map((date) => (
        <section key={date}>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {date}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[date].map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onStatusChange={onStatusChange}
                onRegenerate={onRegenerate}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
