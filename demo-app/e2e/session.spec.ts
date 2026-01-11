import { test, expect } from "@playwright/test";
import {
  createTestUser,
  registerUser,
  loginUser,
  logoutUser,
  clearAuth,
} from "./helpers";

/**
 * Session Management E2E Tests
 *
 * Tests session handling:
 * - Token refresh
 * - Session persistence
 * - Multi-tab behavior
 * - Session timeout
 * - Concurrent sessions
 */

test.describe("Session Management", () => {
  const testUser = createTestUser("session");

  test.beforeAll(async ({ browser }) => {
    // Register test user once
    const page = await browser.newPage();
    await registerUser(page, testUser);
    await page.close();
  });

  test("should maintain session across page reloads", async ({ page }) => {
    await loginUser(page, testUser);

    // Reload page
    await page.reload();

    // Should still be authenticated
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByText(testUser.displayName)).toBeVisible();
  });

  test("should maintain session across navigation", async ({ page }) => {
    await loginUser(page, testUser);

    // Navigate to different pages
    await page.goto("/dashboard/settings");
    await expect(page.getByText(testUser.displayName)).toBeVisible();

    await page.goto("/dashboard/permissions");
    await expect(page.getByText(testUser.displayName)).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText(testUser.displayName)).toBeVisible();
  });

  test("should handle token refresh automatically", async ({ page }) => {
    await loginUser(page, testUser);

    // Wait for access token to expire (simulate by clearing it)
    await page.evaluate(() => {
      document.cookie =
        "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    });

    // Make a request that requires auth
    await page.goto("/dashboard/settings");

    // Should auto-refresh and continue working
    await expect(page).toHaveURL("/dashboard/settings");
    await expect(page.getByText(testUser.displayName)).toBeVisible();
  });

  test("should sync logout across tabs", async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Login in both tabs
    await loginUser(page1, testUser);
    await page2.goto("/dashboard");
    await expect(page2).toHaveURL("/dashboard");

    // Logout in first tab
    await logoutUser(page1);

    // Second tab should also logout (or show session expired)
    await page2.reload();
    await expect(page2).toHaveURL("/");

    await context.close();
  });

  test("should prevent access after session expiration", async ({ page }) => {
    await loginUser(page, testUser);

    // Manually expire all tokens
    await clearAuth(page);

    // Try to access protected page
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL("/");
  });

  test("should allow multiple concurrent sessions", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Login in both contexts (different browsers/devices)
    await loginUser(page1, testUser);
    await loginUser(page2, testUser);

    // Both should work independently
    await expect(page1).toHaveURL("/dashboard");
    await expect(page2).toHaveURL("/dashboard");

    // Actions in one shouldn't affect the other
    await logoutUser(page1);
    await expect(page1).toHaveURL("/");

    // page2 should still be logged in
    await page2.reload();
    await expect(page2).toHaveURL("/dashboard");

    await context1.close();
    await context2.close();
  });

  test("should handle session storage correctly", async ({ page }) => {
    await loginUser(page, testUser);

    // Check that tokens are stored securely
    const cookies = await page.context().cookies();
    const accessToken = cookies.find((c) => c.name === "access_token");
    const refreshToken = cookies.find((c) => c.name === "refresh_token");

    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();

    // Cookies should have secure flags
    expect(accessToken?.httpOnly).toBe(true);
    expect(accessToken?.secure).toBe(true);
    expect(accessToken?.sameSite).toBe("Strict" || "Lax");
  });

  test("should clear sensitive data on logout", async ({ page }) => {
    await loginUser(page, testUser);

    // Check localStorage/sessionStorage before logout
    const beforeLogout = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));

    await logoutUser(page);

    // Check after logout
    const afterLogout = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));

    // Should be cleared or significantly reduced
    expect(afterLogout.local.length).toBeLessThanOrEqual(
      beforeLogout.local.length
    );
    expect(afterLogout.session.length).toBe(0);
  });

  test("should handle remember me functionality", async ({ page }) => {
    await page.goto("/");

    // Login with remember me checked
    await page.getByRole("textbox", { name: /email/i }).fill(testUser.email);
    await page
      .getByRole("textbox", { name: /password/i })
      .fill(testUser.password);
    await page.getByLabel(/remember me/i).check();
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL("/dashboard");

    // Check that refresh token has longer expiry
    const cookies = await page.context().cookies();
    const refreshToken = cookies.find((c) => c.name === "refresh_token");

    expect(refreshToken).toBeDefined();
    // Should expire in ~30 days for remember me
    const expiryDate = new Date(refreshToken!.expires * 1000);
    const now = new Date();
    const daysDiff = Math.floor(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    expect(daysDiff).toBeGreaterThan(25); // Allow some margin
  });

  test("should handle session hijacking prevention", async ({ browser }) => {
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await loginUser(page1, testUser);

    // Get the access token
    const cookies1 = await context1.cookies();
    const accessToken = cookies1.find((c) => c.name === "access_token");

    // Try to use the token in a different context
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    // Set the stolen cookie
    await context2.addCookies([accessToken!]);

    // Try to access protected page
    await page2.goto("/dashboard");

    // Should detect and reject (depending on implementation)
    // This might redirect to login or show error
    const isProtected =
      (await page2.url()) === "/" ||
      (await page2.locator("text=/unauthorized|forbidden/i").isVisible());

    expect(isProtected).toBe(true);

    await context1.close();
    await context2.close();
  });
});
