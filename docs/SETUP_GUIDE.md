# 🚀 GreenHouse Pro V4 - คู่มือติดตั้งและตั้งค่า (Setup Guide)

## สารบัญ

1. [ความต้องการของระบบ](#1-ความต้องการของระบบ)
2. [การติดตั้ง](#2-การติดตั้ง)
3. [การตั้งค่า .env](#3-การตั้งค่า-env)
4. [การเชื่อมต่อ ThingsBoard](#4-การเชื่อมต่อ-thingsboard)
5. [รูปแบบข้อมูลจาก Device](#5-รูปแบบข้อมูลจาก-device)
6. [การ Deploy Production](#6-การ-deploy-production)

---

## 1. ความต้องการของระบบ

- **Node.js** 18+
- **npm** 9+
- **ThingsBoard** server (Community หรือ Professional)
- **RAM** 2GB+
- **Disk** 1GB+

---

## 2. การติดตั้ง

```bash
# 1. แตกไฟล์
unzip greenhouse-pro-v4.zip
cd greenhouse-pro

# 2. ติดตั้ง dependencies
npm install

# 3. คัดลอกไฟล์ตั้งค่า
cp .env.example .env

# 4. แก้ไขไฟล์ .env (ดูหัวข้อ 3)
nano .env

# 5. สร้างฐานข้อมูล
npm run db:migrate --workspace=server

# 6. สร้างข้อมูลเริ่มต้น
npm run db:seed --workspace=server

# 7. รัน Development server
npm run dev
```

**เปิดเบราว์เซอร์:** http://localhost:5173

---

## 3. การตั้งค่า .env

```env
# ===== Server =====
PORT=3001
NODE_ENV=development

# ===== Database =====
DB_PATH=./data/greenhouse.db

# ===== Security =====
# สร้างด้วย: openssl rand -base64 32
APP_SESSION_SECRET=your-super-secret-key-here

# ===== ThingsBoard Default =====
TB_BASE_URL=http://your-thingsboard-server:8080
TB_USERNAME=tenant@thingsboard.org
TB_PASSWORD=your-password

# ===== Admin Account =====
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# ===== Optional: Weather API =====
# ลงทะเบียนที่ https://openweathermap.org/api
OPENWEATHER_API_KEY=your-api-key

# ===== Optional: AI Vision =====
# สำหรับ Google Gemini
GEMINI_API_KEY=your-api-key
```

**คำอธิบาย:**

| ค่า | คำอธิบาย |
|-----|----------|
| `PORT` | Port ของ Backend (default: 3001) |
| `DB_PATH` | ตำแหน่งไฟล์ SQLite |
| `APP_SESSION_SECRET` | **สำคัญ!** ใช้เข้ารหัส Session |
| `TB_BASE_URL` | URL ของ ThingsBoard server |
| `TB_USERNAME` | Username login ThingsBoard |
| `TB_PASSWORD` | Password login ThingsBoard |

---

## 4. การเชื่อมต่อ ThingsBoard

### 4.1 ขั้นตอน

```
┌─────────────────────────────────────────────────────────────┐
│  1. สร้าง Device ใน ThingsBoard                              │
│  2. คัดลอก Device ID                                        │
│  3. สร้าง Project ใน GreenHouse Pro (ใส่ TB credentials)      │
│  4. สร้าง Greenhouse (ใส่ Device ID)                         │
│  5. สร้าง Sensor (ใส่ Data Key ให้ตรงกับ TB)                  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 สร้าง Device ใน ThingsBoard

1. Login ThingsBoard → **Devices** → **Add Device**
2. ตั้งชื่อ Device
3. คัดลอก **Device ID** (UUID)

### 4.3 สร้าง Project ใน GreenHouse Pro

1. Login เป็น Admin
2. **Admin** → **จัดการโปรเจกต์** → **เพิ่มโปรเจกต์**
3. กรอก:
   - Key: `farm1`
   - ชื่อ: `ฟาร์มของฉัน`
   - TB URL: `http://your-thingsboard:8080`
   - TB Username: `tenant@thingsboard.org`
   - TB Password: `your-password`

### 4.4 สร้าง Greenhouse

1. **Admin** → **จัดการโรงเรือน** → **เพิ่มโรงเรือน**
2. กรอก:
   - โปรเจกต์: เลือกโปรเจกต์
   - Key: `greenhouse1`
   - ชื่อ: `โรงเรือน 1`
   - **Device ID**: วาง Device ID จาก ThingsBoard

### 4.5 สร้าง Sensor

1. **Admin** → **จัดการ Sensor**
2. เลือก Project/Greenhouse
3. กด **Template** → **มาตรฐาน 10 จุดดิน**

หรือสร้างเอง:
- Sensor Key: `air_temp`
- ชื่อ: `อุณหภูมิอากาศ`
- **Data Key**: `air_temp` (ต้องตรงกับ ThingsBoard!)
- หน่วย: `°C`

---

## 5. รูปแบบข้อมูลจาก Device

### 5.1 Telemetry Data

Device (ESP32) ต้องส่ง Telemetry ในรูปแบบนี้:

```json
{
  "air_temp": 28.5,
  "air_humidity": 65.2,
  "air_co2": 450,
  "air_light": 12000,
  "soil1_moisture": 45.5,
  "soil1_temp": 26.3,
  "soil1_n": 120,
  "soil1_p": 80,
  "soil1_k": 150,
  "soil1_ec": 1.2,
  "soil1_ph": 6.5,
  "soil2_moisture": 48.2,
  "soil2_temp": 25.8
}
```

### 5.2 Attributes (สถานะอุปกรณ์)

Device ต้องส่ง/อัพเดท Shared Attributes:

```json
{
  "fan_1": true,
  "fan_2": false,
  "pump_1": true,
  "valve_2": false,
  "motor_1_fw": false,
  "motor_1_re": false,
  "auto_fan_1": true,
  "fan_1_on_time": "06:00",
  "fan_1_off_time": "18:00"
}
```

### 5.3 RPC Commands

เมื่อกดควบคุมใน Dashboard, ระบบจะส่ง RPC:

```json
// เปิดพัดลม 1
{
  "method": "setFan1",
  "params": { "value": true }
}

// ควบคุมมอเตอร์
{
  "method": "setMotor1",
  "params": { "direction": "forward" }
}
```

Device ต้อง handle RPC และอัพเดท Attributes กลับมา

### 5.4 ตัวอย่าง ESP32 Code

```cpp
// รับ RPC
void onRpcRequest(const String& method, const JsonVariant& params) {
  if (method == "setFan1") {
    bool value = params["value"];
    digitalWrite(FAN1_PIN, value ? HIGH : LOW);
    
    // อัพเดท Attribute กลับ
    tb.sendAttributeBool("fan_1", value);
  }
}

// ส่ง Telemetry
void sendTelemetry() {
  tb.sendTelemetryFloat("air_temp", readTemperature());
  tb.sendTelemetryFloat("air_humidity", readHumidity());
  tb.sendTelemetryFloat("soil1_moisture", readSoilMoisture(1));
}
```

---

## 6. การ Deploy Production

### 6.1 ด้วย Docker

```bash
cd infra
docker compose up -d
```

### 6.2 ด้วย PM2

```bash
# Build
npm run build --workspace=client
npm run build --workspace=server

# Install PM2
npm install -g pm2

# Start
pm2 start server/dist/index.js --name greenhouse-api
pm2 save
```

### 6.3 Nginx Config

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /var/www/greenhouse-pro/client/dist;
        try_files $uri /index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

---

## 7. Troubleshooting

### ❌ ไม่เห็นข้อมูล Sensor

1. ตรวจสอบ Device ส่งข้อมูลหรือไม่ (ดูใน ThingsBoard)
2. ตรวจสอบ Device ID ตรงหรือไม่
3. ตรวจสอบ **Data Key ต้องตรงกับ Telemetry Key**
4. ตรวจสอบ TB URL/Username/Password

### ❌ ควบคุมอุปกรณ์ไม่ได้

1. Device รับ RPC หรือไม่ (ดูใน TB → Debug)
2. Device อัพเดท Attributes กลับมาหรือไม่
3. ผู้ใช้มีสิทธิ์ Operator/Admin หรือไม่

### ❌ Login ไม่ได้

1. ตรวจสอบ Username/Password
2. ถ้าถูกล็อค รอ 30 นาที หรือให้ Admin ปลดล็อค
3. ถ้าเปิด IP Whitelist ตรวจสอบว่า IP อยู่ในรายการ

### ❌ รีเซ็ตรหัสผ่าน Admin

```bash
# ลบไฟล์ DB แล้ว seed ใหม่ (ข้อมูลจะหาย!)
rm data/greenhouse.db
npm run db:migrate --workspace=server
npm run db:seed --workspace=server
```

---

## 8. Backup

### Manual Backup

```bash
cp data/greenhouse.db data/greenhouse.db.backup
```

### Auto Backup (Cron)

```bash
# เพิ่มใน crontab
0 0 * * * cp /path/to/data/greenhouse.db /path/to/backup/greenhouse-$(date +\%Y\%m\%d).db
```

---

*GreenHouse Pro V4.0 - Setup Guide*
*ธันวาคม 2024*
