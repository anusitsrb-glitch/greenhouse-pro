import { query } from './connection.js';

console.log('🔄 Running database migrations...');

export async function runMigrations() {
  // Users
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('superadmin', 'admin', 'operator', 'viewer')),
      language TEXT NOT NULL DEFAULT 'th',
      theme TEXT NOT NULL DEFAULT 'light',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      last_login_ip TEXT,
      failed_login_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Projects
  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name_th TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'developing' CHECK (status IN ('ready', 'developing')),
      tb_base_url TEXT NOT NULL,
      tb_username TEXT NOT NULL,
      tb_password TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Greenhouses
  await query(`
    CREATE TABLE IF NOT EXISTS greenhouses (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      gh_key TEXT NOT NULL,
      name_th TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'developing' CHECK (status IN ('ready', 'developing')),
      tb_device_id TEXT,
      tags TEXT DEFAULT '[]',
      location TEXT,
      device_status TEXT,
      last_online_at TEXT,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text,
      UNIQUE(project_id, gh_key)
    )
  `);

  // Sensor configs
  await query(`
    CREATE TABLE IF NOT EXISTS sensor_configs (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
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
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text,
      UNIQUE(greenhouse_id, sensor_key)
    )
  `);

  // Control configs
  await query(`
    CREATE TABLE IF NOT EXISTS control_configs (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
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
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text,
      UNIQUE(greenhouse_id, control_key)
    )
  `);

  // Alert history
  await query(`
    CREATE TABLE IF NOT EXISTS alert_history (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold', 'offline', 'system', 'custom')),
      severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
      sensor_key TEXT,
      sensor_name TEXT,
      current_value REAL,
      threshold_value REAL,
      direction TEXT CHECK (direction IN ('above', 'below')),
      message TEXT NOT NULL,
      is_acknowledged INTEGER NOT NULL DEFAULT 0,
      acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      acknowledged_at TEXT,
      notification_sent INTEGER NOT NULL DEFAULT 0,
      notification_channel TEXT,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Scheduled reports
  await query(`
    CREATE TABLE IF NOT EXISTS scheduled_reports (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
      schedule_time TEXT NOT NULL DEFAULT '08:00',
      schedule_day INTEGER,
      report_period TEXT NOT NULL CHECK (report_period IN ('1d', '7d', '30d')),
      notification_channel TEXT NOT NULL CHECK (notification_channel IN ('line', 'email')),
      notification_target TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Device status
  await query(`
    CREATE TABLE IF NOT EXISTS device_status (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL UNIQUE REFERENCES greenhouses(id) ON DELETE CASCADE,
      is_online INTEGER NOT NULL DEFAULT 0,
      last_seen_at TEXT,
      signal_strength INTEGER,
      firmware_version TEXT,
      ip_address TEXT,
      wifi_ssid TEXT,
      last_updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // User project access
  await query(`
    CREATE TABLE IF NOT EXISTS user_project_access (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT now()::text,
      PRIMARY KEY (user_id, project_id)
    )
  `);

  // Audit log
  await query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      project_key TEXT,
      gh_key TEXT,
      detail_json TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // App settings
  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Login history
  await query(`
    CREATE TABLE IF NOT EXISTS login_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip_address TEXT,
      user_agent TEXT,
      device_type TEXT,
      location TEXT,
      status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'blocked')),
      failure_reason TEXT,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // User sessions
  await query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_token TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      device_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_activity_at TEXT NOT NULL DEFAULT now()::text,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // IP whitelist
  await query(`
    CREATE TABLE IF NOT EXISTS ip_whitelist (
      id SERIAL PRIMARY KEY,
      ip_address TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // User preferences
  await query(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      dashboard_layout TEXT DEFAULT '{}',
      quick_actions TEXT DEFAULT '[]',
      notification_settings TEXT DEFAULT '{}',
      chart_preferences TEXT DEFAULT '{}',
      default_project_id INTEGER,
      default_greenhouse_id INTEGER,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Custom dashboards
  await query(`
    CREATE TABLE IF NOT EXISTS custom_dashboards (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      layout TEXT NOT NULL DEFAULT '[]',
      is_default INTEGER NOT NULL DEFAULT 0,
      is_shared INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Dashboard widgets
  await query(`
    CREATE TABLE IF NOT EXISTS dashboard_widgets (
      id SERIAL PRIMARY KEY,
      dashboard_id INTEGER NOT NULL REFERENCES custom_dashboards(id) ON DELETE CASCADE,
      widget_type TEXT NOT NULL,
      title TEXT,
      config TEXT NOT NULL DEFAULT '{}',
      position_x INTEGER NOT NULL DEFAULT 0,
      position_y INTEGER NOT NULL DEFAULT 0,
      width INTEGER NOT NULL DEFAULT 1,
      height INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Automation rules
  await query(`
    CREATE TABLE IF NOT EXISTS automation_rules (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      trigger_type TEXT NOT NULL CHECK (trigger_type IN ('sensor', 'time', 'manual')),
      trigger_config TEXT NOT NULL DEFAULT '{}',
      conditions TEXT NOT NULL DEFAULT '[]',
      actions TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_triggered_at TEXT,
      trigger_count INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Control scenes
  await query(`
    CREATE TABLE IF NOT EXISTS control_scenes (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'Zap',
      color TEXT DEFAULT '#3b82f6',
      actions TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Control history
  await query(`
    CREATE TABLE IF NOT EXISTS control_history (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      control_key TEXT NOT NULL,
      control_name TEXT,
      action TEXT NOT NULL,
      value TEXT,
      ip_address TEXT,
      source TEXT NOT NULL CHECK (source IN ('manual', 'automation', 'schedule', 'scene')),
      source_id INTEGER,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      success INTEGER NOT NULL DEFAULT 1,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Control schedules
  await query(`
    CREATE TABLE IF NOT EXISTS control_schedules (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      control_key TEXT NOT NULL,
      name TEXT NOT NULL,
      schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'custom')),
      time_on TEXT,
      time_off TEXT,
      days_of_week TEXT DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Alert rules
  await query(`
    CREATE TABLE IF NOT EXISTS alert_rules (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sensor_key TEXT NOT NULL,
      condition_type TEXT NOT NULL CHECK (condition_type IN ('above', 'below', 'equal', 'between', 'outside')),
      threshold_value REAL,
      threshold_min REAL,
      threshold_max REAL,
      severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
      notification_channels TEXT DEFAULT '[]',
      cooldown_minutes INTEGER DEFAULT 30,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_triggered_at TEXT,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Notification channels
  await query(`
    CREATE TABLE IF NOT EXISTS notification_channels (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      channel_type TEXT NOT NULL CHECK (channel_type IN ('line', 'sms', 'email', 'webhook')),
      config TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Notification templates
  await query(`
    CREATE TABLE IF NOT EXISTS notification_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      template_type TEXT NOT NULL CHECK (template_type IN ('alert', 'report', 'maintenance', 'custom')),
      subject TEXT,
      body_template TEXT NOT NULL,
      variables TEXT DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Crops
  await query(`
    CREATE TABLE IF NOT EXISTS crops (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      variety TEXT,
      plant_date TEXT NOT NULL,
      expected_harvest_date TEXT,
      actual_harvest_date TEXT,
      quantity INTEGER,
      unit TEXT DEFAULT 'ต้น',
      status TEXT NOT NULL DEFAULT 'planted' CHECK (status IN ('planted', 'growing', 'harvested', 'failed')),
      notes TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Growth records
  await query(`
    CREATE TABLE IF NOT EXISTS growth_records (
      id SERIAL PRIMARY KEY,
      crop_id INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
      record_date TEXT NOT NULL,
      height REAL,
      leaf_count INTEGER,
      health_status TEXT CHECK (health_status IN ('excellent', 'good', 'fair', 'poor')),
      notes TEXT,
      photo_url TEXT,
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Fertilizer schedules
  await query(`
    CREATE TABLE IF NOT EXISTS fertilizer_schedules (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      crop_id INTEGER REFERENCES crops(id) ON DELETE SET NULL,
      fertilizer_name TEXT NOT NULL,
      fertilizer_type TEXT,
      amount REAL,
      unit TEXT DEFAULT 'g',
      schedule_date TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Pest disease records
  await query(`
    CREATE TABLE IF NOT EXISTS pest_disease_records (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      crop_id INTEGER REFERENCES crops(id) ON DELETE SET NULL,
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
      reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Weather cache
  await query(`
    CREATE TABLE IF NOT EXISTS weather_cache (
      id SERIAL PRIMARY KEY,
      location TEXT NOT NULL UNIQUE,
      weather_data TEXT NOT NULL,
      forecast_data TEXT,
      fetched_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

    // Weather configs
  await query(`
    CREATE TABLE IF NOT EXISTS weather_configs (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL UNIQUE REFERENCES greenhouses(id) ON DELETE CASCADE,
      location_name TEXT NOT NULL DEFAULT 'กรุงเทพมหานคร',
      latitude REAL NOT NULL DEFAULT 13.7563,
      longitude REAL NOT NULL DEFAULT 100.5018,
      show_temperature INTEGER NOT NULL DEFAULT 1,
      show_humidity INTEGER NOT NULL DEFAULT 1,
      show_condition INTEGER NOT NULL DEFAULT 1,
      show_wind_speed INTEGER NOT NULL DEFAULT 1,
      show_uv_index INTEGER NOT NULL DEFAULT 0,
      show_rain_chance INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Yield records
  await query(`
    CREATE TABLE IF NOT EXISTS yield_records (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      crop_id INTEGER REFERENCES crops(id) ON DELETE SET NULL,
      harvest_date TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT DEFAULT 'kg',
      quality_grade TEXT,
      price_per_unit REAL,
      total_revenue REAL,
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Water usage
  await query(`
    CREATE TABLE IF NOT EXISTS water_usage (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      record_date TEXT NOT NULL,
      usage_liters REAL NOT NULL,
      source TEXT,
      cost REAL,
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Teams
  await query(`
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Team members
  await query(`
    CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
      joined_at TEXT NOT NULL DEFAULT now()::text,
      PRIMARY KEY (team_id, user_id)
    )
  `);

  // Team project access
  await query(`
    CREATE TABLE IF NOT EXISTS team_project_access (
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT now()::text,
      PRIMARY KEY (team_id, project_id)
    )
  `);

  // Tasks
  await query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER REFERENCES greenhouses(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      task_type TEXT CHECK (task_type IN ('maintenance', 'inspection', 'harvest', 'planting', 'other')),
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      due_date TEXT,
      completed_at TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Activity feed
  await query(`
    CREATE TABLE IF NOT EXISTS activity_feed (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      activity_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      description TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Maintenance schedules
  await query(`
    CREATE TABLE IF NOT EXISTS maintenance_schedules (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
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
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Service history
  await query(`
    CREATE TABLE IF NOT EXISTS service_history (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      equipment_name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      service_date TEXT NOT NULL,
      description TEXT,
      cost REAL,
      technician TEXT,
      next_service_date TEXT,
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Camera configs
  await query(`
    CREATE TABLE IF NOT EXISTS camera_configs (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      camera_type TEXT NOT NULL CHECK (camera_type IN ('ip', 'rtsp', 'http', 'esp32')),
      url TEXT NOT NULL,
      username TEXT,
      password TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Photo gallery
  await query(`
    CREATE TABLE IF NOT EXISTS photo_gallery (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      crop_id INTEGER REFERENCES crops(id) ON DELETE SET NULL,
      title TEXT,
      description TEXT,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      photo_type TEXT CHECK (photo_type IN ('plant', 'pest', 'disease', 'general')),
      taken_at TEXT,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // AI models
  await query(`
    CREATE TABLE IF NOT EXISTS ai_models (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      model_type TEXT NOT NULL CHECK (model_type IN ('pest', 'disease', 'plant', 'custom')),
      description TEXT,
      model_path TEXT,
      labels TEXT DEFAULT '[]',
      accuracy REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // AI training data
  await query(`
    CREATE TABLE IF NOT EXISTS ai_training_data (
      id SERIAL PRIMARY KEY,
      model_id INTEGER NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
      image_path TEXT NOT NULL,
      label TEXT NOT NULL,
      confidence REAL,
      verified INTEGER NOT NULL DEFAULT 0,
      verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Google sheets config
  await query(`
    CREATE TABLE IF NOT EXISTS google_sheets_config (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      sheet_id TEXT NOT NULL,
      sheet_name TEXT,
      sync_type TEXT NOT NULL CHECK (sync_type IN ('telemetry', 'alerts', 'reports', 'custom')),
      sync_interval_minutes INTEGER DEFAULT 60,
      last_sync_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      config TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Heatmap configs
  await query(`
    CREATE TABLE IF NOT EXISTS heatmap_configs (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sensor_key TEXT NOT NULL,
      color_ranges TEXT NOT NULL DEFAULT '[]',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Export history
  await query(`
    CREATE TABLE IF NOT EXISTS export_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      export_type TEXT NOT NULL CHECK (export_type IN ('csv', 'excel', 'pdf', 'json')),
      data_type TEXT NOT NULL,
      file_path TEXT,
      file_size INTEGER,
      row_count INTEGER,
      filters TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // System API keys
  await query(`
    CREATE TABLE IF NOT EXISTS system_api_keys (
      id SERIAL PRIMARY KEY,
      service_name TEXT NOT NULL UNIQUE,
      api_key TEXT NOT NULL,
      api_secret TEXT,
      config TEXT DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Translations
  await query(`
    CREATE TABLE IF NOT EXISTS translations (
      id SERIAL PRIMARY KEY,
      language TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text,
      UNIQUE(language, key)
    )
  `);

  // Control logs
  await query(`
    CREATE TABLE IF NOT EXISTS control_logs (
      id SERIAL PRIMARY KEY,
      project_key TEXT NOT NULL,
      gh_key TEXT NOT NULL,
      device_name TEXT NOT NULL,
      action TEXT NOT NULL,
      value TEXT,
      source TEXT NOT NULL CHECK (source IN ('webapp', 'external_api', 'automation', 'schedule')),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      api_key_prefix TEXT,
      ip_address TEXT,
      user_agent TEXT,
      success INTEGER NOT NULL DEFAULT 1,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Notifications
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN (
        'device_offline', 'device_online', 'sensor_alert', 'sensor_offline',
        'control_action', 'auto_mode_changed', 'system_error', 'info'
      )),
      severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      greenhouse_id INTEGER REFERENCES greenhouses(id) ON DELETE CASCADE,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at TEXT,
      auto_dismiss INTEGER NOT NULL DEFAULT 1,
      dismiss_after_seconds INTEGER DEFAULT 300,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Notification settings
  await query(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 1,
      device_offline INTEGER NOT NULL DEFAULT 1,
      device_online INTEGER NOT NULL DEFAULT 1,
      sensor_alert INTEGER NOT NULL DEFAULT 1,
      sensor_offline INTEGER NOT NULL DEFAULT 1,
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
      created_at TEXT NOT NULL DEFAULT now()::text,
      updated_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Device status logs
  await query(`
    CREATE TABLE IF NOT EXISTS device_status_logs (
      id SERIAL PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
      previous_status TEXT NOT NULL CHECK (previous_status IN ('online', 'offline', 'unknown')),
      new_status TEXT NOT NULL CHECK (new_status IN ('online', 'offline', 'unknown')),
      reason TEXT,
      signal_strength INTEGER,
      wifi_ssid TEXT,
      ip_address TEXT,
      firmware_version TEXT,
      offline_duration INTEGER,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);

  // Sessions (for express-session)
  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire TIMESTAMPTZ NOT NULL
    )
  `);

  // Indexes
  await query(`CREATE INDEX IF NOT EXISTS idx_greenhouses_project_id ON greenhouses(project_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_greenhouses_device_id ON greenhouses(tb_device_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_user_project_access_user_id ON user_project_access(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_user_project_access_project_id ON user_project_access(project_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_projects_key ON projects(key)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sensor_configs_greenhouse_id ON sensor_configs(greenhouse_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_control_configs_greenhouse_id ON control_configs(greenhouse_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_alert_history_greenhouse_id ON alert_history(greenhouse_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_control_history_greenhouse_id ON control_history(greenhouse_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_control_history_created_at ON control_history(created_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_crops_greenhouse_id ON crops(greenhouse_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_growth_records_crop_id ON growth_records(crop_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_device_status_logs_greenhouse_id ON device_status_logs(greenhouse_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)`);

  console.log('✅ Database migrations completed');
}