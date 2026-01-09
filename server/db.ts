/**
 * Database connection module using Drizzle ORM with PostgreSQL
 *
 * Provides a singleton database client instance with connection pooling.
 * Requires DATABASE_URL environment variable to be set.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

// Validate DATABASE_URL is configured
if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set");
  console.error("PostgreSQL database connection requires DATABASE_URL to be configured");
  throw new Error("DATABASE_URL environment variable is required for PostgreSQL storage");
}

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 5000, // Fail fast if connection takes > 5 seconds
});

// Handle connection errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });

// Log successful connection (will fail on first query if connection bad)
console.log("PostgreSQL connection pool initialized (DATABASE_URL configured)");

// Graceful shutdown handler
const shutdown = async () => {
  console.log("Closing PostgreSQL connection pool...");
  await pool.end();
  console.log("PostgreSQL connection pool closed");
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Export pool for direct access if needed (e.g., transactions)
export { pool };
