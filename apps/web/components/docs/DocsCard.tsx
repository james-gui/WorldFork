import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

interface DocsCardProps {
  title: string;
  description: string;
  href: string;
  icon?: React.ReactNode;
}

export function DocsCard({ title, description, href, icon }: DocsCardProps) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
        <CardHeader className="pb-2">
          {icon && (
            <div className="mb-1 text-primary">{icon}</div>
          )}
          <CardTitle className="flex items-center justify-between text-base">
            {title}
            <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>{description}</CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
