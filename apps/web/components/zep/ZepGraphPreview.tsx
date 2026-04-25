'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Network } from 'lucide-react';

/**
 * Decorative SVG graph preview.
 * B9-B will replace this with a real Sigma/graphology embed.
 */
export function ZepGraphPreview() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Network className="h-4 w-4 text-muted-foreground" />
          Graph Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-48 rounded-lg bg-muted/40 overflow-hidden flex items-center justify-center">
          {/* Decorative SVG graph */}
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full opacity-70"
            aria-label="Decorative graph preview — full graph rendered by B9-B"
          >
            {/* Edges */}
            <line x1="150" y1="90" x2="80"  y2="40"  stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="150" y1="90" x2="220" y2="40"  stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="150" y1="90" x2="60"  y2="140" stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="150" y1="90" x2="240" y2="140" stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="80"  y1="40" x2="220" y2="40"  stroke="#a5b4fc" strokeWidth="1"   strokeOpacity="0.3" />
            <line x1="60"  y1="140" x2="240" y2="140" stroke="#a5b4fc" strokeWidth="1"  strokeOpacity="0.3" />
            <line x1="80"  y1="40" x2="60"  y2="140" stroke="#a5b4fc" strokeWidth="1"   strokeOpacity="0.3" />
            <line x1="220" y1="40" x2="240" y2="140" stroke="#a5b4fc" strokeWidth="1"   strokeOpacity="0.3" />

            {/* Center node */}
            <circle cx="150" cy="90" r="12" fill="#6366f1" fillOpacity="0.9" />
            <text x="150" y="94" textAnchor="middle" fontSize="8" fill="white" fontFamily="sans-serif">Run</text>

            {/* Outer nodes */}
            {[
              { cx: 80,  cy: 40,  label: 'C1' },
              { cx: 220, cy: 40,  label: 'C2' },
              { cx: 60,  cy: 140, label: 'C3' },
              { cx: 240, cy: 140, label: 'C4' },
            ].map(({ cx, cy, label }) => (
              <g key={label}>
                <circle cx={cx} cy={cy} r="9" fill="#818cf8" fillOpacity="0.8" />
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="7" fill="white" fontFamily="sans-serif">
                  {label}
                </text>
              </g>
            ))}

            {/* Small satellite nodes */}
            {[
              { cx: 50,  cy: 70  },
              { cx: 120, cy: 25  },
              { cx: 250, cy: 80  },
              { cx: 170, cy: 155 },
            ].map(({ cx, cy }, i) => (
              <circle key={i} cx={cx} cy={cy} r="5" fill="#c7d2fe" fillOpacity="0.6" />
            ))}
          </svg>

          <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground bg-background/80 px-2 py-0.5 rounded">
            Preview only — real graph in B9-B
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
