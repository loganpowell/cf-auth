/**
 * Namespace Isolation Utilities
 *
 * Provides helpers for isolating tenant data through ID prefixing.
 * Pattern: tenant:acme-corp:resource-type:resource-id
 *
 * This prevents cross-tenant data leakage by prefixing all resource IDs
 * with the tenant context, making it impossible to access another tenant's data
 * even if validation somehow fails.
 */

/**
 * Build a namespaced ID for a resource
 *
 * @example
 * // Single tenant
 * namespaceId('tenant:acme-corp', 'user', 'alice')
 * // → 'tenant:acme-corp:user:alice'
 *
 * @example
 * // Nested tenant (sub-org)
 * namespaceId('tenant:enterprise:dept:engineering', 'project', 'proj-123')
 * // → 'tenant:enterprise:dept:engineering:project:proj-123'
 */
export function namespaceId(
  tenantId: string,
  resourceType: string,
  resourceId: string
): string {
  // Validate inputs
  if (!tenantId || !resourceType || !resourceId) {
    throw new Error("tenantId, resourceType, and resourceId are required");
  }

  // Prevent double-namespacing (idempotent)
  if (resourceId.includes(":")) {
    // Already namespaced, extract just the ID part
    const parts = resourceId.split(":");
    const actualId = parts[parts.length - 1];
    return `${tenantId}:${resourceType}:${actualId}`;
  }

  return `${tenantId}:${resourceType}:${resourceId}`;
}

/**
 * Extract resource ID from a namespaced ID
 *
 * @example
 * extractResourceId('tenant:acme-corp:user:alice')
 * // → 'alice'
 */
export function extractResourceId(namespacedId: string): string {
  const parts = namespacedId.split(":");
  return parts[parts.length - 1];
}

/**
 * Extract resource type from a namespaced ID
 *
 * @example
 * extractResourceType('tenant:acme-corp:user:alice')
 * // → 'user'
 */
export function extractResourceType(namespacedId: string): string {
  const parts = namespacedId.split(":");
  if (parts.length < 4) {
    throw new Error(`Invalid namespaced ID: ${namespacedId}`);
  }
  // Second-to-last part before ID
  return parts[parts.length - 2];
}

/**
 * Extract tenant ID from a namespaced ID
 * Handles both simple (tenant:x:type:id) and nested (tenant:x:y:z:type:id)
 *
 * @example
 * extractTenantId('tenant:acme-corp:user:alice')
 * // → 'tenant:acme-corp'
 *
 * @example
 * extractTenantId('tenant:enterprise:dept:engineering:project:proj-123')
 * // → 'tenant:enterprise:dept:engineering'
 */
export function extractTenantId(namespacedId: string): string {
  const parts = namespacedId.split(":");

  // Minimum: ['tenant', 'x', 'type', 'id'] = 4 parts
  if (parts.length < 4) {
    throw new Error(`Invalid namespaced ID: ${namespacedId}`);
  }

  // Tenant ID is all parts except the last 2 (type and id)
  return parts.slice(0, -2).join(":");
}

/**
 * Verify that a namespaced ID belongs to a tenant
 *
 * @example
 * verifyTenantOwnership(
 *   'tenant:acme-corp:user:alice',
 *   'tenant:acme-corp'
 * )
 * // → true
 *
 * @example
 * verifyTenantOwnership(
 *   'tenant:acme-corp:user:alice',
 *   'tenant:evil-corp'
 * )
 * // → false (prevents cross-tenant access)
 */
export function verifyTenantOwnership(
  namespacedId: string,
  tenantId: string
): boolean {
  try {
    const idTenant = extractTenantId(namespacedId);
    return idTenant === tenantId;
  } catch {
    return false;
  }
}

/**
 * Helper: Namespace multiple IDs
 *
 * @example
 * namespaceIds('tenant:acme-corp', 'user', ['alice', 'bob', 'charlie'])
 * // → ['tenant:acme-corp:user:alice', 'tenant:acme-corp:user:bob', ...]
 */
export function namespaceIds(
  tenantId: string,
  resourceType: string,
  resourceIds: string[]
): string[] {
  return resourceIds.map((id) => namespaceId(tenantId, resourceType, id));
}

/**
 * Helper: Extract resource IDs from namespaced IDs
 *
 * @example
 * extractResourceIds([
 *   'tenant:acme-corp:user:alice',
 *   'tenant:acme-corp:user:bob'
 * ])
 * // → ['alice', 'bob']
 */
export function extractResourceIds(namespacedIds: string[]): string[] {
  return namespacedIds.map((id) => extractResourceId(id));
}

/**
 * Helper: Build SQL WHERE clause for tenant isolation
 * Ensures queries can't leak across tenants
 *
 * @example
 * const clause = buildTenantWhereClause('users', 'tenant:acme-corp')
 * // → "users.id LIKE 'tenant:acme-corp:%'"
 *
 * Use in queries:
 * SELECT * FROM users WHERE ${clause} AND email = ?
 */
export function buildTenantWhereClause(
  tableName: string,
  tenantId: string
): string {
  const escaped = tenantId.replace(/'/g, "''"); // SQL escape single quotes
  return `${tableName}.id LIKE '${escaped}:%'`;
}

/**
 * Helper: Validate namespace format before using
 *
 * Format: tenant:{slug}:resource-type:resource-id
 * or: tenant:{slug}:sub-org:sub-id:resource-type:resource-id (nested)
 *
 * @example
 * isValidNamespacedId('tenant:acme-corp:user:alice')
 * // → true
 *
 * @example
 * isValidNamespacedId('invalid:format')
 * // → false
 */
export function isValidNamespacedId(id: string): boolean {
  // Must have at least 4 parts: tenant, slug/id, type, resource-id
  const parts = id.split(":");
  if (parts.length < 4) {
    return false;
  }

  // First part must be 'tenant'
  if (parts[0] !== "tenant") {
    return false;
  }

  // All parts must be non-empty
  if (parts.some((part) => !part)) {
    return false;
  }

  // All parts must be alphanumeric, hyphens, or underscores
  const validChars = /^[a-z0-9_-]+$/i;
  if (!parts.every((part) => validChars.test(part))) {
    return false;
  }

  return true;
}

/**
 * Helper: Get all parent tenant IDs from a nested tenant
 *
 * @example
 * getParentTenantIds('tenant:enterprise:dept:engineering')
 * // → ['tenant:enterprise', 'tenant:enterprise:dept']
 *
 * Useful for checking hierarchical permissions
 */
export function getParentTenantIds(tenantId: string): string[] {
  const parts = tenantId.split(":");

  if (parts.length < 2) {
    return [];
  }

  const parents: string[] = [];

  // Build each parent level
  for (let i = 2; i < parts.length; i++) {
    parents.push(parts.slice(0, i).join(":"));
  }

  return parents;
}

/**
 * Helper: Check if one tenant is a sub-tenant of another
 *
 * @example
 * isSubTenantOf(
 *   'tenant:enterprise:dept:engineering',
 *   'tenant:enterprise'
 * )
 * // → true (engineering is under enterprise)
 *
 * @example
 * isSubTenantOf(
 *   'tenant:acme-corp',
 *   'tenant:enterprise'
 * )
 * // → false (different root tenants)
 */
export function isSubTenantOf(childTenant: string, parentTenant: string): boolean {
  if (childTenant === parentTenant) {
    return true;
  }

  const parents = getParentTenantIds(childTenant);
  return parents.includes(parentTenant);
}

/**
 * Type-safe namespace builder
 * Useful for building namespaced IDs with type checking
 *
 * @example
 * const ns = new NamespaceBuilder('tenant:acme-corp');
 *
 * const userId = ns.build('user', 'alice');
 * // → 'tenant:acme-corp:user:alice'
 *
 * const projectId = ns.build('project', 'proj-123');
 * // → 'tenant:acme-corp:project:proj-123'
 */
export class NamespaceBuilder {
  constructor(private tenantId: string) {
    if (!tenantId.startsWith("tenant:")) {
      throw new Error(`Invalid tenant ID: ${tenantId}`);
    }
  }

  build(resourceType: string, resourceId: string): string {
    return namespaceId(this.tenantId, resourceType, resourceId);
  }

  buildMany(resourceType: string, resourceIds: string[]): string[] {
    return namespaceIds(this.tenantId, resourceType, resourceIds);
  }

  extract(namespacedId: string): { type: string; id: string } {
    if (!verifyTenantOwnership(namespacedId, this.tenantId)) {
      throw new Error(`ID does not belong to tenant ${this.tenantId}`);
    }

    return {
      type: extractResourceType(namespacedId),
      id: extractResourceId(namespacedId),
    };
  }

  extractMany(namespacedIds: string[]): Array<{ type: string; id: string }> {
    return namespacedIds.map((id) => this.extract(id));
  }

  whereClause(tableName: string = ""): string {
    const table = tableName ? `${tableName}.` : "";
    return `${table}id LIKE '${this.tenantId}:%'`;
  }
}
