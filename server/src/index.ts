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
import notificationsRoutes from './routes/notifications.js';
import controlHistoryRoutes from './routes/control-history.js';
import { startDeviceMonitoring } from './services/deviceMonitor.js';
import { startSensorMonitoring } from './services/sensorMonitor.js';
import agricultureRoutes from './routes/agriculture.js';

import { initDB, pool } from './db/connection.js';
import connectPgSimple from 'connect-pg-simple';

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

const corsOrigins =
  (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const appOrigins = [
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
];

const devWebOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
];

const allowedOrigins = isDev
  ? [...devWebOrigins, ...appOrigins, ...corsOrigins]
  : [...appOrigins, ...corsOrigins];

console.log('📡 isDev:', isDev);
console.log('📡 CORS_ORIGINS env:', corsOrigins);
console.log('📡 CORS Allowed Origins (exact):', allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (isDev) {
        try {
          const u = new URL(origin);
          if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
            return callback(null, true);
          }
        } catch {
          // ignore parse errors
        }
        return callback(null, true);
      }
      console.error('❌ [CORS BLOCKED] Origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Accept', 'Pragma', 'Cache-Control'],
    exposedHeaders: ['Set-Cookie', 'Content-Disposition', 'Content-Type'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ============================================================
// ✅ SESSION - PostgreSQL Store
// ============================================================
const PgStore = connectPgSimple(session);

app.use(
  session({
    store: new PgStore({
      pool: pool as any,
      tableName: 'user_sessions_store',
      createTableIfMissing: true,
    }) as any,
    secret: env.APP_SESSION_SECRET,
    name: 'greenhouse.sid',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain: undefined,
    },
  })  as any
);

// ============================================================
// Rate Limiting
// ============================================================
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
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests from this API Key' },
});

app.set('etag', false);

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use('/api/auth/login', authLimiter);
app.use('/api/password', authLimiter);
app.use('/api', apiLimiter);
app.use('/api/external', externalApiLimiter);

// ============================================================
// API Routes
// ============================================================
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
app.use('/api/notifications', notificationsRoutes);
app.use('/api/control-history', controlHistoryRoutes);
app.use('/api/agriculture', agricultureRoutes);
app.use('/api', notFoundHandler);

// ============================================================
// Serve React build (Production)
// ============================================================
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

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('════════════════════════════════════════════════════════');
    console.log('🌿 GreenHouse Pro V2 Server');
    console.log('════════════════════════════════════════════════════════');
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Database: PostgreSQL`);
    console.log(`   ThingsBoard: ${env.TB_BASE_URL}`);
    console.log(`   CORS Origins: ${allowedOrigins.length} allowed`);
    console.log('════════════════════════════════════════════════════════');
    console.log('');

    startMonitoringServices();
  });

  function startMonitoringServices() {
    try {
      console.log('🚀 Starting monitoring services...');

      startDeviceMonitoring(30);
      startSensorMonitoring(60);

      const selfUrl = process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/health`
        : null;

      if (selfUrl) {
        setInterval(async () => {
          try {
            await fetch(selfUrl);
            console.log('💓 Keep-alive ping sent');
          } catch (e) {
            console.error('💔 Keep-alive ping failed:', e);
          }
        }, 5 * 60 * 1000);
        console.log('✅ Keep-alive ping started:', selfUrl);
      } else {
        console.log('⚠️ Keep-alive ping skipped (RAILWAY_PUBLIC_DOMAIN not set)');
      }

      console.log('✅ All monitoring services started');
    } catch (error) {
      console.error('❌ Failed to start monitoring services:', error);
    }
  }
});

export default app;