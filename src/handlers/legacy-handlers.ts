/**
 * Legacy Handler Stubs
 *
 * These handlers return 501 Not Implemented for the old single-tenant auth system.
 * All authentication now goes through the Admin Dashboard API.
 */

import type { Context } from "hono";
import type { Env } from "../types";

const LEGACY_RESPONSE = {
  error: "NOT_IMPLEMENTED",
  message:
    "Legacy auth system disabled. Use Admin Dashboard API for multi-tenant authentication.",
  documentation: "/docs/admin-api",
};

export async function handleRegister(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleLogin(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleRefresh(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleLogout(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleGetMe(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleChangePassword(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleForgotPassword(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleResetPassword(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleVerifyEmail(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleResendVerification(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleListUsers(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

// Permission handlers
export async function handleGetUserPermissions(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleGrantRole(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleRevokeRole(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleCreateRole(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleListRoles(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleGetRole(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}

export async function handleGetAuditTrail(c: Context<{ Bindings: Env }>) {
  return c.json(LEGACY_RESPONSE, 501);
}
