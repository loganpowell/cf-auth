import { test, expect } from "@playwright/test";

/**
 * Authentication Flow E2E Tests
 *
 * Tests the complete authentication lifecycle:
 * - User registration
 * - Email verification
 * - Login/logout
 * - Password reset
 * - Session management
 */

test.describe("Authentication Flow", () => {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: "Test123!@#",
    displayName: "Test User",
  };

  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto("/");
  });

  test("should display login page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Sign In");
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /password/i })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("should navigate to registration page", async ({ page }) => {
    await page.getByRole("link", { name: /create account/i }).click();
    await expect(page).toHaveURL("/register");
    await expect(page.locator("h1")).toContainText("Create Account");
  });

  test("should show validation errors for invalid registration", async ({
    page,
  }) => {
    await page.goto("/register");

    // Try to submit without filling fields
    await page.getByRole("button", { name: /create account/i }).click();

    // Check for error messages
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
    await expect(page.getByText(/display name is required/i)).toBeVisible();
  });

  test("should register a new user", async ({ page }) => {
    await page.goto("/register");

    // Fill in registration form
    await page.getByRole("textbox", { name: /email/i }).fill(testUser.email);
    await page
      .getByRole("textbox", { name: /display name/i })
      .fill(testUser.displayName);
    await page
      .getByRole("textbox", { name: /^password/i })
      .fill(testUser.password);
    await page
      .getByRole("textbox", { name: /confirm password/i })
      .fill(testUser.password);

    // Submit form
    await page.getByRole("button", { name: /create account/i }).click();

    // Should redirect to verification page
    await expect(page).toHaveURL("/verify-email");
    await expect(page.getByText(/check your email/i)).toBeVisible();
  });

  test("should show error for duplicate email registration", async ({
    page,
  }) => {
    // First registration
    await page.goto("/register");
    await page.getByRole("textbox", { name: /email/i }).fill(testUser.email);
    await page
      .getByRole("textbox", { name: /display name/i })
      .fill(testUser.displayName);
    await page
      .getByRole("textbox", { name: /^password/i })
      .fill(testUser.password);
    await page
      .getByRole("textbox", { name: /confirm password/i })
      .fill(testUser.password);
    await page.getByRole("button", { name: /create account/i }).click();

    // Try to register again with same email
    await page.goto("/register");
    await page.getByRole("textbox", { name: /email/i }).fill(testUser.email);
    await page
      .getByRole("textbox", { name: /display name/i })
      .fill(testUser.displayName);
    await page
      .getByRole("textbox", { name: /^password/i })
      .fill(testUser.password);
    await page
      .getByRole("textbox", { name: /confirm password/i })
      .fill(testUser.password);
    await page.getByRole("button", { name: /create account/i }).click();

    // Should show error
    await expect(page.getByText(/email already exists/i)).toBeVisible();
  });

  test("should validate password strength", async ({ page }) => {
    await page.goto("/register");

    const passwordInput = page.getByRole("textbox", { name: /^password/i });

    // Weak password
    await passwordInput.fill("weak");
    await expect(page.getByText(/weak/i)).toBeVisible();

    // Medium password
    await passwordInput.fill("Medium123");
    await expect(page.getByText(/medium/i)).toBeVisible();

    // Strong password
    await passwordInput.fill("Strong123!@#");
    await expect(page.getByText(/strong/i)).toBeVisible();
  });

  test("should login with valid credentials", async ({ page }) => {
    // Assume user is already registered and verified
    await page.goto("/");

    await page.getByRole("textbox", { name: /email/i }).fill(testUser.email);
    await page
      .getByRole("textbox", { name: /password/i })
      .fill(testUser.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByText(testUser.displayName)).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("textbox", { name: /email/i })
      .fill("wrong@example.com");
    await page
      .getByRole("textbox", { name: /password/i })
      .fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("should logout successfully", async ({ page, context }) => {
    // Login first
    await page.goto("/");
    await page.getByRole("textbox", { name: /email/i }).fill(testUser.email);
    await page
      .getByRole("textbox", { name: /password/i })
      .fill(testUser.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/dashboard");

    // Click user menu
    await page.getByRole("button", { name: testUser.displayName }).click();

    // Click logout
    await page.getByRole("button", { name: /logout/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL("/");

    // Cookies should be cleared
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "access_token")).toBeUndefined();
    expect(cookies.find((c) => c.name === "refresh_token")).toBeUndefined();
  });

  test("should handle password reset flow", async ({ page }) => {
    await page.goto("/");

    // Click forgot password
    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL("/forgot-password");

    // Enter email
    await page.getByRole("textbox", { name: /email/i }).fill(testUser.email);
    await page.getByRole("button", { name: /send reset link/i }).click();

    // Should show success message
    await expect(page.getByText(/check your email/i)).toBeVisible();
  });

  test("should persist session across page reloads", async ({ page }) => {
    // Login
    await page.goto("/");
    await page.getByRole("textbox", { name: /email/i }).fill(testUser.email);
    await page
      .getByRole("textbox", { name: /password/i })
      .fill(testUser.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/dashboard");

    // Reload page
    await page.reload();

    // Should still be logged in
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByText(testUser.displayName)).toBeVisible();
  });

  test("should redirect to login when accessing protected route", async ({
    page,
    context,
  }) => {
    // Clear cookies to ensure not logged in
    await context.clearCookies();

    // Try to access dashboard
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL("/");
  });

  test("should handle session expiration", async ({ page, context }) => {
    // Login
    await page.goto("/");
    await page.getByRole("textbox", { name: /email/i }).fill(testUser.email);
    await page
      .getByRole("textbox", { name: /password/i })
      .fill(testUser.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/dashboard");

    // Manually expire the access token cookie
    await context.clearCookies();

    // Try to access a protected page
    await page.goto("/dashboard/settings");

    // Should redirect to login
    await expect(page).toHaveURL("/");
  });
});
