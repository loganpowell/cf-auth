/**
 * Phase 2: Dynamic Indexes Tests
 *
 * Tests for dynamic entity/relationship indexing with custom schemas
 */

import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import type { CompiledSchema } from "../src/types/schema";

describe("Phase 2: Dynamic Indexes", () => {
  describe("Custom Entity Indexing", () => {
    it("should index custom entity types", async () => {
      const orgId = `test-org-custom-entities-${Date.now()}`;
      const id = env.GRAPH_STATE_CSV.idFromName(orgId);
      const stub = env.GRAPH_STATE_CSV.get(id);

      // Create a custom schema with different entity types
      const customSchema: CompiledSchema = {
        version: 1,
        entities: [
          {
            name: "Team",
            fields: [
              { name: "id", type: "STRING", primaryKey: true, required: true },
              { name: "name", type: "STRING", required: true },
            ],
            createTableSQL:
              "CREATE NODE TABLE Team(id STRING, name STRING, PRIMARY KEY(id))",
          },
          {
            name: "Project",
            fields: [
              { name: "id", type: "STRING", primaryKey: true, required: true },
              { name: "title", type: "STRING", required: true },
            ],
            createTableSQL:
              "CREATE NODE TABLE Project(id STRING, title STRING, PRIMARY KEY(id))",
          },
        ],
        relationships: [
          {
            name: "works_on",
            from: "Team",
            to: "Project",
            properties: [{ name: "role", type: "STRING", required: true }],
            createRelTableSQL:
              "CREATE REL TABLE works_on(FROM Team TO Project, role STRING)",
          },
        ],
        indexes: [],
      };

      // Store custom schema
      await env.TENANT_DATA.put(
        `${orgId}/schema/current.json`,
        JSON.stringify(customSchema)
      );

      // Create custom entity CSV files
      const teamsCsv = "id,name\nteam1,Engineering\nteam2,Design";
      await env.TENANT_DATA.put(`${orgId}/data/Team.csv`, teamsCsv);

      const projectsCsv = "id,title\nproj1,Website\nproj2,Mobile App";
      await env.TENANT_DATA.put(`${orgId}/data/Project.csv`, projectsCsv);

      const worksOnCsv =
        "from_id,to_id,role\nteam1,proj1,development\nteam2,proj2,design";
      await env.TENANT_DATA.put(`${orgId}/data/works_on.csv`, worksOnCsv);

      // Trigger load
      await stub.fetch(`http://do/org/${orgId}/schema`);

      const reloadResponse = await stub.fetch(`http://do/org/${orgId}/reload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: orgId }),
      });

      expect(reloadResponse.status).toBe(200);
      const result = await reloadResponse.json();

      // Should have loaded custom entity relationships
      expect(result.edgeCount).toBe(2);

      // Verify schema was loaded correctly
      const schemaResponse = await stub.fetch(`http://do/org/${orgId}/schema`);
      const schema = (await schemaResponse.json()) as CompiledSchema;
      expect(schema.entities).toHaveLength(2);
      expect(schema.entities[0]?.name).toBe("Team");
      expect(schema.entities[1]?.name).toBe("Project");
    });

    it("should support querying custom relationships", async () => {
      const orgId = `test-org-custom-rels-${Date.now()}`;
      const id = env.GRAPH_STATE_CSV.idFromName(orgId);
      const stub = env.GRAPH_STATE_CSV.get(id);

      // Create schema with custom relationship
      const customSchema: CompiledSchema = {
        version: 1,
        entities: [
          {
            name: "Author",
            fields: [
              { name: "id", type: "STRING", primaryKey: true, required: true },
            ],
            createTableSQL:
              "CREATE NODE TABLE Author(id STRING, PRIMARY KEY(id))",
          },
          {
            name: "Book",
            fields: [
              { name: "id", type: "STRING", primaryKey: true, required: true },
            ],
            createTableSQL:
              "CREATE NODE TABLE Book(id STRING, PRIMARY KEY(id))",
          },
        ],
        relationships: [
          {
            name: "wrote",
            from: "Author",
            to: "Book",
            properties: [{ name: "year", type: "NUMBER", required: false }],
            createRelTableSQL:
              "CREATE REL TABLE wrote(FROM Author TO Book, year INT)",
          },
        ],
        indexes: [],
      };

      await env.TENANT_DATA.put(
        `${orgId}/schema/current.json`,
        JSON.stringify(customSchema)
      );

      // Create relationship data
      const wroteCSV =
        "from_id,to_id,year\nauthor1,book1,2020\nauthor1,book2,2022";
      await env.TENANT_DATA.put(`${orgId}/data/wrote.csv`, wroteCSV);

      // Trigger load
      await stub.fetch(`http://do/org/${orgId}/schema`);

      const reloadResponse = await stub.fetch(`http://do/org/${orgId}/reload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: orgId }),
      });

      expect(reloadResponse.status).toBe(200);
      const result = await reloadResponse.json();
      expect(result.edgeCount).toBe(2);
      expect(result.success).toBe(true);
    });
  });

  describe("Multi-Tenant Schema Isolation", () => {
    it("should handle multiple organizations with different schemas", async () => {
      const org1 = `test-org-multi-1-${Date.now()}`;
      const org2 = `test-org-multi-2-${Date.now()}`;

      const id1 = env.GRAPH_STATE_CSV.idFromName(org1);
      const id2 = env.GRAPH_STATE_CSV.idFromName(org2);

      const stub1 = env.GRAPH_STATE_CSV.get(id1);
      const stub2 = env.GRAPH_STATE_CSV.get(id2);

      // Org 1: Team-based schema
      const schema1: CompiledSchema = {
        version: 1,
        entities: [
          {
            name: "Team",
            fields: [
              { name: "id", type: "STRING", primaryKey: true, required: true },
            ],
            createTableSQL:
              "CREATE NODE TABLE Team(id STRING, PRIMARY KEY(id))",
          },
        ],
        relationships: [],
        indexes: [],
      };

      await env.TENANT_DATA.put(
        `${org1}/schema/current.json`,
        JSON.stringify(schema1)
      );

      // Org 2: Department-based schema
      const schema2: CompiledSchema = {
        version: 1,
        entities: [
          {
            name: "Department",
            fields: [
              { name: "id", type: "STRING", primaryKey: true, required: true },
            ],
            createTableSQL:
              "CREATE NODE TABLE Department(id STRING, PRIMARY KEY(id))",
          },
        ],
        relationships: [],
        indexes: [],
      };

      await env.TENANT_DATA.put(
        `${org2}/schema/current.json`,
        JSON.stringify(schema2)
      );

      // Load schemas
      const response1 = await stub1.fetch(`http://do/org/${org1}/schema`);
      const response2 = await stub2.fetch(`http://do/org/${org2}/schema`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Verify each org has its own schema
      const loadedSchema1 = (await response1.json()) as CompiledSchema;
      const loadedSchema2 = (await response2.json()) as CompiledSchema;

      expect(loadedSchema1.entities[0]?.name).toBe("Team");
      expect(loadedSchema2.entities[0]?.name).toBe("Department");
    });

    it("should support completely different relationship types per org", async () => {
      const org1 = `test-org-rels-1-${Date.now()}`;
      const org2 = `test-org-rels-2-${Date.now()}`;

      // Org 1: Software development schema
      const schema1: CompiledSchema = {
        version: 1,
        entities: [
          {
            name: "Developer",
            fields: [
              { name: "id", type: "STRING", primaryKey: true, required: true },
            ],
            createTableSQL:
              "CREATE NODE TABLE Developer(id STRING, PRIMARY KEY(id))",
          },
          {
            name: "Repository",
            fields: [
              { name: "id", type: "STRING", primaryKey: true, required: true },
            ],
            createTableSQL:
              "CREATE NODE TABLE Repository(id STRING, PRIMARY KEY(id))",
          },
        ],
        relationships: [
          {
            name: "contributes_to",
            from: "Developer",
            to: "Repository",
            properties: [],
            createRelTableSQL:
              "CREATE REL TABLE contributes_to(FROM Developer TO Repository)",
          },
        ],
        indexes: [],
      };

      // Org 2: Healthcare schema
      const schema2: CompiledSchema = {
        version: 1,
        entities: [
          {
            name: "Doctor",
            fields: [
              { name: "id", type: "STRING", primaryKey: true, required: true },
            ],
            createTableSQL:
              "CREATE NODE TABLE Doctor(id STRING, PRIMARY KEY(id))",
          },
          {
            name: "Patient",
            fields: [
              { name: "id", type: "STRING", primaryKey: true, required: true },
            ],
            createTableSQL:
              "CREATE NODE TABLE Patient(id STRING, PRIMARY KEY(id))",
          },
        ],
        relationships: [
          {
            name: "treats",
            from: "Doctor",
            to: "Patient",
            properties: [],
            createRelTableSQL:
              "CREATE REL TABLE treats(FROM Doctor TO Patient)",
          },
        ],
        indexes: [],
      };

      await env.TENANT_DATA.put(
        `${org1}/schema/current.json`,
        JSON.stringify(schema1)
      );
      await env.TENANT_DATA.put(
        `${org2}/schema/current.json`,
        JSON.stringify(schema2)
      );

      // Create data for org1
      const contributesCSV = "from_id,to_id\ndev1,repo1\ndev2,repo1";
      await env.TENANT_DATA.put(
        `${org1}/data/contributes_to.csv`,
        contributesCSV
      );

      // Create data for org2
      const treatsCSV = "from_id,to_id\ndoc1,patient1\ndoc1,patient2";
      await env.TENANT_DATA.put(`${org2}/data/treats.csv`, treatsCSV);

      // Load both
      const id1 = env.GRAPH_STATE_CSV.idFromName(org1);
      const id2 = env.GRAPH_STATE_CSV.idFromName(org2);
      const stub1 = env.GRAPH_STATE_CSV.get(id1);
      const stub2 = env.GRAPH_STATE_CSV.get(id2);

      await stub1.fetch(`http://do/org/${org1}/schema`);
      await stub2.fetch(`http://do/org/${org2}/schema`);

      const reload1 = await stub1.fetch(`http://do/org/${org1}/reload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: org1 }),
      });

      const reload2 = await stub2.fetch(`http://do/org/${org2}/reload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: org2 }),
      });

      expect(reload1.status).toBe(200);
      expect(reload2.status).toBe(200);

      const result1 = await reload1.json();
      const result2 = await reload2.json();

      expect(result1.edgeCount).toBe(2);
      expect(result2.edgeCount).toBe(2);

      // Verify schemas are different
      const schema1Response = await stub1.fetch(`http://do/org/${org1}/schema`);
      const schema2Response = await stub2.fetch(`http://do/org/${org2}/schema`);

      const loadedSchema1 = (await schema1Response.json()) as CompiledSchema;
      const loadedSchema2 = (await schema2Response.json()) as CompiledSchema;

      expect(loadedSchema1.relationships[0]?.name).toBe("contributes_to");
      expect(loadedSchema2.relationships[0]?.name).toBe("treats");
    });
  });
});
