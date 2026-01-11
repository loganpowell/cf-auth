/**
 * Pulumi Infrastructure as Code
 *
 * Provisions all infrastructure for the multi-tenant auth service:
 * - AWS OIDC Providers (GitHub Actions, Pulumi ESC)
 * - AWS IAM Roles and Policies
 * - AWS SES (Email service with automated DNS)
 * - Cloudflare D1 Database (multi-tenant data)
 * - Cloudflare KV Namespaces (rate limiting, token blacklist, session cache, mutation logs)
 * - Cloudflare R2 Bucket (per-tenant CSV files)
 * - Cloudflare Durable Objects (per-tenant state management)
 * - Automated DNS records via Route53
 * - Worker secrets via Pulumi ESC
 */

import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import * as aws from "@pulumi/aws";
import * as crypto from "crypto";

// Import email infrastructure (AWS SES + DNS)
import * as emailInfra from "./email";

// Get Pulumi config
const config = new pulumi.Config();
const awsConfig = new pulumi.Config("aws");
const cloudflareAccountId = config.require("cloudflareAccountId");
const cloudflareZoneId = config.get("cloudflareZoneId"); // Optional: for custom domains
const githubRepository = config.require("githubRepository");

// Get stack name for resource naming
const stackName = pulumi.getStack();

// Parse GitHub org and repo
const [githubOrg, githubRepo] = githubRepository.split("/");
const region = awsConfig.require("region");

// =============================================================================
// GitHub Actions OIDC Provider
// =============================================================================
const githubOidcProvider = new aws.iam.OpenIdConnectProvider(
  "github-oidc-provider",
  {
    url: "https://token.actions.githubusercontent.com",
    clientIdLists: ["sts.amazonaws.com"],
    thumbprintLists: [
      "6938fd4d98bab03faadb97b34396831e3780aea1",
      "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
    ],
  },
  {
    import: process.env.IMPORT_GITHUB_OIDC,
  }
);

// =============================================================================
// Pulumi ESC OIDC Provider
// =============================================================================
const pulumiOidcProvider = new aws.iam.OpenIdConnectProvider(
  "pulumi-oidc-provider",
  {
    url: "https://api.pulumi.com/oidc",
    clientIdLists: [githubOrg],
    thumbprintLists: ["9e99a48a9960b14926bb7f3b02e22da2b0ab7280"],
  },
  {
    import: process.env.IMPORT_PULUMI_OIDC,
  }
);

// =============================================================================
// AWS Secrets Manager - SES Credentials
// =============================================================================
const sesCredentialsSecret = new aws.secretsmanager.Secret(
  "ses-credentials",
  {
    name: `cf-auth/ses-credentials-${stackName}`,
    description: "AWS SES credentials for email sending",
  },
  {
    protect: true,
  }
);

// =============================================================================
// IAM Role for Pulumi ESC
// =============================================================================
const pulumiEscRole = new aws.iam.Role(
  "pulumi-esc-role",
  {
    name: `pulumi-esc-cf-auth-${stackName}`,
    description: "Role for Pulumi ESC to access secrets",
    assumeRolePolicy: pulumi.interpolate`{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Federated": "${pulumiOidcProvider.arn}"
                },
                "Action": "sts:AssumeRoleWithWebIdentity",
                "Condition": {
                    "StringEquals": {
                        "api.pulumi.com/oidc:aud": "${githubOrg}"
                    }
                }
            }
        ]
    }`,
    inlinePolicies: [
      {
        name: "pulumi-esc-policy",
        policy: sesCredentialsSecret.arn.apply(
          (arn) => `{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "secretsmanager:GetSecretValue",
                    "secretsmanager:DescribeSecret"
                ],
                "Resource": "${arn}"
            },
            {
                "Effect": "Allow",
                "Action": [
                    "ses:SendEmail",
                    "ses:SendRawEmail",
                    "ses:SendTemplatedEmail"
                ],
                "Resource": "*"
            }
        ]
    }`
        ),
      },
    ],
  },
  {
    protect: true,
  }
);

// =============================================================================
// IAM Role for GitHub Actions
// =============================================================================
const githubActionsRole = new aws.iam.Role("github-actions-role", {
  name: `github-actions-cf-auth-${stackName}`,
  description: "Role for GitHub Actions to deploy infrastructure",
  assumeRolePolicy: pulumi.interpolate`{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Federated": "${githubOidcProvider.arn}"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringLike": {
            "token.actions.githubusercontent.com:sub": "repo:${githubRepository}:*"
          },
          "StringEquals": {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
          }
        }
      }
    ]
  }`,
  inlinePolicies: [
    {
      name: "github-actions-policy",
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "ses:*",
              "sns:*",
              "iam:*",
              "secretsmanager:*",
              "route53:*",
            ],
            Resource: "*",
          },
        ],
      }),
    },
  ],
});

// =============================================================================
// Cloudflare Resources
// =============================================================================

// Create D1 Database with stack-based naming
const authDatabase = new cloudflare.D1Database("auth-db", {
  accountId: cloudflareAccountId,
  name: `auth-db-${stackName}`,
});

// Create KV Namespaces with stack-based naming
const rateLimiterKV = new cloudflare.WorkersKvNamespace("rate-limiter-kv", {
  accountId: cloudflareAccountId,
  title: `rate-limiter-kv-${stackName}`,
});

const tokenBlacklistKV = new cloudflare.WorkersKvNamespace(
  "token-blacklist-kv",
  {
    accountId: cloudflareAccountId,
    title: `token-blacklist-kv-${stackName}`,
  }
);

const sessionCacheKV = new cloudflare.WorkersKvNamespace("session-cache-kv", {
  accountId: cloudflareAccountId,
  title: `session-cache-kv-${stackName}`,
});

// KV Namespace for mutation logs (for Durable Objects persistence)
const mutationLogKV = new cloudflare.WorkersKvNamespace("mutation-log-kv", {
  accountId: cloudflareAccountId,
  title: `mutation-log-kv-${stackName}`,
});

// =============================================================================
// R2 Bucket for CSV Storage
// =============================================================================

// R2 bucket for per-tenant CSV files (canonical data source)
const tenantDataBucket = new cloudflare.R2Bucket("tenant-data-bucket", {
  accountId: cloudflareAccountId,
  name: `tenant-data-${stackName}`,
  location: "WNAM", // Western North America
});

// =============================================================================
// Worker Secrets
// =============================================================================

// Generate a secure JWT secret
const jwtSecret = new cloudflare.WorkerSecret(
  "jwt-secret",
  {
    accountId: cloudflareAccountId,
    name: "JWT_SECRET",
    scriptName: "auth-service", // Must match wrangler.toml name
    secretText:
      config.getSecret("jwtSecret") ||
      pulumi.output(crypto.randomBytes(32).toString("base64")),
  },
  {
    additionalSecretOutputs: ["secretText"],
  }
);

// =============================================================================
// Durable Objects
// =============================================================================

// Note: Durable Objects are defined in the Worker code and bound via wrangler.toml
// They don't require separate Pulumi resources, but we export their namespace
// for configuration purposes.

// Durable Object namespaces (configured in wrangler.toml):
// - TENANT_STATE: Per-tenant state management and real-time sync
// - GRAPH_STATE_CSV: Per-tenant authorization graph state (CSV-based)

// Export OIDC and IAM infrastructure
export const githubOidcProviderArn = githubOidcProvider.arn;
export const pulumiOidcProviderArn = pulumiOidcProvider.arn;
export const sesCredentialsSecretArn = sesCredentialsSecret.arn;
export const sesCredentialsSecretName = sesCredentialsSecret.name;
export const pulumiEscRoleArn = pulumiEscRole.arn;
export const pulumiEscRoleName = pulumiEscRole.name;
export const githubActionsRoleArn = githubActionsRole.arn;
export const githubActionsRoleName = githubActionsRole.name;
export const awsRegion = region;
export const repository = githubRepository;

// Export Cloudflare resource IDs for use in wrangler.toml
export const d1DatabaseId = authDatabase.id;
export const rateLimiterKvId = rateLimiterKV.id;
export const tokenBlacklistKvId = tokenBlacklistKV.id;
export const sessionCacheKvId = sessionCacheKV.id;
export const mutationLogKvId = mutationLogKV.id;
export const tenantDataBucketName = tenantDataBucket.name;
export const jwtSecretName = jwtSecret.name;

// Export email infrastructure outputs at top level for easier access
export const domainIdentityVerificationToken =
  emailInfra.outputs.domainIdentityVerificationToken;
export const dkimTokens = emailInfra.outputs.dkimTokens;
export const mailFromDomainName = emailInfra.outputs.mailFromDomainName;
export const awsAccessKeyId = emailInfra.outputs.awsAccessKeyId;
export const awsSecretAccessKey = emailInfra.outputs.awsSecretAccessKey;
export const sesRegion = emailInfra.outputs.sesRegion;
export const emailFrom = emailInfra.outputs.emailFrom;
export const emailFromName = emailInfra.outputs.emailFromName;
export const bounceTopicArn = emailInfra.outputs.bounceTopicArn;
export const complaintTopicArn = emailInfra.outputs.complaintTopicArn;
export const deliveryTopicArn = emailInfra.outputs.deliveryTopicArn;
export const dnsRecordsCreated = emailInfra.outputs.dnsRecordsCreated;

// Stack outputs
export const outputs = {
  // OIDC and IAM
  oidc: {
    githubProviderArn: githubOidcProvider.arn,
    pulumiProviderArn: pulumiOidcProvider.arn,
    githubActionsRoleArn: githubActionsRole.arn,
    pulumiEscRoleArn: pulumiEscRole.arn,
    sesCredentialsSecretArn: sesCredentialsSecret.arn,
  },
  // Cloudflare resources
  d1Database: {
    id: authDatabase.id,
    name: authDatabase.name,
  },
  kvNamespaces: {
    rateLimiter: {
      id: rateLimiterKV.id,
      title: rateLimiterKV.title,
    },
    tokenBlacklist: {
      id: tokenBlacklistKV.id,
      title: tokenBlacklistKV.title,
    },
    sessionCache: {
      id: sessionCacheKV.id,
      title: sessionCacheKV.title,
    },
    mutationLog: {
      id: mutationLogKV.id,
      title: mutationLogKV.title,
    },
  },
  r2Buckets: {
    tenantData: {
      name: tenantDataBucket.name,
      location: "WNAM",
      purpose: "Per-tenant CSV files (canonical authorization data)",
    },
  },
  durableObjects: {
    note: "Durable Objects are defined in Worker code (wrangler.toml)",
    namespaces: [
      "TENANT_STATE - Per-tenant state management and real-time sync",
      "GRAPH_STATE_CSV - Per-tenant authorization graph state (CSV-based)",
    ],
  },
  workerSecrets: {
    jwtSecret: {
      name: jwtSecret.name,
      scriptName: "auth-service",
      purpose: "JWT token signing and verification for end-user authentication",
    },
  },
  // Email infrastructure
  email: {
    ...emailInfra.outputs,
    dnsAutomated: true,
    setupInstructions:
      "DNS records created automatically via Route53. SES credentials managed via Pulumi ESC.",
  },
};

// Note:
// - All DNS records are created automatically via Route53
// - Worker secrets are managed via Pulumi ESC
// - Single `pulumi up` deploys everything
