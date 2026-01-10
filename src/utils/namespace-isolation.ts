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
  const id = parts[parts.length - 1];
  if (!id) throw new Error("Invalid namespaced ID: " + namespacedId);
  return id;
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
  const type = parts[parts.length - 2];
  if (!type) throw new Error("Invalid namespaced ID: " + namespacedId);
  return type;
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
 * DEPRECATED FUNCTIONS - Not used in current implementation
 * These functions represent possible future extensions to namespace isolation.
 * Kept here for reference in case they're needed later.
 *
 * - extractResourceIds: Batch extraction of resource IDs
 * - buildTenantWhereClause: SQL WHERE clause builder
 * - isValidNamespacedId: Namespace format validator
 * - isSubTenantOf: Tenant hierarchy checker (requires getParentTenantIds)
 * - NamespaceBuilder: Type-safe namespace builder class
 *
 * To use these, uncomment and export as needed.
 */
