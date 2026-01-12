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
import type { CompiledSchema } from "../types/schema";
import { getDefaultSchema } from "../types/schema";

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
  schema?: CompiledSchema; // Phase 2: Dynamic schema support
  schemaVersion?: number;
}

export class GraphStateCSV extends DurableObject<Env> {
  private state: GraphState | null = null;
  private connections: Set<WebSocket> = new Set();
  private orgId: string = ""; // Set from request path

  // Phase 2: Dynamic indexes for arbitrary entity/relationship types
  private entityIndexes = new Map<string, Map<string, any>>(); // entity name -> id -> entity data
  private relationshipIndexes = new Map<string, Map<string, Set<string>>>(); // rel name -> from_id -> Set<to_id>

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  /**
   * Ensure schema is loaded for this organization
   * Phase 2: Load schema from R2, or create default if doesn't exist
   */
  private async ensureSchemaLoaded(orgId: string): Promise<void> {
    if (this.state?.schema && this.orgId === orgId) {
      return; // Schema already loaded
    }

    this.orgId = orgId;

    // Try to load schema from R2
    const schemaKey = `${orgId}/schema/current.json`;
    const schemaObj = await this.env.TENANT_DATA.get(schemaKey);

    if (schemaObj) {
      // Load existing schema
      const schema = JSON.parse(await schemaObj.text()) as CompiledSchema;
      if (!this.state) {
        this.state = {
          tenantId: orgId,
          version: 0,
          edges: new Map(),
          lastSync: Date.now(),
          schema,
          schemaVersion: schema.version,
        };
      } else {
        this.state.schema = schema;
        this.state.schemaVersion = schema.version;
      }
    } else {
      // Create default schema for new org
      await this.createDefaultSchema(orgId);
    }
  }

  /**
   * Create default schema for new organization
   * Phase 2: Stores default schema in R2
   */
  private async createDefaultSchema(orgId: string): Promise<void> {
    const schema = getDefaultSchema();

    // Store schema in R2
    const schemaKey = `${orgId}/schema/current.json`;
    await this.env.TENANT_DATA.put(schemaKey, JSON.stringify(schema, null, 2));

    // Store version history
    const versionKey = `${orgId}/schema/versions/v1.json`;
    await this.env.TENANT_DATA.put(
      versionKey,
      JSON.stringify(
        {
          ...schema,
          createdAt: Date.now(),
          createdBy: "system",
        },
        null,
        2
      )
    );

    // Update state
    if (!this.state) {
      this.state = {
        tenantId: orgId,
        version: 0,
        edges: new Map(),
        lastSync: Date.now(),
        schema,
        schemaVersion: 1,
      };
    } else {
      this.state.schema = schema;
      this.state.schemaVersion = 1;
    }

    console.log(`[GraphStateCSV] Created default schema for org: ${orgId}`);
  }

  /**
   * Phase 2: Get or create entity index for a specific entity type
   */
  private getOrCreateEntityIndex(entityName: string): Map<string, any> {
    if (!this.entityIndexes.has(entityName)) {
      this.entityIndexes.set(entityName, new Map());
    }
    return this.entityIndexes.get(entityName)!;
  }

  /**
   * Phase 2: Get or create relationship index for a specific relationship type
   * Structure: from_id -> Set<to_id>
   */
  private getOrCreateRelationshipIndex(
    relName: string
  ): Map<string, Set<string>> {
    if (!this.relationshipIndexes.has(relName)) {
      this.relationshipIndexes.set(relName, new Map());
    }
    return this.relationshipIndexes.get(relName)!;
  }

  /**
   * HTTP request handler
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Extract orgId from URL or header
    // Expected URL format: https://do-id.workers.dev/org/{orgId}/...
    const orgIdMatch = url.pathname.match(/^\/org\/([^\/]+)/);
    const orgId =
      orgIdMatch?.[1] || request.headers.get("X-Org-ID") || "org_default";

    // Ensure schema is loaded before processing request
    await this.ensureSchemaLoaded(orgId);

    // WebSocket upgrade for real-time graph sync
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request);
    }

    // HTTP API routes
    const pathWithoutOrg = url.pathname.replace(`/org/${orgId}`, "");
    switch (pathWithoutOrg) {
      case "/validate":
        return this.validateEdgeProof(request);
      case "/reload":
        return this.reloadFromR2(request);
      case "/state":
        return this.getState();
      case "/schema":
        return this.getSchema();
      case "/schema/update":
        return this.updateSchema(request);
      default:
        return new Response("Not Found", { status: 404 });
    }
  }

  /**
   * Update schema and hot reload data
   * Phase 2: Support schema updates without full restart
   */
  private async updateSchema(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const newSchema = (await request.json()) as CompiledSchema;

      // Validate schema has required fields
      if (
        !newSchema.version ||
        !newSchema.entities ||
        !newSchema.relationships
      ) {
        return new Response(
          JSON.stringify({ error: "Invalid schema format" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Store new schema in R2
      const schemaKey = `${this.orgId}/schema/current.json`;
      await this.env.TENANT_DATA.put(
        schemaKey,
        JSON.stringify(newSchema, null, 2)
      );

      // Store version history
      const versionKey = `${this.orgId}/schema/versions/v${newSchema.version}.json`;
      await this.env.TENANT_DATA.put(
        versionKey,
        JSON.stringify(
          {
            ...newSchema,
            updatedAt: Date.now(),
            updatedBy: request.headers.get("X-User-ID") || "unknown",
          },
          null,
          2
        )
      );

      // Update state with new schema
      if (this.state) {
        this.state.schema = newSchema;
        this.state.schemaVersion = newSchema.version;
      }

      // Reload data based on new schema
      const edges = await this.loadDataFromSchema(this.orgId);
      if (this.state) {
        this.state.edges = edges;
        this.state.version = Date.now();
        this.state.lastSync = Date.now();
      }

      // Broadcast schema update to connected clients
      await this.broadcastSchemaUpdate(newSchema);

      return new Response(
        JSON.stringify({
          success: true,
          version: newSchema.version,
          edgeCount: edges.size,
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
   * Broadcast schema update to connected clients
   * Phase 2: Notify clients of schema changes
   */
  private async broadcastSchemaUpdate(schema: CompiledSchema): Promise<void> {
    const message = JSON.stringify({
      type: "schema_update",
      schema,
      timestamp: Date.now(),
    });

    for (const ws of this.connections) {
      try {
        ws.send(message);
      } catch (error) {
        console.error("Failed to send schema update to WebSocket:", error);
        this.connections.delete(ws);
      }
    }
  }

  /**
   * Get current schema for this organization
   * Phase 2: Return compiled schema
   */
  private async getSchema(): Promise<Response> {
    if (!this.state?.schema) {
      return new Response(JSON.stringify({ error: "Schema not loaded" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(this.state.schema, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
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
   * Phase 2: Support dynamic entity/relationship loading based on schema
   */
  private async loadCSVFromR2(tenantId: string): Promise<Map<string, Edge>> {
    const edges = new Map<string, Edge>();

    // Phase 2: If schema is loaded, use it to load entity-specific CSVs
    if (this.state?.schema) {
      return this.loadDataFromSchema(tenantId);
    }

    // Fallback: Load the main graph.csv file (Phase 1 compatibility)
    const key = `tenants/${tenantId}/graph.csv`;
    const object = await this.env.TENANT_DATA.get(key);

    if (!object) {
      console.warn(`CSV file not found: ${key}, returning empty graph`);
      return edges;
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
   * Phase 2: Load data based on dynamic schema
   * Loads entity CSVs and relationship CSVs separately
   * Populates dynamic indexes for all entity and relationship types
   */
  private async loadDataFromSchema(
    tenantId: string
  ): Promise<Map<string, Edge>> {
    const edges = new Map<string, Edge>();

    if (!this.state?.schema) {
      throw new Error("Schema not loaded");
    }

    const schema = this.state.schema;

    // Clear existing indexes
    this.entityIndexes.clear();
    this.relationshipIndexes.clear();

    // Load entity CSVs into entity indexes
    for (const entity of schema.entities) {
      const csvKey = `${tenantId}/data/${entity.name}.csv`;
      const csvObj = await this.env.TENANT_DATA.get(csvKey);

      if (!csvObj) {
        console.log(`[GraphStateCSV] No data file for entity: ${entity.name}`);
        continue;
      }

      const csvText = await csvObj.text();
      const rows = this.parseCSV(csvText);

      // Get or create entity index
      const entityIndex = this.getOrCreateEntityIndex(entity.name);

      // Index entities by their primary key (id)
      for (const row of rows) {
        const id = row.id;
        if (!id) {
          console.warn(`Invalid ${entity.name} row: missing id`, row);
          continue;
        }
        entityIndex.set(id, row);
      }

      console.log(
        `[GraphStateCSV] Indexed ${rows.length} entities for ${entity.name}`
      );
    }

    // Load relationship CSVs (these become edges in the graph)
    for (const rel of schema.relationships) {
      const csvKey = `${tenantId}/data/${rel.name}.csv`;
      const csvObj = await this.env.TENANT_DATA.get(csvKey);

      if (!csvObj) {
        console.log(
          `[GraphStateCSV] No data file for relationship: ${rel.name}`
        );
        continue;
      }

      const csvText = await csvObj.text();
      const rows = this.parseCSV(csvText);

      // Get or create relationship index
      const relIndex = this.getOrCreateRelationshipIndex(rel.name);

      // Parse relationship rows into edges
      // Expected format: from_id,to_id[,property1,property2,...]
      for (const row of rows) {
        const fromId = row.from_id || row.source || "";
        const toId = row.to_id || row.target || "";

        if (!fromId || !toId) {
          console.warn(
            `Invalid ${rel.name} row: missing from_id or to_id`,
            row
          );
          continue;
        }

        // Populate relationship index: from_id -> Set<to_id>
        if (!relIndex.has(fromId)) {
          relIndex.set(fromId, new Set());
        }
        relIndex.get(fromId)!.add(toId);

        // Format: {entity}:{id}
        const source = `${rel.from}:${fromId}`;
        const target = `${rel.to}:${toId}`;
        const edgeId = `${source}:${rel.name}:${target}`;

        // Extract properties from row (e.g., permission)
        const properties: Record<string, string> = {};
        for (const prop of rel.properties) {
          const value = row[prop.name];
          if (value !== undefined) {
            properties[prop.name] = value;
          }
        }

        const edge: Edge = {
          id: edgeId,
          source,
          target,
          type: rel.name,
          permission: properties.permission || rel.name,
          revokedAt: null,
        };

        edges.set(edge.id, edge);
      }

      console.log(
        `[GraphStateCSV] Loaded ${rows.length} edges for ${rel.name}`
      );
    }

    console.log(`[GraphStateCSV] Total edges loaded: ${edges.size}`);
    console.log(
      `[GraphStateCSV] Entity indexes: ${this.entityIndexes.size} types`
    );
    console.log(
      `[GraphStateCSV] Relationship indexes: ${this.relationshipIndexes.size} types`
    );
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
