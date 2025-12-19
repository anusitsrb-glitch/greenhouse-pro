import { db } from './connection.js';
import { env } from '../config/env.js';
import bcrypt from 'bcrypt';

console.log('🌱 Seeding database...');

const SALT_ROUNDS = 12;

// ============================================================
// 1. Seed Super Admin User
// ============================================================
const existingSuperAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('superadmin');

if (!existingSuperAdmin) {
  const passwordHash = bcrypt.hashSync('superadmin123', SALT_ROUNDS);
  
  db.prepare(`
    INSERT INTO users (username, email, password_hash, role, language, theme, is_active)
    VALUES (?, ?, ?, 'superadmin', 'th', 'light', 1)
  `).run('superadmin', 'superadmin@greenhouse.local', passwordHash);
  
  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('🔑 SUPER ADMIN ACCOUNT CREATED');
  console.log('════════════════════════════════════════════════════════');
  console.log('   Username: superadmin');
  console.log('   Password: superadmin123');
  console.log('   ⚠️  สำหรับนักพัฒนาเท่านั้น!');
  console.log('════════════════════════════════════════════════════════');
  console.log('');
} else {
  console.log('ℹ️  Super Admin user already exists, skipping...');
}

// ============================================================
// 2. Seed Admin User
// ============================================================
const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(env.ADMIN_USERNAME);

if (!existingAdmin) {
  const passwordHash = bcrypt.hashSync(env.ADMIN_PASSWORD, SALT_ROUNDS);
  
  db.prepare(`
    INSERT INTO users (username, email, password_hash, role, language, theme, is_active)
    VALUES (?, ?, ?, 'admin', 'th', 'light', 1)
  `).run(env.ADMIN_USERNAME, 'admin@greenhouse.local', passwordHash);
  
  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('🔑 ADMIN ACCOUNT CREATED');
  console.log('════════════════════════════════════════════════════════');
  console.log(`   Username: ${env.ADMIN_USERNAME}`);
  console.log(`   Password: ${env.ADMIN_PASSWORD}`);
  console.log('════════════════════════════════════════════════════════');
  console.log('');
} else {
  console.log('ℹ️  Admin user already exists, skipping...');
}

// ============================================================
// 3. Seed Demo Users (Operator & Viewer)
// ============================================================
const demoUsers = [
  { username: 'operator', email: 'operator@greenhouse.local', password: 'operator123', role: 'operator' },
  { username: 'viewer', email: 'viewer@greenhouse.local', password: 'viewer123', role: 'viewer' },
];

for (const user of demoUsers) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);
  if (!existing) {
    const passwordHash = bcrypt.hashSync(user.password, SALT_ROUNDS);
    db.prepare(`
      INSERT INTO users (username, email, password_hash, role, language, theme, is_active)
      VALUES (?, ?, ?, ?, 'th', 'light', 1)
    `).run(user.username, user.email, passwordHash, user.role);
  }
}
console.log('✅ Demo users seeded (operator, viewer)');

// ============================================================
// 4. Seed Projects
// ============================================================
const projects = [
  { key: 'maejard', name_th: 'ฟาร์มแม่จ๊าด', status: 'ready' },
  { key: 'hydroponics', name_th: 'โรงปลูก Hydroponics', status: 'developing' },
  { key: 'vegetable_house', name_th: 'โรงปลูกผัก', status: 'developing' },
  { key: 'guava_outdoor', name_th: 'แปลงฝรั่ง Outdoor', status: 'developing' },
];

const insertProject = db.prepare(`
  INSERT OR IGNORE INTO projects (key, name_th, status, tb_base_url, tb_username, tb_password)
  VALUES (?, ?, ?, ?, ?, ?)
`);

for (const project of projects) {
  insertProject.run(
    project.key,
    project.name_th,
    project.status,
    env.TB_BASE_URL,
    env.TB_USERNAME,
    env.TB_PASSWORD
  );
}
console.log('✅ Projects seeded (4 projects)');

// ============================================================
// 5. Seed Greenhouses for Maejard
// ============================================================
const maejardProject = db.prepare('SELECT id FROM projects WHERE key = ?').get('maejard') as { id: number } | undefined;

if (maejardProject) {
  const insertGreenhouse = db.prepare(`
    INSERT OR IGNORE INTO greenhouses (project_id, gh_key, name_th, status, tb_device_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (let i = 1; i <= 10; i++) {
    const ghKey = `greenhouse${i}`;
    const nameTh = `โรงเรือน ${i}`;
    const isReady = i === 8;
    const status = isReady ? 'ready' : 'developing';
    const deviceId = null;

    insertGreenhouse.run(maejardProject.id, ghKey, nameTh, status, deviceId);
  }
  console.log('✅ Greenhouses seeded for maejard (10 greenhouses)');
}

// ============================================================
// 6. Seed Greenhouses for Other Projects
// ============================================================
const otherProjectKeys = ['hydroponics', 'vegetable_house', 'guava_outdoor'];

for (const projectKey of otherProjectKeys) {
  const project = db.prepare('SELECT id FROM projects WHERE key = ?').get(projectKey) as { id: number } | undefined;
  
  if (project) {
    const existingGh = db.prepare('SELECT id FROM greenhouses WHERE project_id = ?').get(project.id);
    
    if (!existingGh) {
      db.prepare(`
        INSERT INTO greenhouses (project_id, gh_key, name_th, status, tb_device_id)
        VALUES (?, 'zone1', 'โซน 1', 'developing', NULL)
      `).run(project.id);
    }
  }
}
console.log('✅ Placeholder greenhouses seeded for other projects');

// ============================================================
// 7. Grant Access to All Projects for Super Admin & Admin
// ============================================================
const superAdminUser = db.prepare('SELECT id FROM users WHERE role = ?').get('superadmin') as { id: number } | undefined;
const adminUser = db.prepare('SELECT id FROM users WHERE role = ?').get('admin') as { id: number } | undefined;
const allProjects = db.prepare('SELECT id FROM projects').all() as { id: number }[];

const insertAccess = db.prepare(`
  INSERT OR IGNORE INTO user_project_access (user_id, project_id) VALUES (?, ?)
`);

for (const project of allProjects) {
  if (superAdminUser) insertAccess.run(superAdminUser.id, project.id);
  if (adminUser) insertAccess.run(adminUser.id, project.id);
}
console.log('✅ Super Admin & Admin granted access to all projects');

// ============================================================
// 8. Seed App Settings
// ============================================================
const settings = [
  { key: 'app_version', value: '4.0.0', description: 'Application version' },
  { key: 'backup_enabled', value: 'true', description: 'Enable automatic backups' },
  { key: 'backup_interval_days', value: '7', description: 'Days between backups' },
  { key: 'ip_whitelist_enabled', value: 'false', description: 'Enable IP whitelist' },
  { key: 'max_login_attempts', value: '5', description: 'Max failed login attempts before lockout' },
  { key: 'lockout_duration_minutes', value: '30', description: 'Account lockout duration' },
  { key: 'session_timeout_minutes', value: '480', description: 'Session timeout (8 hours)' },
  { key: 'weather_api_location', value: '18.7883,98.9853', description: 'Default location for weather (Chiang Mai)' },
  { key: 'default_language', value: 'th', description: 'Default language' },
];

const insertSetting = db.prepare(`
  INSERT OR IGNORE INTO app_settings (key, value, description) VALUES (?, ?, ?)
`);

for (const setting of settings) {
  insertSetting.run(setting.key, setting.value, setting.description);
}
console.log('✅ App settings seeded');

// ============================================================
// 9. Seed Default Notification Channels
// ============================================================
const channels = [
  { name: 'Line Notify หลัก', channel_type: 'line', config: '{}', is_default: 1 },
  { name: 'SMS หลัก', channel_type: 'sms', config: '{}', is_default: 0 },
];

const insertChannel = db.prepare(`
  INSERT OR IGNORE INTO notification_channels (name, channel_type, config, is_default, is_active)
  VALUES (?, ?, ?, ?, 1)
`);

for (const channel of channels) {
  const existing = db.prepare('SELECT id FROM notification_channels WHERE name = ?').get(channel.name);
  if (!existing) {
    insertChannel.run(channel.name, channel.channel_type, channel.config, channel.is_default);
  }
}
console.log('✅ Default notification channels seeded');

// ============================================================
// 10. Seed Default Notification Templates
// ============================================================
const templates = [
  {
    name: 'Alert ค่าเกินเกณฑ์',
    template_type: 'alert',
    subject: '⚠️ แจ้งเตือน: {{sensor_name}} ผิดปกติ',
    body_template: `🚨 แจ้งเตือนจาก GreenHouse Pro

📍 โรงเรือน: {{greenhouse_name}}
📊 Sensor: {{sensor_name}}
📈 ค่าปัจจุบัน: {{current_value}} {{unit}}
⚠️ เกณฑ์: {{threshold_value}} {{unit}}
⏰ เวลา: {{timestamp}}

กรุณาตรวจสอบทันที!`,
    variables: '["greenhouse_name", "sensor_name", "current_value", "unit", "threshold_value", "timestamp"]',
  },
  {
    name: 'Alert อุปกรณ์ Offline',
    template_type: 'alert',
    subject: '🔴 แจ้งเตือน: อุปกรณ์ Offline',
    body_template: `🔴 อุปกรณ์ขาดการเชื่อมต่อ

📍 โรงเรือน: {{greenhouse_name}}
⏰ Offline ตั้งแต่: {{timestamp}}

กรุณาตรวจสอบการเชื่อมต่อ!`,
    variables: '["greenhouse_name", "timestamp"]',
  },
  {
    name: 'รายงานประจำวัน',
    template_type: 'report',
    subject: '📊 รายงานประจำวัน - {{date}}',
    body_template: `📊 รายงานประจำวัน GreenHouse Pro

📅 วันที่: {{date}}
📍 โรงเรือน: {{greenhouse_name}}

🌡️ อุณหภูมิ: {{avg_temp}}°C ({{min_temp}} - {{max_temp}})
💧 ความชื้น: {{avg_humidity}}%

ดูรายละเอียดเพิ่มเติมที่ระบบ`,
    variables: '["date", "greenhouse_name", "avg_temp", "min_temp", "max_temp", "avg_humidity"]',
  },
  {
    name: 'แจ้งเตือนบำรุงรักษา',
    template_type: 'maintenance',
    subject: '🔧 แจ้งเตือน: ถึงกำหนดบำรุงรักษา',
    body_template: `🔧 ถึงกำหนดบำรุงรักษา

📍 โรงเรือน: {{greenhouse_name}}
🔩 อุปกรณ์: {{equipment_name}}
📋 ประเภท: {{maintenance_type}}
📅 กำหนด: {{due_date}}

กรุณาดำเนินการตามกำหนด`,
    variables: '["greenhouse_name", "equipment_name", "maintenance_type", "due_date"]',
  },
];

const insertTemplate = db.prepare(`
  INSERT OR IGNORE INTO notification_templates (name, template_type, subject, body_template, variables, is_active)
  VALUES (?, ?, ?, ?, ?, 1)
`);

for (const template of templates) {
  const existing = db.prepare('SELECT id FROM notification_templates WHERE name = ?').get(template.name);
  if (!existing) {
    insertTemplate.run(template.name, template.template_type, template.subject, template.body_template, template.variables);
  }
}
console.log('✅ Default notification templates seeded');

// ============================================================
// 11. Seed Default Translations
// ============================================================
const translations = [
  // Thai
  { lang: 'th', key: 'app.title', value: 'GreenHouse Pro' },
  { lang: 'th', key: 'nav.home', value: 'หน้าแรก' },
  { lang: 'th', key: 'nav.dashboard', value: 'แดชบอร์ด' },
  { lang: 'th', key: 'nav.settings', value: 'ตั้งค่า' },
  { lang: 'th', key: 'nav.admin', value: 'ผู้ดูแลระบบ' },
  { lang: 'th', key: 'auth.login', value: 'เข้าสู่ระบบ' },
  { lang: 'th', key: 'auth.logout', value: 'ออกจากระบบ' },
  { lang: 'th', key: 'common.save', value: 'บันทึก' },
  { lang: 'th', key: 'common.cancel', value: 'ยกเลิก' },
  { lang: 'th', key: 'common.delete', value: 'ลบ' },
  { lang: 'th', key: 'common.edit', value: 'แก้ไข' },
  { lang: 'th', key: 'common.add', value: 'เพิ่ม' },
  { lang: 'th', key: 'common.search', value: 'ค้นหา' },
  
  // English
  { lang: 'en', key: 'app.title', value: 'GreenHouse Pro' },
  { lang: 'en', key: 'nav.home', value: 'Home' },
  { lang: 'en', key: 'nav.dashboard', value: 'Dashboard' },
  { lang: 'en', key: 'nav.settings', value: 'Settings' },
  { lang: 'en', key: 'nav.admin', value: 'Admin' },
  { lang: 'en', key: 'auth.login', value: 'Login' },
  { lang: 'en', key: 'auth.logout', value: 'Logout' },
  { lang: 'en', key: 'common.save', value: 'Save' },
  { lang: 'en', key: 'common.cancel', value: 'Cancel' },
  { lang: 'en', key: 'common.delete', value: 'Delete' },
  { lang: 'en', key: 'common.edit', value: 'Edit' },
  { lang: 'en', key: 'common.add', value: 'Add' },
  { lang: 'en', key: 'common.search', value: 'Search' },
  
  // Myanmar (Burmese) - Basic
  { lang: 'mm', key: 'app.title', value: 'GreenHouse Pro' },
  { lang: 'mm', key: 'nav.home', value: 'ပင်မစာမျက်နှာ' },
  { lang: 'mm', key: 'nav.dashboard', value: 'ဒက်ရှ်ဘုတ်' },
  { lang: 'mm', key: 'nav.settings', value: 'ဆက်တင်များ' },
  { lang: 'mm', key: 'auth.login', value: 'ဝင်ရောက်ရန်' },
  { lang: 'mm', key: 'auth.logout', value: 'ထွက်ရန်' },
  { lang: 'mm', key: 'common.save', value: 'သိမ်းဆည်းရန်' },
  { lang: 'mm', key: 'common.cancel', value: 'မလုပ်တော့ပါ' },
];

const insertTranslation = db.prepare(`
  INSERT OR IGNORE INTO translations (language, key, value) VALUES (?, ?, ?)
`);

for (const t of translations) {
  insertTranslation.run(t.lang, t.key, t.value);
}
console.log('✅ Default translations seeded (TH, EN, MM)');

// ============================================================
// 12. Seed Default Heatmap Configurations
// ============================================================
if (maejardProject) {
  const maejardGreenhouses = db.prepare('SELECT id FROM greenhouses WHERE project_id = ?').all(maejardProject.id) as { id: number }[];
  
  const heatmapConfigs = [
    {
      name: 'ความชื้นดิน',
      sensor_key: 'soil_moisture',
      color_ranges: JSON.stringify([
        { min: 0, max: 30, color: '#ef4444', label: 'แห้งมาก' },
        { min: 30, max: 50, color: '#f97316', label: 'แห้ง' },
        { min: 50, max: 70, color: '#eab308', label: 'ปานกลาง' },
        { min: 70, max: 85, color: '#22c55e', label: 'ดี' },
        { min: 85, max: 100, color: '#3b82f6', label: 'ชื้นมาก' },
      ]),
    },
    {
      name: 'อุณหภูมิดิน',
      sensor_key: 'soil_temp',
      color_ranges: JSON.stringify([
        { min: 0, max: 20, color: '#3b82f6', label: 'เย็น' },
        { min: 20, max: 25, color: '#22c55e', label: 'เหมาะสม' },
        { min: 25, max: 30, color: '#eab308', label: 'อุ่น' },
        { min: 30, max: 35, color: '#f97316', label: 'ร้อน' },
        { min: 35, max: 50, color: '#ef4444', label: 'ร้อนมาก' },
      ]),
    },
  ];

  const insertHeatmap = db.prepare(`
    INSERT OR IGNORE INTO heatmap_configs (greenhouse_id, name, sensor_key, color_ranges, is_default)
    VALUES (?, ?, ?, ?, 1)
  `);

  for (const gh of maejardGreenhouses) {
    for (const config of heatmapConfigs) {
      const existing = db.prepare('SELECT id FROM heatmap_configs WHERE greenhouse_id = ? AND sensor_key = ?').get(gh.id, config.sensor_key);
      if (!existing) {
        insertHeatmap.run(gh.id, config.name, config.sensor_key, config.color_ranges);
      }
    }
  }
  console.log('✅ Default heatmap configurations seeded');
}

console.log('');
console.log('════════════════════════════════════════════════════════');
console.log('✅ DATABASE SEEDING COMPLETED');
console.log('════════════════════════════════════════════════════════');
console.log('');
console.log('📋 Default Accounts:');
console.log('   Super Admin: superadmin / superadmin123');
console.log('   Admin:       admin / admin123');
console.log('   Operator:    operator / operator123');
console.log('   Viewer:      viewer / viewer123');
console.log('');
