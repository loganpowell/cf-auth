/**
 * Drizzle Database Helper
 *
 * Provides a helper function to initialize Drizzle ORM with the D1 database.
 */

import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import type { Env } from "../types";

/**
 * Initialize Drizzle ORM with D1 database
 *
 * @param env - Cloudflare Worker environment bindings
 * @returns Drizzle database instance with schema
 *
 * @example
 * ```ts
 * const db = initDb(env);
 * const users = await db.select().from(schema.users).all();
 * ```
 */
export function initDb(env: Env) {
  return drizzle(env.DB, { schema });
}

// Export schema for convenience
export { schema };
