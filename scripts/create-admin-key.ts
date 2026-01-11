/**
 * Script to generate a proper admin API key for testing
 * Run with: npx tsx scripts/create-admin-key.ts
 */

import { createHash, randomBytes } from "node:crypto";

function generateAPIKey(type: "secret", environment: "live" | "test") {
  // Generate random suffix (32 chars)
  const randomSuffix = randomBytes(24)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 32);

  const typePrefix = "sk"; // secret key
  const env = environment === "test" ? "test" : "live";
  const keyPrefix = `${typePrefix}_${env}_${randomSuffix}`;

  // Generate secret component
  const keySecret = randomBytes(32).toString("hex");

  return {
    keyId: `key_${randomBytes(8).toString("hex")}`,
    keyPrefix,
    keySecret,
    fullKey: `${keyPrefix}:${keySecret}`, // This is what users will use in Bearer header
  };
}

function hashAPIKey(keyPrefix: string, keySecret: string): string {
  const data = `${keyPrefix}:${keySecret}`;
  return createHash("sha256").update(data).digest("hex");
}

// Generate admin key
const adminKey = generateAPIKey("secret", "live");
const keyHash = hashAPIKey(adminKey.keyPrefix, adminKey.keySecret);

console.log("\n🔑 Bootstrap Admin API Key Generated\n");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("\n📋 Key Details:");
console.log(`   Key ID:     ${adminKey.keyId}`);
console.log(`   Key Prefix: ${adminKey.keyPrefix}`);
console.log(`   Key Secret: ${adminKey.keySecret}`);
console.log(`   Hash:       ${keyHash}`);

console.log("\n🔐 Full API Key (USE THIS IN Authorization HEADER):");
console.log(`   ${adminKey.fullKey}`);

console.log("\n📝 SQL Insert Statement:");
console.log(`
INSERT INTO api_keys (
  id, tenant_id, key_prefix, key_hash, name,
  type, environment, permissions, created_at
) VALUES (
  '${adminKey.keyId}',
  'tenant_000',
  '${adminKey.keyPrefix}',
  '${keyHash}',
  'Platform Admin Key',
  'secret',
  'live',
  '["*"]',
  ${Math.floor(Date.now() / 1000)}
);
`);

console.log("\n🧪 Test with curl:");
console.log(`
curl -X GET \\
  https://auth-service.logan-607.workers.dev/admin/tenants \\
  -H "Authorization: Bearer ${adminKey.fullKey}"
`);

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
