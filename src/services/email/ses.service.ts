/**
 * AWS SES Email Service
 *
 * Handles sending emails using AWS Simple Email Service (SES)
 * Uses AWS SigV4 signing for authentication
 *
 * Requirements:
 * 1. AWS Account with SES enabled
 * 2. Verified sender email/domain in SES
 * 3. AWS credentials configured (Access Key ID & Secret Access Key)
 * 4. SES region configured
 */

import type { Env } from "../../types";

export interface SESEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

/**
 * AWS SigV4 Signing Helpers
 */
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

  const urlObj = new URL(url);
  const canonicalUri = urlObj.pathname || "/";
  const canonicalQuerystring = urlObj.search.slice(1);

  const signedHeaders = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort()
    .join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((k) => `${k.toLowerCase()}:${(headers[k] || "").trim()}`)
    .join("\n");

  const payloadHash = await sha256(payload);

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders + "\n",
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join("\n");

  const signingKey = await getSignatureKey(
    secretAccessKey,
    dateStamp,
    region,
    service
  );
  const signature = await hmacSha256(stringToSign, signingKey);

  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    "X-Amz-Date": amzDate,
    Authorization: authorizationHeader,
  };
}

/**
 * AWS SES API v2 Send Email
 * Uses AWS Signature Version 4 for authentication
 */
async function sendSESEmail(options: SESEmailOptions, env: Env): Promise<void> {
  const { to, subject, html, text, replyTo, cc = [], bcc = [] } = options;

  const toAddresses = Array.isArray(to) ? to : [to];
  const fromEmail = env.EMAIL_FROM || "noreply@auth.example.com";
  const fromName = env.FROM_NAME || "Auth Service";
  const region = env.AWS_REGION || "us-east-1";

  // SES v2 API endpoint
  const endpoint = `https://email.${region}.amazonaws.com/v2/email/outbound-emails`;

  // Build the request payload
  const payload = JSON.stringify({
    FromEmailAddress: `${fromName} <${fromEmail}>`,
    Destination: {
      ToAddresses: toAddresses,
      ...(cc.length > 0 && { CcAddresses: cc }),
      ...(bcc.length > 0 && { BccAddresses: bcc }),
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
    ...(replyTo && { ReplyToAddresses: [replyTo] }),
  });

  // Prepare headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Host: `email.${region}.amazonaws.com`,
  };

  // Sign the request with AWS SigV4
  const signedHeaders = await signRequest(
    "POST",
    endpoint,
    headers,
    payload,
    env.AWS_ACCESS_KEY_ID!,
    env.AWS_SECRET_ACCESS_KEY!,
    region,
    "ses"
  );

  // Make the signed request
  console.log(`🔐 Sending POST to: ${endpoint}`);
  console.log(`📨 To: ${toAddresses.join(", ")}`);
  console.log(`📋 Subject: ${subject}`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: signedHeaders,
    body: payload,
  });

  console.log(`📡 SES Response status: ${response.status}`);

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ SES API error response: ${error}`);
    throw new Error(`SES API error: ${response.status} - ${error}`);
  }

  const result = (await response.json()) as { MessageId?: string };
  console.log(
    `✅ Email sent via SES - MessageId: ${result.MessageId || "unknown"}`
  );
}

/**
 * Send an email using AWS SES
 *
 * @param options - Email options
 * @param env - Environment bindings
 */
export async function sendEmail(
  options: SESEmailOptions,
  env: Env
): Promise<void> {
  console.log("🔍 sendEmail called with ENVIRONMENT:", env.ENVIRONMENT);

  // For development, just log the email
  if (env.ENVIRONMENT === "development") {
    console.log("📧 Email (Dev Mode - Not Sent via SES):");
    console.log(
      "To:",
      Array.isArray(options.to) ? options.to.join(", ") : options.to
    );
    console.log("Subject:", options.subject);
    console.log("Text:", options.text);
    console.log("---");
    return;
  }

  console.log("📧 Sending email via AWS SES...");

  // Validate AWS SES configuration
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    console.error("❌ AWS credentials not configured!");
    console.error("Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY");
    throw new Error("AWS SES credentials not configured");
  }

  if (!env.EMAIL_FROM) {
    console.error("❌ EMAIL_FROM not configured!");
    throw new Error("Sender email not configured");
  }

  try {
    await sendSESEmail(options, env);
  } catch (error) {
    console.error("❌ Failed to send email via SES:", error);
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
    env.APP_URL || "http://localhost:5173"
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
        <h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email</h1>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">
          Welcome! Please verify your email address to complete your registration.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">
            Verify Email Address
          </a>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
          Or copy and paste this link into your browser:
        </p>
        <p style="font-size: 14px; color: #667eea; word-break: break-all;">
          ${verificationUrl}
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
          This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome! Please verify your email address to complete your registration.

Click this link to verify your email:
${verificationUrl}

This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
  `.trim();

  await sendEmail(
    {
      to: email,
      subject: "Verify your email address",
      html,
      text,
    },
    env
  );
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  env: Env
): Promise<void> {
  const resetUrl = `${
    env.APP_URL || "http://localhost:5174"
  }/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Reset Your Password</h1>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">
          We received a request to reset your password. Click the button below to create a new password.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background: #f5576c; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">
            Reset Password
          </a>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
          Or copy and paste this link into your browser:
        </p>
        <p style="font-size: 14px; color: #f5576c; word-break: break-all;">
          ${resetUrl}
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
  `.trim();

  await sendEmail(
    {
      to: email,
      subject: "Reset your password",
      html,
      text,
    },
    env
  );
}
