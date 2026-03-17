import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Badge } from '@/components/ui';
import { adminApi } from '@/lib/adminApi';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { Database, Shield, Clock, Server, Download, RefreshCw } from 'lucide-react';

export function SettingsPage() {
  const { addToast } = useToast();
  const { t } = useT();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getSettings();
      setSettings(data);
    } catch (error) {
      addToast({ type: 'error', message: t('admin.settings.loadError') });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  return (
    <AdminLayout title={t('admin.settings')} subtitle={t('admin.settings.subtitle')}>
      <div className="max-w-3xl space-y-6">
        {/* System Info */}
        <Card>
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-gray-400" />
              {t('admin.settings.systemInfo')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.settings.version')}</p>
                <p className="text-lg font-semibold dark:text-gray-100">{settings.app_version || '1.0.0'}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.settings.nodejs')}</p>
                <p className="text-lg font-semibold dark:text-gray-100">{process.env.NODE_ENV || 'production'}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Database */}
        <Card>
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-gray-400" />
              {t('admin.settings.database')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium dark:text-gray-100">{t('admin.settings.dbMain')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.settings.dbMainDesc')}</p>
                </div>
                <Badge variant="success">{t('admin.settings.connected')}</Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium dark:text-gray-100">{t('admin.settings.backup')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {settings.backup_enabled
                      ? t('admin.settings.backupEnabled')
                      : t('admin.settings.backupDisabled')}
                    {settings.backup_interval_days &&
                      ` (${t('admin.settings.backupEvery').replace('{n}', settings.backup_interval_days)})`}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4" />
                  {t('admin.settings.backupBtn')}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Security */}
        <Card>
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-gray-400" />
              {t('admin.settings.security')}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">CSRF Protection</span>
                <Badge variant="success">{t('admin.settings.backupEnabled')}</Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">Rate Limiting</span>
                <Badge variant="success">{t('admin.settings.backupEnabled')}</Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">{t('admin.settings.sessionTimeout')}</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{t('admin.settings.sessionTimeoutValue')}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">Password Hashing</span>
                <Badge variant="success">bcrypt</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Audit Log Info */}
        <Card>
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              {t('admin.settings.auditLog')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('admin.settings.auditLogDesc')}
            </p>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                💡 <strong>Tip:</strong> {t('admin.settings.auditLogTip')}
              </p>
            </div>
          </div>
        </Card>

        {/* Refresh */}
        <Button variant="outline" onClick={fetchSettings} isLoading={isLoading}>
          <RefreshCw className="w-4 h-4" />
          {t('admin.settings.refresh')}
        </Button>
      </div>
    </AdminLayout>
  );
}