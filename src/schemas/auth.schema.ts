/**
 * OpenAPI Zod Schemas for Authentication Endpoints
 *
 * These schemas define the request/response structure for all auth endpoints
 * and are used to generate the OpenAPI spec and TypeScript SDK.
 *
 * ALL schemas are auto-generated from Drizzle database schema via drizzle-zod.
 * This ensures ZERO schema drift between database and API.
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  UserApiSchema,
  UserApiSchemaForRegister,
  UserApiSchemaForLogin,
} from "./db-schemas";

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

// ============================================================================
// Import Auto-Generated Schemas from db-schemas.ts
// ============================================================================

/**
 * User schemas - imported from db-schemas.ts
 * All auto-generated from Drizzle, no manual definitions
 */
const UserSchema = UserApiSchema;
const UserSchemaForRegister = UserApiSchemaForRegister;
const UserSchemaForLogin = UserApiSchemaForLogin;

const ErrorResponseSchema = z
  .object({
    error: z
      .string()
      .openapi({ description: "Error message", example: "Validation failed" }),
    message: z.string().optional().openapi({
      description: "Detailed error message",
      example: "Invalid email format",
    }),
    details: z
      .array(
        z.object({
          field: z.string().openapi({ example: "email" }),
          message: z.string().openapi({ example: "Invalid email address" }),
        })
      )
      .optional()
      .openapi({ description: "Validation error details" }),
  })
  .openapi("ErrorResponse");

// ============================================================================
// Register Endpoint
// ============================================================================

export const RegisterRequestSchema = z
  .object({
    email: z.email().openapi({
      description: "User email address",
      example: "user@example.com",
    }),
    password: z.string().min(8).openapi({
      description: "User password (min 8 characters)",
      example: "SecureP@ss123",
    }),
    displayName: z.string().min(3).openapi({
      description: "Display name (min 3 characters)",
      example: "johndoe",
    }),
  })
  .openapi("RegisterRequest");

export const RegisterResponseSchema = z
  .object({
    message: z.string().openapi({
      description: "Success message",
      example:
        "Registration successful. Please check your email to verify your account.",
    }),
    user: UserSchemaForRegister,
    accessToken: z.string().openapi({
      description: "JWT access token for immediate login",
      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    }),
  })
  .openapi("RegisterResponse");

export const registerRoute = createRoute({
  operationId: "v1AuthRegisterPost",
  method: "post",
  path: "/v1/auth/register",
  tags: ["Authentication"],
  summary: "Register a new user",
  description: "Create a new user account with email and password",
  security: [],
  request: {
    body: {
      content: {
        "application/json": {
          schema: RegisterRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: RegisterResponseSchema,
        },
      },
      description: "User successfully registered",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Validation error",
    },
    409: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Email already registered",
    },
    500: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
});

// ============================================================================
// Login Endpoint
// ============================================================================

export const LoginRequestSchema = z
  .object({
    email: z.email().openapi({
      description: "User email address",
      example: "user@example.com",
    }),
    password: z
      .string()
      .openapi({ description: "User password", example: "SecureP@ss123" }),
  })
  .openapi("LoginRequest");

export const LoginResponseSchema = z
  .object({
    message: z
      .string()
      .openapi({ description: "Success message", example: "Login successful" }),
    accessToken: z.string().openapi({
      description: "JWT access token (15min TTL)",
      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    }),
    user: UserSchemaForLogin.openapi({
      description: "Authenticated user information",
    }),
  })
  .openapi("LoginResponse");

export const loginRoute = createRoute({
  operationId: "v1AuthLoginPost",
  method: "post",
  path: "/v1/auth/login",
  tags: ["Authentication"],
  summary: "Login user",
  description: "Authenticate user with email and password",
  security: [],
  request: {
    body: {
      content: {
        "application/json": {
          schema: LoginRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: LoginResponseSchema,
        },
      },
      description: "Successfully authenticated",
    },
    401: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid credentials",
    },
    403: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Account suspended",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Validation error",
    },
    500: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
});

// ============================================================================
// Verify Email Endpoint
// ============================================================================

export const VerifyEmailRequestSchema = z
  .object({
    token: z.string().openapi({
      description: "Email verification token",
      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    }),
  })
  .openapi("VerifyEmailRequest");

export const VerifyEmailResponseSchema = z
  .object({
    message: z.string().openapi({
      description: "Success message",
      example: "Email verified successfully",
    }),
  })
  .openapi("VerifyEmailResponse");

export const verifyEmailRoute = createRoute({
  operationId: "v1AuthVerifyEmailPost",
  method: "post",
  path: "/v1/auth/verify-email",
  tags: ["Authentication"],
  summary: "Verify email address",
  description: "Verify user email address with token from email",
  security: [],
  request: {
    body: {
      content: {
        "application/json": {
          schema: VerifyEmailRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: VerifyEmailResponseSchema,
        },
      },
      description: "Email verified successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid or expired token",
    },
  },
});

// ============================================================================
// Resend Verification Endpoint
// ============================================================================

export const ResendVerificationRequestSchema = z
  .object({
    email: z.email().openapi({
      description: "User email address",
      example: "user@example.com",
    }),
  })
  .openapi("ResendVerificationRequest");

export const ResendVerificationResponseSchema = z
  .object({
    message: z.string().openapi({
      description: "Success message",
      example: "Verification email sent",
    }),
  })
  .openapi("ResendVerificationResponse");

export const resendVerificationRoute = createRoute({
  operationId: "v1AuthResendVerificationPost",
  method: "post",
  path: "/v1/auth/resend-verification",
  tags: ["Authentication"],
  summary: "Resend verification email",
  description: "Send a new verification email to the user",
  security: [],
  request: {
    body: {
      content: {
        "application/json": {
          schema: ResendVerificationRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ResendVerificationResponseSchema,
        },
      },
      description: "Verification email sent",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid email or user not found",
    },
  },
});

// ============================================================================
// Forgot Password Endpoint
// ============================================================================

export const ForgotPasswordRequestSchema = z
  .object({
    email: z.email().openapi({
      description: "User email address",
      example: "user@example.com",
    }),
  })
  .openapi("ForgotPasswordRequest");

export const ForgotPasswordResponseSchema = z
  .object({
    message: z.string().openapi({
      description: "Success message (same for existing/non-existing users)",
      example: "If the email exists, a password reset link has been sent",
    }),
  })
  .openapi("ForgotPasswordResponse");

export const forgotPasswordRoute = createRoute({
  operationId: "v1AuthForgotPasswordPost",
  method: "post",
  path: "/v1/auth/forgot-password",
  tags: ["Authentication"],
  summary: "Request password reset",
  description:
    "Send password reset email (always returns success to prevent email enumeration)",
  security: [],
  request: {
    body: {
      content: {
        "application/json": {
          schema: ForgotPasswordRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ForgotPasswordResponseSchema,
        },
      },
      description: "Password reset email sent (or would be if user exists)",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Validation error",
    },
  },
});

// ============================================================================
// Reset Password Endpoint
// ============================================================================

export const ResetPasswordRequestSchema = z
  .object({
    token: z.string().openapi({
      description: "Password reset token from email",
      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    }),
    newPassword: z.string().min(8).openapi({
      description: "New password (min 8 characters)",
      example: "NewSecureP@ss123",
    }),
  })
  .openapi("ResetPasswordRequest");

export const ResetPasswordResponseSchema = z
  .object({
    message: z.string().openapi({
      description: "Success message",
      example: "Password reset successfully",
    }),
  })
  .openapi("ResetPasswordResponse");

export const resetPasswordRoute = createRoute({
  operationId: "v1AuthResetPasswordPost",
  method: "post",
  path: "/v1/auth/reset-password",
  tags: ["Authentication"],
  summary: "Reset password",
  description: "Reset user password with token from email",
  security: [],
  request: {
    body: {
      content: {
        "application/json": {
          schema: ResetPasswordRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ResetPasswordResponseSchema,
        },
      },
      description: "Password reset successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid or expired token",
    },
  },
});

// ============================================================================
// Get Current User Endpoint
// ============================================================================

export const GetMeResponseSchema = z
  .object({
    user: UserSchema.openapi({ description: "Current user information" }),
  })
  .openapi("GetMeResponse");

export const getMeRoute = createRoute({
  operationId: "v1AuthMeGet",
  method: "get",
  path: "/v1/auth/me",
  tags: ["Authentication"],
  summary: "Get current user",
  description: "Get currently authenticated user information",
  security: [
    {
      bearerAuth: [],
    },
  ],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: GetMeResponseSchema,
        },
      },
      description: "User information retrieved",
    },
    401: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Unauthorized - invalid or expired token",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "User not found",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Bad request",
    },
    500: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
});

// ============================================================================
// Refresh Token Endpoint
// ============================================================================

export const RefreshResponseSchema = z
  .object({
    accessToken: z.string().openapi({
      description: "New JWT access token",
      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    }),
  })
  .openapi("RefreshResponse");

export const refreshRoute = createRoute({
  operationId: "v1AuthRefreshPost",
  method: "post",
  path: "/v1/auth/refresh",
  tags: ["Authentication"],
  summary: "Refresh access token",
  description:
    "Get a new access token using refresh token from httpOnly cookie",
  security: [],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: RefreshResponseSchema,
        },
      },
      description: "New access token generated",
    },
    401: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid or expired refresh token",
    },
  },
});

// ============================================================================
// Logout Endpoint
// ============================================================================

export const LogoutResponseSchema = z
  .object({
    message: z.string().openapi({
      description: "Success message",
      example: "Logged out successfully",
    }),
  })
  .openapi("LogoutResponse");

export const logoutRoute = createRoute({
  operationId: "v1AuthLogoutPost",
  method: "post",
  path: "/v1/auth/logout",
  tags: ["Authentication"],
  summary: "Logout user",
  description: "Logout user and invalidate tokens",
  security: [
    {
      bearerAuth: [],
    },
  ],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: LogoutResponseSchema,
        },
      },
      description: "Successfully logged out",
    },
  },
});

// ============================================================================
// Change Password Endpoint
// ============================================================================

export const ChangePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1).openapi({
      description: "Current password",
      example: "OldP@ss123",
    }),
    newPassword: z.string().min(8).openapi({
      description: "New password (min 8 characters)",
      example: "NewSecureP@ss123",
    }),
  })
  .openapi("ChangePasswordRequest");

export const ChangePasswordResponseSchema = z
  .object({
    message: z.string().openapi({
      description: "Success message",
      example: "Password changed successfully",
    }),
  })
  .openapi("ChangePasswordResponse");

export const changePasswordRoute = createRoute({
  operationId: "v1AuthChangePasswordPost",
  method: "post",
  path: "/v1/auth/change-password",
  tags: ["Authentication"],
  summary: "Change password",
  description:
    "Change password for authenticated user (requires current password)",
  security: [
    {
      bearerAuth: [],
    },
  ],
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChangePasswordRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ChangePasswordResponseSchema,
        },
      },
      description: "Password changed successfully",
    },
    401: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Unauthorized or current password incorrect",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Validation error",
    },
    500: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
});

// ============================================================================
// Type Exports - Inferred from Zod Schemas (Single Source of Truth)
// ============================================================================

// Core Types
export type User = z.infer<typeof UserSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Request Types
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;
export type ResendVerificationRequest = z.infer<
  typeof ResendVerificationRequestSchema
>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

// Response Types
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type VerifyEmailResponse = z.infer<typeof VerifyEmailResponseSchema>;
export type ResendVerificationResponse = z.infer<
  typeof ResendVerificationResponseSchema
>;
export type ForgotPasswordResponse = z.infer<
  typeof ForgotPasswordResponseSchema
>;
export type ResetPasswordResponse = z.infer<typeof ResetPasswordResponseSchema>;
export type ChangePasswordResponse = z.infer<
  typeof ChangePasswordResponseSchema
>;
export type GetMeResponse = z.infer<typeof GetMeResponseSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;

// ============================================================================
// List Users Route (Helper for permissions dashboard)
// ============================================================================

const UserListItemSchema = z.object({
  id: z.string().openapi({ example: "user_abc123" }),
  email: z.string().email().openapi({ example: "user@example.com" }),
  displayName: z.string().nullable().openapi({ example: "John Doe" }),
  emailVerified: z.boolean().openapi({ example: true }),
  createdAt: z.number().openapi({ example: 1702425600 }),
  status: z.enum(["active", "suspended"]).openapi({ example: "active" }),
});

const ListUsersResponseSchema = z.object({
  users: z.array(UserListItemSchema),
  count: z.number().openapi({ example: 10 }),
});

export const listUsersRoute = createRoute({
  method: "get",
  path: "/v1/users",
  tags: ["Users"],
  summary: "List all users",
  description: "Get a list of all registered users (authenticated users only)",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "List of users",
      content: {
        "application/json": {
          schema: ListUsersResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export type ListUsersResponse = z.infer<typeof ListUsersResponseSchema>;
