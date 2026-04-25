import * as React from 'react';

// Decorative static SVG node-graph for the hero preview card.
// 10 nodes + edges, no interactivity needed.

const NODES = [
  { id: 'n1', x: 60, y: 40, r: 8, color: '#818cf8' },
  { id: 'n2', x: 130, y: 25, r: 6, color: '#a5b4fc' },
  { id: 'n3', x: 200, y: 55, r: 10, color: '#6366f1' },
  { id: 'n4', x: 170, y: 110, r: 7, color: '#c7d2fe' },
  { id: 'n5', x: 90, y: 95, r: 9, color: '#4f46e5' },
  { id: 'n6', x: 240, y: 100, r: 6, color: '#818cf8' },
  { id: 'n7', x: 40, y: 115, r: 5, color: '#e0e7ff' },
  { id: 'n8', x: 145, y: 140, r: 7, color: '#6366f1' },
  { id: 'n9', x: 220, y: 155, r: 5, color: '#a5b4fc' },
  { id: 'n10', x: 75, y: 155, r: 6, color: '#4338ca' },
];

const EDGES = [
  ['n1', 'n2'],
  ['n1', 'n5'],
  ['n2', 'n3'],
  ['n3', 'n4'],
  ['n3', 'n6'],
  ['n4', 'n5'],
  ['n5', 'n7'],
  ['n5', 'n8'],
  ['n4', 'n8'],
  ['n6', 'n9'],
  ['n8', 'n9'],
  ['n7', 'n10'],
  ['n8', 'n10'],
];

function nodeById(id: string) {
  return NODES.find((n) => n.id === id)!;
}

export function MiniNetwork() {
  return (
    <svg
      viewBox="0 0 280 180"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="netGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect width="280" height="180" rx="8" fill="url(#netGrad)" />
      {EDGES.map(([a, b]) => {
        const na = nodeById(a);
        const nb = nodeById(b);
        return (
          <line
            key={`${a}-${b}`}
            x1={na.x}
            y1={na.y}
            x2={nb.x}
            y2={nb.y}
            stroke="#818cf8"
            strokeWidth="1"
            strokeOpacity="0.45"
          />
        );
      })}
      {NODES.map((n) => (
        <circle
          key={n.id}
          cx={n.x}
          cy={n.y}
          r={n.r}
          fill={n.color}
          fillOpacity="0.9"
        />
      ))}
    </svg>
  );
}
