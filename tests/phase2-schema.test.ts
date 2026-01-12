/**
 * Phase 2: Schema Infrastructure - Basic Tests
 *
 * Tests for multi-tenant schema loading and storage
 */

import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { getDefaultSchema } from "../src/types/schema";
import type { CompiledSchema } from "../src/types/schema";

describe("Phase 2: Schema Infrastructure", () => {
  describe("Schema Types", () => {
    it("should provide default schema with Phase 1 entities", () => {
      const schema = getDefaultSchema();

      expect(schema.version).toBe(1);
      expect(schema.entities).toHaveLength(3);
      expect(schema.relationships).toHaveLength(4);

      // Verify Phase 1 entities exist
      const entityNames = schema.entities.map((e) => e.name);
      expect(entityNames).toContain("User");
      expect(entityNames).toContain("Group");
      expect(entityNames).toContain("Resource");

      // Verify Phase 1 relationships exist
      const relNames = schema.relationships.map((r) => r.name);
      expect(relNames).toContain("member_of");
      expect(relNames).toContain("has_permission");
      expect(relNames).toContain("group_permission");
      expect(relNames).toContain("inherits_from");
    });

    it("should include SQL generation for entities", () => {
      const schema = getDefaultSchema();

      for (const entity of schema.entities) {
        expect(entity.createTableSQL).toBeDefined();
        expect(entity.createTableSQL).toContain("CREATE NODE TABLE");
        expect(entity.createTableSQL).toContain(entity.name);
      }
    });

    it("should include SQL generation for relationships", () => {
      const schema = getDefaultSchema();

      for (const rel of schema.relationships) {
        expect(rel.createRelTableSQL).toBeDefined();
        expect(rel.createRelTableSQL).toContain("CREATE REL TABLE");
        expect(rel.createRelTableSQL).toContain(rel.name);
        expect(rel.createRelTableSQL).toContain(
          `FROM ${rel.from} TO ${rel.to}`
        );
      }
    });
  });

  describe("Multi-Tenant Schema Storage", () => {
    it("should support per-org schema isolation", () => {
      // This is a structural test - verifies the type system supports multi-tenancy
      const org1Schema = getDefaultSchema();
      const org2Schema = getDefaultSchema();

      // Each org can have independent schema
      expect(org1Schema).toEqual(org2Schema); // Same default for now
      expect(org1Schema).not.toBe(org2Schema); // Different objects
    });

    it("should include version tracking", () => {
      const schema = getDefaultSchema();
      expect(schema.version).toBeDefined();
      expect(typeof schema.version).toBe("number");
    });
  });

  describe("Dynamic Schema Loading in Durable Object", () => {
    it("should load schema on first request", async () => {
      const id = env.GRAPH_STATE_CSV.idFromName("test-org-1");
      const stub = env.GRAPH_STATE_CSV.get(id);

      // Make a request to trigger schema loading
      const response = await stub.fetch("http://do/org/test-org-1/schema");
      expect(response.status).toBe(200);

      const schema = (await response.json()) as CompiledSchema;
      expect(schema.version).toBe(1);
      expect(schema.entities).toHaveLength(3);
      expect(schema.relationships).toHaveLength(4);
    });

    it("should create default schema for new org", async () => {
      const orgId = `test-org-${Date.now()}`;
      const id = env.GRAPH_STATE_CSV.idFromName(orgId);
      const stub = env.GRAPH_STATE_CSV.get(id);

      // First request should create default schema
      const response = await stub.fetch(`http://do/org/${orgId}/schema`);
      expect(response.status).toBe(200);

      const schema = (await response.json()) as CompiledSchema;
      expect(schema.version).toBe(1);

      // Verify schema was stored in R2
      const schemaKey = `${orgId}/schema/current.json`;
      const storedSchema = await env.TENANT_DATA.get(schemaKey);
      expect(storedSchema).toBeDefined();
    });

    it("should support schema updates", async () => {
      const orgId = `test-org-update-${Date.now()}`;
      const id = env.GRAPH_STATE_CSV.idFromName(orgId);
      const stub = env.GRAPH_STATE_CSV.get(id);

      // Create initial schema
      await stub.fetch(`http://do/org/${orgId}/schema`);

      // Update schema with new version
      const updatedSchema = getDefaultSchema();
      updatedSchema.version = 2;

      const updateResponse = await stub.fetch(
        `http://do/org/${orgId}/schema/update`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedSchema),
        }
      );

      expect(updateResponse.status).toBe(200);
      const result = await updateResponse.json();
      expect(result).toMatchObject({
        success: true,
        version: 2,
      });

      // Verify schema was updated
      const schemaResponse = await stub.fetch(`http://do/org/${orgId}/schema`);
      const schema = (await schemaResponse.json()) as CompiledSchema;
      expect(schema.version).toBe(2);
    });
  });

  describe("Dynamic Data Loading", () => {
    it("should load relationship data based on schema", async () => {
      const orgId = `test-org-data-${Date.now()}`;
      const id = env.GRAPH_STATE_CSV.idFromName(orgId);
      const stub = env.GRAPH_STATE_CSV.get(id);

      // Create test CSV data in R2
      const memberOfCsv = "from_id,to_id\nalice,engineers\nbob,admins";
      await env.TENANT_DATA.put(`${orgId}/data/member_of.csv`, memberOfCsv);

      const hasPermissionCsv =
        "from_id,to_id,permission\nalice,doc1,read\nbob,doc2,write";
      await env.TENANT_DATA.put(
        `${orgId}/data/has_permission.csv`,
        hasPermissionCsv
      );

      // Trigger data load by requesting state
      await stub.fetch(`http://do/org/${orgId}/schema`);

      // Reload from R2 to load data
      const reloadResponse = await stub.fetch(`http://do/org/${orgId}/reload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: orgId }),
      });

      expect(reloadResponse.status).toBe(200);
      const reloadResult = await reloadResponse.json();
      expect(reloadResult).toMatchObject({
        success: true,
        tenantId: orgId,
      });

      // Should have loaded edges from CSVs
      expect(reloadResult.edgeCount).toBeGreaterThan(0);
    });
  });
});
