import { test, expect } from "@playwright/test";

/**
 * Authorization & Permissions E2E Tests
 *
 * Tests the permission system:
 * - Role assignment
 * - Permission checks
 * - Access control
 * - Permission inheritance
 * - Audit trail
 */

test.describe("Authorization & Permissions", () => {
  const adminUser = {
    email: `admin-${Date.now()}@example.com`,
    password: "Admin123!@#",
    displayName: "Admin User",
  };

  const regularUser = {
    email: `user-${Date.now()}@example.com`,
    password: "User123!@#",
    displayName: "Regular User",
  };

  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto("/");
    await page.getByRole("textbox", { name: /email/i }).fill(adminUser.email);
    await page
      .getByRole("textbox", { name: /password/i })
      .fill(adminUser.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/dashboard");
  });

  test("should display permissions dashboard", async ({ page }) => {
    await page.goto("/dashboard/permissions");

    await expect(page.locator("h1")).toContainText("Permissions");
    await expect(page.getByText(/roles/i)).toBeVisible();
    await expect(page.getByText(/users/i)).toBeVisible();
  });

  test("should list available roles", async ({ page }) => {
    await page.goto("/dashboard/permissions");

    // Should show default roles
    await expect(page.getByText(/platform:admin/i)).toBeVisible();
    await expect(page.getByText(/org:owner/i)).toBeVisible();
    await expect(page.getByText(/org:admin/i)).toBeVisible();
    await expect(page.getByText(/org:member/i)).toBeVisible();
  });

  test("should create custom role", async ({ page }) => {
    await page.goto("/dashboard/permissions");

    // Click create role button
    await page.getByRole("button", { name: /create role/i }).click();

    // Fill in role details
    await page
      .getByRole("textbox", { name: /role name/i })
      .fill("project-manager");
    await page
      .getByRole("textbox", { name: /description/i })
      .fill("Manages projects and teams");

    // Select permissions
    await page.getByLabel(/org:projects:read/i).check();
    await page.getByLabel(/org:projects:write/i).check();
    await page.getByLabel(/team:read/i).check();

    // Save role
    await page.getByRole("button", { name: /save role/i }).click();

    // Should show success message
    await expect(page.getByText(/role created/i)).toBeVisible();
    await expect(page.getByText(/project-manager/i)).toBeVisible();
  });

  test("should grant role to user", async ({ page }) => {
    await page.goto("/dashboard/permissions");

    // Find user in list
    await page.getByText(regularUser.email).click();

    // Grant role
    await page.getByRole("button", { name: /grant role/i }).click();
    await page
      .getByRole("combobox", { name: /select role/i })
      .selectOption("org:admin");
    await page.getByRole("button", { name: /confirm/i }).click();

    // Should show success message
    await expect(page.getByText(/role granted/i)).toBeVisible();

    // Should show role in user's permissions
    await expect(page.getByText(/org:admin/i)).toBeVisible();
  });

  test("should revoke role from user", async ({ page }) => {
    await page.goto("/dashboard/permissions");

    // Find user with role
    await page.getByText(regularUser.email).click();

    // Revoke role
    await page.getByRole("button", { name: /revoke role/i }).click();
    await page
      .getByRole("combobox", { name: /select role/i })
      .selectOption("org:admin");
    await page.getByRole("button", { name: /confirm/i }).click();

    // Should show success message
    await expect(page.getByText(/role revoked/i)).toBeVisible();

    // Role should be removed from user's permissions
    await expect(page.getByText(/org:admin/i)).not.toBeVisible();
  });

  test("should display user permissions", async ({ page }) => {
    await page.goto("/dashboard/permissions");

    // View user details
    await page.getByText(adminUser.email).click();

    // Should show effective permissions
    await expect(page.getByText(/effective permissions/i)).toBeVisible();
    await expect(page.getByText(/platform:*/i)).toBeVisible(); // Admin has all permissions
  });

  test("should filter permissions by category", async ({ page }) => {
    await page.goto("/dashboard/permissions");

    // Filter by organization permissions
    await page.getByRole("button", { name: /filter/i }).click();
    await page.getByLabel(/organization/i).check();

    // Should only show org permissions
    await expect(page.getByText(/org:/)).toBeVisible();
    await expect(page.getByText(/team:/)).not.toBeVisible();
    await expect(page.getByText(/repo:/)).not.toBeVisible();
  });

  test("should view permission audit trail", async ({ page }) => {
    await page.goto("/dashboard/permissions");

    // Click audit trail tab
    await page.getByRole("tab", { name: /audit trail/i }).click();

    // Should show audit records
    await expect(page.getByText(/action/i)).toBeVisible();
    await expect(page.getByText(/user/i)).toBeVisible();
    await expect(page.getByText(/timestamp/i)).toBeVisible();

    // Should show recent actions
    await expect(page.getByText(/grant/i)).toBeVisible();
    await expect(page.getByText(/revoke/i)).toBeVisible();
  });

  test("should prevent unauthorized access", async ({ page, context }) => {
    // Logout admin
    await page.getByRole("button", { name: adminUser.displayName }).click();
    await page.getByRole("button", { name: /logout/i }).click();

    // Login as regular user (no admin permissions)
    await page.getByRole("textbox", { name: /email/i }).fill(regularUser.email);
    await page
      .getByRole("textbox", { name: /password/i })
      .fill(regularUser.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Try to access permissions page
    await page.goto("/dashboard/permissions");

    // Should show access denied or redirect
    await expect(
      page.getByText(/access denied|forbidden|unauthorized/i)
    ).toBeVisible();
  });

  test("should show permission inheritance", async ({ page }) => {
    await page.goto("/dashboard/permissions");

    // Create parent role
    await page.getByRole("button", { name: /create role/i }).click();
    await page.getByRole("textbox", { name: /role name/i }).fill("team-lead");
    await page.getByLabel(/team:read/i).check();
    await page.getByLabel(/team:write/i).check();
    await page.getByRole("button", { name: /save role/i }).click();

    // Create child role that inherits
    await page.getByRole("button", { name: /create role/i }).click();
    await page.getByRole("textbox", { name: /role name/i }).fill("senior-lead");
    await page
      .getByRole("combobox", { name: /inherits from/i })
      .selectOption("team-lead");
    await page.getByLabel(/team:delete/i).check(); // Add extra permission
    await page.getByRole("button", { name: /save role/i }).click();

    // View child role
    await page.getByText("senior-lead").click();

    // Should show inherited permissions
    await expect(page.getByText(/inherited from team-lead/i)).toBeVisible();
    await expect(page.getByText(/team:read/i)).toBeVisible();
    await expect(page.getByText(/team:write/i)).toBeVisible();
    await expect(page.getByText(/team:delete/i)).toBeVisible();
  });

  test("should validate permission changes", async ({ page }) => {
    await page.goto("/dashboard/permissions");

    // Try to create role without permissions
    await page.getByRole("button", { name: /create role/i }).click();
    await page.getByRole("textbox", { name: /role name/i }).fill("empty-role");
    await page.getByRole("button", { name: /save role/i }).click();

    // Should show error
    await expect(page.getByText(/at least one permission/i)).toBeVisible();
  });

  test("should search for users", async ({ page }) => {
    await page.goto("/dashboard/permissions");

    // Search for user
    await page
      .getByRole("textbox", { name: /search users/i })
      .fill(regularUser.email);

    // Should show matching user
    await expect(page.getByText(regularUser.email)).toBeVisible();

    // Should not show non-matching users
    await expect(page.getByText(adminUser.email)).not.toBeVisible();
  });

  test("should paginate users list", async ({ page }) => {
    await page.goto("/dashboard/permissions");

    // Check pagination controls
    await expect(page.getByRole("button", { name: /next/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /previous/i })).toBeVisible();

    // Navigate to next page
    await page.getByRole("button", { name: /next/i }).click();

    // Should show different users
    const firstPageUsers = await page.getByRole("row").allTextContents();
    await page.getByRole("button", { name: /next/i }).click();
    const secondPageUsers = await page.getByRole("row").allTextContents();

    expect(firstPageUsers).not.toEqual(secondPageUsers);
  });

  test("should export audit trail", async ({ page }) => {
    await page.goto("/dashboard/permissions");
    await page.getByRole("tab", { name: /audit trail/i }).click();

    // Click export button
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /export/i }).click();
    const download = await downloadPromise;

    // Should download CSV file
    expect(download.suggestedFilename()).toMatch(/audit-trail.*\.csv/);
  });
});
