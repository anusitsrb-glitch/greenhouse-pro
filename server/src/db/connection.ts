import Database from 'better-sqlite3';
import { env } from '../config/env.js';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dbDir = path.dirname(env.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
export const db = new Database(env.DB_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log(`📦 Database connected: ${env.DB_PATH}`);

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});
