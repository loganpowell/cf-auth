/**
 * Dashboard Layout
 *
 * Provides the layout structure for authenticated pages.
 * Fetches user data and displays it in the header.
 */

import { component$, Slot, $, useSignal } from "@builder.io/qwik";
import { routeLoader$, useNavigate } from "@builder.io/qwik-city";
import type { User } from "@/types/shared";
import { getApiUrl } from "~/lib/config";

// Fetch user data for layout
export const useLayoutUserData = routeLoader$(async ({ cookie }) => {
  const accessToken = cookie.get("accessToken");

  if (!accessToken) {
    return { user: null };
  }

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken.value}`,
      },
    });

    if (response.ok) {
      const data = (await response.json()) as User;
      return { user: data };
    }
  } catch (error) {
    console.error("Failed to fetch user data in layout:", error);
  }

  return { user: null };
});

export default component$(() => {
  const nav = useNavigate();
  const showUserMenu = useSignal(false);
  const layoutData = useLayoutUserData();

  const handleLogout = $(async () => {
    // Clear local storage and navigate to login
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token) {
        // Call logout endpoint (fire and forget)
        const apiUrl = getApiUrl();
        fetch(`${apiUrl}/v1/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {
          // Ignore errors - we're logging out anyway
        });
      }
      localStorage.removeItem("accessToken");
    }
    await nav("/");
  });

  const user = layoutData.value.user;
  const userInitial = user?.displayName?.charAt(0).toUpperCase() || "U";

  return (
    <div class="min-h-screen bg-white">
      {/* Header */}
      <header class="border-b border-black">
        <div class="container-custom py-8">
          <div class="flex items-center justify-between">
            {/* Logo */}
            <a href="/dashboard" class="text-2xl font-light tracking-tightest">
              Auth
            </a>

            {/* User Menu */}
            <div class="relative">
              <button
                onClick$={() => {
                  showUserMenu.value = !showUserMenu.value;
                }}
                class="flex items-center space-x-4 px-4 py-2 border border-black hover:bg-black hover:text-white transition-all duration-150"
              >
                <div class="flex items-center justify-center w-8 h-8 border border-black text-xs font-medium">
                  {userInitial}
                </div>
                <div class="text-left">
                  <div class="text-sm font-medium">
                    {user?.displayName || "User"}
                  </div>
                  <div class="text-xs opacity-60">
                    {user?.email || "Authenticated"}
                  </div>
                </div>
              </button>

              {/* Dropdown Menu */}
              {showUserMenu.value && (
                <div class="absolute right-0 mt-2 w-48 bg-white border border-black z-10">
                  <a
                    href="/settings"
                    class="block px-4 py-3 text-sm hover:bg-black hover:text-white transition-all duration-150"
                  >
                    Settings
                  </a>
                  <button
                    onClick$={handleLogout}
                    class="w-full text-left px-4 py-3 text-sm hover:bg-black hover:text-white transition-all duration-150 border-t border-black"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main class="container-custom section">
        <Slot />
      </main>
    </div>
  );
});
