/**
 * Permissions API Client
 *
 * Type-safe API calls for the permission system using generated SDK types.
 * Uses openapi-fetch with server$ for secure server-side API calls.
 */

import { server$ } from "@qwik.dev/router";
import createClient from "openapi-fetch";
import type { paths } from "./api-client.d";
import { getApiUrl } from "./config";

/**
 * Create a server-side API client with auth token
 */
function createPermissionsApiClient(accessToken: string) {
  const client = createClient<paths>({
    baseUrl: getApiUrl(),
  });

  client.use({
    onRequest({ request }) {
      request.headers.set("Authorization", `Bearer ${accessToken}`);
      return request;
    },
  });

  return client;
}

/**
 * Extract response types from SDK for easier typing
 */
type GrantRoleRequest = NonNullable<
  paths["/v1/permissions/grant"]["post"]["requestBody"]
>["content"]["application/json"];
type RevokeRoleRequest = NonNullable<
  paths["/v1/permissions/revoke"]["post"]["requestBody"]
>["content"]["application/json"];
type CreateRoleRequest = NonNullable<
  paths["/v1/roles"]["post"]["requestBody"]
>["content"]["application/json"];
type ListRolesQuery = paths["/v1/roles"]["get"]["parameters"]["query"];

/**
 * Grant a role to a user
 */
export const grantRole$ = server$(
  async (accessToken: string, data: GrantRoleRequest) => {
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    const client = createPermissionsApiClient(accessToken);
    const response = await client.POST("/v1/permissions/grant", {
      body: data,
    });

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error ||
        response.error?.message ||
        "Failed to grant role";
      throw new Error(errorMsg);
    }

    return response.data;
  }
);

/**
 * Revoke a role from a user
 */
export const revokeRole$ = server$(
  async (accessToken: string, data: RevokeRoleRequest) => {
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    const client = createPermissionsApiClient(accessToken);
    const response = await client.POST("/v1/permissions/revoke", {
      body: data,
    });

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error ||
        response.error?.message ||
        "Failed to revoke role";
      throw new Error(errorMsg);
    }

    return response.data;
  }
);

/**
 * Create a custom role
 */
export const createRole$ = server$(
  async (accessToken: string, data: CreateRoleRequest) => {
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    const client = createPermissionsApiClient(accessToken);
    const response = await client.POST("/v1/roles", {
      body: data,
    });

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error ||
        response.error?.message ||
        "Failed to create role";
      throw new Error(errorMsg);
    }

    return response.data;
  }
);

/**
 * List available roles
 */
export const listRoles$ = server$(
  async (accessToken: string, params?: ListRolesQuery) => {
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    const client = createPermissionsApiClient(accessToken);
    const response = await client.GET("/v1/roles", {
      params: {
        query: params,
      },
    });

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error ||
        response.error?.message ||
        "Failed to list roles";
      throw new Error(errorMsg);
    }

    return response.data;
  }
);

/**
 * Get a specific role by ID
 */
export const getRole$ = server$(async (accessToken: string, roleId: string) => {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const client = createPermissionsApiClient(accessToken);
  const response = await client.GET("/v1/roles/{roleId}", {
    params: {
      path: { roleId },
    },
  });

  if (response.error || !response.data) {
    const errorMsg =
      response.error?.error || response.error?.message || "Failed to get role";
    throw new Error(errorMsg);
  }

  return response.data;
});

/**
 * Get user's effective permissions
 */
export const getUserPermissions$ = server$(
  async (
    accessToken: string,
    userId: string,
    queryParams?: { organizationId?: string; teamId?: string }
  ) => {
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    const client = createPermissionsApiClient(accessToken);
    const response = await client.GET("/v1/users/{userId}/permissions", {
      params: {
        path: { userId },
        query: queryParams,
      },
    });

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error ||
        response.error?.message ||
        "Failed to get user permissions";
      throw new Error(errorMsg);
    }

    return response.data;
  }
);

/**
 * Get permission audit trail
 */
export const getAuditTrail$ = server$(
  async (
    accessToken: string,
    queryParams?: {
      organizationId?: string;
      action?:
        | "grant"
        | "revoke"
        | "role_create"
        | "role_update"
        | "role_delete";
      limit?: number;
    }
  ) => {
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    const client = createPermissionsApiClient(accessToken);
    const response = await client.GET("/v1/permissions/audit", {
      params: {
        query: queryParams as any, // Type assertion needed due to openapi-fetch query param typing
      },
    });

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error ||
        response.error?.message ||
        "Failed to get audit trail";
      throw new Error(errorMsg);
    }

    return response.data;
  }
);

/**
 * Permission metadata for UI display
 */
export const PERMISSION_CATEGORIES = {
  organization: {
    label: "Organization",
    icon: "🏢",
    color: "blue",
  },
  team: {
    label: "Team",
    icon: "👥",
    color: "green",
  },
  repository: {
    label: "Repository",
    icon: "📦",
    color: "purple",
  },
  data: {
    label: "Data",
    icon: "💾",
    color: "orange",
  },
  collaboration: {
    label: "Collaboration",
    icon: "💬",
    color: "pink",
  },
  admin: {
    label: "Admin",
    icon: "⚙️",
    color: "red",
  },
} as const;

/**
 * Get permission category from permission name
 */
export function getPermissionCategory(
  permissionName: string
): keyof typeof PERMISSION_CATEGORIES {
  if (permissionName.startsWith("org:")) return "organization";
  if (permissionName.startsWith("team:")) return "team";
  if (permissionName.startsWith("repo:")) return "repository";
  if (permissionName.startsWith("data:")) return "data";
  if (permissionName.startsWith("collab:")) return "collaboration";
  return "admin";
}

/**
 * Format permission name for display
 */
export function formatPermissionName(permissionName: string): string {
  return permissionName
    .split(":")
    .pop()!
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
