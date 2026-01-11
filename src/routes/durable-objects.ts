/**
 * Durable Objects HTTP Endpoints
 *
 * Provides HTTP access to TenantState and GraphStateCSV Durable Objects
 * for testing and direct interaction.
 */

import { Hono } from "hono";
import type { Env } from "../types";

export function createDurableObjectsRouter() {
  const router = new Hono<{ Bindings: Env }>();

  /**
   * TenantState Durable Object Routes
   */

  // Get tenant state
  router.get("/tenant-state/:tenantId", async (c) => {
    const { tenantId } = c.req.param();
    const env = c.env;

    const id = env.TENANT_STATE.idFromName(tenantId);
    const stub = env.TENANT_STATE.get(id);

    try {
      const response = await stub.fetch("http://do/state");
      const data = await response.json();
      return c.json(data);
    } catch (error: any) {
      return c.json(
        { error: "Failed to fetch tenant state", message: error.message },
        500
      );
    }
  });

  // Send mutation to tenant state
  router.post("/tenant-state/:tenantId/mutation", async (c) => {
    const { tenantId } = c.req.param();
    const env = c.env;
    const body = await c.req.json();

    const id = env.TENANT_STATE.idFromName(tenantId);
    const stub = env.TENANT_STATE.get(id);

    try {
      const response = await stub.fetch("http://do/mutation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return c.json(data);
    } catch (error: any) {
      return c.json(
        { error: "Failed to send mutation", message: error.message },
        500
      );
    }
  });

  // Reset tenant state
  router.post("/tenant-state/:tenantId/reset", async (c) => {
    const { tenantId } = c.req.param();
    const env = c.env;

    const id = env.TENANT_STATE.idFromName(tenantId);
    const stub = env.TENANT_STATE.get(id);

    try {
      const response = await stub.fetch("http://do/reset", {
        method: "POST",
      });
      const data = await response.json();
      return c.json(data);
    } catch (error: any) {
      return c.json(
        { error: "Failed to reset tenant state", message: error.message },
        500
      );
    }
  });

  /**
   * GraphStateCSV Durable Object Routes
   */

  // Get graph state
  router.get("/graph-state/:tenantId", async (c) => {
    const { tenantId } = c.req.param();
    const env = c.env;

    const id = env.GRAPH_STATE_CSV.idFromName(tenantId);
    const stub = env.GRAPH_STATE_CSV.get(id);

    try {
      const response = await stub.fetch("http://do/state");
      const data = await response.json();
      return c.json(data);
    } catch (error: any) {
      return c.json(
        { error: "Failed to fetch graph state", message: error.message },
        500
      );
    }
  });

  // Validate edge chain
  router.post("/graph-state/:tenantId/validate", async (c) => {
    const { tenantId } = c.req.param();
    const env = c.env;
    const body = await c.req.json();

    const id = env.GRAPH_STATE_CSV.idFromName(tenantId);
    const stub = env.GRAPH_STATE_CSV.get(id);

    try {
      const response = await stub.fetch("http://do/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return c.json(data);
    } catch (error: any) {
      return c.json(
        { error: "Failed to validate edge chain", message: error.message },
        500
      );
    }
  });

  // Reload graph from R2
  router.post("/graph-state/:tenantId/reload", async (c) => {
    const { tenantId } = c.req.param();
    const env = c.env;

    const id = env.GRAPH_STATE_CSV.idFromName(tenantId);
    const stub = env.GRAPH_STATE_CSV.get(id);

    try {
      const response = await stub.fetch("http://do/reload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const data = await response.json();
      return c.json(data);
    } catch (error: any) {
      return c.json(
        { error: "Failed to reload graph", message: error.message },
        500
      );
    }
  });

  return router;
}
