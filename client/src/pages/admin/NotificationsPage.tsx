import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input } from '@/components/ui';
import { adminApi, LineNotifyConfig } from '@/lib/adminApi';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { Bell, Send, Save, Eye, EyeOff, AlertTriangle, Thermometer, Droplets, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NotificationsPage() {
  const { addToast } = useToast();
  const { t } = useT();
  const [config, setConfig] = useState<LineNotifyConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [newToken, setNewToken] = useState('');

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getLineNotifyConfig();
      setConfig(data);
    } catch {
      addToast({ type: 'error', message: t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await adminApi.updateLineNotifyConfig({ ...config, token: newToken || undefined });
      addToast({ type: 'success', message: t('admin.notif.saveSuccess') });
      setNewToken('');
      fetchConfig();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      await adminApi.testLineNotify();
      addToast({ type: 'success', message: t('admin.notif.testSuccess') });
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading || !config) {
    return (
      <AdminLayout title={t('admin.notifications')}>
        <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t('admin.notifications')} subtitle={t('admin.notif.subtitle')}>
      <div className="max-w-3xl space-y-6">

        {/* Main Toggle */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', config.enabled ? 'bg-green-100' : 'bg-gray-100')}>
                  <Bell className={cn('w-6 h-6', config.enabled ? 'text-green-600' : 'text-gray-400')} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('admin.notif.lineNotify')}</h3>
                  <p className="text-sm text-gray-500">{t('admin.notif.lineNotifyDesc')}</p>
                </div>
              </div>
              <button
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className={cn('relative w-14 h-8 rounded-full transition-colors', config.enabled ? 'bg-green-500' : 'bg-gray-300')}
              >
                <span className={cn('absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow', config.enabled ? 'left-7' : 'left-1')} />
              </button>
            </div>
          </div>
        </Card>

        {/* Token Settings */}
        <Card>
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('admin.notif.tokenSection')}</h3>

            {config.tokenMasked && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('admin.notif.currentToken')} <span className="font-mono">{config.tokenMasked}</span>
                </p>
              </div>
            )}

            <div className="relative">
              <Input
                label={t('admin.notif.newToken')}
                type={showToken ? 'text' : 'password'}
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder={config.tokenMasked ? t('admin.notif.tokenUnchanged') : t('admin.notif.tokenPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>{t('admin.notif.tokenHowTo')}</strong><br />
                {t('admin.notif.tokenStep1')}<br />
                {t('admin.notif.tokenStep2')}<br />
                {t('admin.notif.tokenStep3')}<br />
                {t('admin.notif.tokenStep4')}<br />
                {t('admin.notif.tokenStep5')}
              </p>
            </div>
          </div>
        </Card>

        {/* Alert Types */}
        <Card>
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('admin.notif.alertTypes')}</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 border dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="checkbox"
                  checked={config.alertOnOffline}
                  onChange={(e) => setConfig({ ...config, alertOnOffline: e.target.checked })}
                  className="w-4 h-4 text-primary rounded"
                />
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{t('admin.notif.alertOffline')}</p>
                  <p className="text-sm text-gray-500">{t('admin.notif.alertOfflineDesc')}</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="checkbox"
                  checked={config.alertOnThreshold}
                  onChange={(e) => setConfig({ ...config, alertOnThreshold: e.target.checked })}
                  className="w-4 h-4 text-primary rounded"
                />
                <Thermometer className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{t('admin.notif.alertThreshold')}</p>
                  <p className="text-sm text-gray-500">{t('admin.notif.alertThresholdDesc')}</p>
                </div>
              </label>
            </div>
          </div>
        </Card>

        {/* Thresholds */}
        {config.alertOnThreshold && (
          <Card>
            <div className="p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('admin.notif.thresholds')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Thermometer className="w-4 h-4" />
                    <span className="font-medium">{t('admin.notif.tempLabel')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label={t('admin.notif.min')} type="number" value={config.thresholds.temp_min}
                      onChange={(e) => setConfig({ ...config, thresholds: { ...config.thresholds, temp_min: parseFloat(e.target.value) } })} />
                    <Input label={t('admin.notif.max')} type="number" value={config.thresholds.temp_max}
                      onChange={(e) => setConfig({ ...config, thresholds: { ...config.thresholds, temp_max: parseFloat(e.target.value) } })} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Droplets className="w-4 h-4" />
                    <span className="font-medium">{t('admin.notif.humidityLabel')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label={t('admin.notif.min')} type="number" value={config.thresholds.humidity_min}
                      onChange={(e) => setConfig({ ...config, thresholds: { ...config.thresholds, humidity_min: parseFloat(e.target.value) } })} />
                    <Input label={t('admin.notif.max')} type="number" value={config.thresholds.humidity_max}
                      onChange={(e) => setConfig({ ...config, thresholds: { ...config.thresholds, humidity_max: parseFloat(e.target.value) } })} />
                  </div>
                </div>

                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Sprout className="w-4 h-4" />
                    <span className="font-medium">{t('admin.notif.soilLabel')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label={t('admin.notif.min')} type="number" value={config.thresholds.soil_moisture_min}
                      onChange={(e) => setConfig({ ...config, thresholds: { ...config.thresholds, soil_moisture_min: parseFloat(e.target.value) } })} />
                    <Input label={t('admin.notif.max')} type="number" value={config.thresholds.soil_moisture_max}
                      onChange={(e) => setConfig({ ...config, thresholds: { ...config.thresholds, soil_moisture_max: parseFloat(e.target.value) } })} />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleTest} variant="outline" isLoading={isTesting} disabled={!config.tokenMasked && !newToken}>
            <Send className="w-4 h-4" />
            {t('admin.notif.testBtn')}
          </Button>
          <Button onClick={handleSave} isLoading={isSaving} className="flex-1">
            <Save className="w-4 h-4" />
            {t('admin.notif.saveBtn')}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}