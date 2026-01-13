/**
 * Tenant Registry Service
 * 
 * Phase 2.0: Multi-Tenant Infrastructure
 * 
 * Manages tenant (organization) lifecycle, metadata, and schema versions.
 * Stores tenant data in Cloudflare KV for fast global access.
 */

import { getDefaultSchema } from '../types/schema';

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'deleted';
export type TenantPlan = 'free' | 'starter' | 'pro' | 'enterprise';

export interface Tenant {
  id: string;
  name: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  status: TenantStatus;
  plan: TenantPlan;
  metadata?: {
    owner?: string;
    email?: string;
    industry?: string;
    size?: 'small' | 'medium' | 'large' | 'enterprise';
  };
}

export interface TenantCreateInput {
  id: string;
  name: string;
  plan?: TenantPlan;
  metadata?: Tenant['metadata'];
}

export interface TenantUpdateInput {
  name?: string;
  status?: TenantStatus;
  plan?: TenantPlan;
  metadata?: Tenant['metadata'];
}

export class TenantRegistry {
  constructor(
    private kv: KVNamespace,
    private r2: R2Bucket
  ) {}

  /**
   * Get tenant by ID
   */
  async getTenant(orgId: string): Promise<Tenant | null> {
    const data = await this.kv.get(`tenant:${orgId}`);
    if (!data) return null;

    try {
      return JSON.parse(data) as Tenant;
    } catch (error) {
      console.error(`[TenantRegistry] Failed to parse tenant ${orgId}:`, error);
      return null;
    }
  }

  /**
   * Check if tenant exists
   */
  async exists(orgId: string): Promise<boolean> {
    const tenant = await this.getTenant(orgId);
    return tenant !== null && tenant.status !== 'deleted';
  }

  /**
   * Create new tenant with default schema
   */
  async createTenant(input: TenantCreateInput): Promise<Tenant> {
    // Check if tenant already exists
    const existing = await this.getTenant(input.id);
    if (existing && existing.status !== 'deleted') {
      throw new Error(`Tenant ${input.id} already exists`);
    }

    const now = new Date().toISOString();
    const tenant: Tenant = {
      id: input.id,
      name: input.name,
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      status: 'trial',
      plan: input.plan || 'free',
      metadata: input.metadata,
    };

    // Store tenant metadata in KV
    await this.kv.put(`tenant:${tenant.id}`, JSON.stringify(tenant));

    // Initialize default schema in R2
    await this.initializeDefaultSchema(tenant.id);

    console.log(`[TenantRegistry] Created tenant: ${tenant.id}`);
    return tenant;
  }

  /**
   * Update tenant metadata
   */
  async updateTenant(orgId: string, input: TenantUpdateInput): Promise<Tenant> {
    const tenant = await this.getTenant(orgId);
    if (!tenant) {
      throw new Error(`Tenant ${orgId} not found`);
    }

    // Update fields
    const updated: Tenant = {
      ...tenant,
      name: input.name ?? tenant.name,
      status: input.status ?? tenant.status,
      plan: input.plan ?? tenant.plan,
      metadata: input.metadata ?? tenant.metadata,
      updatedAt: new Date().toISOString(),
    };

    await this.kv.put(`tenant:${orgId}`, JSON.stringify(updated));

    console.log(`[TenantRegistry] Updated tenant: ${orgId}`);
    return updated;
  }

  /**
   * List all tenants (with optional status filter)
   */
  async listTenants(options?: {
    status?: TenantStatus;
    plan?: TenantPlan;
    limit?: number;
  }): Promise<Tenant[]> {
    const list = await this.kv.list({ prefix: 'tenant:' });
    const tenants: Tenant[] = [];

    for (const key of list.keys) {
      const data = await this.kv.get(key.name);
      if (!data) continue;

      try {
        const tenant = JSON.parse(data) as Tenant;

        // Apply filters
        if (options?.status && tenant.status !== options.status) continue;
        if (options?.plan && tenant.plan !== options.plan) continue;

        tenants.push(tenant);

        // Apply limit
        if (options?.limit && tenants.length >= options.limit) break;
      } catch (error) {
        console.error(`[TenantRegistry] Failed to parse tenant ${key.name}:`, error);
      }
    }

    return tenants;
  }

  /**
   * Suspend tenant (soft delete)
   */
  async suspendTenant(orgId: string, reason?: string): Promise<void> {
    const tenant = await this.getTenant(orgId);
    if (!tenant) {
      throw new Error(`Tenant ${orgId} not found`);
    }

    tenant.status = 'suspended';
    tenant.updatedAt = new Date().toISOString();
    if (reason) {
      tenant.metadata = {
        ...tenant.metadata,
        suspensionReason: reason,
      } as any;
    }

    await this.kv.put(`tenant:${orgId}`, JSON.stringify(tenant));
    console.log(`[TenantRegistry] Suspended tenant: ${orgId}`);
  }

  /**
   * Reactivate suspended tenant
   */
  async reactivateTenant(orgId: string): Promise<void> {
    const tenant = await this.getTenant(orgId);
    if (!tenant) {
      throw new Error(`Tenant ${orgId} not found`);
    }

    if (tenant.status !== 'suspended') {
      throw new Error(`Tenant ${orgId} is not suspended`);
    }

    tenant.status = 'active';
    tenant.updatedAt = new Date().toISOString();

    await this.kv.put(`tenant:${orgId}`, JSON.stringify(tenant));
    console.log(`[TenantRegistry] Reactivated tenant: ${orgId}`);
  }

  /**
   * Delete tenant (mark as deleted, preserve data)
   */
  async deleteTenant(orgId: string): Promise<void> {
    const tenant = await this.getTenant(orgId);
    if (!tenant) {
      throw new Error(`Tenant ${orgId} not found`);
    }

    tenant.status = 'deleted';
    tenant.updatedAt = new Date().toISOString();

    await this.kv.put(`tenant:${orgId}`, JSON.stringify(tenant));
    console.log(`[TenantRegistry] Deleted tenant: ${orgId}`);
  }

  /**
   * Permanently delete tenant and all data
   * WARNING: This is irreversible!
   */
  async permanentlyDeleteTenant(orgId: string): Promise<void> {
    // Delete from KV
    await this.kv.delete(`tenant:${orgId}`);

    // Delete from R2 (all org data)
    const objects = await this.r2.list({ prefix: `${orgId}/` });
    for (const obj of objects.objects) {
      await this.r2.delete(obj.key);
    }

    console.log(`[TenantRegistry] Permanently deleted tenant: ${orgId}`);
  }

  /**
   * Upgrade tenant schema version
   */
  async upgradeSchemaVersion(orgId: string, newVersion: number): Promise<void> {
    const tenant = await this.getTenant(orgId);
    if (!tenant) {
      throw new Error(`Tenant ${orgId} not found`);
    }

    tenant.schemaVersion = newVersion;
    tenant.updatedAt = new Date().toISOString();

    await this.kv.put(`tenant:${orgId}`, JSON.stringify(tenant));
    console.log(`[TenantRegistry] Upgraded tenant ${orgId} to schema v${newVersion}`);
  }

  /**
   * Initialize default schema for new tenant
   * @private
   */
  private async initializeDefaultSchema(orgId: string): Promise<void> {
    const defaultSchema = getDefaultSchema();

    // Store current schema
    await this.r2.put(
      `${orgId}/schema/current.json`,
      JSON.stringify(defaultSchema, null, 2),
      {
        httpMetadata: {
          contentType: 'application/json',
        },
      }
    );

    // Store as version 1
    await this.r2.put(
      `${orgId}/schema/versions/v1.json`,
      JSON.stringify(defaultSchema, null, 2),
      {
        httpMetadata: {
          contentType: 'application/json',
        },
        customMetadata: {
          createdAt: new Date().toISOString(),
          active: 'true',
        },
      }
    );

    console.log(`[TenantRegistry] Initialized default schema for ${orgId}`);
  }

  /**
   * Get tenant statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<TenantStatus, number>;
    byPlan: Record<TenantPlan, number>;
  }> {
    const tenants = await this.listTenants();

    const stats = {
      total: tenants.length,
      byStatus: {
        active: 0,
        suspended: 0,
        trial: 0,
        deleted: 0,
      } as Record<TenantStatus, number>,
      byPlan: {
        free: 0,
        starter: 0,
        pro: 0,
        enterprise: 0,
      } as Record<TenantPlan, number>,
    };

    for (const tenant of tenants) {
      stats.byStatus[tenant.status]++;
      stats.byPlan[tenant.plan]++;
    }

    return stats;
  }
}
