'use client';

import * as React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Card } from '@/components/ui/card';
import { PostCard } from './PostCard';
import type { MockPost } from '@/lib/mocks/dashboard';

interface LiveSocialFeedProps {
  posts: MockPost[];
  height?: number;
}

export function LiveSocialFeed({ posts, height = 480 }: LiveSocialFeedProps) {
  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Live Social Feed
        </h3>
        <span className="text-xs text-muted-foreground">
          {posts.length} posts
        </span>
      </div>
      <div style={{ height }}>
        <Virtuoso
          data={posts}
          itemContent={(_index, post) => <PostCard post={post} />}
          increaseViewportBy={200}
        />
      </div>
      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground text-center">
        View all posts
      </div>
    </Card>
  );
}
