# 🌿 GreenHouse Pro

Production-ready IoT dashboard for managing smart greenhouses connected to ThingsBoard.

## 📋 Features

- **Multi-Project Support**: Manage multiple greenhouse projects (ฟาร์มแม่จ๊าด, Hydroponics, etc.)
- **Real-time Monitoring**: Air sensors (temp, humidity, CO₂, light) + 10 soil nodes
- **Device Control**: Relays (fans, valves, pumps, lights) + Motors with Auto mode
- **Timer Scheduling**: Set on/off times for automated control
- **Interactive Charts**: Historical data visualization (1h to 30d)
- **Role-based Access**: Admin, Operator, Viewer roles
- **Thai Language UI**: All user-facing text in Thai

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Express, SQLite (better-sqlite3) |
| Auth | Session cookies, CSRF tokens, bcrypt |
| IoT | ThingsBoard (JWT auth, REST API, RPC) |
| Infra | Docker, Caddy (reverse proxy + auto HTTPS) |

## 🚀 Quick Start (Development)

### 1. Clone & Install

```bash
git clone <repo-url> greenhouse-pro
cd greenhouse-pro
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
NODE_ENV=development
PORT=3001
DB_PATH=./data/greenhouse.db
APP_SESSION_SECRET=your-secret-at-least-32-chars-long
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
TB_BASE_URL=http://your-thingsboard:8080
TB_USERNAME=your-tb-username
TB_PASSWORD=your-tb-password
```

### 3. Initialize Database

```bash
npm run db:migrate --workspace=server
npm run db:seed --workspace=server
```

### 4. Run Development

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## 🐳 Production Deployment

### Option 1: Using Deploy Script

```bash
cd infra/scripts
./deploy.sh
```

### Option 2: Manual Steps

```bash
# 1. Build frontend
cd client && npm run build && cd ..

# 2. Build backend
cd server && npm run build && cd ..

# 3. Start containers
cd infra && docker compose up -d
```

### Enable HTTPS

Edit `infra/caddy/Caddyfile`, uncomment the HTTPS section and replace `YOUR_DOMAIN`.

## 📊 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/auth/csrf` | Get CSRF token |

### Projects (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List accessible projects |
| GET | `/api/projects/:key` | Get project details |
| GET | `/api/projects/:key/greenhouses` | List greenhouses |

### ThingsBoard Proxy (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tb/latest` | Latest telemetry |
| GET | `/api/tb/timeseries` | Historical data |
| GET | `/api/tb/attributes` | Device attributes |
| POST | `/api/tb/rpc` | Send RPC command |

### Admin (requires admin role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/admin/users` | User management |
| GET/POST | `/api/admin/projects` | Project management |
| GET/POST | `/api/admin/greenhouses` | Greenhouse management |

## 🔧 Database

SQLite database with tables:
- `users` - User accounts with roles
- `projects` - Greenhouse projects with TB settings
- `greenhouses` - Individual greenhouses with device IDs
- `user_project_access` - User-project permissions
- `audit_log` - Action logging

### Backup

```bash
# Manual backup
npm run db:backup --workspace=server

# Docker backup
cd infra && docker compose run --rm backup
```

## 📁 Project Structure

```
greenhouse-pro/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── greenhouse/ # Tabs: Soil, Dashboard, Charts, Timers
│   │   │   ├── layout/     # Header, PageContainer
│   │   │   ├── projects/   # Project & Greenhouse cards
│   │   │   └── ui/         # Button, Card, Input, etc.
│   │   ├── config/         # Data keys
│   │   ├── hooks/          # useAuth, useTelemetry, useRpc
│   │   ├── lib/            # API clients
│   │   └── pages/          # Home, Project, Greenhouse
│   └── ...
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # auth, projects, tb, admin
│   │   ├── services/       # ThingsBoard client
│   │   ├── db/             # SQLite setup
│   │   └── middleware/     # Auth, CSRF
│   └── ...
├── infra/                  # Docker deployment
│   ├── docker-compose.yml
│   ├── caddy/Caddyfile
│   └── scripts/
└── .env.example
```

## 🎨 UI Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | User authentication |
| Home | `/` | Project selection |
| Project | `/project/:key` | Greenhouse list |
| Greenhouse | `/project/:key/:gh` | 4-tab interface |

### Greenhouse Tabs

1. **ค่าดิน (Soil)**: Air sensors + 10 soil nodes
2. **กราฟ (Charts)**: Historical data visualization
3. **ควบคุม (Dashboard)**: Relay/motor controls + auto modes
4. **ตั้งเวลา (Timers)**: Schedule configuration

## 🔐 User Roles

| Role | Permissions |
|------|-------------|
| Admin | Full access, user management, project config |
| Operator | Control devices, set timers |
| Viewer | Read-only access |

## 📝 License

MIT
