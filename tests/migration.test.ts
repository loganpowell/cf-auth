/**
 * Migration Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationService } from '../src/services/migration';
import { TenantRegistry } from '../src/services/tenant-registry';

// Mock implementations
class MockKVNamespace {
  private data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async put(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
    const keys = Array.from(this.data.keys())
      .filter(key => !options?.prefix || key.startsWith(options.prefix))
      .map(name => ({ name }));
    return { keys };
  }

  clear() {
    this.data.clear();
  }
}

class MockR2Bucket {
  private objects = new Map<string, { key: string; value: string; metadata?: any }>();

  async get(key: string): Promise<any> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    
    return {
      key: obj.key,
      text: async () => obj.value,
      json: async () => JSON.parse(obj.value),
    };
  }

  async put(key: string, value: string, options?: any): Promise<void> {
    this.objects.set(key, { key, value, metadata: options });
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async list(options?: { prefix?: string; delimiter?: string }): Promise<{ objects: Array<{ key: string }> }> {
    let keys = Array.from(this.objects.keys());
    
    if (options?.prefix) {
      keys = keys.filter(key => key.startsWith(options.prefix));
    }
    
    if (options?.delimiter) {
      // Simplified delimiter logic for testing
      keys = keys.map(key => {
        const parts = key.split(options.delimiter!);
        return parts.length > 1 ? parts[0] + options.delimiter : key;
      });
      keys = [...new Set(keys)]; // Remove duplicates
    }
    
    return { objects: keys.map(key => ({ key })) };
  }

  clear() {
    this.objects.clear();
  }
}

describe('MigrationService', () => {
  let migration: MigrationService;
  let tenantRegistry: TenantRegistry;
  let mockKV: MockKVNamespace;
  let mockR2: MockR2Bucket;

  beforeEach(() => {
    mockKV = new MockKVNamespace();
    mockR2 = new MockR2Bucket();
    tenantRegistry = new TenantRegistry(mockKV as any, mockR2 as any);
    migration = new MigrationService(tenantRegistry, mockR2 as any, mockKV as any);
  });

  describe('needsMigration', () => {
    it('should return true if old structure exists', async () => {
      // Add old-style files at root
      await mockR2.put('users.csv', 'id\nuser1\nuser2');
      await mockR2.put('groups.csv', 'id\ngroup1');

      const needs = await migration.needsMigration();
      expect(needs).toBe(true);
    });

    it('should return false if no old files exist', async () => {
      const needs = await migration.needsMigration();
      expect(needs).toBe(false);
    });

    it('should return false if only new structure exists', async () => {
      await mockR2.put('org_test/data/users.csv', 'id\nuser1');

      const needs = await migration.needsMigration();
      expect(needs).toBe(false);
    });
  });

  describe('migrateToMultiTenant', () => {
    beforeEach(async () => {
      // Setup old structure
      await mockR2.put('users.csv', 'id\nuser1\nuser2');
      await mockR2.put('groups.csv', 'id\ngroup1\ngroup2');
      await mockR2.put('resources.csv', 'id\nres1');
      await mockR2.put('member_of.csv', 'from,to\nuser1,group1');
    });

    it('should create default tenant', async () => {
      const status = await migration.migrateToMultiTenant('org_default');

      expect(status.completed).toBe(true);
      expect(status.tenantsMigrated).toContain('org_default');

      const tenant = await tenantRegistry.getTenant('org_default');
      expect(tenant).toBeTruthy();
      expect(tenant!.name).toBe('Default Organization (Migrated)');
    });

    it('should migrate data files to tenant directory', async () => {
      const status = await migration.migrateToMultiTenant('org_default');

      expect(status.dataFilesMigrated).toBeGreaterThan(0);

      // Check files were copied to new location
      const usersFile = await mockR2.get('org_default/data/users.csv');
      expect(usersFile).toBeTruthy();
      
      const content = await usersFile.text();
      expect(content).toBe('id\nuser1\nuser2');
    });

    it('should store migration metadata', async () => {
      await migration.migrateToMultiTenant('org_default');

      // Check R2 metadata
      const metadataFile = await mockR2.get('org_default/migration-metadata.json');
      expect(metadataFile).toBeTruthy();

      const metadata = await metadataFile.json();
      expect(metadata.version).toBe(1);
      expect(metadata.migratedFrom).toBe('single-tenant-root');

      // Check KV metadata
      const kvStatus = await migration.getMigrationStatus('org_default');
      expect(kvStatus?.migrated).toBe(true);
    });

    it('should handle missing files gracefully', async () => {
      mockR2.clear();
      await mockR2.put('users.csv', 'id\nuser1');

      const status = await migration.migrateToMultiTenant('org_default');

      expect(status.completed).toBe(true);
      expect(status.dataFilesMigrated).toBe(1); // Only users.csv exists
    });

    it('should not recreate existing tenant', async () => {
      // Create tenant first
      await tenantRegistry.createTenant({
        id: 'org_existing',
        name: 'Existing Org',
      });

      const status = await migration.migrateToMultiTenant('org_existing');

      expect(status.completed).toBe(true);
      
      const tenant = await tenantRegistry.getTenant('org_existing');
      expect(tenant!.name).toBe('Existing Org'); // Name unchanged
    });
  });

  describe('verifyMigration', () => {
    beforeEach(async () => {
      await mockR2.put('users.csv', 'id\nuser1');
      await migration.migrateToMultiTenant('org_verify');
    });

    it('should verify successful migration', async () => {
      const result = await migration.verifyMigration('org_verify');

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing tenant', async () => {
      const result = await migration.verifyMigration('org_nonexistent');

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Tenant org_nonexistent not found');
    });

    it('should detect missing schema', async () => {
      await tenantRegistry.createTenant({
        id: 'org_noschema',
        name: 'No Schema',
      });
      
      // Delete schema file
      await mockR2.delete('org_noschema/schema/current.json');

      const result = await migration.verifyMigration('org_noschema');

      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('Schema not found'))).toBe(true);
    });
  });

  describe('getMigrationStatus', () => {
    it('should return null for non-migrated org', async () => {
      const status = await migration.getMigrationStatus('org_none');
      expect(status).toBeNull();
    });

    it('should return migration status for migrated org', async () => {
      await mockR2.put('users.csv', 'id\nuser1');
      await migration.migrateToMultiTenant('org_status');

      const status = await migration.getMigrationStatus('org_status');

      expect(status).toBeTruthy();
      expect(status!.migrated).toBe(true);
      expect(status!.version).toBe(1);
      expect(status!.migratedAt).toBeTruthy();
    });
  });

  describe('rollbackMigration', () => {
    beforeEach(async () => {
      await mockR2.put('users.csv', 'id\nuser1');
      await mockR2.put('groups.csv', 'id\ngroup1');
      await migration.migrateToMultiTenant('org_rollback');
      
      // Clear old files to test rollback
      await mockR2.delete('users.csv');
      await mockR2.delete('groups.csv');
    });

    it('should restore files to root', async () => {
      await migration.rollbackMigration('org_rollback');

      // Check files restored to root
      const usersFile = await mockR2.get('users.csv');
      expect(usersFile).toBeTruthy();
      
      const groupsFile = await mockR2.get('groups.csv');
      expect(groupsFile).toBeTruthy();
    });

    it('should delete tenant after rollback', async () => {
      await migration.rollbackMigration('org_rollback');

      const tenant = await tenantRegistry.getTenant('org_rollback');
      expect(tenant).toBeNull();
    });
  });
});
