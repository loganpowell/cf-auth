/**
 * Permissions Dashboard Page
 *
 * Main interface for managing permissions and roles.
 * Allows users to:
 * - View available roles
 * - Assign roles to users (with delegation validation)
 * - View user permissions
 * - Create custom roles
 */

import { component$, useSignal, $, useContext } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { serverApi } from "~/lib/server-api";
import {
  RoleSelector,
  type Role,
} from "~/components/permissions/role-selector";
import { PermissionBadgeList } from "~/components/permissions/permission-badge";
import { UserPicker } from "~/components/permissions/user-picker";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card } from "~/components/ui/card";
import { ToastContextId, showToast } from "~/contexts/toast-context";

// Load initial data on the server side using cookies
export const usePermissionsData = routeLoader$(async ({ cookie, redirect }) => {
  const accessToken = cookie.get("accessToken");

  if (!accessToken?.value) {
    console.error("[Permissions Loader] No access token found");
    throw redirect(302, "/");
  }

  try {
    console.log("[Permissions Loader] Fetching data...");

    // Fetch all required data in parallel
    const [rolesData, usersData, userData] = await Promise.all([
      serverApi.listRoles(accessToken.value),
      serverApi.listUsers(accessToken.value),
      serverApi.getMe(accessToken.value),
    ]);

    console.log("[Permissions Loader] Data fetched:", {
      rolesCount: rolesData.roles?.length,
      usersCount: usersData.users?.length,
      userId: userData.user.id,
    });

    // Get user's permissions
    console.log(
      "[Permissions Loader] Fetching user permissions for:",
      userData.user.id
    );
    const permsData = await serverApi.getUserPermissions(
      accessToken.value,
      userData.user.id
    );

    console.log("[Permissions Loader] Permissions fetched:", {
      permsCount: permsData.permissions?.names?.length,
    });

    return {
      roles: rolesData.roles || [],
      users: usersData.users || [],
      myPermissions: permsData.permissions?.names || [],
      myUserId: userData.user.id,
      accessToken: accessToken.value,
    };
  } catch (error) {
    console.error("[Permissions Loader] Error:", error);
    console.error("[Permissions Loader] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Don't redirect, return empty data so we can see the error
    return {
      roles: [],
      users: [],
      myPermissions: [],
      myUserId: "",
      accessToken: accessToken.value,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

export default component$(() => {
  const toastContext = useContext(ToastContextId);
  const permissionsData = usePermissionsData();

  // Just use the loader data directly - accept that props will change
  const roles = permissionsData.value.roles;
  const users = permissionsData.value.users;
  const myPermissions = permissionsData.value.myPermissions;
  const accessToken = permissionsData.value.accessToken;
  const myUserId = permissionsData.value.myUserId;

  // Mutable state
  const selectedRole = useSignal<Role | null>(null);
  const targetUserId = useSignal("");
  const userPermissions = useSignal<string[]>([]);
  const loading = useSignal(false);
  const loadingUsers = useSignal(false);
  const showCreateRole = useSignal(false);

  // Create role form state
  const newRoleName = useSignal("");
  const newRoleDescription = useSignal("");
  const selectedPermissions = useSignal<string[]>([]);

  // Load target user permissions when user ID changes
  const loadUserPermissions = $(async () => {
    if (!targetUserId.value || !permissionsData.value.accessToken) {
      userPermissions.value = [];
      return;
    }

    try {
      const data = await serverApi.getUserPermissions(
        permissionsData.value.accessToken,
        targetUserId.value
      );
      userPermissions.value = data.permissions?.names || [];
    } catch {
      showToast(
        toastContext.toasts,
        "Failed to load user permissions",
        "error"
      );
      userPermissions.value = [];
    }
  });

  // Grant role to user
  const handleGrantRole = $(async () => {
    if (!selectedRole.value || !targetUserId.value || !accessToken) {
      showToast(
        toastContext.toasts,
        "Please select a role and enter a user ID",
        "error"
      );
      return;
    }

    try {
      loading.value = true;
      await serverApi.grantRole(accessToken, {
        userId: targetUserId.value,
        roleId: selectedRole.value.id,
      });

      showToast(
        toastContext.toasts,
        `Successfully granted "${selectedRole.value.name}" to user`,
        "success"
      );

      // Reload user permissions
      await loadUserPermissions();
    } catch (err) {
      const error = err as Error;
      showToast(
        toastContext.toasts,
        error.message || "Failed to grant role",
        "error"
      );
    } finally {
      loading.value = false;
    }
  });

  // Create custom role
  const handleCreateRole = $(async () => {
    if (
      !newRoleName.value ||
      selectedPermissions.value.length === 0 ||
      !accessToken
    ) {
      showToast(
        toastContext.toasts,
        "Please enter a role name and select at least one permission",
        "error"
      );
      return;
    }

    try {
      loading.value = true;
      const result = await serverApi.createRole(accessToken, {
        name: newRoleName.value,
        description: newRoleDescription.value || undefined,
        permissionNames: selectedPermissions.value,
      });

      showToast(
        toastContext.toasts,
        `Successfully created role "${result.role.name}". Refresh the page to see it.`,
        "success"
      );

      // Reset form
      newRoleName.value = "";
      newRoleDescription.value = "";
      selectedPermissions.value = [];
      showCreateRole.value = false;
    } catch (err) {
      const error = err as Error;
      showToast(
        toastContext.toasts,
        error.message || "Failed to create role",
        "error"
      );
    } finally {
      loading.value = false;
    }
  });

  return (
    <div class="container mx-auto px-4 py-8 max-w-6xl">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-black dark:text-white mb-2">
          Permissions Dashboard
        </h1>
        <p class="text-black dark:text-white opacity-70">
          Manage roles and permissions for users in your organization
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grant Role Section */}
        <Card>
          <div class="p-6">
            <h2 class="text-xl font-semibold text-black dark:text-white mb-4">
              Grant Role to User
            </h2>

            <div class="space-y-4">
              {/* User Picker */}
              <div>
                <label class="block text-sm font-medium text-black dark:text-white mb-2">
                  Select User
                </label>
                <UserPicker
                  users={users}
                  selectedUserId={targetUserId.value}
                  onSelect$={$((userId: string) => {
                    targetUserId.value = userId;
                    if (userId) {
                      loadUserPermissions();
                    } else {
                      userPermissions.value = [];
                    }
                  })}
                  disabled={loading.value}
                  loading={loadingUsers.value}
                />
              </div>

              {/* Role Selector */}
              <div>
                <label class="block text-sm font-medium text-black dark:text-white mb-2">
                  Select Role
                </label>
                <RoleSelector
                  key="role-selector-stable"
                  roles={roles}
                  selectedRoleId={selectedRole.value?.id}
                  userPermissions={myPermissions}
                  onSelect$={$((role: Role) => {
                    selectedRole.value = role;
                  })}
                  disabled={loading.value}
                />
              </div>

              {/* Grant Button */}
              <Button
                onClick$={handleGrantRole}
                disabled={
                  !selectedRole.value || !targetUserId.value || loading.value
                }
                class="w-full"
              >
                {loading.value ? "Granting..." : "Grant Role"}
              </Button>
            </div>
          </div>
        </Card>

        {/* User Permissions Section */}
        <Card>
          <div class="p-6">
            <h2 class="text-xl font-semibold text-black dark:text-white mb-4">
              User Permissions
            </h2>

            {targetUserId.value ? (
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-black dark:text-white opacity-70">
                    User:{" "}
                    <code class="px-2 py-1 bg-black dark:bg-white text-white dark:text-black">
                      {targetUserId.value}
                    </code>
                  </span>
                  <span class="text-sm font-medium text-black dark:text-white">
                    {userPermissions.value.length} permissions
                  </span>
                </div>

                {userPermissions.value.length > 0 ? (
                  <div class="max-h-96 overflow-y-auto">
                    <PermissionBadgeList permissions={userPermissions.value} />
                  </div>
                ) : (
                  <div class="text-center py-8 text-black dark:text-white opacity-50">
                    No permissions granted
                  </div>
                )}
              </div>
            ) : (
              <div class="text-center py-12 text-black dark:text-white opacity-50">
                Enter a user ID to view their permissions
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* My Permissions Section */}
      <div class="mt-6">
        <Card>
          <div class="p-6">
            <h2 class="text-xl font-semibold text-black dark:text-white mb-4">
              My Permissions
            </h2>

            <div class="flex items-center justify-between mb-4">
              <span class="text-sm text-black dark:text-white opacity-70">
                Current User ID:{" "}
                <code class="px-2 py-1 bg-black dark:bg-white text-white dark:text-black">
                  {myUserId}
                </code>
              </span>
              <span class="text-sm font-medium text-black dark:text-white">
                {myPermissions.length} permissions
              </span>
            </div>

            {myPermissions.length > 0 ? (
              <div class="max-h-64 overflow-y-auto">
                <PermissionBadgeList permissions={myPermissions} />
              </div>
            ) : (
              <div class="text-center py-8 text-black dark:text-white opacity-50">
                No permissions granted
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Create Role Section */}
      <div class="mt-6">
        <Card>
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-black dark:text-white">
                Custom Roles
              </h2>
              <Button
                onClick$={() => {
                  showCreateRole.value = !showCreateRole.value;
                }}
                variant="primary"
              >
                {showCreateRole.value ? "Cancel" : "Create New Role"}
              </Button>
            </div>

            {showCreateRole.value && (
              <div class="space-y-4 border-t border-black dark:border-white pt-4">
                <div>
                  <label class="block text-sm font-medium text-black dark:text-white mb-2">
                    Role Name
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter role name..."
                    value={newRoleName.value}
                    onInput$={(e) => {
                      newRoleName.value = (e.target as HTMLInputElement).value;
                    }}
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-black dark:text-white mb-2">
                    Description (optional)
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter role description..."
                    value={newRoleDescription.value}
                    onInput$={(e) => {
                      newRoleDescription.value = (
                        e.target as HTMLInputElement
                      ).value;
                    }}
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-black dark:text-white mb-2">
                    Permissions (select multiple)
                  </label>
                  <div class="space-y-2 max-h-48 overflow-y-auto border border-black dark:border-white rounded-md p-3">
                    {myPermissions.map((permission) => (
                      <label
                        key={permission}
                        class="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.value.includes(
                            permission
                          )}
                          onChange$={(e) => {
                            const checked = (e.target as HTMLInputElement)
                              .checked;
                            if (checked) {
                              selectedPermissions.value = [
                                ...selectedPermissions.value,
                                permission,
                              ];
                            } else {
                              selectedPermissions.value =
                                selectedPermissions.value.filter(
                                  (p) => p !== permission
                                );
                            }
                          }}
                          class="rounded border-black dark:border-white"
                        />
                        <span class="text-sm text-black dark:text-white">
                          {permission}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  onClick$={handleCreateRole}
                  disabled={
                    !newRoleName.value ||
                    selectedPermissions.value.length === 0 ||
                    loading.value
                  }
                  class="w-full"
                >
                  {loading.value ? "Creating..." : "Create Role"}
                </Button>
              </div>
            )}

            <div class="mt-6">
              <h3 class="text-lg font-medium text-black dark:text-white mb-3">
                Available Roles
              </h3>
              <div class="space-y-2">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    class="p-4 border border-black dark:border-white rounded-lg"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <h4 class="font-medium text-black dark:text-white">
                          {role.name}
                        </h4>
                        {role.description && (
                          <p class="text-sm text-black dark:text-white opacity-70 mt-1">
                            {role.description}
                          </p>
                        )}
                        <div class="mt-2">
                          <PermissionBadgeList
                            permissions={role.permissionNames}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
});
