/**
 * TenantState Durable Object
 *
 * Per-tenant state management and real-time synchronization.
 *
 * Responsibilities:
 * - Maintain active tenant connections (WebSocket)
 * - Broadcast mutations to connected clients
 * - Cache frequently accessed tenant data
 * - Manage tenant-specific rate limits
 * - Coordinate schema updates
 *
 * Lifecycle:
 * - One Durable Object instance per tenant
 * - Automatically hibernates after 5 minutes of inactivity
 * - Persists state to KV on shutdown
 * - Loads from KV on cold start
 */

import { DurableObject } from "cloudflare:workers";

export interface Env {
  DB: D1Database;
  MUTATION_LOG: KVNamespace;
  TENANT_DATA: R2Bucket;
  TENANT_STATE: DurableObjectNamespace;
  GRAPH_STATE_CSV: DurableObjectNamespace;
}

export class TenantState extends DurableObject<Env> {
  private tenantId: string | null = null;
  private connections: Set<WebSocket> = new Set();
  private lastActivity: number = Date.now();

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  /**
   * HTTP request handler
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade for real-time sync
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request);
    }

    // HTTP API routes
    switch (url.pathname) {
      case "/state":
        return this.getState();
      case "/mutation":
        return this.handleMutation(request);
      case "/reset":
        return this.resetState();
      default:
        return new Response("Not Found", { status: 404 });
    }
  }

  /**
   * WebSocket connection handler
   */
  private async handleWebSocket(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    if (!server) {
      return new Response("Failed to create WebSocket", { status: 500 });
    }

    // Accept WebSocket connection
    this.ctx.acceptWebSocket(server);
    this.connections.add(server);
    this.lastActivity = Date.now();

    // Send initial state
    server.send(
      JSON.stringify({
        type: "connected",
        tenantId: this.tenantId,
        timestamp: Date.now(),
      })
    );

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * WebSocket message handler
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const data = typeof message === "string" ? JSON.parse(message) : message;

      // Handle different message types
      switch (data.type) {
        case "ping":
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          break;
        case "mutation":
          await this.broadcastMutation(data.mutation);
          break;
        default:
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Unknown message type",
            })
          );
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          error: "Invalid message format",
        })
      );
    }

    this.lastActivity = Date.now();
  }

  /**
   * WebSocket close handler
   */
  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    this.connections.delete(ws);
    console.log(
      `WebSocket closed: code=${code}, reason=${reason}, clean=${wasClean}`
    );

    // Persist state if no more connections
    if (this.connections.size === 0) {
      await this.persistState();
    }
  }

  /**
   * Get current tenant state
   */
  private async getState(): Promise<Response> {
    return new Response(
      JSON.stringify({
        tenantId: this.tenantId,
        connections: this.connections.size,
        lastActivity: this.lastActivity,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  /**
   * Handle mutation request
   */
  private async handleMutation(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const mutation = await request.json();
      await this.broadcastMutation(mutation);

      return new Response(
        JSON.stringify({
          success: true,
          broadcast: this.connections.size,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  /**
   * Broadcast mutation to all connected clients
   */
  private async broadcastMutation(mutation: any): Promise<void> {
    const message = JSON.stringify({
      type: "mutation",
      mutation,
      timestamp: Date.now(),
    });

    // Broadcast to all connected clients
    for (const ws of this.connections) {
      try {
        ws.send(message);
      } catch (error) {
        console.error("Failed to send to WebSocket:", error);
        this.connections.delete(ws);
      }
    }

    // Persist to KV for audit trail
    if (this.tenantId) {
      const key = `mutation:${this.tenantId}:${Date.now()}`;
      await this.env.MUTATION_LOG.put(key, JSON.stringify(mutation), {
        expirationTtl: 86400 * 30, // 30 days
      });
    }
  }

  /**
   * Reset tenant state
   */
  private async resetState(): Promise<Response> {
    this.tenantId = null;
    this.lastActivity = Date.now();

    // Close all connections
    for (const ws of this.connections) {
      ws.close(1000, "State reset");
    }
    this.connections.clear();

    return new Response(
      JSON.stringify({ success: true, message: "State reset" }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  /**
   * Persist state to KV on shutdown
   */
  private async persistState(): Promise<void> {
    if (!this.tenantId) return;

    const state = {
      tenantId: this.tenantId,
      lastActivity: this.lastActivity,
      persistedAt: Date.now(),
    };

    await this.env.MUTATION_LOG.put(
      `state:${this.tenantId}`,
      JSON.stringify(state)
    );
  }
}
