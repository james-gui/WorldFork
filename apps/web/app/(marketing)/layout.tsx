import * as React from 'react';
import { MarketingNav } from '@/components/chrome/MarketingNav';
import { MarketingFooter } from '@/components/chrome/MarketingFooter';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
