/**
 * Legacy Auth System - Temporarily Disabled
 * 
 * The old single-tenant authentication system has been replaced
 * with the new multi-tenant Admin Dashboard API.
 * 
 * These stubs are provided to satisfy existing imports while
 * we transition the codebase.
 */

// Legacy type stubs
export type User = {
  id: string;
  email: string;
  [key: string]: any;
};

export type Role = {
  id: string;
  name: string;
  [key: string]: any;
};

// Stub implementations that return "not implemented" errors
export async function registerUser(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled. Use Admin Dashboard API for multi-tenant authentication.");
}

export async function loginUser(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled. Use Admin Dashboard API for multi-tenant authentication.");
}

export async function refreshUserToken(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}

export async function getUserById(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}

export async function verifyEmailToken(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}

export async function createPasswordResetToken(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}

export async function verifyPasswordResetToken(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}

export async function getUserPermissions(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}

export async function checkUserPermission(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}

export async function checkUserPermissions(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}

export async function grantRole(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}

export async function revokeRole(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}

export async function createRole(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}

export async function getRoles(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}

export async function listRoles(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}

export async function getRole(..._args: any[]): Promise<never> {
  throw new Error("Legacy auth system disabled.");
}
