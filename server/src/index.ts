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

// Initialize database
import './db/connection.js';

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

// CORS
app.use(
  cors({
    origin: isDev ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session
app.use(
  session({
    secret: env.APP_SESSION_SECRET,
    name: 'greenhouse.sid',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: !isDev, // production ควร true
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100,
  message: { success: false, error: 'คำขอถูกจำกัด กรุณาลองใหม่ในภายหลัง' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ===== API routes =====
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/password', passwordRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tb', tbRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/alerts', alertsRoutes);

// ✅ 404 เฉพาะฝั่ง API เท่านั้น
app.use('/api', notFoundHandler);

// ===== Serve React build (Production) =====
if (!isDev) {
  // ทำให้ path ชัวร์: อิงจากตำแหน่งไฟล์ server/dist/index.js
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // dist/index.js อยู่ที่ /app/server/dist/index.js
  // ดังนั้น ../../client/dist = /app/client/dist
  const clientDist = path.resolve(__dirname, '../../client/dist');
  const indexHtml = path.join(clientDist, 'index.html');

  console.log('📦 Static clientDist:', clientDist);
  console.log('📦 index.html exists:', fs.existsSync(indexHtml));

  // กัน favicon 500 (ถ้าไม่มีใน dist ก็ไม่ควร 500)
  app.get('/favicon.ico', (_req, res) => res.status(204).end());

  if (fs.existsSync(indexHtml)) {
    app.use(express.static(clientDist));

    // SPA fallback
    app.get('*', (_req, res) => {
      res.sendFile(indexHtml);
    });
  } else {
    // ถ้า build client ไม่สำเร็จ จะได้รู้ทันทีจากหน้าเว็บ + log ไม่ใช่ 500 งงๆ
    app.get('*', (_req, res) => {
      res.status(500).send('Client build not found. Please build client to /client/dist.');
    });
  }
}

// Error handler ต้องท้ายสุด
app.use(errorHandler);

// ✅ PORT สำหรับ Railway
const PORT = Number(process.env.PORT) || env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('🌿 GreenHouse Pro V5 Server');
  console.log('════════════════════════════════════════════════════════');
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Database: ${env.DB_PATH}`);
  console.log(`   ThingsBoard: ${env.TB_BASE_URL}`);
  console.log('════════════════════════════════════════════════════════');
  console.log('');
});

export default app;
