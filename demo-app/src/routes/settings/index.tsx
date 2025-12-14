/**
 * Settings Page
 *
 * User account settings including password change
 */

import { component$, useContext, useVisibleTask$ } from "@qwik.dev/core";
import { routeLoader$, routeAction$, Form, z, zod$ } from "@qwik.dev/router";
import { serverApi } from "~/lib/server-api";
import { ToastContextId } from "~/contexts/toast-context";

// Fetch user data
export const useUserData = routeLoader$(async ({ cookie, redirect }) => {
  const refreshToken = cookie.get("refreshToken");
  const accessToken = cookie.get("accessToken");

  if (!refreshToken) {
    throw redirect(302, "/");
  }

  // Auto-refresh if needed
  if (!accessToken?.value && refreshToken) {
    try {
      const refreshData = await serverApi.refresh();
      cookie.set("accessToken", refreshData.accessToken, {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 15,
      });
      const newAccessToken = cookie.get("accessToken");
      if (newAccessToken?.value) {
        const userData = await serverApi.getMe(newAccessToken.value);
        return userData;
      }
    } catch (error) {
      console.error("Failed to refresh token:", error);
      throw redirect(302, "/");
    }
  }

  if (!accessToken?.value) {
    throw redirect(302, "/");
  }

  try {
    const userData = await serverApi.getMe(accessToken.value);
    return userData;
  } catch (error) {
    console.error("Failed to fetch user data:", error);
    throw redirect(302, "/");
  }
});

// Password change action
export const useChangePassword = routeAction$(
  async (data, { cookie, fail }) => {
    const accessToken = cookie.get("accessToken");

    if (!accessToken) {
      return fail(401, { message: "Not authenticated" });
    }

    try {
      const result = await serverApi.changePassword(
        accessToken.value,
        data.currentPassword,
        data.newPassword
      );

      return {
        success: true,
        message: result.message || "Password changed successfully",
      };
    } catch (error) {
      console.error("Password change error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to change password";
      return fail(400, { message: errorMessage });
    }
  },
  zod$(
    z
      .object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z
          .string()
          .min(8, "Password must be at least 8 characters")
          .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
          .regex(/[a-z]/, "Password must contain at least one lowercase letter")
          .regex(/[0-9]/, "Password must contain at least one number")
          .regex(
            /[^A-Za-z0-9]/,
            "Password must contain at least one special character"
          ),
        confirmPassword: z.string().min(1, "Please confirm your password"),
      })
      .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
      })
  )
);

export default component$(() => {
  const userData = useUserData();
  const changePassword = useChangePassword();
  const toastCtx = useContext(ToastContextId);

  // Show toast notification when password is changed
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const value = track(() => changePassword.value);

    if (value?.success) {
      toastCtx.showToast(value.message, "success");
    } else if (value?.failed && value?.message) {
      toastCtx.showToast(value.message, "error");
    }
  });

  return (
    <div class="max-w-4xl">
      <div class="mb-16">
        <h1 class="text-5xl font-light tracking-tightest mb-4">Settings</h1>
        <p class="text-sm opacity-60">Manage your account settings</p>
      </div>

      {/* Account Information */}
      <div class="card p-8 mb-8">
        <h2 class="text-2xl font-light tracking-tightest mb-6">
          Account Information
        </h2>
        {userData.value.user && (
          <div class="space-y-6">
            <div>
              <label class="block text-xs uppercase tracking-wider mb-2 opacity-60">
                Display Name
              </label>
              <p class="text-sm">{userData.value.user.displayName}</p>
            </div>
            <div class="divider"></div>
            <div>
              <label class="block text-xs uppercase tracking-wider mb-2 opacity-60">
                Email Address
              </label>
              <div class="flex items-center gap-3">
                <p class="text-sm">{userData.value.user.email}</p>
                <span
                  class={
                    userData.value.user.emailVerified
                      ? "badge badge-success"
                      : "badge badge-warning"
                  }
                >
                  {userData.value.user.emailVerified
                    ? "VERIFIED"
                    : "NOT VERIFIED"}
                </span>
              </div>
            </div>
            <div class="divider"></div>
            <div>
              <label class="block text-xs uppercase tracking-wider mb-2 opacity-60">
                Account Created
              </label>
              <p class="text-sm">
                {new Date(userData.value.user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Change Password */}
      <div class="card p-8">
        <h2 class="text-2xl font-light tracking-tightest mb-6">
          Change Password
        </h2>

        <Form action={changePassword} class="space-y-8">
          <div>
            <label
              for="currentPassword"
              class="block text-xs uppercase tracking-wider mb-3 opacity-60"
            >
              Current Password
            </label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              required
              class="input"
              placeholder="••••••••"
            />
            {changePassword.value?.fieldErrors?.currentPassword && (
              <p class="mt-2 text-sm opacity-60">
                {changePassword.value.fieldErrors.currentPassword}
              </p>
            )}
          </div>

          <div>
            <label
              for="newPassword"
              class="block text-xs uppercase tracking-wider mb-3 opacity-60"
            >
              New Password
            </label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              required
              class="input"
              placeholder="••••••••"
            />
            {changePassword.value?.fieldErrors?.newPassword && (
              <p class="mt-2 text-sm opacity-60">
                {changePassword.value.fieldErrors.newPassword}
              </p>
            )}
            <p class="mt-2 text-xs opacity-40">
              Must be at least 8 characters with uppercase, lowercase, number,
              and special character
            </p>
          </div>

          <div>
            <label
              for="confirmPassword"
              class="block text-xs uppercase tracking-wider mb-3 opacity-60"
            >
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              required
              class="input"
              placeholder="••••••••"
            />
            {changePassword.value?.fieldErrors?.confirmPassword && (
              <p class="mt-2 text-sm opacity-60">
                {changePassword.value.fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            class="btn w-full"
            disabled={changePassword.isRunning}
          >
            {changePassword.isRunning
              ? "Changing Password..."
              : "Change Password"}
          </button>
        </Form>
      </div>
    </div>
  );
});
