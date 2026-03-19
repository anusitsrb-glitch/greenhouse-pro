import { useEffect, useState, useCallback } from 'react';
import { useT } from '@/i18n';
import { AdminLayout } from './AdminLayout';
import {
  SlidersHorizontal, FolderOpen, ChevronDown, ChevronRight,
  Save, Loader2, RotateCcw, CheckCircle2, Gauge,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Greenhouse {
  id: number;
  ghKey: string;
  nameTh: string;
  projectKey: string;
  projectName?: string;
}

interface SensorConfig {
  id: number;
  sensor_key: string;
  name_th: string;
  sensor_type: string;
  data_key: string;
  unit: string;
  calibration_offset: number;
  calibration_scale: number;
  calibration_date: string | null;
  is_active: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const naturalSort = (a: Greenhouse, b: Greenhouse) =>
  a.ghKey.localeCompare(b.ghKey, undefined, { numeric: true, sensitivity: 'base' });

function formatCalDate(dateStr: string | null): string {
  if (!dateStr) return 'ยังไม่เคย calibrate';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'ยังไม่เคย calibrate';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const SENSOR_ICON: Record<string, string> = {
  air: '🌡',
  soil: '🌱',
  water: '💧',
  light: '☀️',
  custom: '🔧',
};

// ─── Sub-component: SensorRow ─────────────────────────────────────────────────

interface SensorRowProps {
  sensor: SensorConfig;
  projectKey: string;
  ghKey: string;
  onSaved: (sensorKey: string, newOffset: number) => void;
}

function SensorRow({ sensor, projectKey, ghKey, onSaved }: SensorRowProps) {
  const [offset, setOffset] = useState<string>(String(sensor.calibration_offset ?? 0));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty = parseFloat(offset) !== (sensor.calibration_offset ?? 0);

  const handleSave = async () => {
    const parsed = parseFloat(offset);
    if (isNaN(parsed)) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/sensors/${projectKey}/${ghKey}/calibrate/${sensor.sensor_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offset: parsed, scale: sensor.calibration_scale ?? 1 }),
      });
      setSaved(true);
      onSaved(sensor.sensor_key, parsed);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => setOffset('0');

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 px-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      {/* Sensor info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-xl w-7 text-center flex-shrink-0">
          {SENSOR_ICON[sensor.sensor_type] ?? '🔧'}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {sensor.name_th}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
            {sensor.sensor_key} · {formatCalDate(sensor.calibration_date)}
          </p>
        </div>
      </div>

      {/* Offset input + controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Unit badge */}
        <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 w-10 text-right">
          {sensor.unit}
        </span>

        {/* Offset label */}
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">offset</span>

        {/* Number input */}
        <input
          type="number"
          step="0.1"
          value={offset}
          onChange={(e) => setOffset(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className={`w-24 px-2.5 py-1.5 text-sm text-center font-mono border rounded-lg focus:outline-none focus:ring-2 transition-colors
            ${isDirty
              ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20 focus:ring-amber-300'
              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-primary/30'
            }
            text-gray-900 dark:text-gray-100`}
        />

        {/* Reset */}
        <button
          onClick={handleReset}
          title="รีเซ็ตเป็น 0"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || (!isDirty && !saved)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-all disabled:opacity-40
            ${saved
              ? 'bg-green-500 text-white'
              : isDirty
                ? 'bg-primary hover:bg-primary/90 text-white shadow-sm'
                : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
            }`}
        >
          {saving
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : saved
              ? <CheckCircle2 className="w-3.5 h-3.5" />
              : <Save className="w-3.5 h-3.5" />
          }
          <span className="hidden sm:inline">
            {saved ? 'บันทึกแล้ว' : 'บันทึก'}
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── Sub-component: GreenhousePanel ──────────────────────────────────────────

interface GreenhousePanelProps {
  gh: Greenhouse;
}

function GreenhousePanel({ gh }: GreenhousePanelProps) {
  const [open, setOpen] = useState(false);
  const [sensors, setSensors] = useState<SensorConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadSensors = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sensors/${gh.projectKey}/${gh.ghKey}`);
      const json = await res.json();
      const list: SensorConfig[] = Array.isArray(json?.data?.sensors)
        ? json.data.sensors.filter(
            (s: SensorConfig) =>
              (s.is_active === 1 || s.is_active === true) && ['air', 'soil', 'water', 'light', 'custom'].includes(s.sensor_type)
          )
        : [];
      setSensors(list);
      setLoaded(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [gh.projectKey, gh.ghKey, loaded]);

  const handleToggle = () => {
    if (!open && !loaded) loadSensors();
    setOpen((prev) => !prev);
  };

  const handleSaved = (sensorKey: string, newOffset: number) => {
    setSensors((prev) =>
      prev.map((s) =>
        s.sensor_key === sensorKey
          ? { ...s, calibration_offset: newOffset, calibration_date: new Date().toISOString() }
          : s
      )
    );
  };

  const airSensors = sensors.filter((s) => s.sensor_type === 'air');
  const soilSensors = sensors.filter((s) => s.sensor_type === 'soil');
  const otherSensors = sensors.filter((s) => !['air', 'soil'].includes(s.sensor_type));

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
      {/* Greenhouse header — คลิก expand */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
          <Gauge className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{gh.nameTh}</p>
          <p className="text-xs text-gray-400">{gh.projectKey} / {gh.ghKey}</p>
        </div>
        {loading
          ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
          : open
            ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        }
      </button>

      {/* Sensor list */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
          {loaded && sensors.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">ไม่มี Sensor ที่ตั้งค่าไว้</p>
          )}

          {airSensors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                🌡 อากาศ
              </p>
              <div className="space-y-2">
                {airSensors.map((s) => (
                  <SensorRow
                    key={s.sensor_key}
                    sensor={s}
                    projectKey={gh.projectKey}
                    ghKey={gh.ghKey}
                    onSaved={handleSaved}
                  />
                ))}
              </div>
            </div>
          )}

          {soilSensors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                🌱 ดิน
              </p>
              <div className="space-y-2">
                {soilSensors.map((s) => (
                  <SensorRow
                    key={s.sensor_key}
                    sensor={s}
                    projectKey={gh.projectKey}
                    ghKey={gh.ghKey}
                    onSaved={handleSaved}
                  />
                ))}
              </div>
            </div>
          )}

          {otherSensors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                🔧 อื่นๆ
              </p>
              <div className="space-y-2">
                {otherSensors.map((s) => (
                  <SensorRow
                    key={s.sensor_key}
                    sensor={s}
                    projectKey={gh.projectKey}
                    ghKey={gh.ghKey}
                    onSaved={handleSaved}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CalibratePage() {
  const { t } = useT();
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleProject = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    fetch('/api/admin/greenhouses')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const list: Greenhouse[] = Array.isArray(json?.data?.greenhouses)
          ? json.data.greenhouses
          : [];
        setGreenhouses(list);
        // Auto-expand โปรเจคแรก
        const keys = [...new Set<string>(list.map((g) => g.projectKey))].sort();
        if (keys.length > 0) setExpanded({ [keys[0]]: true });
      })
      .catch(() => {});
  }, []);

  // จัดกลุ่มตาม projectKey + natural sort โรงเรือน
  const grouped = greenhouses.reduce<Record<string, Greenhouse[]>>((acc, gh) => {
    if (!acc[gh.projectKey]) acc[gh.projectKey] = [];
    acc[gh.projectKey].push(gh);
    return acc;
  }, {});
  Object.keys(grouped).forEach((k) => grouped[k].sort(naturalSort));
  const projectKeys = Object.keys(grouped).sort();

  return (
    <AdminLayout
      title="Calibrate Sensor"
      subtitle="ปรับค่า offset ของ sensor แต่ละโรงเรือน (ค่าจริง = ค่า sensor + offset)"
    >
      <div className="space-y-3">
        {greenhouses.length === 0 && (
          <div className="text-center text-gray-400 py-12">{t('common.noData')}</div>
        )}

        {projectKeys.map((projectKey) => {
          const isOpen = !!expanded[projectKey];
          const projectName = grouped[projectKey][0]?.projectName ?? projectKey;

          return (
            <div
              key={projectKey}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Project header */}
              <button
                onClick={() => toggleProject(projectKey)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{projectName}</p>
                  <p className="text-xs text-gray-400">
                    {projectKey} · {grouped[projectKey].length} โรงเรือน
                  </p>
                </div>
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                }
              </button>

              {/* Greenhouse list */}
              {isOpen && (
                <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 p-4 space-y-3">
                  {grouped[projectKey].map((gh) => (
                    <GreenhousePanel key={gh.ghKey} gh={gh} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Helper note */}
        {greenhouses.length > 0 && (
          <div className="flex items-start gap-2.5 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
            <SlidersHorizontal className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              <span className="font-medium">วิธีใช้:</span>{' '}
              คลิกโรงเรือนเพื่อดู sensor → ใส่ค่า offset (เช่น -2 หมายถึงหักออก 2) → กดบันทึก
              <br />
              <span className="text-blue-500 dark:text-blue-400">ค่าจริงที่แสดงบน Dashboard = ค่า sensor + offset</span>
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}