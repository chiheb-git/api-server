import type { Pool } from "pg";
import { BOOTSTRAP_SCHEMA_STATEMENTS } from "./bootstrapSchemaStatements.js";
import { logger } from "./logger.js";

/**
 * Crée les tables manquantes (CREATE IF NOT EXISTS) avant le trafic HTTP.
 * Ne modifie pas les tables déjà présentes avec une autre définition.
 */
export async function ensureDatabaseSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    for (const sql of BOOTSTRAP_SCHEMA_STATEMENTS) {
      await client.query(sql);
    }
  } finally {
    client.release();
  }
  logger.info(
    { tables: BOOTSTRAP_SCHEMA_STATEMENTS.length },
    "Schéma PostgreSQL minimum appliqué (CREATE IF NOT EXISTS)",
  );
}
