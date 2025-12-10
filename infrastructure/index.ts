/**
 * Pulumi Infrastructure as Code
 * 
 * Provisions Cloudflare resources for the auth service:
 * - D1 Database
 * - KV Namespaces (rate limiting, token blacklist, session cache)
 * - Workers deployment
 * - Custom domain routing
 */

import * as pulumi from '@pulumi/pulumi';
import * as cloudflare from '@pulumi/cloudflare';

// Get Pulumi config
const config = new pulumi.Config();
const cloudflareAccountId = config.require('cloudflareAccountId');
const cloudflareZoneId = config.get('cloudflareZoneId'); // Optional: for custom domains

// Create D1 Database
const authDatabase = new cloudflare.D1Database('auth-db', {
  accountId: cloudflareAccountId,
  name: 'auth-db',
});

// Create KV Namespaces
const rateLimiterKV = new cloudflare.WorkersKvNamespace('rate-limiter-kv', {
  accountId: cloudflareAccountId,
  title: 'Auth Service - Rate Limiter',
});

const tokenBlacklistKV = new cloudflare.WorkersKvNamespace('token-blacklist-kv', {
  accountId: cloudflareAccountId,
  title: 'Auth Service - Token Blacklist',
});

const sessionCacheKV = new cloudflare.WorkersKvNamespace('session-cache-kv', {
  accountId: cloudflareAccountId,
  title: 'Auth Service - Session Cache',
});

// Export resource IDs for use in wrangler.toml
export const d1DatabaseId = authDatabase.id;
export const rateLimiterKvId = rateLimiterKV.id;
export const tokenBlacklistKvId = tokenBlacklistKV.id;
export const sessionCacheKvId = sessionCacheKV.id;

// Stack outputs
export const outputs = {
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
  },
};

// Note: Worker deployment will be handled by wrangler CLI
// Pulumi is used for resource provisioning, wrangler for code deployment
