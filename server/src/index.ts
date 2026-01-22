import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import rateLimit from 'express-rate-limit';

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { env, isDev } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import routes
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin/index.js';
import projectsRoutes from './routes/projects.js';
import tbRoutes from './routes/tb.js';
import reportsRoutes from './routes/reports.js';
import alertsRoutes from './routes/alerts.js';
import passwordRoutes from './routes/password.js';
import externalRoutes from './routes/external/index.js';
import exportRoutes from './routes/export.js';

// ✅ WebSocket import
import { initWebSocket, getWebSocketStats } from './websocket/index.js';

// ✅ ใช้ DB instance เพื่อทำ SQLite session store
import { db } from './db/connection.js';

// ✅ SQLite Session Store (แทน MemoryStore)
import BetterSqlite3SessionStore from 'better-sqlite3-session-store';

const app = express();

// Global error handlers to prevent crash
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) =>
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
);

// Trust proxy (Railway เป็น reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));

// -------------------------------
// ✅ CORS
// - ถ้าโปรดักชัน "โดเมนเดียวกัน" (serve client+api จากโดเมนเดียว) => origin: true ได้เลย
// - ถ้าอยากจำกัดหลายโดเมน ให้ตั้ง ENV: CORS_ORIGINS="https://a.com,https://b.com"
//   แล้วระบบจะอ่านจาก process.env (ไม่ผูกกับ env.ts)
// -------------------------------
const corsOrigins =
  (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

app.use(
  cors({
    origin: isDev
      ? ['http://localhost:5173', 'http://127.0.0.1:5173']
      : corsOrigins.length
        ? corsOrigins
        : true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// -------------------------------
// ✅ SESSION: ใช้ SQLiteStore เพื่อ "จำล็อกอิน" แม้ Railway restart
// -------------------------------
const SqliteStore = BetterSqlite3SessionStore(session);

app.use(
  session({
    store: new SqliteStore({
      client: db,
      table: 'sessions',
      expired: {
        clear: true,
        intervalMs: 15 * 60 * 1000,
      },
    }),
    secret: env.APP_SESSION_SECRET,
    name: 'greenhouse.sid',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: 'auto',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// -------------------------------
// ✅ Rate limit แบบไม่ทำเว็บพัง
// -------------------------------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 20000 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || '';
    return p.startsWith('/health') || p.startsWith('/auth/me');
  },
  message: { success: false, error: 'คำขอมากเกินไป กรุณาลองใหม่' },
});

const externalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 10000 : 1000, // 1000 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests from this API Key' },
});


app.use('/api/auth/login', authLimiter);
app.use('/api/password', authLimiter);
app.use('/api', apiLimiter);
app.use('/api/external', externalApiLimiter);

// ===== API routes =====
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/password', passwordRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tb', tbRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/external/v1', externalRoutes);
app.use('/api/export', exportRoutes);
app.use('/api', notFoundHandler);

// ===== Serve React build (Production) =====
if (!isDev) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const clientDist = path.resolve(__dirname, '../client-dist');
  const indexHtml = path.join(clientDist, 'index.html');

  console.log('📦 Static clientDist:', clientDist);
  console.log('📦 index.html exists:', fs.existsSync(indexHtml));

  app.get('/favicon.ico', (_req, res) => res.status(204).end());

  if (fs.existsSync(indexHtml)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => res.sendFile(indexHtml));
  } else {
    app.get('*', (_req, res) =>
      res.status(500).send('Client build not found. Please build client to /server/client-dist.')
    );
  }
}

app.use(errorHandler);

const PORT = Number(process.env.PORT) || env.PORT || 3000;

// ✅ CHANGED: Use app.listen to get server instance for WebSocket
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('🌿 GreenHouse Pro V5 Server (Optimized)');
  console.log('════════════════════════════════════════════════════════');
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Database: ${env.DB_PATH}`);
  console.log(`   ThingsBoard: ${env.TB_BASE_URL}`);
  console.log('════════════════════════════════════════════════════════');
  console.log('');
});

// ✅ NEW: Initialize WebSocket Server
const wss = initWebSocket(server);

// ✅ NEW: WebSocket stats endpoint (optional - for monitoring)
app.get('/api/ws/stats', (req, res) => {
  const stats = getWebSocketStats();
  res.json({ success: true, data: stats });
});

export default app;
