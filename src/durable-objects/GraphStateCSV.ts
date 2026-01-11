/**
 * GraphStateCSV Durable Object
 *
 * Per-tenant authorization graph state management using CSV as canonical format.
 *
 * Responsibilities:
 * - Load CSV files from R2 on cold start
 * - Validate edge proofs for authorization checks
 * - Track schema version and trigger reloads
 * - Provide O(1) edge lookup for validation
 * - Broadcast graph mutations to connected clients
 *
 * Data Flow:
 * 1. Cold start: Load CSV from R2 (users.csv, groups.csv, etc.)
 * 2. Parse CSV into in-memory lookup tables
 * 3. Serve edge validation requests (O(1) lookup)
 * 4. On mutation: Update in-memory state + broadcast
 * 5. On idle (5 min): Backup state to KV
 *
 * CSV Files (per tenant):
 * - users.csv: User nodes
 * - groups.csv: Group nodes
 * - resources.csv: Resource nodes
 * - member_of.csv: User→Group edges
 * - inherits_from.csv: Group→Group edges
 * - user_permissions.csv: User→Resource edges
 * - group_permissions.csv: Group→Resource edges
 */

import { DurableObject } from "cloudflare:workers";

export interface Env {
  DB: D1Database;
  MUTATION_LOG: KVNamespace;
  TENANT_DATA: R2Bucket;
  TENANT_STATE: DurableObjectNamespace;
  GRAPH_STATE_CSV: DurableObjectNamespace;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
  permission?: string;
  revokedAt: number | null;
}

interface GraphState {
  tenantId: string;
  version: number;
  edges: Map<string, Edge>;
  lastSync: number;
}

export class GraphStateCSV extends DurableObject<Env> {
  private state: GraphState | null = null;
  private connections: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  /**
   * HTTP request handler
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade for real-time graph sync
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request);
    }

    // HTTP API routes
    switch (url.pathname) {
      case "/validate":
        return this.validateEdgeProof(request);
      case "/reload":
        return this.reloadFromR2(request);
      case "/state":
        return this.getState();
      default:
        return new Response("Not Found", { status: 404 });
    }
  }

  /**
   * Validate edge proof for authorization
   */
  private async validateEdgeProof(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const { edgeIds, userId, resourceId } = await request.json<{
        edgeIds: string[];
        userId: string;
        resourceId: string;
      }>();

      // Ensure graph is loaded
      if (!this.state) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: "Graph not initialized",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Validate edge chain
      const validation = this.validateChain(edgeIds, userId, resourceId);

      return new Response(JSON.stringify(validation), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          valid: false,
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
   * Validate edge chain connectivity
   * Returns: { valid: boolean, reason?: string }
   */
  private validateChain(
    edgeIds: string[],
    userId: string,
    resourceId: string
  ): { valid: boolean; reason?: string } {
    if (!this.state) {
      return { valid: false, reason: "Graph not initialized" };
    }

    // Empty chain = no permission
    if (edgeIds.length === 0) {
      return { valid: false, reason: "Empty edge chain" };
    }

    // Lookup all edges (O(n) where n = chain length, typically 3-5)
    const edges: Edge[] = [];
    for (const edgeId of edgeIds) {
      const edge = this.state.edges.get(edgeId);
      if (!edge) {
        return { valid: false, reason: `Edge not found: ${edgeId}` };
      }
      if (edge.revokedAt !== null) {
        return { valid: false, reason: `Edge revoked: ${edgeId}` };
      }
      edges.push(edge);
    }

    // Validate chain connectivity: edge[i].target === edge[i+1].source
    for (let i = 0; i < edges.length - 1; i++) {
      const currentEdge = edges[i];
      const nextEdge = edges[i + 1];

      if (!currentEdge || !nextEdge) {
        return { valid: false, reason: `Missing edge in chain at index ${i}` };
      }

      if (currentEdge.target !== nextEdge.source) {
        return {
          valid: false,
          reason: `Chain break: edge ${currentEdge.id} → ${currentEdge.target} ≠ ${nextEdge.source}`,
        };
      }
    }

    const firstEdge = edges[0];
    const lastEdge = edges[edges.length - 1];

    if (!firstEdge || !lastEdge) {
      return { valid: false, reason: "Invalid edge chain" };
    }

    // Validate endpoints
    if (firstEdge.source !== userId) {
      return {
        valid: false,
        reason: `Chain start mismatch: ${firstEdge.source} ≠ ${userId}`,
      };
    }

    if (lastEdge.target !== resourceId) {
      return {
        valid: false,
        reason: `Chain end mismatch: ${lastEdge.target} ≠ ${resourceId}`,
      };
    }

    // Chain is valid
    return { valid: true };
  }

  /**
   * Reload graph from R2 CSV files
   */
  private async reloadFromR2(request: Request): Promise<Response> {
    try {
      // Get tenant ID from request body
      const body = await request.json<{ tenantId: string }>();
      const tenantId = body.tenantId;

      if (!tenantId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "tenantId is required in request body",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Load CSV files from R2
      const edges = await this.loadCSVFromR2(tenantId);

      // Initialize state
      this.state = {
        tenantId,
        version: Date.now(),
        edges,
        lastSync: Date.now(),
      };

      // Broadcast reload to connected clients
      await this.broadcastReload();

      return new Response(
        JSON.stringify({
          success: true,
          tenantId,
          edgeCount: edges.size,
          version: this.state.version,
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
   * Load CSV files from R2 and parse into edge map
   */
  private async loadCSVFromR2(tenantId: string): Promise<Map<string, Edge>> {
    const edges = new Map<string, Edge>();

    // Load the main graph.csv file
    const key = `tenants/${tenantId}/graph.csv`;
    const object = await this.env.TENANT_DATA.get(key);

    if (!object) {
      throw new Error(`CSV file not found: ${key}`);
    }

    const csvText = await object.text();
    const rows = this.parseCSV(csvText);

    // Parse edges from CSV rows
    // Expected format: subject_type,subject_id,relation,object_type,object_id
    for (const row of rows) {
      const subject =
        row.subject_type && row.subject_id
          ? `${row.subject_type}:${row.subject_id}`
          : row.subject_type || "";
      const object =
        row.object_type && row.object_id
          ? `${row.object_type}:${row.object_id}`
          : row.object_type || "";
      const relation = row.relation || "";

      // Skip rows without required fields
      if (!subject || !object || !relation) {
        console.warn(`Invalid row: missing required fields`, row);
        continue;
      }

      const edgeId = `${subject}:${relation}:${object}`;
      const edge: Edge = {
        id: edgeId,
        source: subject,
        target: object,
        type: relation,
        permission: relation,
        revokedAt: null,
      };

      edges.set(edge.id, edge);
    }

    return edges;
  }

  /**
   * Simple CSV parser (assumes no quotes/escaping for now)
   */
  private parseCSV(csvText: string): Record<string, string>[] {
    const lines = csvText.trim().split("\n");
    if (lines.length === 0) return [];

    const headerLine = lines[0];
    if (!headerLine) return [];

    const headers = headerLine.split(",").map((h) => h.trim());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const values = line.split(",").map((v) => v.trim());
      const row: Record<string, string> = {};

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        if (header) {
          row[header] = values[j] || "";
        }
      }

      rows.push(row);
    }

    return rows;
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

    this.ctx.acceptWebSocket(server);
    this.connections.add(server);

    // Send initial state
    if (this.state) {
      server.send(
        JSON.stringify({
          type: "state",
          version: this.state.version,
          edgeCount: this.state.edges.size,
          lastSync: this.state.lastSync,
        })
      );
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Broadcast reload event to all connected clients
   */
  private async broadcastReload(): Promise<void> {
    if (!this.state) return;

    const message = JSON.stringify({
      type: "reload",
      version: this.state.version,
      timestamp: Date.now(),
    });

    for (const ws of this.connections) {
      try {
        ws.send(message);
      } catch (error) {
        console.error("Failed to send to WebSocket:", error);
        this.connections.delete(ws);
      }
    }
  }

  /**
   * Get current graph state
   */
  private async getState(): Promise<Response> {
    if (!this.state) {
      return new Response(
        JSON.stringify({
          initialized: false,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        initialized: true,
        tenantId: this.state.tenantId,
        version: this.state.version,
        edgeCount: this.state.edges.size,
        lastSync: this.state.lastSync,
        connections: this.connections.size,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  /**
   * WebSocket close handler
   */
  async webSocketClose(ws: WebSocket) {
    this.connections.delete(ws);
  }
}
