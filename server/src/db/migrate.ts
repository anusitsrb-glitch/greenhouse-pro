import { db } from './connection.js';


function listColumns(table: string): string[] {
  // quote table name for safety
  return db.prepare(`PRAGMA table_info("${table}")`).all().map((r: any) => r.name);
}


function addColumnIfMissing(table: string, column: string, definition: string) {
  const cols = new Set(listColumns(table));
  if (cols.has(column)) return;

  db.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
  console.log(`[DB] Added column: ${table}.${column} ${definition}`);
}


console.log('🔄 Running database migrations...');

// Users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'operator', 'viewer')) DEFAULT 'viewer',
    language TEXT NOT NULL DEFAULT 'th',
    theme TEXT NOT NULL DEFAULT 'light',
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    last_login_ip TEXT,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Projects table (with per-project ThingsBoard settings)
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    name_th TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('ready', 'developing')) DEFAULT 'developing',
    tb_base_url TEXT NOT NULL,
    tb_username TEXT NOT NULL,
    tb_password TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Greenhouses table
db.exec(`
  CREATE TABLE IF NOT EXISTS greenhouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    gh_key TEXT NOT NULL,
    name_th TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('ready', 'developing')) DEFAULT 'developing',
    tb_device_id TEXT,
    tags TEXT DEFAULT '[]',
    location TEXT,
    device_status TEXT,
    last_online_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, gh_key)
  )
`);

// ✅ Ensure columns for online/offline status exist (Railway-safe)
addColumnIfMissing('greenhouses', 'device_status', 'TEXT');
addColumnIfMissing('greenhouses', 'last_online_at', 'TEXT');

// ============================================================
// NEW: Sensor Configuration Table (Dynamic Sensors)
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS sensor_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    sensor_key TEXT NOT NULL,
    name_th TEXT NOT NULL,
    sensor_type TEXT NOT NULL CHECK (sensor_type IN ('air', 'soil', 'water', 'light', 'custom')),
    data_key TEXT NOT NULL,
    unit TEXT NOT NULL,
    icon TEXT DEFAULT 'Thermometer',
    color TEXT DEFAULT '#10b981',
    min_value REAL,
    max_value REAL,
    alert_min REAL,
    alert_max REAL,
    calibration_offset REAL DEFAULT 0,
    calibration_scale REAL DEFAULT 1,
    calibration_date TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    UNIQUE(greenhouse_id, sensor_key)
  )
`);

// ============================================================
// NEW: Relay/Motor Configuration Table (Dynamic Controls)
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS control_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    control_key TEXT NOT NULL,
    name_th TEXT NOT NULL,
    control_type TEXT NOT NULL CHECK (control_type IN ('relay', 'motor', 'dimmer', 'custom')),
    rpc_method TEXT NOT NULL,
    attribute_key TEXT NOT NULL,
    icon TEXT DEFAULT 'Power',
    color TEXT DEFAULT '#3b82f6',
    auto_mode_key TEXT,
    timer_on_key TEXT,
    timer_off_key TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    UNIQUE(greenhouse_id, control_key)
  )
`);

// ============================================================
// NEW: Alert History Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold', 'offline', 'system', 'custom')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')) DEFAULT 'warning',
    sensor_key TEXT,
    sensor_name TEXT,
    current_value REAL,
    threshold_value REAL,
    direction TEXT CHECK (direction IN ('above', 'below')),
    message TEXT NOT NULL,
    is_acknowledged INTEGER NOT NULL DEFAULT 0,
    acknowledged_by INTEGER,
    acknowledged_at TEXT,
    notification_sent INTEGER NOT NULL DEFAULT 0,
    notification_channel TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// NEW: Scheduled Reports Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS scheduled_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
    schedule_time TEXT NOT NULL DEFAULT '08:00',
    schedule_day INTEGER,
    report_period TEXT NOT NULL CHECK (report_period IN ('1d', '7d', '30d')),
    notification_channel TEXT NOT NULL CHECK (notification_channel IN ('line', 'email')),
    notification_target TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE
  )
`);

// ============================================================
// NEW: Device Status Table (Cache for TB device status)
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS device_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL UNIQUE,
    is_online INTEGER NOT NULL DEFAULT 0,
    last_seen_at TEXT,
    signal_strength INTEGER,
    firmware_version TEXT,
    ip_address TEXT,
    wifi_ssid TEXT,
    last_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE
  )
`);

// User-Project access mapping
db.exec(`
  CREATE TABLE IF NOT EXISTS user_project_access (
    user_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, project_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )
`);

// Audit log
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    project_key TEXT,
    gh_key TEXT,
    detail_json TEXT NOT NULL DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// App settings table for storing configuration
db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ============================================================
// V4: Login History Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    device_type TEXT,
    location TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'blocked')),
    failure_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// ============================================================
// V4: User Sessions Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    device_name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// ============================================================
// V4: IP Whitelist Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS ip_whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: User Preferences Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    dashboard_layout TEXT DEFAULT '{}',
    quick_actions TEXT DEFAULT '[]',
    notification_settings TEXT DEFAULT '{}',
    chart_preferences TEXT DEFAULT '{}',
    default_project_id INTEGER,
    default_greenhouse_id INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// ============================================================
// V4: Custom Dashboards Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS custom_dashboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    layout TEXT NOT NULL DEFAULT '[]',
    is_default INTEGER NOT NULL DEFAULT 0,
    is_shared INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// ============================================================
// V4: Dashboard Widgets Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dashboard_id INTEGER NOT NULL,
    widget_type TEXT NOT NULL,
    title TEXT,
    config TEXT NOT NULL DEFAULT '{}',
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 1,
    height INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (dashboard_id) REFERENCES custom_dashboards(id) ON DELETE CASCADE
  )
`);

// ============================================================
// V4: Automation Rules Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS automation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('sensor', 'time', 'manual')),
    trigger_config TEXT NOT NULL DEFAULT '{}',
    conditions TEXT NOT NULL DEFAULT '[]',
    actions TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    last_triggered_at TEXT,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Control Scenes/Presets Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS control_scenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'Zap',
    color TEXT DEFAULT '#3b82f6',
    actions TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Control History Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS control_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    control_key TEXT NOT NULL,
    control_name TEXT,
    action TEXT NOT NULL,
    value TEXT,
    ip_address TEXT,  -- เพิ่มบรรทัดนี้
    source TEXT NOT NULL CHECK (source IN ('manual', 'automation', 'schedule', 'scene')),
    source_id INTEGER,
    user_id INTEGER,
    success INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Control Schedules Table (Multiple schedules)
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS control_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    control_key TEXT NOT NULL,
    name TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'custom')),
    time_on TEXT,
    time_off TEXT,
    days_of_week TEXT DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Alert Rules Table (Custom alert conditions)
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sensor_key TEXT NOT NULL,
    condition_type TEXT NOT NULL CHECK (condition_type IN ('above', 'below', 'equal', 'between', 'outside')),
    threshold_value REAL,
    threshold_min REAL,
    threshold_max REAL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')) DEFAULT 'warning',
    notification_channels TEXT DEFAULT '[]',
    cooldown_minutes INTEGER DEFAULT 30,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_triggered_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE
  )
`);

// ============================================================
// V4: Notification Channels Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS notification_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    channel_type TEXT NOT NULL CHECK (channel_type IN ('line', 'sms', 'email', 'webhook')),
    config TEXT NOT NULL DEFAULT '{}',
    is_active INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ============================================================
// V4: Notification Templates Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS notification_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    template_type TEXT NOT NULL CHECK (template_type IN ('alert', 'report', 'maintenance', 'custom')),
    subject TEXT,
    body_template TEXT NOT NULL,
    variables TEXT DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ============================================================
// V4: Crops Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS crops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    variety TEXT,
    plant_date TEXT NOT NULL,
    expected_harvest_date TEXT,
    actual_harvest_date TEXT,
    quantity INTEGER,
    unit TEXT DEFAULT 'ต้น',
    status TEXT NOT NULL CHECK (status IN ('planted', 'growing', 'harvested', 'failed')) DEFAULT 'planted',
    notes TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Growth Records Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS growth_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crop_id INTEGER NOT NULL,
    record_date TEXT NOT NULL,
    height REAL,
    leaf_count INTEGER,
    health_status TEXT CHECK (health_status IN ('excellent', 'good', 'fair', 'poor')),
    notes TEXT,
    photo_url TEXT,
    recorded_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Fertilizer Schedule Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS fertilizer_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    crop_id INTEGER,
    fertilizer_name TEXT NOT NULL,
    fertilizer_type TEXT,
    amount REAL,
    unit TEXT DEFAULT 'g',
    schedule_date TEXT NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    completed_by INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE SET NULL,
    FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Pest/Disease Records Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS pest_disease_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    crop_id INTEGER,
    record_type TEXT NOT NULL CHECK (record_type IN ('pest', 'disease')),
    name TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    affected_area TEXT,
    treatment TEXT,
    treatment_date TEXT,
    resolved INTEGER NOT NULL DEFAULT 0,
    resolved_at TEXT,
    photo_url TEXT,
    notes TEXT,
    reported_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE SET NULL,
    FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Weather Cache Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS weather_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT NOT NULL,
    weather_data TEXT NOT NULL,
    forecast_data TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ============================================================
// V4: Teams Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Team Members Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS team_members (
    team_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('leader', 'member')) DEFAULT 'member',
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (team_id, user_id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// ============================================================
// V4: Team Project Access Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS team_project_access (
    team_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (team_id, project_id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )
`);

// ============================================================
// V4: Tasks Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT CHECK (task_type IN ('maintenance', 'inspection', 'harvest', 'planting', 'other')),
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
    assigned_to INTEGER,
    due_date TEXT,
    completed_at TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Activity Feed Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_feed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    activity_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    description TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Maintenance Schedules Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS maintenance_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    equipment_name TEXT NOT NULL,
    maintenance_type TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'yearly', 'custom')),
    schedule_day INTEGER,
    schedule_date TEXT,
    last_maintenance_at TEXT,
    next_maintenance_at TEXT,
    notify_before_days INTEGER DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Service History Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS service_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    equipment_name TEXT NOT NULL,
    service_type TEXT NOT NULL,
    service_date TEXT NOT NULL,
    description TEXT,
    cost REAL,
    technician TEXT,
    next_service_date TEXT,
    notes TEXT,
    recorded_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Yield Records Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS yield_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    crop_id INTEGER,
    harvest_date TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT DEFAULT 'kg',
    quality_grade TEXT,
    price_per_unit REAL,
    total_revenue REAL,
    notes TEXT,
    recorded_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE SET NULL,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Water Usage Records Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS water_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    record_date TEXT NOT NULL,
    usage_liters REAL NOT NULL,
    source TEXT,
    cost REAL,
    notes TEXT,
    recorded_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Camera Configurations Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS camera_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    camera_type TEXT NOT NULL CHECK (camera_type IN ('ip', 'rtsp', 'http', 'esp32')),
    url TEXT NOT NULL,
    username TEXT,
    password TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE
  )
`);

// ============================================================
// V4: Photo Gallery Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS photo_gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    crop_id INTEGER,
    title TEXT,
    description TEXT,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    photo_type TEXT CHECK (photo_type IN ('plant', 'pest', 'disease', 'general')),
    taken_at TEXT,
    uploaded_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
    FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: AI Recognition Models Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS ai_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    model_type TEXT NOT NULL CHECK (model_type IN ('pest', 'disease', 'plant', 'custom')),
    description TEXT,
    model_path TEXT,
    labels TEXT DEFAULT '[]',
    accuracy REAL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ============================================================
// V4: AI Training Data Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS ai_training_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    label TEXT NOT NULL,
    confidence REAL,
    verified INTEGER NOT NULL DEFAULT 0,
    verified_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (model_id) REFERENCES ai_models(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// V4: Google Sheets Integration Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS google_sheets_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    sheet_id TEXT NOT NULL,
    sheet_name TEXT,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('telemetry', 'alerts', 'reports', 'custom')),
    sync_interval_minutes INTEGER DEFAULT 60,
    last_sync_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    config TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE
  )
`);

// ============================================================
// V4: Heatmap Configurations Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS heatmap_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sensor_key TEXT NOT NULL,
    color_ranges TEXT NOT NULL DEFAULT '[]',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE
  )
`);

// ============================================================
// V4: Data Export History Table
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS export_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    export_type TEXT NOT NULL CHECK (export_type IN ('csv', 'excel', 'pdf', 'json')),
    data_type TEXT NOT NULL,
    file_path TEXT,
    file_size INTEGER,
    row_count INTEGER,
    filters TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// ============================================================
// V4: System API Keys Table (Super Admin only)
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS system_api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL UNIQUE,
    api_key TEXT NOT NULL,
    api_secret TEXT,
    config TEXT DEFAULT '{}',
    is_active INTEGER NOT NULL DEFAULT 1,
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);


// ============================================================
// V4: Translations Table (i18n)
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(language, key)
  )
`);

// ============================================================
// V5: Control Logs Table (Activity Log for External API)
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS control_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_key TEXT NOT NULL,
    gh_key TEXT NOT NULL,
    device_name TEXT NOT NULL,
    action TEXT NOT NULL,
    value TEXT,
    source TEXT NOT NULL CHECK (source IN ('webapp', 'external_api', 'automation', 'schedule')),
    user_id INTEGER,
    api_key_prefix TEXT,
    ip_address TEXT,
    user_agent TEXT,
    success INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )
`);

// ============================================================
// Create indexes for better query performance
// ============================================================
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_greenhouses_project_id ON greenhouses(project_id);
  CREATE INDEX IF NOT EXISTS idx_greenhouses_device_id ON greenhouses(tb_device_id);
  CREATE INDEX IF NOT EXISTS idx_user_project_access_user_id ON user_project_access(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_project_access_project_id ON user_project_access(project_id);
  CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
  CREATE INDEX IF NOT EXISTS idx_projects_key ON projects(key);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  
  CREATE INDEX IF NOT EXISTS idx_sensor_configs_greenhouse_id ON sensor_configs(greenhouse_id);
  CREATE INDEX IF NOT EXISTS idx_control_configs_greenhouse_id ON control_configs(greenhouse_id);
  CREATE INDEX IF NOT EXISTS idx_alert_history_greenhouse_id ON alert_history(greenhouse_id);
  CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at);
  CREATE INDEX IF NOT EXISTS idx_alert_history_is_acknowledged ON alert_history(is_acknowledged);
  CREATE INDEX IF NOT EXISTS idx_scheduled_reports_greenhouse_id ON scheduled_reports(greenhouse_id);
  CREATE INDEX IF NOT EXISTS idx_device_status_greenhouse_id ON device_status(greenhouse_id);
  
  CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at);
  CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
  CREATE INDEX IF NOT EXISTS idx_automation_rules_greenhouse_id ON automation_rules(greenhouse_id);
  CREATE INDEX IF NOT EXISTS idx_control_history_greenhouse_id ON control_history(greenhouse_id);
  CREATE INDEX IF NOT EXISTS idx_control_history_created_at ON control_history(created_at);
  CREATE INDEX IF NOT EXISTS idx_alert_rules_greenhouse_id ON alert_rules(greenhouse_id);
  CREATE INDEX IF NOT EXISTS idx_crops_greenhouse_id ON crops(greenhouse_id);
  CREATE INDEX IF NOT EXISTS idx_growth_records_crop_id ON growth_records(crop_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_tasks_greenhouse_id ON tasks(greenhouse_id);
  CREATE INDEX IF NOT EXISTS idx_activity_feed_user_id ON activity_feed(user_id);
  CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON activity_feed(created_at);
  CREATE INDEX IF NOT EXISTS idx_yield_records_greenhouse_id ON yield_records(greenhouse_id);
  CREATE INDEX IF NOT EXISTS idx_photo_gallery_greenhouse_id ON photo_gallery(greenhouse_id);
  CREATE INDEX IF NOT EXISTS idx_translations_language ON translations(language);
  
  CREATE INDEX IF NOT EXISTS idx_control_logs_project ON control_logs(project_key, gh_key);
  CREATE INDEX IF NOT EXISTS idx_control_logs_device ON control_logs(device_name);
  CREATE INDEX IF NOT EXISTS idx_control_logs_source ON control_logs(source);
  CREATE INDEX IF NOT EXISTS idx_control_logs_created ON control_logs(created_at);
`);

// ============================================================
// PHASE 1: Notification System
// ============================================================

console.log('🔄 Creating Phase 1 tables...');

// 1. Notifications Table
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT NOT NULL CHECK (type IN (
      'device_offline', 'device_online', 'sensor_alert',
      'control_action', 'auto_mode_changed', 'system_error', 'info'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')) DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    project_id INTEGER,
    greenhouse_id INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0,
    read_at TEXT,
    auto_dismiss INTEGER NOT NULL DEFAULT 1,
    dismiss_after_seconds INTEGER DEFAULT 300,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE
  )
`);

// 2. Notification Settings Table
db.exec(`
  CREATE TABLE IF NOT EXISTS notification_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1,
    device_offline INTEGER NOT NULL DEFAULT 1,
    device_online INTEGER NOT NULL DEFAULT 1,
    sensor_alert INTEGER NOT NULL DEFAULT 1,
    control_action INTEGER NOT NULL DEFAULT 1,
    auto_mode_changed INTEGER NOT NULL DEFAULT 1,
    system_error INTEGER NOT NULL DEFAULT 1,
    show_info INTEGER NOT NULL DEFAULT 1,
    show_warning INTEGER NOT NULL DEFAULT 1,
    show_critical INTEGER NOT NULL DEFAULT 1,
    project_filter TEXT DEFAULT '[]',
    greenhouse_filter TEXT DEFAULT '[]',
    in_app INTEGER NOT NULL DEFAULT 1,
    email INTEGER NOT NULL DEFAULT 0,
    line_notify INTEGER NOT NULL DEFAULT 0,
    push INTEGER NOT NULL DEFAULT 0,
    quiet_hours_enabled INTEGER NOT NULL DEFAULT 0,
    quiet_hours_start TEXT DEFAULT '22:00',
    quiet_hours_end TEXT DEFAULT '07:00',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// 3. Device Status Logs Table
db.exec(`
  CREATE TABLE IF NOT EXISTS device_status_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    greenhouse_id INTEGER NOT NULL,
    previous_status TEXT NOT NULL CHECK (previous_status IN ('online', 'offline', 'unknown')),
    new_status TEXT NOT NULL CHECK (new_status IN ('online', 'offline', 'unknown')),
    reason TEXT,
    signal_strength INTEGER,
    wifi_ssid TEXT,
    ip_address TEXT,
    firmware_version TEXT,
    offline_duration INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE
  )
`);

// 4. Indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
  CREATE INDEX IF NOT EXISTS idx_notifications_severity ON notifications(severity);
  CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
  CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_greenhouse_id ON notifications(greenhouse_id);
  
  CREATE INDEX IF NOT EXISTS idx_device_status_logs_greenhouse_id ON device_status_logs(greenhouse_id);
  CREATE INDEX IF NOT EXISTS idx_device_status_logs_created_at ON device_status_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_device_status_logs_new_status ON device_status_logs(new_status);
`);

console.log('✅ Phase 1 tables created');


await addColumnIfMissing(
  'users',
  'language',
  "TEXT DEFAULT 'th'"
);

await addColumnIfMissing(
  'users',
  'theme',
  "TEXT DEFAULT 'light'"
);





console.log('✅ Database migrations completed');