import { useEffect, useState } from 'react';
import { useT } from '@/i18n';
import { AdminLayout } from './AdminLayout';
import { CloudSun, MapPin, Search, Save, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

interface GeoResult {
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface WeatherConfig {
  location_name: string;
  latitude: number;
  longitude: number;
  show_temperature: number;
  show_humidity: number;
  show_condition: number;
  show_wind_speed: number;
  show_uv_index: number;
  show_rain_chance: number;
}

interface Greenhouse {
  id: number;
  ghKey: string;
  nameTh: string;
  projectKey: string;
}

const DEFAULT_CONFIG: WeatherConfig = {
  location_name: 'กรุงเทพมหานคร',
  latitude: 13.7563,
  longitude: 100.5018,
  show_temperature: 1,
  show_humidity: 1,
  show_condition: 1,
  show_wind_speed: 1,
  show_uv_index: 0,
  show_rain_chance: 1,
};

export function WeatherPage() {
  const { t } = useT();
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([]);
  const [configs, setConfigs] = useState<Record<string, WeatherConfig>>({});
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<Record<string, GeoResult[]>>({});
  const [searching, setSearching] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  // Load greenhouses
  useEffect(() => {
    fetch('/api/admin/greenhouses')
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        const list = Array.isArray(json?.data?.greenhouses) ? json.data.greenhouses : [];
        setGreenhouses(list);
      })
      .catch(() => {});
  }, []);

  // Load config for each greenhouse
  // Server returns: { success: true, data: { config: {...} } }
  useEffect(() => {
    if (!greenhouses.length) return;
    greenhouses.forEach((gh) => {
      fetch(`/api/admin/weather/${gh.projectKey}/${gh.ghKey}`)
        .then((r) => r.ok ? r.json() : null)
        .then((json) => {
          const cfg = json?.data?.config;
          if (cfg) {
            // Normalize: ensure latitude/longitude are numbers (DB อาจ return string)
            const normalized: WeatherConfig = {
              ...DEFAULT_CONFIG,
              ...cfg,
              latitude: cfg.latitude != null ? Number(cfg.latitude) : DEFAULT_CONFIG.latitude,
              longitude: cfg.longitude != null ? Number(cfg.longitude) : DEFAULT_CONFIG.longitude,
            };
            setConfigs((prev) => ({ ...prev, [`${gh.projectKey}/${gh.ghKey}`]: normalized }));
          }
        })
        .catch(() => {});
    });
  }, [greenhouses]);

  const getKey = (gh: Greenhouse) => `${gh.projectKey}/${gh.ghKey}`;

  const getConfig = (gh: Greenhouse): WeatherConfig => configs[getKey(gh)] ?? { ...DEFAULT_CONFIG };

  const updateConfig = (gh: Greenhouse, patch: Partial<WeatherConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [getKey(gh)]: { ...getConfig(gh), ...patch },
    }));
  };

  const handleSearch = async (gh: Greenhouse) => {
    const q = searchQueries[getKey(gh)]?.trim();
    if (!q) return;
    setSearching((prev) => ({ ...prev, [getKey(gh)]: true }));
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=th`
      );
      const json = await res.json();
      setSearchResults((prev) => ({ ...prev, [getKey(gh)]: json.results ?? [] }));
    } catch {
      setSearchResults((prev) => ({ ...prev, [getKey(gh)]: [] }));
    } finally {
      setSearching((prev) => ({ ...prev, [getKey(gh)]: false }));
    }
  };

  const handleSelectLocation = (gh: Greenhouse, result: GeoResult) => {
    const label = [result.name, result.admin1, result.country].filter(Boolean).join(', ');
    updateConfig(gh, {
      location_name: label,
      latitude: result.latitude,
      longitude: result.longitude,
    });
    setSearchResults((prev) => ({ ...prev, [getKey(gh)]: [] }));
    setSearchQueries((prev) => ({ ...prev, [getKey(gh)]: '' }));
  };

  const handleSave = async (gh: Greenhouse) => {
    const cfg = getConfig(gh);
    setSaving((prev) => ({ ...prev, [getKey(gh)]: true }));
    try {
      await fetch(`/api/admin/weather/${gh.projectKey}/${gh.ghKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      setSaved((prev) => ({ ...prev, [getKey(gh)]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [getKey(gh)]: false })), 2000);
    } catch {
      // silent
    } finally {
      setSaving((prev) => ({ ...prev, [getKey(gh)]: false }));
    }
  };

  const TOGGLE_FIELDS: { key: keyof WeatherConfig; label: string }[] = [
    { key: 'show_temperature', label: t('admin.weather.showTemperature') },
    { key: 'show_humidity',    label: t('admin.weather.showHumidity') },
    { key: 'show_condition',   label: t('admin.weather.showCondition') },
    { key: 'show_wind_speed',  label: t('admin.weather.showWindSpeed') },
    { key: 'show_uv_index',    label: t('admin.weather.showUvIndex') },
    { key: 'show_rain_chance', label: t('admin.weather.showRainChance') },
  ];

  return (
    <AdminLayout title={t('admin.weather')} subtitle={t('admin.weather.subtitle')}>
      <div className="space-y-6">
        {greenhouses.length === 0 && (
          <div className="text-center text-gray-400 py-12">{t('common.noData')}</div>
        )}

        {greenhouses.map((gh) => {
          const cfg = getConfig(gh);
          const key = getKey(gh);
          const results = searchResults[key] ?? [];

          return (
            <div key={key} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              {/* GH Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900 flex items-center justify-center">
                  <CloudSun className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{gh.nameTh}</p>
                  <p className="text-xs text-gray-400">{gh.projectKey} / {gh.ghKey}</p>
                </div>
              </div>

              {/* Location Search */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('admin.weather.selectLocation')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQueries[key] ?? ''}
                    onChange={(e) => setSearchQueries((prev) => ({ ...prev, [key]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(gh)}
                    placeholder={t('admin.weather.searchPlaceholder')}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => handleSearch(gh)}
                    disabled={searching[key]}
                    className="px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {searching[key] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {t('admin.weather.searchBtn')}
                  </button>
                </div>

                {/* Search Results */}
                {results.length > 0 && (
                  <div className="mt-1 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    {results.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectLocation(gh, r)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-sky-50 dark:hover:bg-sky-900/30 flex items-center gap-2 border-b last:border-b-0 border-gray-100 dark:border-gray-700"
                      >
                        <MapPin className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                        <span>{[r.name, r.admin1, r.country].filter(Boolean).join(', ')}</span>
                        <span className="ml-auto text-xs text-gray-400">
                          {Number(r.latitude).toFixed(2)}, {Number(r.longitude).toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Current Location */}
              <div className="flex items-center gap-2 mb-4 p-3 bg-sky-50 dark:bg-sky-900/20 rounded-lg">
                <MapPin className="w-4 h-4 text-sky-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sky-800 dark:text-sky-200 truncate">{cfg.location_name}</p>
                  <p className="text-xs text-sky-500">
                    {Number(cfg.latitude).toFixed(4)}, {Number(cfg.longitude).toFixed(4)}
                  </p>
                </div>
              </div>

              {/* Toggle Fields */}
              <div className="mb-5">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.weather.showFields')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TOGGLE_FIELDS.map(({ key: fieldKey, label }) => {
                    const isOn = cfg[fieldKey] === 1;
                    return (
                      <button
                        key={fieldKey}
                        onClick={() => updateConfig(gh, { [fieldKey]: isOn ? 0 : 1 } as Partial<WeatherConfig>)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isOn
                            ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {isOn
                          ? <ToggleRight className="w-4 h-4 flex-shrink-0" />
                          : <ToggleLeft className="w-4 h-4 flex-shrink-0" />
                        }
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={() => handleSave(gh)}
                disabled={saving[key]}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
              >
                {saving[key] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saved[key] ? t('admin.weather.saveSuccess') : t('common.save')}
              </button>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}