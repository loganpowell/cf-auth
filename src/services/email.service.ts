/**
 * Email Service
 *
 * Handles sending emails using AWS SES (Simple Email Service)
 * Uses AWS SigV4 signing for authentication
 *
 * Requirements:
 * 1. AWS SES domain verified
 * 2. AWS credentials configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * 3. Email domain configured in EMAIL_FROM environment variable
 */

import { eq, and, gt } from "drizzle-orm";
import { initDb, schema } from "../db";
import type { Env } from "../types";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * AWS SigV4 signing implementation
 */
async function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  payload: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  service: string
): Promise<Record<string, string>> {
  const algorithm = "AWS4-HMAC-SHA256";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  // Parse URL
  const urlObj = new URL(url);
  const canonicalUri = urlObj.pathname;
  const canonicalQuerystring = urlObj.search.slice(1);

  // Create canonical headers
  const signedHeaders = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort()
    .join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((k) => `${k.toLowerCase()}:${(headers[k] || "").trim()}`)
    .join("\n");

  // Hash payload
  const payloadHash = await sha256(payload);

  // Create canonical request
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders + "\n",
    signedHeaders,
    payloadHash,
  ].join("\n");

  // Create string to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join("\n");

  // Calculate signature
  const signingKey = await getSignatureKey(
    secretAccessKey,
    dateStamp,
    region,
    service
  );
  const signature = await hmacSha256(stringToSign, signingKey);

  // Create authorization header
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    "X-Amz-Date": amzDate,
    Authorization: authorizationHeader,
  };
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(message: string, key: ArrayBuffer): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgBuffer);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256Bytes(dateStamp, `AWS4${key}`);
  const kRegion = await hmacSha256Bytes(region, kDate);
  const kService = await hmacSha256Bytes(service, kRegion);
  return await hmacSha256Bytes("aws4_request", kService);
}

async function hmacSha256Bytes(
  message: string,
  key: string | ArrayBuffer
): Promise<ArrayBuffer> {
  const msgBuffer = new TextEncoder().encode(message);
  const keyBuffer =
    typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, msgBuffer);
}

/**
 * Send an email using AWS SES v2 API
 *
 * @param options - Email options
 * @param env - Environment bindings
 */
export async function sendEmail(
  options: EmailOptions,
  env: Env
): Promise<void> {
  const { to, subject, text, html } = options;

  // For development, just log the email
  if (env.ENVIRONMENT === "development") {
    console.log("📧 Email (Dev Mode - Not Sent):");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("Text:", text);
    console.log("---");
    return;
  }

  // Check AWS credentials
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(
      "AWS SES credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
    );
  }

  const fromEmail = env.EMAIL_FROM || "noreply@auth.example.com";
  const fromName = env.FROM_NAME || "Auth Service";
  const awsRegion = env.AWS_REGION || "us-east-1";
  const service = "ses";

  try {
    // Prepare SES v2 API request
    const endpoint = `https://email.${awsRegion}.amazonaws.com/v2/email/outbound-emails`;
    const emailPayload = JSON.stringify({
      FromEmailAddress: `${fromName} <${fromEmail}>`,
      Destination: {
        ToAddresses: [to],
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: html,
              Charset: "UTF-8",
            },
            Text: {
              Data: text,
              Charset: "UTF-8",
            },
          },
        },
      },
    });

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Host: `email.${awsRegion}.amazonaws.com`,
    };

    // Sign the request
    const signedHeaders = await signRequest(
      "POST",
      endpoint,
      headers,
      emailPayload,
      env.AWS_ACCESS_KEY_ID,
      env.AWS_SECRET_ACCESS_KEY,
      awsRegion,
      service
    );

    // Send the request
    const response = await fetch(endpoint, {
      method: "POST",
      headers: signedHeaders,
      body: emailPayload,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AWS SES Error:", errorText);
      throw new Error(`Failed to send email via AWS SES: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Email sent successfully via AWS SES:", result);
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    throw new Error(
      `Failed to send email: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  verificationToken: string,
  env: Env
): Promise<void> {
  const verificationUrl = `${
    env.APP_URL || "http://localhost:5174"
  }/verify-email?token=${verificationToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Verify Your Email</h1>
      </div>
      
      <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">
          Thank you for signing up! Please verify your email address to activate your account.
        </p>
        
        <p style="font-size: 16px; margin-bottom: 30px;">
          Click the button below to verify your email:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">
            Verify Email Address
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-top: 30px;">
          Or copy and paste this link into your browser:
        </p>
        <p style="font-size: 14px; color: #667eea; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
          ${verificationUrl}
        </p>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; margin: 0;">
          This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Auth Service. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  const text = `
Verify Your Email

Thank you for signing up! Please verify your email address to activate your account.

Click the link below to verify your email:
${verificationUrl}

This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.

© ${new Date().getFullYear()} Auth Service. All rights reserved.
  `.trim();

  await sendEmail(
    {
      to: email,
      subject: "Verify Your Email Address",
      html,
      text,
    },
    env
  );
}

// ============================================================================
// Email Verification Token Operations
// ============================================================================

/**
 * Store an email verification token in the database
 */
export async function storeEmailVerificationToken(
  userId: string,
  userEmail: string,
  token: string,
  expiresAt: number,
  env: Env
): Promise<string> {
  const db = initDb(env);
  const now = Math.floor(Date.now() / 1000);

  // Delete any existing tokens for this user
  await db
    .delete(schema.emailVerificationTokens)
    .where(eq(schema.emailVerificationTokens.userId, userId));

  // Generate ID for the token
  const { generateId } = await import("../utils/crypto");
  const tokenId = generateId();

  // Insert new token
  await db.insert(schema.emailVerificationTokens).values({
    id: tokenId,
    userId: userId,
    email: userEmail,
    token,
    expiresAt: expiresAt,
    createdAt: now,
  });

  return tokenId;
}

/**
 * Verify an email verification token and return the user ID
 */
export async function verifyEmailToken(
  token: string,
  env: Env
): Promise<string | null> {
  const db = initDb(env);
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .select({ userId: schema.emailVerificationTokens.userId })
    .from(schema.emailVerificationTokens)
    .where(
      and(
        eq(schema.emailVerificationTokens.token, token),
        gt(schema.emailVerificationTokens.expiresAt, now)
      )
    )
    .get();

  return result?.userId || null;
}

/**
 * Delete an email verification token
 */
export async function deleteEmailVerificationToken(
  token: string,
  env: Env
): Promise<void> {
  const db = initDb(env);

  await db
    .delete(schema.emailVerificationTokens)
    .where(eq(schema.emailVerificationTokens.token, token));
}

// ============================================================================
// Password Reset Token Operations
// ============================================================================

/**
 * Store a password reset token in the database
 */
export async function storePasswordResetToken(
  userId: string,
  token: string,
  expiresAt: number,
  env: Env
): Promise<string> {
  const db = initDb(env);
  const now = Math.floor(Date.now() / 1000);

  // Delete any existing reset tokens for this user
  await db
    .delete(schema.passwordResetTokens)
    .where(eq(schema.passwordResetTokens.userId, userId));

  // Generate ID for the token
  const { generateId } = await import("../utils/crypto");
  const tokenId = generateId();

  // Insert new token
  await db.insert(schema.passwordResetTokens).values({
    id: tokenId,
    userId: userId,
    token,
    expiresAt: expiresAt,
    createdAt: now,
  });

  return tokenId;
}

/**
 * Verify a password reset token and return the user ID
 */
export async function verifyPasswordResetToken(
  token: string,
  env: Env
): Promise<string | null> {
  const db = initDb(env);
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .select({ userId: schema.passwordResetTokens.userId })
    .from(schema.passwordResetTokens)
    .where(
      and(
        eq(schema.passwordResetTokens.token, token),
        gt(schema.passwordResetTokens.expiresAt, now)
      )
    )
    .get();

  return result?.userId || null;
}

/**
 * Delete a password reset token
 */
export async function deletePasswordResetToken(
  token: string,
  env: Env
): Promise<void> {
  const db = initDb(env);

  await db
    .delete(schema.passwordResetTokens)
    .where(eq(schema.passwordResetTokens.token, token));
}

/**
 * Mark a password reset token as used
 */
export async function markPasswordResetTokenUsed(
  token: string,
  env: Env
): Promise<void> {
  const db = initDb(env);
  const now = Math.floor(Date.now() / 1000);

  await db
    .update(schema.passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(schema.passwordResetTokens.token, token));
}
