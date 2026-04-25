import * as React from 'react';
import { AppSidebar } from '@/components/chrome/AppSidebar';
import { TopBar } from '@/components/chrome/TopBar';
import { WebSocketBridge } from '@/components/chrome/WebSocketBridge';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Skip to content — accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg focus:outline-none"
      >
        Skip to content
      </a>

      {/* Sidebar — hidden on mobile, shown on lg+ */}
      <AppSidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* TopBar mounts keyboard shortcuts + command palette + mobile sheet */}
        <TopBar />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-background"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      {/* WS bridge — subscribes based on current route params */}
      <WebSocketBridge />
    </div>
  );
}
