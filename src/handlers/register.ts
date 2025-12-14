/**
 * Registration Handler
 *
 * POST /v1/auth/register
 *
 * Creates a new user account with email/password.
 * Validation is handled by the OpenAPI route definition.
 */

import type { RouteHandler } from "@hono/zod-openapi";
import type { Env } from "../types";
import { registerRoute } from "../schemas/auth.schema";
import { registerUser } from "../services/user.service";
import { generateSecureToken } from "../utils/crypto";
import {
  sendVerificationEmail,
  storeEmailVerificationToken,
} from "../services/email.service";
import { transformUserForRegister } from "../schemas/db-schemas";

/**
 * Handle user registration
 * Data is pre-validated by OpenAPI route schema
 */
export const handleRegister: RouteHandler<
  typeof registerRoute,
  { Bindings: Env }
> = async (c) => {
  try {
    // Get validated data from OpenAPI middleware
    const validatedData = c.req.valid("json");
    console.log("Registration request:", validatedData.email);

    // Register user
    const result = await registerUser(validatedData, c.env);
    console.log("User registered:", result.user.email);

    // Generate email verification token (plain text, not hashed)
    const verificationToken = generateSecureToken();
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours

    // Store verification token in database
    await storeEmailVerificationToken(
      result.user.id,
      result.user.email,
      verificationToken,
      expiresAt,
      c.env
    );

    // Send verification email (wait for it to ensure it sends)
    try {
      await sendVerificationEmail(result.user.email, verificationToken, c.env);
      console.log("✅ Verification email sent successfully");
    } catch (error) {
      console.error("❌ Failed to send verification email:", error);
      // Don't fail registration if email fails
    }

    // Set refresh token as httpOnly cookie
    c.header(
      "Set-Cookie",
      `refreshToken=${result.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`
    );

    // Transform database user to API user (partial for register response)
    const apiUser = transformUserForRegister(result.user);

    // Return response matching OpenAPI schema
    return c.json(
      {
        message:
          "Registration successful. Please check your email to verify your account.",
        user: apiUser,
        accessToken: result.accessToken,
      },
      201
    );
  } catch (error) {
    // Handle business logic errors
    if (error instanceof Error) {
      console.error("Business logic error:", error.message);

      // Check for specific error messages
      if (error.message.includes("already registered")) {
        return c.json(
          {
            error: "Email already registered",
            message:
              "This email address is already associated with an account.",
          },
          409
        );
      }

      return c.json(
        {
          error: "Registration failed",
          message: error.message,
        },
        400
      );
    }

    // Generic error
    console.error("Registration error:", error);
    return c.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred during registration.",
      },
      500
    );
  }
};
