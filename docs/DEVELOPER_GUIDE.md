# 🛠️ GreenHouse Pro V4 - คู่มือนักพัฒนา (Developer Guide)

## โครงสร้างไฟล์

```
greenhouse-pro/
├── client/                     # Frontend (React + Vite + TypeScript)
│   └── src/
│       ├── App.tsx            # 🔴 Main Routes
│       ├── main.tsx           # Entry point
│       ├── index.css          # Global CSS + Tailwind
│       ├── components/
│       │   ├── ui/            # UI พื้นฐาน (Button, Card, Input)
│       │   ├── layout/        # Header, PageContainer
│       │   ├── greenhouse/    # 🔴 Components หน้า Dashboard
│       │   ├── charts/        # กราฟ, Heatmap
│       │   └── dashboard/     # Custom Dashboard Widgets
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── HomePage.tsx
│       │   ├── ProjectPage.tsx
│       │   ├── GreenhousePage.tsx  # 🔴 หน้าหลัก
│       │   ├── ProfilePage.tsx
│       │   └── admin/         # 🔴 Admin Pages ทั้งหมด
│       ├── hooks/             # Custom Hooks
│       │   ├── useAuth.tsx    # 🔴 Authentication
│       │   ├── useTelemetry.ts
│       │   ├── useAttributes.ts
│       │   └── useRpc.ts
│       ├── lib/               # API Functions
│       │   ├── api.ts         # 🔴 Base API
│       │   ├── tbApi.ts       # ThingsBoard API
│       │   └── adminApi.ts
│       ├── i18n/              # 🔴 Translations (TH/EN/MM)
│       │   └── index.ts
│       └── config/
│           └── dataKeys.ts    # 🔴 Sensor Keys
│
├── server/                     # Backend (Express + TypeScript)
│   └── src/
│       ├── index.ts           # 🔴 Server Entry
│       ├── routes/
│       │   ├── auth.ts        # 🔴 Authentication
│       │   ├── projects.ts
│       │   ├── tb.ts          # 🔴 ThingsBoard Proxy
│       │   ├── password.ts    # Password Management
│       │   ├── security.ts    # Login History, Sessions
│       │   ├── export.ts      # CSV/Excel Export
│       │   ├── alerts.ts
│       │   ├── reports.ts
│       │   └── admin/         # Admin Routes
│       │       ├── users.ts
│       │       ├── projects.ts
│       │       ├── greenhouses.ts
│       │       ├── sensors.ts # 🔴 Dynamic Sensors
│       │       ├── controls.ts
│       │       ├── settings.ts
│       │       └── audit.ts
│       ├── services/
│       │   ├── thingsboard.ts # 🔴 ThingsBoard Service
│       │   ├── lineNotify.ts
│       │   └── reportGenerator.ts
│       ├── middleware/
│       │   └── auth.ts        # 🔴 Auth Middleware
│       ├── db/
│       │   ├── connection.ts
│       │   ├── migrate.ts     # 🔴 Database Schema
│       │   └── seed.ts
│       ├── utils/
│       │   ├── response.ts
│       │   └── audit.ts
│       └── types/
│           └── index.ts       # TypeScript Types
│
├── docs/                       # Documentation
│   ├── ADMIN_MANUAL.md
│   ├── DEVELOPER_GUIDE.md
│   └── SETUP_GUIDE.md
│
├── infra/                      # Docker & Deployment
│   ├── docker-compose.yml
│   └── caddy/
│
└── .env.example               # Environment Variables
```

---

## ไฟล์สำคัญที่ต้องแก้ไข

### 1. เพิ่ม Sensor Key ใหม่

**ไฟล์:** `client/src/config/dataKeys.ts` และ `server/src/config/dataKeys.ts`

```typescript
export const AIR_TELEMETRY_KEYS = [
  'air_temp',
  'air_humidity',
  'air_co2',
  'air_light',
  'air_pressure',  // เพิ่มใหม่
];
```

**หรือใช้หน้า Admin → จัดการ Sensor (แนะนำ!)**

---

### 2. เพิ่ม Relay/Motor ใหม่

**ไฟล์:** `client/src/components/greenhouse/DashboardTab.tsx`

```typescript
const RELAY_CONFIGS = [
  { key: 'fan_1', name: 'พัดลม 1', ... },
  { key: 'heater_1', name: 'ฮีตเตอร์', ... }, // เพิ่มใหม่
];
```

---

### 3. เพิ่ม Database Table ใหม่

**ไฟล์:** `server/src/db/migrate.ts`

```typescript
db.exec(`
  CREATE TABLE IF NOT EXISTS my_new_table (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    ...
  )
`);
```

**รัน:** `npm run db:migrate --workspace=server`

---

### 4. เพิ่ม API Route ใหม่

**สร้างไฟล์:** `server/src/routes/myFeature.ts`

```typescript
import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => {
  // ...
});

export default router;
```

**ลงทะเบียนใน:** `server/src/index.ts`

```typescript
import myFeatureRoutes from './routes/myFeature.js';
app.use('/api/my-feature', myFeatureRoutes);
```

---

### 5. เพิ่มหน้า Admin ใหม่

1. สร้าง: `client/src/pages/admin/MyNewPage.tsx`
2. Export ใน: `client/src/pages/admin/index.ts`
3. เพิ่ม Route: `client/src/App.tsx`
4. เพิ่มเมนู: `client/src/pages/admin/AdminLayout.tsx`

---

### 6. เพิ่มภาษาใหม่

**ไฟล์:** `client/src/i18n/index.ts`

```typescript
export const translations = {
  th: { ... },
  en: { ... },
  mm: { ... },
  // เพิ่มภาษาใหม่
  jp: {
    'app.title': 'GreenHouse Pro',
    ...
  },
};
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user |
| PUT | /api/auth/preferences | Update preferences |

### Password
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/password/change | Change own password |
| POST | /api/password/reset/:userId | Admin reset password |
| POST | /api/password/strength | Check password strength |

### ThingsBoard Proxy
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tb/:project/:gh/telemetry | Get latest telemetry |
| GET | /api/tb/:project/:gh/telemetry/timeseries | Get historical data |
| GET | /api/tb/:project/:gh/attributes | Get attributes |
| POST | /api/tb/:project/:gh/rpc | Send RPC command |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/export/telemetry/csv | Export to CSV |
| POST | /api/export/telemetry/excel | Export to Excel |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | /api/admin/users | List/Create users |
| PUT/DELETE | /api/admin/users/:id | Update/Delete user |
| GET/POST | /api/admin/projects | List/Create projects |
| GET/POST | /api/admin/sensors/:project/:gh | List/Create sensors |
| GET | /api/admin/audit | Get audit logs |

### Security
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/security/login-history | Get login history |
| GET | /api/security/sessions | Get active sessions |
| DELETE | /api/security/sessions/:id | Terminate session |
| GET/POST | /api/security/ip-whitelist | IP whitelist |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3001 |
| NODE_ENV | Environment | development |
| DB_PATH | SQLite file path | ./data/greenhouse.db |
| APP_SESSION_SECRET | Session key | (required) |
| TB_BASE_URL | ThingsBoard URL | (required) |
| TB_USERNAME | ThingsBoard user | (required) |
| TB_PASSWORD | ThingsBoard pass | (required) |
| OPENWEATHER_API_KEY | Weather API | (optional) |
| GEMINI_API_KEY | AI Vision API | (optional) |

---

## การทดสอบ

### Test API ด้วย curl

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c cookies.txt

# Get Projects
curl http://localhost:3001/api/projects -b cookies.txt
```

---

## Production Deployment

```bash
# Build
npm run build --workspace=client
npm run build --workspace=server

# Docker
cd infra
docker compose up -d
```

---

*GreenHouse Pro V4.0*
