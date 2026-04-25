import * as React from 'react';
import { Hero } from '@/components/marketing/Hero';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';

// Page 01 — Landing
// Layout shell (MarketingNav + MarketingFooter) is provided by (marketing)/layout.tsx.
export default function LandingPage() {
  return (
    <div className="flex flex-col">
      <Hero />
      <FeatureGrid />
    </div>
  );
}
