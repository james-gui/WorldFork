import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  href: string;
  linkLabel?: string;
}

export function FeatureCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  href,
  linkLabel = 'Explore',
}: FeatureCardProps) {
  return (
    <div className="group rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md flex flex-col">
      <div
        className={cn(
          'h-10 w-10 rounded-lg flex items-center justify-center mb-4 flex-shrink-0',
          iconBg,
          iconColor,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground flex-1">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
      >
        {linkLabel}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
