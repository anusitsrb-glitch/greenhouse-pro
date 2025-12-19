import { config } from 'dotenv';

// Load .env file
config();

// Default values
const defaults = {
  NODE_ENV: 'development',
  PORT: 3001,
  DB_PATH: './data/greenhouse.db',
  APP_SESSION_SECRET: 'greenhouse-pro-secret-key-change-in-production-123456',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'admin123',
  TB_BASE_URL: 'http://localhost:8080',
  TB_USERNAME: 'tenant@thingsboard.org',
  TB_PASSWORD: 'tenant',
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || defaults.NODE_ENV,
  PORT: parseInt(process.env.PORT || String(defaults.PORT), 10),
  DB_PATH: process.env.DB_PATH || defaults.DB_PATH,
  APP_SESSION_SECRET: process.env.APP_SESSION_SECRET || defaults.APP_SESSION_SECRET,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || defaults.ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || defaults.ADMIN_PASSWORD,
  TB_BASE_URL: process.env.TB_BASE_URL || defaults.TB_BASE_URL,
  TB_USERNAME: process.env.TB_USERNAME || defaults.TB_USERNAME,
  TB_PASSWORD: process.env.TB_PASSWORD || defaults.TB_PASSWORD,
};

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';

// Log config at startup
console.log('🔧 Environment config loaded');
if (isDev) {
  console.log('   Mode: Development');
}
