/**
 * Tenant Registry Tests
 * 
 * Tests for tenant lifecycle management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantRegistry, type Tenant, type TenantCreateInput } from '../src/services/tenant-registry';

// Mock KV and R2
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
  private objects = new Map<string, any>();

  async get(key: string): Promise<any> {
    return this.objects.get(key) || null;
  }

  async put(key: string, value: string, options?: any): Promise<void> {
    this.objects.set(key, { key, value, ...options });
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async list(options?: { prefix?: string }): Promise<{ objects: Array<{ key: string }> }> {
    const objects = Array.from(this.objects.keys())
      .filter(key => !options?.prefix || key.startsWith(options.prefix))
      .map(key => ({ key }));
    return { objects };
  }

  clear() {
    this.objects.clear();
  }
}

describe('TenantRegistry', () => {
  let registry: TenantRegistry;
  let mockKV: MockKVNamespace;
  let mockR2: MockR2Bucket;

  beforeEach(() => {
    mockKV = new MockKVNamespace();
    mockR2 = new MockR2Bucket();
    registry = new TenantRegistry(mockKV as any, mockR2 as any);
  });

  describe('createTenant', () => {
    it('should create new tenant with default values', async () => {
      const input: TenantCreateInput = {
        id: 'org_test',
        name: 'Test Organization',
      };

      const tenant = await registry.createTenant(input);

      expect(tenant.id).toBe('org_test');
      expect(tenant.name).toBe('Test Organization');
      expect(tenant.status).toBe('trial');
      expect(tenant.plan).toBe('free');
      expect(tenant.schemaVersion).toBe(1);
      expect(tenant.createdAt).toBeTruthy();
      expect(tenant.updatedAt).toBeTruthy();
    });

    it('should create tenant with custom plan', async () => {
      const input: TenantCreateInput = {
        id: 'org_pro',
        name: 'Pro Organization',
        plan: 'pro',
      };

      const tenant = await registry.createTenant(input);

      expect(tenant.plan).toBe('pro');
    });

    it('should create tenant with metadata', async () => {
      const input: TenantCreateInput = {
        id: 'org_meta',
        name: 'Organization with Metadata',
        metadata: {
          owner: 'john@example.com',
          industry: 'healthcare',
          size: 'medium',
        },
      };

      const tenant = await registry.createTenant(input);

      expect(tenant.metadata?.owner).toBe('john@example.com');
      expect(tenant.metadata?.industry).toBe('healthcare');
      expect(tenant.metadata?.size).toBe('medium');
    });

    it('should initialize default schema in R2', async () => {
      const input: TenantCreateInput = {
        id: 'org_schema',
        name: 'Schema Test',
      };

      await registry.createTenant(input);

      // Check that schema files were created
      const objects = await mockR2.list({ prefix: 'org_schema/schema/' });
      expect(objects.objects.length).toBeGreaterThan(0);
    });

    it('should throw error if tenant already exists', async () => {
      const input: TenantCreateInput = {
        id: 'org_duplicate',
        name: 'Duplicate',
      };

      await registry.createTenant(input);

      await expect(registry.createTenant(input)).rejects.toThrow(
        'Tenant org_duplicate already exists'
      );
    });
  });

  describe('getTenant', () => {
    it('should return tenant if exists', async () => {
      const input: TenantCreateInput = {
        id: 'org_get',
        name: 'Get Test',
      };

      await registry.createTenant(input);
      const tenant = await registry.getTenant('org_get');

      expect(tenant).toBeTruthy();
      expect(tenant!.id).toBe('org_get');
      expect(tenant!.name).toBe('Get Test');
    });

    it('should return null if tenant does not exist', async () => {
      const tenant = await registry.getTenant('org_nonexistent');
      expect(tenant).toBeNull();
    });

    it('should handle corrupt data gracefully', async () => {
      await mockKV.put('tenant:org_corrupt', 'invalid json {');
      const tenant = await registry.getTenant('org_corrupt');
      expect(tenant).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing tenant', async () => {
      await registry.createTenant({
        id: 'org_exists',
        name: 'Exists Test',
      });

      const exists = await registry.exists('org_exists');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent tenant', async () => {
      const exists = await registry.exists('org_nonexistent');
      expect(exists).toBe(false);
    });

    it('should return false for deleted tenant', async () => {
      await registry.createTenant({
        id: 'org_deleted',
        name: 'Deleted Test',
      });
      await registry.deleteTenant('org_deleted');

      const exists = await registry.exists('org_deleted');
      expect(exists).toBe(false);
    });
  });

  describe('updateTenant', () => {
    it('should update tenant name', async () => {
      await registry.createTenant({
        id: 'org_update',
        name: 'Original Name',
      });

      const updated = await registry.updateTenant('org_update', {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
    });

    it('should update tenant status', async () => {
      await registry.createTenant({
        id: 'org_status',
        name: 'Status Test',
      });

      const updated = await registry.updateTenant('org_status', {
        status: 'active',
      });

      expect(updated.status).toBe('active');
    });

    it('should update tenant plan', async () => {
      await registry.createTenant({
        id: 'org_plan',
        name: 'Plan Test',
      });

      const updated = await registry.updateTenant('org_plan', {
        plan: 'enterprise',
      });

      expect(updated.plan).toBe('enterprise');
    });

    it('should update metadata', async () => {
      await registry.createTenant({
        id: 'org_metadata',
        name: 'Metadata Test',
      });

      const updated = await registry.updateTenant('org_metadata', {
        metadata: {
          email: 'contact@example.com',
          size: 'large',
        },
      });

      expect(updated.metadata?.email).toBe('contact@example.com');
      expect(updated.metadata?.size).toBe('large');
    });

    it('should update updatedAt timestamp', async () => {
      const created = await registry.createTenant({
        id: 'org_timestamp',
        name: 'Timestamp Test',
      });

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await registry.updateTenant('org_timestamp', {
        name: 'Updated',
      });

      expect(updated.updatedAt).not.toBe(created.updatedAt);
    });

    it('should throw error if tenant does not exist', async () => {
      await expect(
        registry.updateTenant('org_nonexistent', { name: 'Updated' })
      ).rejects.toThrow('Tenant org_nonexistent not found');
    });
  });

  describe('listTenants', () => {
    beforeEach(async () => {
      await registry.createTenant({ id: 'org_1', name: 'Org 1', plan: 'free' });
      await registry.createTenant({ id: 'org_2', name: 'Org 2', plan: 'pro' });
      await registry.createTenant({ id: 'org_3', name: 'Org 3', plan: 'enterprise' });
      
      await registry.updateTenant('org_1', { status: 'active' });
      await registry.updateTenant('org_2', { status: 'active' });
      // org_3 stays as trial
    });

    it('should list all tenants', async () => {
      const tenants = await registry.listTenants();
      expect(tenants).toHaveLength(3);
    });

    it('should filter by status', async () => {
      const activeTenants = await registry.listTenants({ status: 'active' });
      expect(activeTenants).toHaveLength(2);
      expect(activeTenants.every(t => t.status === 'active')).toBe(true);
    });

    it('should filter by plan', async () => {
      const proTenants = await registry.listTenants({ plan: 'pro' });
      expect(proTenants).toHaveLength(1);
      expect(proTenants[0].id).toBe('org_2');
    });

    it('should respect limit', async () => {
      const tenants = await registry.listTenants({ limit: 2 });
      expect(tenants).toHaveLength(2);
    });

    it('should return empty array if no tenants match', async () => {
      const tenants = await registry.listTenants({ status: 'deleted' });
      expect(tenants).toHaveLength(0);
    });
  });

  describe('suspendTenant', () => {
    it('should suspend active tenant', async () => {
      await registry.createTenant({ id: 'org_suspend', name: 'Suspend Test' });
      await registry.suspendTenant('org_suspend');

      const tenant = await registry.getTenant('org_suspend');
      expect(tenant!.status).toBe('suspended');
    });

    it('should store suspension reason', async () => {
      await registry.createTenant({ id: 'org_reason', name: 'Reason Test' });
      await registry.suspendTenant('org_reason', 'Payment failed');

      const tenant = await registry.getTenant('org_reason');
      expect((tenant!.metadata as any).suspensionReason).toBe('Payment failed');
    });

    it('should throw error if tenant does not exist', async () => {
      await expect(registry.suspendTenant('org_nonexistent')).rejects.toThrow(
        'Tenant org_nonexistent not found'
      );
    });
  });

  describe('reactivateTenant', () => {
    it('should reactivate suspended tenant', async () => {
      await registry.createTenant({ id: 'org_reactivate', name: 'Reactivate Test' });
      await registry.suspendTenant('org_reactivate');
      await registry.reactivateTenant('org_reactivate');

      const tenant = await registry.getTenant('org_reactivate');
      expect(tenant!.status).toBe('active');
    });

    it('should throw error if tenant is not suspended', async () => {
      await registry.createTenant({ id: 'org_active', name: 'Active Test' });
      await registry.updateTenant('org_active', { status: 'active' });

      await expect(registry.reactivateTenant('org_active')).rejects.toThrow(
        'Tenant org_active is not suspended'
      );
    });

    it('should throw error if tenant does not exist', async () => {
      await expect(registry.reactivateTenant('org_nonexistent')).rejects.toThrow(
        'Tenant org_nonexistent not found'
      );
    });
  });

  describe('deleteTenant', () => {
    it('should mark tenant as deleted', async () => {
      await registry.createTenant({ id: 'org_delete', name: 'Delete Test' });
      await registry.deleteTenant('org_delete');

      const tenant = await registry.getTenant('org_delete');
      expect(tenant!.status).toBe('deleted');
    });

    it('should throw error if tenant does not exist', async () => {
      await expect(registry.deleteTenant('org_nonexistent')).rejects.toThrow(
        'Tenant org_nonexistent not found'
      );
    });
  });

  describe('permanentlyDeleteTenant', () => {
    it('should remove tenant from KV', async () => {
      await registry.createTenant({ id: 'org_permanent', name: 'Permanent Delete' });
      await registry.permanentlyDeleteTenant('org_permanent');

      const tenant = await registry.getTenant('org_permanent');
      expect(tenant).toBeNull();
    });

    it('should remove all R2 data', async () => {
      await registry.createTenant({ id: 'org_r2delete', name: 'R2 Delete' });
      await registry.permanentlyDeleteTenant('org_r2delete');

      const objects = await mockR2.list({ prefix: 'org_r2delete/' });
      expect(objects.objects).toHaveLength(0);
    });
  });

  describe('upgradeSchemaVersion', () => {
    it('should increment schema version', async () => {
      await registry.createTenant({ id: 'org_upgrade', name: 'Upgrade Test' });
      await registry.upgradeSchemaVersion('org_upgrade', 2);

      const tenant = await registry.getTenant('org_upgrade');
      expect(tenant!.schemaVersion).toBe(2);
    });

    it('should throw error if tenant does not exist', async () => {
      await expect(
        registry.upgradeSchemaVersion('org_nonexistent', 2)
      ).rejects.toThrow('Tenant org_nonexistent not found');
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await registry.createTenant({ id: 'org_stat1', name: 'Stat 1', plan: 'free' });
      await registry.createTenant({ id: 'org_stat2', name: 'Stat 2', plan: 'pro' });
      await registry.createTenant({ id: 'org_stat3', name: 'Stat 3', plan: 'pro' });
      
      await registry.updateTenant('org_stat1', { status: 'active' });
      await registry.updateTenant('org_stat2', { status: 'active' });
      await registry.suspendTenant('org_stat3');
    });

    it('should count total tenants', async () => {
      const stats = await registry.getStats();
      expect(stats.total).toBe(3);
    });

    it('should count tenants by status', async () => {
      const stats = await registry.getStats();
      expect(stats.byStatus.active).toBe(2);
      expect(stats.byStatus.suspended).toBe(1);
      expect(stats.byStatus.trial).toBe(0);
    });

    it('should count tenants by plan', async () => {
      const stats = await registry.getStats();
      expect(stats.byPlan.free).toBe(1);
      expect(stats.byPlan.pro).toBe(2);
      expect(stats.byPlan.starter).toBe(0);
      expect(stats.byPlan.enterprise).toBe(0);
    });
  });
});
