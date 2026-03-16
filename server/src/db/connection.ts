import pkg from 'pg';
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

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function initDB() {
  await runMigrations();
  await seed();
  console.log('[DB] PostgreSQL connected and ready');
}