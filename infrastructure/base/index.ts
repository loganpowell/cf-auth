import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Get configuration
const config = new pulumi.Config();
const awsConfig = new pulumi.Config("aws");
const region = awsConfig.require("region");
const githubRepository = config.require("githubRepository");

// Parse GitHub org and repo
const [githubOrg, githubRepo] = githubRepository.split("/");

// =============================================================================
// GitHub Actions OIDC Provider
// =============================================================================
// Allows GitHub Actions to authenticate to AWS without long-lived credentials
const githubOidcProvider = new aws.iam.OpenIdConnectProvider(
  "github-oidc-provider",
  {
    url: "https://token.actions.githubusercontent.com",
    clientIdLists: ["sts.amazonaws.com"],
    thumbprintLists: [
      // GitHub's OIDC thumbprints
      "6938fd4d98bab03faadb97b34396831e3780aea1",
      "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
    ],
  },
  {
    // Allow importing existing provider
    import: process.env.IMPORT_GITHUB_OIDC,
  }
);

// =============================================================================
// Pulumi ESC OIDC Provider
// =============================================================================
// Allows Pulumi ESC to authenticate to AWS for secret management
const pulumiOidcProvider = new aws.iam.OpenIdConnectProvider(
  "pulumi-oidc-provider",
  {
    url: "https://api.pulumi.com/oidc",
    clientIdLists: [githubOrg],
    thumbprintLists: ["9e99a48a9960b14926bb7f3b02e22da2b0ab7280"],
  },
  {
    // Allow importing existing provider
    import: process.env.IMPORT_PULUMI_OIDC,
  }
);

// =============================================================================
// AWS Secrets Manager - SES Credentials
// =============================================================================
// Centralized storage for SES credentials (will be populated by email stack)
const sesCredentialsSecret = new aws.secretsmanager.Secret(
  "ses-credentials",
  {
    name: "cf-auth/ses-credentials",
    description: "AWS SES credentials for email sending",
  },
  {
    protect: true,
  }
);

// =============================================================================
// IAM Role for Pulumi ESC
// =============================================================================
// Allows Pulumi ESC to read secrets from AWS Secrets Manager
const pulumiEscRole = new aws.iam.Role(
  "pulumi-esc-role",
  {
    name: "pulumi-esc-cf-auth",
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
// Allows GitHub Actions workflows to deploy infrastructure
const githubActionsRole = new aws.iam.Role("github-actions-role", {
  name: "github-actions-cf-auth",
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
              // SES permissions
              "ses:*",
              // SNS permissions for notifications
              "sns:*",
              // IAM permissions for managing SES user
              "iam:CreateUser",
              "iam:DeleteUser",
              "iam:CreateAccessKey",
              "iam:DeleteAccessKey",
              "iam:ListAccessKeys",
              "iam:AttachUserPolicy",
              "iam:DetachUserPolicy",
              "iam:PutUserPolicy",
              "iam:DeleteUserPolicy",
              "iam:GetUser",
              "iam:GetUserPolicy",
              "iam:CreatePolicy",
              "iam:DeletePolicy",
              "iam:GetPolicy",
              "iam:ListPolicies",
              // Secrets Manager permissions
              "secretsmanager:CreateSecret",
              "secretsmanager:UpdateSecret",
              "secretsmanager:DeleteSecret",
              "secretsmanager:PutSecretValue",
              "secretsmanager:GetSecretValue",
              "secretsmanager:DescribeSecret",
              "secretsmanager:TagResource",
            ],
            Resource: "*",
          },
        ],
      }),
    },
  ],
});

// =============================================================================
// Outputs
// =============================================================================
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
