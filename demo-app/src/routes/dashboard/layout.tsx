/**
 * Dashboard Layout
 *
 * Provides the layout structure for authenticated pages.
 * Fetches user data and displays it in the header.
 */

import { component$, Slot, $, useSignal } from "@qwik.dev/core";
import { routeLoader$, useNavigate } from "@qwik.dev/router";
import { serverApi } from "~/lib/server-api";

// Fetch user data for layout
export const useLayoutUserData = routeLoader$(async ({ cookie, redirect }) => {
  const accessToken = cookie.get("accessToken");
  const refreshToken = cookie.get("refreshToken");

  console.log("🎨 Layout Loader - Tokens:", {
    hasRefreshToken: !!refreshToken,
    hasAccessToken: !!accessToken,
    accessTokenValue: accessToken?.value ? "present" : "missing",
  });

  // Automatic token refresh if access token missing but refresh token exists
  if (!accessToken?.value && refreshToken) {
    console.log("🔄 Layout - Access token missing, attempting refresh...");
    try {
      const refreshData = await serverApi.refresh();
      console.log("✅ Layout - Token refreshed successfully");
      cookie.set("accessToken", refreshData.accessToken, {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 15, // 15 minutes
      });
      // Get the new access token
      const newAccessToken = cookie.get("accessToken");
      if (newAccessToken?.value) {
        console.log(
          "📡 Layout - Calling serverApi.getMe with refreshed token..."
        );
        const userData = await serverApi.getMe(newAccessToken.value);
        console.log("✅ Layout - User data received:", {
          email: userData.user.email,
          displayName: userData.user.displayName,
          verified: userData.user.emailVerified,
        });
        return userData; // Return the full API response { user: {...} }
      }
    } catch (error) {
      console.error("❌ Layout - Token refresh error:", error);
      throw redirect(302, "/");
    }
  }

  if (!accessToken?.value) {
    console.log("⚠️ Layout - No access token or refresh token available");
    throw redirect(302, "/");
  }

  try {
    console.log("📡 Layout - Calling serverApi.getMe...");
    const userData = await serverApi.getMe(accessToken.value);
    console.log("✅ Layout - User data received:", {
      email: userData.user.email,
      displayName: userData.user.displayName,
      verified: userData.user.emailVerified,
    });
    return userData; // Return the full API response { user: {...} }
  } catch (error) {
    console.error("❌ Layout - Failed to fetch user data:", error);
    throw redirect(302, "/");
  }
});

export default component$(() => {
  const nav = useNavigate();
  const showUserMenu = useSignal(false);
  const layoutData = useLayoutUserData();

  const handleLogout = $(async () => {
    // Call logout endpoint to invalidate server-side tokens (fire and forget)
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token) {
        try {
          await serverApi.logout(token);
        } catch {
          // Ignore errors - we're logging out anyway
        }
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
                <span class="flex items-center justify-center w-8 h-8 border border-black text-xs font-medium">
                  {userInitial}
                </span>
                <span class="text-left inline-block">
                  <span class="text-sm font-medium block">
                    {user?.displayName || "User"}
                  </span>
                  <span class="text-xs opacity-60 block">
                    {user?.email || "Authenticated"}
                  </span>
                </span>
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
