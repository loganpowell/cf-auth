/**
 * Login Handler
 *
 * POST /v1/auth/login
 *
 * Authenticates a user with email and password.
 * Validation is handled by the OpenAPI route definition.
 */

import type { RouteHandler } from "@hono/zod-openapi";
import type { Env } from "../types";
import { loginRoute } from "../schemas/auth.schema";
import { loginUser } from "../services/user.service";
import { transformUserForLogin } from "../schemas/db-schemas";

/**
 * Handle user login
 * Data is pre-validated by OpenAPI route schema
 */
export const handleLogin: RouteHandler<
  typeof loginRoute,
  { Bindings: Env }
> = async (c) => {
  try {
    // Get validated data from OpenAPI middleware
    const validatedData = c.req.valid("json");

    // Authenticate user
    const result = await loginUser(validatedData, c.env);

    // Transform database user to API user (partial for login response)
    const apiUser = transformUserForLogin(result.user);

    // Set refresh token as httpOnly cookie
    c.header(
      "Set-Cookie",
      `refreshToken=${result.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`
    );

    // Return response matching OpenAPI schema
    return c.json(
      {
        message: apiUser.emailVerified
          ? "Login successful"
          : "Login successful. Please verify your email address.",
        accessToken: result.accessToken,
        user: apiUser,
      },
      200
    );
  } catch (error) {
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
};
