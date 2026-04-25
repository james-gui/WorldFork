'use client';

import * as React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { MockPost } from '@/lib/mocks/dashboard';

interface PostCardProps {
  post: MockPost;
}

function PostCardImpl({ post }: PostCardProps) {
  const initials = post.authorName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <article className="flex gap-3 px-4 py-3 border-b border-border hover:bg-muted/40 transition-colors">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback
          className="text-[11px] font-semibold text-white"
          style={{ backgroundColor: post.avatarColor }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">
            {post.authorName}
          </span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 capitalize"
          >
            {post.authorRole}
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {post.timestamp}
          </span>
        </div>
        <p className="text-sm text-foreground mt-1 line-clamp-3">
          {post.content}
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {post.reactions.map((r) => (
            <span
              key={r.kind}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              <span className="capitalize">{r.kind}</span>
              <span className="tabular-nums font-medium text-foreground">
                {r.count}
              </span>
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

export const PostCard = React.memo(PostCardImpl);
