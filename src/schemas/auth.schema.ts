/**
 * OpenAPI Zod Schemas for Authentication Endpoints
 *
 * These schemas define the request/response structure for all auth endpoints
 * and are used to generate the OpenAPI spec and TypeScript SDK.
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Extend Zod with OpenAPI support to ensure proper JSON Schema generation
extendZodWithOpenApi(z);

// ============================================================================
// Shared Schemas
// ============================================================================

const UserSchema = z
  .object({
    id: z.string().openapi({
      description: "Unique user identifier (UUID)",
      example: "550e8400-e29b-41d4-a716-446655440000",
    }),
    email: z.string().email().openapi({
      description: "User email address",
      example: "user@example.com",
    }),
    displayName: z
      .string()
      .openapi({ description: "User display name", example: "johndoe" }),
    avatarUrl: z.string().url().nullish().openapi({
      description: "User avatar URL",
      example: "https://example.com/avatar.jpg",
    }),
    emailVerified: z
      .boolean()
      .openapi({ description: "Whether email is verified", example: true }),
    createdAt: z.string().datetime().openapi({
      description: "Account creation timestamp",
      example: "2025-01-01T00:00:00Z",
    }),
    updatedAt: z.string().datetime().openapi({
      description: "Last update timestamp",
      example: "2025-01-01T00:00:00Z",
    }),
    lastLoginAt: z.string().datetime().nullish().openapi({
      description: "Last login timestamp",
      example: "2025-01-01T00:00:00Z",
    }),
    status: z
      .enum(["active", "suspended"])
      .openapi({ description: "Account status", example: "active" }),
    mfaEnabled: z
      .boolean()
      .openapi({ description: "Whether MFA is enabled", example: false }),
  })
  .openapi("User");

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
    email: z.string().email().openapi({
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
      example: "Registration successful",
    }),
    user: UserSchema.pick({
      id: true,
      email: true,
      displayName: true,
    }).openapi({ description: "Created user information" }),
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
      description: "Validation error or email already exists",
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
    email: z.string().email().openapi({
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
    user: UserSchema.pick({
      id: true,
      email: true,
      displayName: true,
      emailVerified: true,
    }).openapi({ description: "Authenticated user information" }),
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
    email: z.string().email().openapi({
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
    email: z.string().email().openapi({
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
      Bearer: [],
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
      Bearer: [],
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
