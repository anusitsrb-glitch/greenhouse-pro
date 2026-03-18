import { useEffect, useState } from 'react';
import { useT } from '@/i18n';
import { MapPin, RefreshCw, Thermometer, Droplets, Wind, Eye, Umbrella, Sun } from 'lucide-react';

interface WeatherData {
  temperature: number;
  humidity: number;
  weather_code: number;
  condition: { label_th: string; icon: string };
  wind_speed: number;
  uv_index: number;
  rain_chance: number;
  location_name: string;
  updated_at: string;
}

interface WeatherConfig {
  show_temperature: number;
  show_humidity: number;
  show_condition: number;
  show_wind_speed: number;
  show_uv_index: number;
  show_rain_chance: number;
}

interface WeatherResponse {
  weather: WeatherData;
  config: WeatherConfig;
  cached: boolean;
}

interface WeatherCardProps {
  project: string;
  gh: string;
}

const CONDITION_EMOJI: Record<string, string> = {
  sunny: '☀️',
  partly_cloudy: '⛅',
  cloudy: '☁️',
  foggy: '🌫️',
  drizzle: '🌦️',
  rainy: '🌧️',
  snowy: '❄️',
  heavy_rain: '⛈️',
  thunderstorm: '⛈️',
};

export function WeatherCard({ project, gh }: WeatherCardProps) {
  const { t } = useT();
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchWeather = () => {
    setLoading(true);
    fetch(`/api/weather/${project}/${gh}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((json) => { setData(json); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (project && gh) fetchWeather();
  }, [project, gh]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-sky-50 to-blue-100 dark:from-sky-950 dark:to-blue-900 rounded-2xl p-4 animate-pulse h-28" />
    );
  }

  if (error || !data) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 flex items-center justify-center text-gray-400 text-sm h-20">
        {t('weather.unavailable')}
      </div>
    );
  }

  const { weather, config } = data;
  const emoji = CONDITION_EMOJI[weather.condition.icon] ?? '🌡️';

  const fields = [
    { key: 'show_temperature', icon: <Thermometer className="w-3.5 h-3.5" />, label: `${weather.temperature}°C` },
    { key: 'show_humidity',    icon: <Droplets className="w-3.5 h-3.5" />,    label: `${weather.humidity}%` },
    { key: 'show_wind_speed',  icon: <Wind className="w-3.5 h-3.5" />,        label: `${weather.wind_speed} km/h` },
    { key: 'show_rain_chance', icon: <Umbrella className="w-3.5 h-3.5" />,    label: `${weather.rain_chance}%` },
    { key: 'show_uv_index',    icon: <Sun className="w-3.5 h-3.5" />,         label: `UV ${weather.uv_index}` },
  ] as const;

  const visibleFields = fields.filter((f) => config[f.key]);

  return (
    <div className="bg-gradient-to-br from-sky-50 to-blue-100 dark:from-sky-950 dark:to-blue-900 rounded-2xl p-4 border border-sky-200 dark:border-sky-800">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs font-medium truncate max-w-[160px]">{weather.location_name}</span>
        </div>
        <button
          onClick={fetchWeather}
          className="p-1 rounded-lg hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors"
          title={t('common.refresh')}
        >
          <RefreshCw className="w-3.5 h-3.5 text-sky-500" />
        </button>
      </div>

      {/* Main */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-4xl">{emoji}</span>
        <div>
          {config.show_condition && (
            <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">{weather.condition.label_th}</p>
          )}
          {config.show_temperature && (
            <p className="text-2xl font-bold text-sky-900 dark:text-white">{weather.temperature}°C</p>
          )}
        </div>
      </div>

      {/* Fields */}
      {visibleFields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visibleFields
            .filter((f) => f.key !== 'show_temperature')
            .map((f) => (
              <div
                key={f.key}
                className="flex items-center gap-1 bg-white/60 dark:bg-sky-900/40 rounded-lg px-2 py-1 text-xs text-sky-800 dark:text-sky-200"
              >
                {f.icon}
                <span>{f.label}</span>
              </div>
            ))}
        </div>
      )}

      {/* Updated at */}
      <p className="text-[10px] text-sky-500 dark:text-sky-400 mt-2">
        {t('weather.updated')}: {new Date(weather.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
        {data.cached && <span className="ml-1 opacity-60">({t('weather.cached')})</span>}
      </p>
    </div>
  );
}