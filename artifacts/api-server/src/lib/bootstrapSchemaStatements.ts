/**
 * DDL idempotent au démarrage : CREATE TABLE IF NOT EXISTS.
 * Aligné sur lib/db/src/schema (Drizzle).
 */
export const BOOTSTRAP_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS phones (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  imei TEXT NOT NULL UNIQUE,
  brand TEXT,
  model TEXT,
  image_base64 TEXT,
  trust_score REAL NOT NULL,
  layer1_score REAL NOT NULL,
  layer2_score REAL NOT NULL,
  layer3_result TEXT NOT NULL,
  final_verdict TEXT NOT NULL,
  verification_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS searches (
  id SERIAL PRIMARY KEY,
  imei TEXT NOT NULL,
  searched_by INTEGER,
  result TEXT NOT NULL,
  trust_score REAL,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS box_verifications (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  front_image_base64 TEXT,
  angle_image_base64 TEXT,
  layer1_score INTEGER NOT NULL,
  layer2_score INTEGER NOT NULL,
  layer3_score INTEGER NOT NULL,
  layer4_score INTEGER NOT NULL,
  layer5_score INTEGER NOT NULL,
  layer6_score INTEGER NOT NULL,
  layer7_score INTEGER NOT NULL,
  layer8_score INTEGER NOT NULL,
  final_score INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS fusion_verifications (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  imei_score INTEGER NOT NULL,
  box_score INTEGER NOT NULL,
  fusion_score INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  confidence VARCHAR(20) NOT NULL,
  agreement VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
)`,
];
