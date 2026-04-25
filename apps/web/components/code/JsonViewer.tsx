'use client';

import dynamic from 'next/dynamic';
import { loader } from '@monaco-editor/react';

// Configure Monaco to load from CDN to keep bundle small
loader.config({
  paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs' },
});

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface JsonViewerProps {
  value: string;
  height?: string;
  language?: string;
}

export function JsonViewer({ value, height = '60vh', language = 'json' }: JsonViewerProps) {
  return (
    <Editor
      height={height}
      defaultLanguage={language}
      value={value}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        fontSize: 13,
        fontFamily: 'JetBrains Mono, monospace',
        theme: 'vs-dark',
      }}
    />
  );
}
