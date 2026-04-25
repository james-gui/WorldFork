'use client';

type Handler<T = unknown> = (msg: T) => void;

interface Subscription {
  topic: string;
  handler: Handler;
}

interface Connection {
  ws: WebSocket | null;
  url: string;
  refCount: number;
  reconnectDelay: number;
  shouldReconnect: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

const BASE_DELAY = 1000;
const MAX_DELAY = 30_000;

export class WSClient {
  private connections = new Map<string, Connection>();
  private subscriptions: Subscription[] = [];

  connect(url: string, token?: string) {
    const fullUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
    const existing = this.connections.get(fullUrl);
    if (existing) {
      existing.refCount += 1;
      existing.shouldReconnect = true;
      return fullUrl;
    }

    const connection: Connection = {
      ws: null,
      url: fullUrl,
      refCount: 1,
      reconnectDelay: BASE_DELAY,
      shouldReconnect: true,
      reconnectTimer: null,
    };
    this.connections.set(fullUrl, connection);
    this._open(connection);
    return fullUrl;
  }

  private _open(connection: Connection) {
    if (typeof window === 'undefined') return;
    connection.ws = new WebSocket(connection.url);

    connection.ws.onopen = () => {
      connection.reconnectDelay = BASE_DELAY;
    };

    connection.ws.onmessage = (event: MessageEvent) => {
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

    connection.ws.onclose = () => {
      if (connection.shouldReconnect) {
        connection.reconnectTimer = setTimeout(() => {
          connection.reconnectDelay = Math.min(connection.reconnectDelay * 2, MAX_DELAY);
          this._open(connection);
        }, connection.reconnectDelay);
      }
    };

    connection.ws.onerror = () => {
      connection.ws?.close();
    };
  }

  subscribe<T = unknown>(topic: string, handler: Handler<T>): () => void {
    const sub: Subscription = { topic, handler: handler as Handler };
    this.subscriptions.push(sub);
    return () => {
      this.subscriptions = this.subscriptions.filter((s) => s !== sub);
    };
  }

  disconnect(url: string) {
    const connection = this.connections.get(url);
    if (!connection) return;
    connection.refCount -= 1;
    if (connection.refCount > 0) return;
    connection.shouldReconnect = false;
    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer);
      connection.reconnectTimer = null;
    }
    connection.ws?.close();
    this.connections.delete(url);
  }

  close() {
    for (const connection of this.connections.values()) {
      connection.shouldReconnect = false;
      if (connection.reconnectTimer) {
        clearTimeout(connection.reconnectTimer);
        connection.reconnectTimer = null;
      }
      connection.ws?.close();
    }
    this.connections.clear();
    this.subscriptions = [];
  }
}

// Singleton instance
export const wsClient = typeof window !== 'undefined' ? new WSClient() : null;
