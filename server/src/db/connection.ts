import pkg from 'pg';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { runMigrations } from './migrate.js';
import { seed } from './seed.js'; 

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error('[DB] DATABASE_URL is not set');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Helper: query
export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function ensureUsersSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      is_active INTEGER NOT NULL DEFAULT 1,
      email TEXT,
      full_name TEXT,
      phone TEXT,
      language TEXT DEFAULT 'th',
      theme TEXT DEFAULT 'light',
      last_login_at TEXT,
      last_login_ip TEXT,
      failed_login_count INTEGER DEFAULT 0,
      locked_until TEXT,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT
    )
  `);
  console.log('[DB] users table ready');
}

async function seedAdminIfMissing() {
  const u = env.ADMIN_USERNAME;
  const p = env.ADMIN_PASSWORD;
  if (!u || !p) {
    console.warn('[DB] ADMIN_USERNAME / ADMIN_PASSWORD not set → skip seeding admin');
    return;
  }
  const res = await query(`SELECT 1 FROM users WHERE username = $1`, [u]);
  if (res.rows.length > 0) {
    console.log(`[DB] admin already exists: ${u}`);
    return;
  }
  const hash = bcrypt.hashSync(p, 10);
  await query(
    `INSERT INTO users (username, password_hash, role, is_active, language, theme)
     VALUES ($1, $2, 'superadmin', 1, 'th', 'light')`,
    [u, hash]
  );
  console.log(`[DB] Seeded admin: ${u}`);
}

export async function initDB() {
  await runMigrations();
  await seedAdminIfMissing();
  await seed(); 
  console.log('[DB] PostgreSQL connected and ready');
}