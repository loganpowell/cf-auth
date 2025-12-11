/**
 * AWS SES Infrastructure (Pulumi)
 *
 * Provisions and configures AWS Simple Email Service for transactional emails
 *
 * Features:
 * - Email identity verification (domain or email)
 * - DKIM signing for better deliverability
 * - Configuration sets for tracking
 * - SNS topics for bounce/complaint handling
 * - Optional: Email templates
 *
 * Requirements:
 * - AWS provider configured in Pulumi
 * - Domain DNS access for verification
 */

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Get Pulumi config
const config = new pulumi.Config();
const emailConfig = new pulumi.Config("email");
const awsConfig = new pulumi.Config("aws");

// Email configuration - support both naming conventions
const emailDomain =
  emailConfig.get("domain") ||
  config.get("emailDomain") ||
  config.require("emailDomain");
const emailFrom =
  emailConfig.get("fromAddress") ||
  config.get("emailFrom") ||
  `noreply@${emailDomain}`;
const emailFromName =
  emailConfig.get("fromName") || config.get("emailFromName") || "Auth Service";

// Bounce domain (for bounce/complaint handling)
// Optional - defaults to "bounces.{emailDomain}" subdomain
// This MUST be a subdomain of emailDomain per AWS SES requirements
// Example: if emailDomain is "mail.rel.sh", this could be "bounces.mail.rel.sh"
const bounceDomain =
  emailConfig.get("bounceDomain") ||
  config.get("emailBounceDomain") ||
  `bounces.${emailDomain}`;

// AWS region for SES
const sesRegion = awsConfig.get("region") || "us-east-1";

// Get stack name for resource naming
const stackName = pulumi.getStack();

/**
 * Verify domain identity in SES
 * This allows sending from any address @yourdomain.com
 */
export const domainIdentity = new aws.ses.DomainIdentity(
  "email-domain-identity",
  {
    domain: emailDomain,
  }
);

/**
 * DKIM tokens for email authentication
 * These need to be added as DNS records in your domain
 */
export const domainDkim = new aws.ses.DomainDkim("email-domain-dkim", {
  domain: domainIdentity.domain,
});

/**
 * Mail FROM domain for better deliverability
 * This is the domain that receives bounce/complaint notifications
 * Defaults to same as emailDomain, but can be configured separately
 * Configurable via emailBounceDomain or email:bounceDomain
 */
export const mailFromDomain = new aws.ses.MailFrom("email-mail-from", {
  domain: domainIdentity.domain,
  mailFromDomain: bounceDomain,
});

/**
 * Configuration set for tracking email events
 * Enables bounce, complaint, and delivery tracking
 */
export const configurationSet = new aws.ses.ConfigurationSet(
  "email-config-set",
  {
    name: `auth-service-emails-${stackName}`,
    reputationMetricsEnabled: true,
    sendingEnabled: true,
  }
);

/**
 * SNS Topic for bounce notifications
 */
export const bounceNotificationTopic = new aws.sns.Topic("email-bounce-topic", {
  name: `auth-service-email-bounces-${stackName}`,
  displayName: `Auth Service Email Bounces (${stackName})`,
});

/**
 * SNS Topic for complaint notifications
 */
export const complaintNotificationTopic = new aws.sns.Topic(
  "email-complaint-topic",
  {
    name: `auth-service-email-complaints-${stackName}`,
    displayName: `Auth Service Email Complaints (${stackName})`,
  }
);

/**
 * SNS Topic for delivery notifications (optional)
 */
export const deliveryNotificationTopic = new aws.sns.Topic(
  "email-delivery-topic",
  {
    name: `auth-service-email-deliveries-${stackName}`,
    displayName: `Auth Service Email Deliveries (${stackName})`,
  }
);

/**
 * Event destination for bounces
 */
export const bounceEventDestination = new aws.ses.EventDestination(
  "bounce-event-destination",
  {
    name: "bounce-events",
    configurationSetName: configurationSet.name,
    enabled: true,
    matchingTypes: ["bounce"],
    snsDestination: {
      topicArn: bounceNotificationTopic.arn,
    },
  }
);

/**
 * Event destination for complaints
 */
export const complaintEventDestination = new aws.ses.EventDestination(
  "complaint-event-destination",
  {
    name: "complaint-events",
    configurationSetName: configurationSet.name,
    enabled: true,
    matchingTypes: ["complaint"],
    snsDestination: {
      topicArn: complaintNotificationTopic.arn,
    },
  }
);

/**
 * Event destination for deliveries (optional - can be noisy)
 */
export const deliveryEventDestination = new aws.ses.EventDestination(
  "delivery-event-destination",
  {
    name: "delivery-events",
    configurationSetName: configurationSet.name,
    enabled: false, // Enable if you need delivery tracking
    matchingTypes: ["send", "delivery"],
    snsDestination: {
      topicArn: deliveryNotificationTopic.arn,
    },
  }
);

/**
 * IAM User for programmatic SES access
 * Create access keys for this user to use in Cloudflare Workers
 * Note: Changing resource name to force replacement (IAM users can't be renamed)
 */
export const sesUser = new aws.iam.User(`ses-user-${stackName}`, {
  name: `auth-service-ses-user-${stackName}`,
  path: "/service-accounts/",
  tags: {
    Service: "auth-service",
    Purpose: "SES email sending",
    Stack: stackName,
  },
});

/**
 * IAM Policy for SES sending permissions
 * Note: Changing resource name to force replacement (IAM policies can't be renamed)
 */
export const sesPolicy = new aws.iam.Policy(`ses-send-policy-${stackName}`, {
  name: `auth-service-ses-send-policy-${stackName}`,
  description: `Allow sending emails via SES (${stackName})`,
  policy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["ses:SendEmail", "ses:SendRawEmail", "ses:SendTemplatedEmail"],
        Resource: "*",
        Condition: {
          StringEquals: {
            "ses:FromAddress": [emailFrom],
          },
        },
      },
    ],
  }),
});

/**
 * Attach policy to user
 */
export const sesPolicyAttachment = new aws.iam.UserPolicyAttachment(
  `ses-policy-attachment-${stackName}`,
  {
    user: sesUser.name,
    policyArn: sesPolicy.arn,
  }
);

/**
 * Create access key for the SES user
 * IMPORTANT: Store these credentials securely in Cloudflare Workers secrets
 */
export const sesAccessKey = new aws.iam.AccessKey(
  `ses-access-key-${stackName}`,
  {
    user: sesUser.name,
  }
);

// =============================================================================
// Route53 DNS Records (Automated)
// =============================================================================

/**
 * Determine which hosted zone to use for DNS records
 *
 * For subdomains (e.g., mail.rel.sh):
 * - Use parent domain's hosted zone (rel.sh) - RECOMMENDED
 * - All SES records created as subdomains in the parent zone
 * - No separate hosted zone needed
 *
 * For root domains (e.g., example.com):
 * - Use the root domain's existing hosted zone
 */

let hostedZoneId: pulumi.Output<string> | undefined;
let hostedZoneNameServers: pulumi.Output<string[]> | undefined;
let hostedZoneName: string;

// Parse domain to determine if it's a subdomain
const domainParts = emailDomain.split(".");
const isSubdomain = domainParts.length > 2;

if (isSubdomain) {
  // For subdomains, use parent domain's hosted zone
  const parentDomain = domainParts.slice(1).join(".");
  hostedZoneName = parentDomain;

  pulumi.log.info(
    `Email domain ${emailDomain} is a subdomain. ` +
      `Using parent domain ${parentDomain} hosted zone for DNS records.`
  );
} else {
  // For root domains, use the domain itself
  hostedZoneName = emailDomain;
}

// Look up the hosted zone
try {
  const hostedZone = aws.route53.getZoneOutput({
    name: hostedZoneName,
    privateZone: false,
  });

  hostedZoneId = hostedZone.zoneId;
  hostedZoneNameServers = hostedZone.nameServers;

  pulumi.log.info(
    `Found Route53 hosted zone for ${hostedZoneName} (ID: ${hostedZoneId})`
  );
} catch (error) {
  pulumi.log.warn(
    `Route53 hosted zone for ${hostedZoneName} not found. ` +
      `DNS records will not be created automatically. ` +
      `Please add the following records manually or create the hosted zone.`
  );
}

// Only create DNS records if we have a hosted zone
const dnsRecordsEnabled = hostedZoneId !== undefined;

/**
 * Domain Verification TXT Record
 * AWS will check this record to verify domain ownership
 */
const domainVerificationRecord =
  dnsRecordsEnabled && hostedZoneId
    ? new aws.route53.Record("ses-domain-verification", {
        zoneId: hostedZoneId,
        name: `_amazonses.${emailDomain}`,
        type: "TXT",
        ttl: 1800,
        records: [domainIdentity.verificationToken],
      })
    : undefined;

/**
 * DKIM CNAME Records (3 records)
 * These prove that emails are legitimately from your domain
 */
const dkimRecords =
  dnsRecordsEnabled && hostedZoneId
    ? domainDkim.dkimTokens.apply((tokens) =>
        tokens.map(
          (token, i) =>
            new aws.route53.Record(`ses-dkim-${i + 1}`, {
              zoneId: hostedZoneId!,
              name: `${token}._domainkey.${emailDomain}`,
              type: "CNAME",
              ttl: 1800,
              records: [`${token}.dkim.amazonses.com`],
            })
        )
      )
    : undefined;

/**
 * Mail FROM Domain - MX Record
 * Receives bounce notifications
 * Uses bounceDomain (can be same as emailDomain or separate)
 */
const mailFromMxRecord =
  dnsRecordsEnabled && hostedZoneId
    ? new aws.route53.Record("ses-mail-from-mx", {
        zoneId: hostedZoneId,
        name: bounceDomain,
        type: "MX",
        ttl: 1800,
        records: [`10 feedback-smtp.${sesRegion}.amazonses.com`],
      })
    : undefined;

/**
 * Mail FROM Domain - SPF TXT Record
 * Authorizes AWS SES to send emails on behalf of your domain
 * Uses bounceDomain (can be same as emailDomain or separate)
 */
const mailFromSpfRecord =
  dnsRecordsEnabled && hostedZoneId
    ? new aws.route53.Record("ses-mail-from-spf", {
        zoneId: hostedZoneId,
        name: bounceDomain,
        type: "TXT",
        ttl: 1800,
        records: ["v=spf1 include:amazonses.com ~all"],
      })
    : undefined;

// Export values needed for configuration
export const outputs = {
  // Domain verification
  domainIdentityVerificationToken: domainIdentity.verificationToken,

  // DKIM records (add these to DNS)
  dkimTokens: domainDkim.dkimTokens,

  // Mail FROM domain (add MX and SPF records)
  mailFromDomainName: mailFromDomain.mailFromDomain,

  // AWS credentials (use in wrangler secrets)
  awsAccessKeyId: sesAccessKey.id,
  awsSecretAccessKey: sesAccessKey.secret, // Marked as secret in Pulumi

  // Configuration
  sesRegion: pulumi.output(sesRegion),
  emailFrom: pulumi.output(emailFrom),
  emailFromName: pulumi.output(emailFromName),
  configurationSetName: configurationSet.name,

  // SNS Topics
  bounceTopicArn: bounceNotificationTopic.arn,
  complaintTopicArn: complaintNotificationTopic.arn,
  deliveryTopicArn: deliveryNotificationTopic.arn,

  // DNS Records (automated via Route53)
  dnsRecordsCreated: pulumi.output(dnsRecordsEnabled),
  dnsAutomated: pulumi.output(dnsRecordsEnabled),
  hostedZoneId: hostedZoneId || pulumi.output(undefined),
  hostedZoneNameServers: hostedZoneNameServers || pulumi.output(undefined),
  domainVerificationRecordId:
    domainVerificationRecord?.id || pulumi.output(undefined),
  dkimRecordIds: dkimRecords
    ? pulumi.output(dkimRecords).apply((records) => records.map((r) => r.id))
    : pulumi.output(undefined),
  mailFromMxRecordId: mailFromMxRecord?.id || pulumi.output(undefined),
  mailFromSpfRecordId: mailFromSpfRecord?.id || pulumi.output(undefined),
};
