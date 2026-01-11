/**
 * Authorization Middleware (Legacy - Disabled)
 * 
 * This middleware was part of the old single-tenant auth system.
 * Multi-tenant authorization is now handled in the Admin Dashboard API.
 */

import type { Context, Next } from "hono";

/**
 * Legacy middleware stub - throws error if accidentally used
 */
export function requirePermission(..._args: any[]) {
  return async (_c: Context, _next: Next) => {
    throw new Error("Legacy authorization middleware disabled. Use Admin Dashboard API.");
  };
}

export function requireAnyPermission(..._args: any[]) {
  return async (_c: Context, _next: Next) => {
    throw new Error("Legacy authorization middleware disabled. Use Admin Dashboard API.");
  };
}

export function requireAllPermissions(..._args: any[]) {
  return async (_c: Context, _next: Next) => {
    throw new Error("Legacy authorization middleware disabled. Use Admin Dashboard API.");
  };
}
