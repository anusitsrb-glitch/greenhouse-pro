import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

// --- 1) เตรียม path ของ DB ---
const dbFile = env.DB_PATH || './data/greenhouse.db';

// สร้างโฟลเดอร์ให้ DB_PATH (สำคัญมากบน Linux/Railway)
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

// --- 2) เปิด DB ---
export const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');


// -------------------------------
// Helpers: schema / migration
// -------------------------------
function listTables(): string[] {
  return db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all()
    .map((r: any) => r.name);
}

function listColumns(table: string): string[] {
  // PRAGMA table_info returns rows: cid, name, type, notnull, dflt_value, pk
  return db.prepare(`PRAGMA table_info(${table})`).all().map((r: any) => r.name);
}

function addColumnIfMissing(table: string, column: string, definition: string) {
  const cols = new Set(listColumns(table));
  if (cols.has(column)) return;

  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`[DB] Added column: ${table}.${column} ${definition}`);
}

/**
 * 3) สร้าง schema ขั้นต่ำ แต่ "ครบคอลัมน์ที่ระบบใช้จริง"
 *    และถ้า table เดิมมีอยู่แล้ว ให้เติม column ที่ขาดอัตโนมัติ
 */
function ensureUsersSchema() {
  // สร้าง table ถ้ายังไม่มี
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,

      -- auth ใช้ตัวนี้แน่นอน
      password_hash TEXT NOT NULL,

      -- role ตามระบบ
      role TEXT NOT NULL DEFAULT 'viewer',

      -- สถานะผู้ใช้
      is_active INTEGER NOT NULL DEFAULT 1,

      -- โปรไฟล์ที่ /api/auth/me SELECT
      email TEXT,
      full_name TEXT,
      phone TEXT,

      -- preferences
      language TEXT DEFAULT 'th',
      theme TEXT DEFAULT 'light',

      -- security/audit fields (เผื่อโค้ดอื่นเรียก)
      last_login_at TEXT,
      last_login_ip TEXT,
      failed_login_count INTEGER DEFAULT 0,
      locked_until TEXT,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);

  // ถ้า DB เก่าเคยสร้าง users แบบคอลัมน์น้อย → เติมให้ครบ
  addColumnIfMissing('users', 'email', 'TEXT');
  addColumnIfMissing('users', 'full_name', 'TEXT');
  addColumnIfMissing('users', 'phone', 'TEXT');

  addColumnIfMissing('users', 'language', "TEXT DEFAULT 'th'");
  addColumnIfMissing('users', 'theme', "TEXT DEFAULT 'light'");

  addColumnIfMissing('users', 'last_login_at', 'TEXT');
  addColumnIfMissing('users', 'last_login_ip', 'TEXT');
  addColumnIfMissing('users', 'failed_login_count', 'INTEGER DEFAULT 0');
  addColumnIfMissing('users', 'locked_until', 'TEXT');

  // บาง DB เก่าอาจไม่มี created_at/updated_at (กันพัง)
  addColumnIfMissing('users', 'created_at', "TEXT NOT NULL DEFAULT (datetime('now'))");
  addColumnIfMissing('users', 'updated_at', 'TEXT');
}

/**
 * 4) seed admin ครั้งแรก (ถ้าไม่มี username นี้)
 */
function seedAdminIfMissing() {
  const u = env.ADMIN_USERNAME;
  const p = env.ADMIN_PASSWORD;

  if (!u || !p) {
    console.warn('[DB] ADMIN_USERNAME / ADMIN_PASSWORD not set → skip seeding admin');
    return;
  }

  const exists = db.prepare(`SELECT 1 FROM users WHERE username = ?`).get(u);
  if (exists) {
    console.log(`[DB] admin already exists: ${u}`);
    return;
  }

  const hash = bcrypt.hashSync(p, 10);

  db.prepare(`
    INSERT INTO users (username, password_hash, role, is_active, language, theme)
    VALUES (?, ?, 'admin', 1, 'th', 'light')
  `).run(u, hash);

  console.log(`[DB] Seeded admin: ${u}`);
}

// --- Run ---
ensureUsersSchema();
seedAdminIfMissing();

// ✅ log ให้ชัวร์ว่า DB นี้มีตารางอะไรบ้าง + users มีคอลัมน์อะไร
const tables = listTables();
console.log(`[DB] file=${dbFile}`);
console.log(`[DB] tables=${tables.join(', ') || '(none)'}`);
if (tables.includes('users')) {
  console.log(`[DB] users.columns=${listColumns('users').join(', ')}`);
}

console.log(`📦 Database connected: ${dbFile}`);

// ปิด DB ตอนโปรเซสจบ
process.on('exit', () => {
  try { db.close(); } catch {}
});
