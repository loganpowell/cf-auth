/**
 * Migration Utility for Backward Compatibility
 * 
 * Phase 2.0: Multi-Tenant Infrastructure
 * 
 * Handles migration from single-tenant structure to multi-tenant structure.
 * This utility helps migrate existing deployments that used the hardcoded
 * Phase 0/1 schema to the new per-tenant dynamic schema structure.
 */

import { getDefaultSchema } from '../types/schema';
import type { TenantRegistry } from './tenant-registry';

export interface MigrationStatus {
  completed: boolean;
  tenantsMigrated: string[];
  errors: Array<{ tenant: string; error: string }>;
  dataFilesMigrated: number;
  startedAt: string;
  completedAt?: string;
}

export class MigrationService {
  constructor(
    private tenantRegistry: TenantRegistry,
    private r2: R2Bucket,
    private kv: KVNamespace
  ) {}

  /**
   * Check if migration is needed (old structure exists)
   */
  async needsMigration(): Promise<boolean> {
    try {
      // Check for old root-level CSV files
      const oldFiles = await this.r2.list({ prefix: '', delimiter: '/' });
      
      // Look for files that indicate old structure (e.g., users.csv at root)
      const hasOldStructure = oldFiles.objects.some(obj => 
        obj.key === 'users.csv' || 
        obj.key === 'groups.csv' || 
        obj.key === 'resources.csv'
      );

      return hasOldStructure;
    } catch (error) {
      console.error('[Migration] Error checking migration status:', error);
      return false;
    }
  }

  /**
   * Migrate single-tenant data to multi-tenant structure
   * 
   * This migrates the default organization (org_default) from root-level
   * CSV files to the new per-tenant structure.
   */
  async migrateToMultiTenant(defaultOrgId: string = 'org_default'): Promise<MigrationStatus> {
    const status: MigrationStatus = {
      completed: false,
      tenantsMigrated: [],
      errors: [],
      dataFilesMigrated: 0,
      startedAt: new Date().toISOString(),
    };

    console.log(`[Migration] Starting migration for ${defaultOrgId}`);

    try {
      // Step 1: Create default tenant
      await this.createDefaultTenant(defaultOrgId);
      status.tenantsMigrated.push(defaultOrgId);

      // Step 2: Migrate CSV files from root to tenant directory
      const migratedFiles = await this.migrateDataFiles(defaultOrgId);
      status.dataFilesMigrated = migratedFiles;

      // Step 3: Store migration metadata
      await this.storeMigrationMetadata(defaultOrgId);

      status.completed = true;
      status.completedAt = new Date().toISOString();

      console.log(`[Migration] Completed successfully: ${migratedFiles} files migrated`);
    } catch (error) {
      console.error('[Migration] Error during migration:', error);
      status.errors.push({
        tenant: defaultOrgId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return status;
  }

  /**
   * Create default tenant for migration
   */
  private async createDefaultTenant(orgId: string): Promise<void> {
    // Check if tenant already exists
    const existing = await this.tenantRegistry.getTenant(orgId);
    if (existing) {
      console.log(`[Migration] Tenant ${orgId} already exists, skipping creation`);
      return;
    }

    // Create tenant with default schema
    await this.tenantRegistry.createTenant({
      id: orgId,
      name: 'Default Organization (Migrated)',
      plan: 'pro', // Give migrated orgs pro plan
      metadata: {
        migrated: true,
        migratedAt: new Date().toISOString(),
      } as any,
    });

    console.log(`[Migration] Created default tenant: ${orgId}`);
  }

  /**
   * Migrate data files from root to tenant directory
   */
  private async migrateDataFiles(orgId: string): Promise<number> {
    const filesToMigrate = [
      'users.csv',
      'groups.csv',
      'resources.csv',
      'member_of.csv',
      'inherits_from.csv',
      'user_permissions.csv',
      'group_permissions.csv',
      'has_permission.csv',
    ];

    let migratedCount = 0;

    for (const filename of filesToMigrate) {
      try {
        // Check if old file exists
        const oldFile = await this.r2.get(filename);
        if (!oldFile) {
          console.log(`[Migration] File ${filename} not found, skipping`);
          continue;
        }

        // Read old file content
        const content = await oldFile.text();

        // Write to new location
        const newKey = `${orgId}/data/${filename}`;
        await this.r2.put(newKey, content, {
          httpMetadata: {
            contentType: 'text/csv',
          },
          customMetadata: {
            migratedFrom: filename,
            migratedAt: new Date().toISOString(),
          },
        });

        console.log(`[Migration] Migrated ${filename} -> ${newKey}`);
        migratedCount++;

        // Optionally: Delete old file after successful migration
        // await this.r2.delete(filename);
      } catch (error) {
        console.error(`[Migration] Error migrating ${filename}:`, error);
      }
    }

    return migratedCount;
  }

  /**
   * Store migration metadata
   */
  private async storeMigrationMetadata(orgId: string): Promise<void> {
    const metadata = {
      version: 1,
      migratedAt: new Date().toISOString(),
      migratedFrom: 'single-tenant-root',
      migratedTo: `${orgId}/`,
    };

    await this.r2.put(
      `${orgId}/migration-metadata.json`,
      JSON.stringify(metadata, null, 2),
      {
        httpMetadata: {
          contentType: 'application/json',
        },
      }
    );

    // Also store in KV for quick access
    await this.kv.put(
      `migration:${orgId}`,
      JSON.stringify(metadata)
    );
  }

  /**
   * Rollback migration (restore to single-tenant structure)
   * WARNING: This should only be used for emergency rollback
   */
  async rollbackMigration(orgId: string): Promise<void> {
    console.log(`[Migration] Rolling back migration for ${orgId}`);

    try {
      // Get list of migrated files
      const objects = await this.r2.list({ prefix: `${orgId}/data/` });

      // Copy files back to root
      for (const obj of objects.objects) {
        const file = await this.r2.get(obj.key);
        if (!file) continue;

        const content = await file.text();
        const filename = obj.key.split('/').pop();
        if (!filename) continue;

        await this.r2.put(filename, content, {
          httpMetadata: {
            contentType: 'text/csv',
          },
        });

        console.log(`[Migration] Restored ${obj.key} -> ${filename}`);
      }

      // Delete tenant
      await this.tenantRegistry.permanentlyDeleteTenant(orgId);

      console.log(`[Migration] Rollback completed for ${orgId}`);
    } catch (error) {
      console.error('[Migration] Error during rollback:', error);
      throw error;
    }
  }

  /**
   * Verify migration integrity
   */
  async verifyMigration(orgId: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // Check tenant exists
      const tenant = await this.tenantRegistry.getTenant(orgId);
      if (!tenant) {
        issues.push(`Tenant ${orgId} not found`);
      }

      // Check schema exists
      const schema = await this.r2.get(`${orgId}/schema/current.json`);
      if (!schema) {
        issues.push(`Schema not found for ${orgId}`);
      }

      // Check data directory exists
      const dataFiles = await this.r2.list({ prefix: `${orgId}/data/` });
      if (dataFiles.objects.length === 0) {
        issues.push(`No data files found for ${orgId}`);
      }

      // Check migration metadata
      const metadata = await this.r2.get(`${orgId}/migration-metadata.json`);
      if (!metadata) {
        issues.push(`Migration metadata not found for ${orgId}`);
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      issues.push(`Error verifying migration: ${error}`);
      return { valid: false, issues };
    }
  }

  /**
   * Get migration status for an organization
   */
  async getMigrationStatus(orgId: string): Promise<{
    migrated: boolean;
    migratedAt?: string;
    version?: number;
  } | null> {
    const data = await this.kv.get(`migration:${orgId}`);
    if (!data) return null;

    try {
      const metadata = JSON.parse(data);
      return {
        migrated: true,
        migratedAt: metadata.migratedAt,
        version: metadata.version,
      };
    } catch (error) {
      console.error(`[Migration] Failed to parse migration status for ${orgId}:`, error);
      return null;
    }
  }
}
