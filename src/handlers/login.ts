/**
 * Login Handler
 *
 * POST /v1/auth/login
 *
 * Authenticates a user with email and password.
 */

import { Context } from "hono";
import { z } from "zod";
import type { Env } from "../types";
import { loginUser } from "../services/user.service";

// Request body validation schema
const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Handle user login
 */
export async function handleLogin(c: Context<{ Bindings: Env }>) {
  try {
    // Parse and validate request body
    const body = await c.req.json();
    const validatedData = loginSchema.parse(body);

    // Authenticate user
    const result = await loginUser(validatedData, c.env);

    // Set refresh token as httpOnly cookie
    c.header(
      "Set-Cookie",
      `refreshToken=${result.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`
    );

    // Return user and access token
    return c.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.display_name,
        avatarUrl: result.user.avatar_url,
        emailVerified: result.user.email_verified,
        lastLoginAt: result.user.last_login_at,
      },
      accessToken: result.accessToken,
      message: result.user.email_verified
        ? "Login successful"
        : "Login successful. Please verify your email address.",
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: "Validation failed",
          details: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        400
      );
    }

    // Handle authentication errors
    if (error instanceof Error) {
      // Use generic error message for security (don't reveal if email exists)
      if (
        error.message.includes("Invalid email or password") ||
        error.message.includes("social login")
      ) {
        return c.json(
          {
            error: "Authentication failed",
            message: error.message,
          },
          401
        );
      }

      if (error.message.includes("suspended")) {
        return c.json(
          {
            error: "Account suspended",
            message: error.message,
          },
          403
        );
      }

      return c.json(
        {
          error: "Login failed",
          message: error.message,
        },
        400
      );
    }

    // Generic error
    console.error("Login error:", error);
    return c.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred during login.",
      },
      500
    );
  }
}
