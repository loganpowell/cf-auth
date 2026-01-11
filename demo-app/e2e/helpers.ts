import { Page, expect } from '@playwright/test';

/**
 * Test utilities for E2E tests
 */

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

/**
 * Create a test user with unique email
 */
export function createTestUser(prefix: string = 'test'): TestUser {
  return {
    email: `${prefix}-${Date.now()}@example.com`,
    password: 'Test123!@#',
    displayName: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} User`
  };
}

/**
 * Register a new user via the UI
 */
export async function registerUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');
  
  await page.getByRole('textbox', { name: /email/i }).fill(user.email);
  await page.getByRole('textbox', { name: /display name/i }).fill(user.displayName);
  await page.getByRole('textbox', { name: /^password/i }).fill(user.password);
  await page.getByRole('textbox', { name: /confirm password/i }).fill(user.password);
  
  await page.getByRole('button', { name: /create account/i }).click();
}

/**
 * Login as a user via the UI
 */
export async function loginUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/');
  
  await page.getByRole('textbox', { name: /email/i }).fill(user.email);
  await page.getByRole('textbox', { name: /password/i }).fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  
  // Wait for redirect to dashboard
  await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
}

/**
 * Logout the current user
 */
export async function logoutUser(page: Page): Promise<void> {
  // Click user menu (try both possible patterns)
  try {
    await page.getByRole('button', { name: /user menu/i }).click({ timeout: 2000 });
  } catch {
    // Try clicking on user display name
    await page.locator('[data-testid="user-menu"]').click();
  }
  
  await page.getByRole('button', { name: /logout/i }).click();
  
  // Wait for redirect to login
  await expect(page).toHaveURL('/', { timeout: 5000 });
}

/**
 * Navigate to a specific dashboard page
 */
export async function navigateToDashboard(page: Page, path: string = ''): Promise<void> {
  const fullPath = path ? `/dashboard/${path}` : '/dashboard';
  await page.goto(fullPath);
}

/**
 * Wait for API call to complete
 */
export async function waitForApiCall(page: Page, urlPattern: string | RegExp): Promise<void> {
  await page.waitForResponse(response => {
    const url = response.url();
    return typeof urlPattern === 'string' 
      ? url.includes(urlPattern)
      : urlPattern.test(url);
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some(cookie => cookie.name === 'access_token');
}

/**
 * Get current user from cookies
 */
export async function getCurrentUser(page: Page): Promise<{ email?: string; displayName?: string } | null> {
  const cookies = await page.context().cookies();
  const accessToken = cookies.find(c => c.name === 'access_token');
  
  if (!accessToken) return null;
  
  // Decode JWT payload (simple base64 decode, no verification needed for tests)
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.value.split('.')[1], 'base64').toString()
    );
    return {
      email: payload.email,
      displayName: payload.displayName
    };
  } catch {
    return null;
  }
}

/**
 * Clear authentication cookies
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.context().clearCookies();
}

/**
 * Mock API response for testing
 */
export async function mockApiResponse(
  page: Page,
  endpoint: string,
  response: any,
  status: number = 200
): Promise<void> {
  await page.route(`**${endpoint}`, route => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response)
    });
  });
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ 
    path: `screenshots/${name}-${Date.now()}.png`,
    fullPage: true 
  });
}

/**
 * Fill form with data
 */
export async function fillForm(page: Page, data: Record<string, string>): Promise<void> {
  for (const [field, value] of Object.entries(data)) {
    const input = page.getByLabel(new RegExp(field, 'i'));
    await input.fill(value);
  }
}

/**
 * Wait for toast/notification message
 */
export async function waitForNotification(page: Page, message: string | RegExp): Promise<void> {
  await expect(
    page.locator('[role="alert"], [data-testid="notification"], .toast')
  ).toContainText(message);
}

/**
 * Check if element is visible with retry
 */
export async function elementIsVisible(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Grant role to user via API (for test setup)
 */
export async function grantRoleViaApi(
  baseUrl: string,
  accessToken: string,
  userId: string,
  roleId: string
): Promise<void> {
  const response = await fetch(`${baseUrl}/v1/permissions/grant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ userId, roleId })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to grant role: ${response.statusText}`);
  }
}

/**
 * Create role via API (for test setup)
 */
export async function createRoleViaApi(
  baseUrl: string,
  accessToken: string,
  roleData: {
    name: string;
    description?: string;
    permissionNames: string[];
  }
): Promise<any> {
  const response = await fetch(`${baseUrl}/v1/roles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(roleData)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create role: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Cleanup test data (for teardown)
 */
export async function cleanupTestData(
  baseUrl: string,
  accessToken: string
): Promise<void> {
  // Delete test users, roles, etc.
  // Implementation depends on your cleanup API endpoints
  console.log('Cleaning up test data...');
}
