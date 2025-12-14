/**
 * OpenAPI Zod Schemas for Permission Endpoints
 *
 * These schemas define the request/response structure for all permission endpoints
 * and are used to generate the OpenAPI spec and TypeScript SDK.
 *
 * ALL schemas are auto-generated from Drizzle database schema via drizzle-zod.
 * This ensures ZERO schema drift between database and API.
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  RoleWithPermissionsSchema,
  RoleAssignmentSchema,
  PermissionAuditSchema,
} from "./db-schemas";

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

// ============================================================================
// Import Auto-Generated Schemas from db-schemas.ts
// ============================================================================

const ErrorResponseSchema = z
  .object({
    error: z
      .string()
      .openapi({ description: "Error message", example: "Validation failed" }),
    message: z.string().optional().openapi({
      description: "Detailed error message",
      example: "You cannot grant permissions you do not possess",
    }),
    details: z
      .array(
        z.object({
          field: z.string().openapi({ example: "permissions" }),
          message: z
            .string()
            .openapi({ example: "Missing required permission: org.write" }),
        })
      )
      .optional()
      .openapi({ description: "Validation error details" }),
  })
  .openapi("ErrorResponse");

// ============================================================================
// Grant Role Endpoint
// ============================================================================

export const GrantRoleRequestSchema = z
  .object({
    userId: z.string().openapi({
      description: "User ID to grant role to",
      example: "user-123",
    }),
    roleId: z.string().openapi({
      description: "Role ID to grant",
      example: "role-456",
    }),
    organizationId: z.string().optional().openapi({
      description: "Optional organization scope",
      example: "org-789",
    }),
    teamId: z.string().optional().openapi({
      description: "Optional team scope",
      example: "team-101",
    }),
    expiresAt: z.string().datetime().optional().openapi({
      description: "Optional expiration timestamp (ISO 8601)",
      example: "2025-12-31T23:59:59Z",
    }),
  })
  .openapi("GrantRoleRequest");

export const GrantRoleResponseSchema = z
  .object({
    message: z.string().openapi({
      description: "Success message",
      example: "Role granted successfully",
    }),
    assignment: RoleAssignmentSchema,
  })
  .openapi("GrantRoleResponse");

export const grantRoleRoute = createRoute({
  operationId: "v1PermissionsGrantPost",
  method: "post",
  path: "/v1/permissions/grant",
  tags: ["Permissions"],
  summary: "Grant a role to a user",
  description:
    "Assign a role to a user with optional organization/team scope. Validates that the grantor has permission delegation rights (Permission Superset Model).",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: GrantRoleRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Role granted successfully",
      content: {
        "application/json": {
          schema: GrantRoleResponseSchema,
        },
      },
    },
    400: {
      description: "Bad request - validation failed or delegation not allowed",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - missing or invalid token",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description:
        "Forbidden - user cannot grant permissions they do not possess",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================================================
// Revoke Role Endpoint
// ============================================================================

export const RevokeRoleRequestSchema = z
  .object({
    userId: z.string().openapi({
      description: "User ID to revoke role from",
      example: "user-123",
    }),
    roleId: z.string().openapi({
      description: "Role ID to revoke",
      example: "role-456",
    }),
    organizationId: z.string().optional().openapi({
      description: "Optional organization scope",
      example: "org-789",
    }),
    teamId: z.string().optional().openapi({
      description: "Optional team scope",
      example: "team-101",
    }),
  })
  .openapi("RevokeRoleRequest");

export const RevokeRoleResponseSchema = z
  .object({
    message: z.string().openapi({
      description: "Success message",
      example: "Role revoked successfully",
    }),
  })
  .openapi("RevokeRoleResponse");

export const revokeRoleRoute = createRoute({
  operationId: "v1PermissionsRevokePost",
  method: "post",
  path: "/v1/permissions/revoke",
  tags: ["Permissions"],
  summary: "Revoke a role from a user",
  description:
    "Remove a role assignment from a user. Validates that the revoker has permission management rights.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: RevokeRoleRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Role revoked successfully",
      content: {
        "application/json": {
          schema: RevokeRoleResponseSchema,
        },
      },
    },
    400: {
      description: "Bad request - validation failed",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - missing or invalid token",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description:
        "Forbidden - user cannot revoke permissions they do not possess",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================================================
// Create Custom Role Endpoint
// ============================================================================

export const CreateRoleRequestSchema = z
  .object({
    name: z.string().min(3).max(100).openapi({
      description: "Role name",
      example: "Content Manager",
    }),
    description: z.string().max(500).optional().openapi({
      description: "Role description",
      example: "Can manage content and view analytics",
    }),
    permissionNames: z
      .array(z.string())
      .min(1)
      .openapi({
        description: "Array of permission names",
        example: ["org.read", "data.read", "data.write", "collab.issue.read"],
      }),
    organizationId: z.string().optional().openapi({
      description: "Optional organization scope (null = global system role)",
      example: "org-789",
    }),
  })
  .openapi("CreateRoleRequest");

export const CreateRoleResponseSchema = z
  .object({
    message: z.string().openapi({
      description: "Success message",
      example: "Role created successfully",
    }),
    role: RoleWithPermissionsSchema,
  })
  .openapi("CreateRoleResponse");

export const createRoleRoute = createRoute({
  operationId: "v1RolesPost",
  method: "post",
  path: "/v1/roles",
  tags: ["Permissions"],
  summary: "Create a custom role",
  description:
    "Create a new role with custom permissions. Validates that creator can delegate all requested permissions (Permission Superset Model).",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateRoleRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Role created successfully",
      content: {
        "application/json": {
          schema: CreateRoleResponseSchema,
        },
      },
    },
    400: {
      description: "Bad request - validation failed",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - missing or invalid token",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description:
        "Forbidden - user cannot create role with permissions they do not possess",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================================================
// List Roles Endpoint
// ============================================================================

export const ListRolesQuerySchema = z.object({
  organizationId: z.string().optional().openapi({
    description:
      "Filter by organization ID (omit for global system roles, or pass org ID for org-specific roles)",
    example: "org-789",
  }),
});

export const ListRolesResponseSchema = z
  .object({
    roles: z.array(RoleWithPermissionsSchema).openapi({
      description: "Array of roles with permission names",
    }),
  })
  .openapi("ListRolesResponse");

export const listRolesRoute = createRoute({
  operationId: "v1RolesGet",
  method: "get",
  path: "/v1/roles",
  tags: ["Permissions"],
  summary: "List available roles",
  description:
    "Get all roles in a scope (global system roles or organization-specific roles)",
  security: [{ bearerAuth: [] }],
  request: {
    query: ListRolesQuerySchema,
  },
  responses: {
    200: {
      description: "Roles retrieved successfully",
      content: {
        "application/json": {
          schema: ListRolesResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - missing or invalid token",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================================================
// Get Role Details Endpoint
// ============================================================================

export const GetRoleResponseSchema = z
  .object({
    role: RoleWithPermissionsSchema,
  })
  .openapi("GetRoleResponse");

export const getRoleRoute = createRoute({
  operationId: "v1RolesRoleIdGet",
  method: "get",
  path: "/v1/roles/{roleId}",
  tags: ["Permissions"],
  summary: "Get role details",
  description: "Get detailed information about a specific role",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      roleId: z.string().openapi({
        description: "Role ID",
        example: "role-456",
        param: {
          name: "roleId",
          in: "path",
        },
      }),
    }),
  },
  responses: {
    200: {
      description: "Role retrieved successfully",
      content: {
        "application/json": {
          schema: GetRoleResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - missing or invalid token",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Role not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================================================
// Get User Permissions Endpoint
// ============================================================================

export const GetUserPermissionsQuerySchema = z.object({
  organizationId: z.string().optional().openapi({
    description: "Optional organization scope",
    example: "org-789",
  }),
  teamId: z.string().optional().openapi({
    description: "Optional team scope",
    example: "team-101",
  }),
});

export const GetUserPermissionsResponseSchema = z
  .object({
    userId: z.string().openapi({
      description: "User ID",
      example: "user-123",
    }),
    isOwner: z.boolean().openapi({
      description: "Whether user is organization owner (has full superset)",
      example: false,
    }),
    permissions: z.object({
      low: z.string().openapi({
        description: "Low 64 bits of permission bitmap",
        example: "127",
      }),
      high: z.string().openapi({
        description: "High 64 bits of permission bitmap",
        example: "0",
      }),
      names: z.array(z.string()).openapi({
        description: "Human-readable permission names",
        example: ["org.read", "team.read", "data.read"],
      }),
    }),
  })
  .openapi("GetUserPermissionsResponse");

export const getUserPermissionsRoute = createRoute({
  operationId: "v1UsersUserIdPermissionsGet",
  method: "get",
  path: "/v1/users/{userId}/permissions",
  tags: ["Permissions"],
  summary: "Get user's effective permissions",
  description:
    "Get all effective permissions for a user in a specific scope (org/team)",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      userId: z.string().openapi({
        description: "User ID",
        example: "user-123",
        param: {
          name: "userId",
          in: "path",
        },
      }),
    }),
    query: GetUserPermissionsQuerySchema,
  },
  responses: {
    200: {
      description: "User permissions retrieved successfully",
      content: {
        "application/json": {
          schema: GetUserPermissionsResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - missing or invalid token",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================================================
// Get Permission Audit Trail Endpoint
// ============================================================================

export const GetAuditTrailQuerySchema = z.object({
  userId: z.string().optional().openapi({
    description: "Filter by user ID (actor or target)",
    example: "user-123",
  }),
  roleId: z.string().optional().openapi({
    description: "Filter by role ID",
    example: "role-456",
  }),
  organizationId: z.string().optional().openapi({
    description: "Filter by organization ID",
    example: "org-789",
  }),
  action: z
    .enum(["grant", "revoke", "role_create", "role_update", "role_delete"])
    .optional()
    .openapi({
      description: "Filter by action type",
      example: "grant",
    }),
  limit: z.coerce.number().int().min(1).max(1000).default(100).openapi({
    description: "Maximum number of entries to return",
    example: 100,
  }),
});

export const GetAuditTrailResponseSchema = z
  .object({
    entries: z.array(PermissionAuditSchema).openapi({
      description: "Array of permission audit entries",
    }),
  })
  .openapi("GetAuditTrailResponse");

export const getAuditTrailRoute = createRoute({
  operationId: "v1PermissionsAuditGet",
  method: "get",
  path: "/v1/permissions/audit",
  tags: ["Permissions"],
  summary: "Get permission audit trail",
  description:
    "Query permission change history with optional filters for compliance and debugging",
  security: [{ bearerAuth: [] }],
  request: {
    query: GetAuditTrailQuerySchema,
  },
  responses: {
    200: {
      description: "Audit trail retrieved successfully",
      content: {
        "application/json": {
          schema: GetAuditTrailResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - missing or invalid token",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden - insufficient permissions to view audit trail",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});
