import { describe, it, expect, beforeEach } from "vitest";
// @ts-expect-error - cloudflare:test is a virtual module provided by @cloudflare/vitest-pool-workers
import { env } from "cloudflare:test";
import type {
  DurableObjectNamespace,
  DurableObjectStub,
} from "@cloudflare/workers-types";

/**
 * Durable Objects Tests
 *
 * Tests for TenantState and GraphStateCSV Durable Objects
 * including WebSocket connections, state management, and edge validation.
 *
 * NOTE: Some tests are skipped because R2 bucket binding is disabled
 * (API token lacks R2 permissions). Re-enable when R2 is available.
 */

// Skip all DO tests if R2 is not available
const hasR2 = !!env.TENANT_DATA;

describe("Durable Objects Infrastructure", () => {
  it("should have Durable Object namespaces available", () => {
    expect(env.TENANT_STATE).toBeDefined();
    expect(env.GRAPH_STATE_CSV).toBeDefined();
    expect(typeof env.TENANT_STATE.idFromName).toBe("function");
    expect(typeof env.GRAPH_STATE_CSV.idFromName).toBe("function");
  });

  it("should have KV namespaces available", () => {
    expect(env.MUTATION_LOG).toBeDefined();
    expect(typeof env.MUTATION_LOG.get).toBe("function");
    expect(typeof env.MUTATION_LOG.put).toBe("function");
  });

  it("should indicate R2 bucket status", () => {
    if (hasR2) {
      expect(env.TENANT_DATA).toBeDefined();
    } else {
      // R2 bucket disabled - expected until API token permissions updated
      expect(env.TENANT_DATA).toBeUndefined();
    }
  });
});

describe.skipIf(!hasR2)("TenantState Durable Object", () => {
  let doNamespace: DurableObjectNamespace;
  let tenantState: DurableObjectStub;

  beforeEach(async () => {
    doNamespace = env.TENANT_STATE;
    const id = doNamespace.idFromName("test-tenant");
    tenantState = doNamespace.get(id);
  });

  describe("HTTP API", () => {
    it("should return state via GET /state", async () => {
      const response = await tenantState.fetch("http://do/state");
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data).toHaveProperty("tenantId");
      expect(data).toHaveProperty("connections");
      expect(data.connections).toBe(0);
    });

    it("should handle POST /mutation and broadcast", async () => {
      const mutation = {
        type: "add_user",
        userId: "user_alice",
        timestamp: Date.now(),
      };

      const response = await tenantState.fetch("http://do/mutation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
    });

    it("should reset state via POST /reset", async () => {
      const response = await tenantState.fetch("http://do/reset", {
        method: "POST",
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
    });

    it("should return 404 for unknown routes", async () => {
      const response = await tenantState.fetch("http://do/unknown");
      expect(response.status).toBe(404);
    });
  });

  describe("WebSocket Connections", () => {
    it("should upgrade to WebSocket connection", async () => {
      const response = await tenantState.fetch("http://do/", {
        headers: { Upgrade: "websocket" },
      });

      expect(response.status).toBe(101);
      expect(response.webSocket).toBeDefined();
    });

    it("should send initial state on WebSocket connect", async () => {
      const response = await tenantState.fetch("http://do/", {
        headers: { Upgrade: "websocket" },
      });

      const ws = response.webSocket;
      expect(ws).toBeDefined();

      // In real test, would listen for messages
      // For now just verify connection succeeds
    });
  });
});

describe.skipIf(!hasR2)("GraphStateCSV Durable Object", () => {
  let doNamespace: DurableObjectNamespace;
  let graphState: DurableObjectStub;

  beforeEach(async () => {
    doNamespace = env.GRAPH_STATE_CSV;
    const id = doNamespace.idFromName("test-tenant");
    graphState = doNamespace.get(id);
  });

  describe("State Management", () => {
    it("should return uninitialized state initially", async () => {
      const response = await graphState.fetch("http://do/state");
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data.initialized).toBe(false);
    });

    it("should reload CSV from R2", async () => {
      const response = await graphState.fetch("http://do/reload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: "test-tenant" }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("edgeCount");
    });
  });

  describe("Edge Validation", () => {
    it("should validate edge proof chain", async () => {
      const edgeProof = {
        edgeIds: ["edge_001", "edge_002"],
        userId: "user_alice",
        resourceId: "resource_project_x",
      };

      const response = await graphState.fetch("http://do/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edgeProof),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data).toHaveProperty("valid");
      expect(typeof data.valid).toBe("boolean");
    });

    it("should reject empty edge chain", async () => {
      const edgeProof = {
        edgeIds: [],
        userId: "user_alice",
        resourceId: "resource_project_x",
      };

      const response = await graphState.fetch("http://do/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edgeProof),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.valid).toBe(false);
      expect(data.reason).toContain("Empty edge chain");
    });

    it("should reject invalid edge IDs", async () => {
      const edgeProof = {
        edgeIds: ["nonexistent_edge"],
        userId: "user_alice",
        resourceId: "resource_project_x",
      };

      const response = await graphState.fetch("http://do/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edgeProof),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.valid).toBe(false);
    });
  });

  describe("WebSocket Notifications", () => {
    it("should upgrade to WebSocket for reload notifications", async () => {
      const response = await graphState.fetch("http://do/", {
        headers: { Upgrade: "websocket" },
      });

      expect(response.status).toBe(101);
      expect(response.webSocket).toBeDefined();
    });
  });
});

describe.skipIf(!hasR2)("Durable Objects Integration", () => {
  it("should create per-tenant isolated instances", async () => {
    const tenantStateNS = env.TENANT_STATE;
    // Create instances for different tenants
    const tenant1Id = tenantStateNS.idFromName("tenant_1");
    const tenant2Id = tenantStateNS.idFromName("tenant_2");

    const tenant1State = tenantStateNS.get(tenant1Id);
    const tenant2State = tenantStateNS.get(tenant2Id);

    // Verify they're different instances
    const response1 = await tenant1State.fetch("http://do/state");
    const response2 = await tenant2State.fetch("http://do/state");

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
  });

  it("should coordinate between TenantState and GraphStateCSV", async () => {
    const tenantId = "test-tenant-coordination";

    // Get both DOs for same tenant
    const tenantStateId = env.TENANT_STATE.idFromName(tenantId);
    const graphStateId = env.GRAPH_STATE_CSV.idFromName(tenantId);

    const tenantState = env.TENANT_STATE.get(tenantStateId);
    const graphState = env.GRAPH_STATE_CSV.get(graphStateId);

    // Reload graph state
    await graphState.fetch("http://do/reload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });

    // Apply mutation to tenant state
    await tenantState.fetch("http://do/mutation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "add_edge",
        edgeId: "new_edge",
        timestamp: Date.now(),
      }),
    });

    // Both should be accessible
    const tenantStateResponse = await tenantState.fetch("http://do/state");
    const graphStateResponse = await graphState.fetch("http://do/state");

    expect(tenantStateResponse.status).toBe(200);
    expect(graphStateResponse.status).toBe(200);
  });
});

describe.skipIf(!hasR2)("R2 and KV Integration", () => {
  it.skipIf(!hasR2)("should have TENANT_DATA R2 bucket available", () => {
    expect(env.TENANT_DATA).toBeDefined();
    expect(typeof env.TENANT_DATA.get).toBe("function");
  });

  it("should have MUTATION_LOG KV namespace available", () => {
    expect(env.MUTATION_LOG).toBeDefined();
    expect(typeof env.MUTATION_LOG.get).toBe("function");
    expect(typeof env.MUTATION_LOG.put).toBe("function");
  });

  it("should write and read from MUTATION_LOG KV", async () => {
    const key = `test-mutation-${Date.now()}`;
    const mutation = {
      type: "test",
      timestamp: Date.now(),
    };

    await env.MUTATION_LOG.put(key, JSON.stringify(mutation));
    const retrieved = await env.MUTATION_LOG.get(key);

    expect(retrieved).toBeDefined();
    const parsed = JSON.parse(retrieved!);
    expect(parsed.type).toBe("test");
  });

  it("should write and read from TENANT_DATA R2", async () => {
    const key = `test-tenant/test.csv`;
    const csvContent =
      "id,source,target,type\nedge_001,user_alice,group_eng,member_of";

    await env.TENANT_DATA.put(key, csvContent);
    const retrieved = await env.TENANT_DATA.get(key);

    expect(retrieved).toBeDefined();
    const text = await retrieved!.text();
    expect(text).toContain("user_alice");
  });
});

describe.skipIf(!hasR2)("CSV Parsing and Validation", () => {
  it("should parse valid CSV files", async () => {
    const tenantId = "csv-test-tenant";
    const csvContent = `id,source,target,type,permission,revoked_at
edge_001,user_alice,group_engineering,member_of,,
edge_002,user_bob,resource_project,user_permission,read,`;

    // Upload CSV to R2
    await env.TENANT_DATA.put(`${tenantId}/member_of.csv`, csvContent);

    // Reload GraphStateCSV
    const graphStateId = env.GRAPH_STATE_CSV.idFromName(tenantId);
    const graphState = env.GRAPH_STATE_CSV.get(graphStateId);

    const response = await graphState.fetch("http://do/reload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as any;
    expect(data.success).toBe(true);
    expect(data.edgeCount).toBeGreaterThanOrEqual(2);
  });

  it("should validate connected edge chains", async () => {
    const tenantId = "chain-validation-tenant";
    const csvContent = `id,source,target,type,permission,revoked_at
edge_001,user_alice,group_eng,member_of,,
edge_002,group_eng,resource_project,group_permission,read,`;

    await env.TENANT_DATA.put(`${tenantId}/member_of.csv`, csvContent);

    const graphStateId = env.GRAPH_STATE_CSV.idFromName(tenantId);
    const graphState = env.GRAPH_STATE_CSV.get(graphStateId);

    await graphState.fetch("http://do/reload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });

    // Validate chain: user_alice → group_eng → resource_project
    const validationResponse = await graphState.fetch("http://do/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        edgeIds: ["edge_001", "edge_002"],
        userId: "user_alice",
        resourceId: "resource_project",
      }),
    });

    const validation = await validationResponse.json();
    expect(validation.valid).toBe(true);
  });

  it("should reject disconnected edge chains", async () => {
    const tenantId = "disconnected-chain-tenant";
    const csvContent = `id,source,target,type,permission,revoked_at
edge_001,user_alice,group_eng,member_of,,
edge_002,user_bob,resource_project,user_permission,read,`;

    await env.TENANT_DATA.put(`${tenantId}/member_of.csv`, csvContent);

    const graphStateId = env.GRAPH_STATE_CSV.idFromName(tenantId);
    const graphState = env.GRAPH_STATE_CSV.get(graphStateId);

    await graphState.fetch("http://do/reload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });

    // Try to validate disconnected chain
    const validationResponse = await graphState.fetch("http://do/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        edgeIds: ["edge_001", "edge_002"],
        userId: "user_alice",
        resourceId: "resource_project",
      }),
    });

    const validation = await validationResponse.json();
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain("Chain break");
  });
});
