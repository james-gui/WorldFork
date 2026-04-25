'use client';

type Handler<T = unknown> = (msg: T) => void;

interface Subscription {
  topic: string;
  handler: Handler;
}

const BASE_DELAY = 1000;
const MAX_DELAY = 30_000;

export class WSClient {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private subscriptions: Subscription[] = [];
  private reconnectDelay = BASE_DELAY;
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(url: string, token?: string) {
    const fullUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
    this.url = fullUrl;
    this.shouldReconnect = true;
    this._open(fullUrl);
  }

  private _open(url: string) {
    if (typeof window === 'undefined') return;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectDelay = BASE_DELAY;
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string);
        const topic: string = msg.topic ?? msg.type ?? '';
        for (const sub of this.subscriptions) {
          if (topic.startsWith(sub.topic) || sub.topic === '*') {
            sub.handler(msg);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      if (this.shouldReconnect && this.url) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_DELAY);
          if (this.url) this._open(this.url);
        }, this.reconnectDelay);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  subscribe<T = unknown>(topic: string, handler: Handler<T>): () => void {
    const sub: Subscription = { topic, handler: handler as Handler };
    this.subscriptions.push(sub);
    return () => {
      this.subscriptions = this.subscriptions.filter((s) => s !== sub);
    };
  }

  close() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.subscriptions = [];
  }
}

// Singleton instance
export const wsClient = typeof window !== 'undefined' ? new WSClient() : null;
