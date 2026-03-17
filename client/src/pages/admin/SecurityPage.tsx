import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { Shield, History, Users, Globe, Plus, Trash2, XCircle, CheckCircle, AlertTriangle } from 'lucide-react';

interface LoginHistoryItem { id: number; user_id: number; username: string; ip_address: string; user_agent: string; status: 'success' | 'failed' | 'blocked'; created_at: string; }
interface Session { id: number; user_id: number; username: string; session_token: string; ip_address: string; user_agent: string; last_activity_at: string; expires_at: string; }
interface IPWhitelistItem { id: number; ip_address: string; description: string; created_by_name: string; created_at: string; }
interface LoginStats { totalLogins: number; successfulLogins: number; failedLogins: number; blockedAttempts: number; uniqueUsers: number; }

export function SecurityPage() {
  const { addToast } = useToast();
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<'history' | 'sessions' | 'ip'>('history');
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [loginStats, setLoginStats] = useState<LoginStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [ipWhitelist, setIpWhitelist] = useState<IPWhitelistItem[]>([]);
  const [ipEnabled, setIpEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newIp, setNewIp] = useState({ ip_address: '', description: '' });

  useEffect(() => {
    if (activeTab === 'history') { fetchLoginHistory(); fetchLoginStats(); }
    else if (activeTab === 'sessions') fetchSessions();
    else if (activeTab === 'ip') fetchIpWhitelist();
  }, [activeTab]);

  const fetchLoginHistory = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ history: LoginHistoryItem[] }>('/security/login-history');
      if (response.success && response.data) setLoginHistory(response.data.history);
    } catch {} finally { setIsLoading(false); }
  };

  const fetchLoginStats = async () => {
    try {
      const response = await api.get<{ stats: LoginStats }>('/security/login-history/stats');
      if (response.success && response.data) setLoginStats(response.data.stats);
    } catch {}
  };

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ sessions: Session[] }>('/security/sessions');
      if (response.success && response.data) setSessions(response.data.sessions);
    } catch {} finally { setIsLoading(false); }
  };

  const fetchIpWhitelist = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ whitelist: IPWhitelistItem[]; enabled: boolean }>('/security/ip-whitelist');
      if (response.success && response.data) { setIpWhitelist(response.data.whitelist); setIpEnabled(response.data.enabled); }
    } catch {} finally { setIsLoading(false); }
  };

  const handleTerminateSession = async (sessionId: number) => {
    if (!confirm(t('admin.security.terminateConfirm'))) return;
    try {
      await api.delete(`/security/sessions/${sessionId}`);
      addToast({ type: 'success', message: t('admin.security.terminateSuccess') });
      fetchSessions();
    } catch { addToast({ type: 'error', message: t('admin.security.error') }); }
  };

  const handleAddIp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/security/ip-whitelist', newIp);
      addToast({ type: 'success', message: t('admin.security.addIpSuccess') });
      setNewIp({ ip_address: '', description: '' });
      fetchIpWhitelist();
    } catch (error: any) { addToast({ type: 'error', message: error.message || t('admin.security.error') }); }
  };

  const handleRemoveIp = async (id: number) => {
    if (!confirm(t('admin.security.removeIpConfirm'))) return;
    try {
      await api.delete(`/security/ip-whitelist/${id}`);
      addToast({ type: 'success', message: t('admin.security.removeIpSuccess') });
      fetchIpWhitelist();
    } catch { addToast({ type: 'error', message: t('admin.security.error') }); }
  };

  const handleToggleIpWhitelist = async () => {
    try {
      await api.put('/security/ip-whitelist/toggle', { enabled: !ipEnabled });
      setIpEnabled(!ipEnabled);
      addToast({ type: 'success', message: ipEnabled ? t('admin.security.toggleOffSuccess') : t('admin.security.toggleOnSuccess') });
    } catch { addToast({ type: 'error', message: t('admin.security.error') }); }
  };

  return (
    <AdminLayout title="Security" subtitle={t('admin.security.subtitle')}>
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button variant={activeTab === 'history' ? 'primary' : 'outline'} onClick={() => setActiveTab('history')}>
          <History className="w-4 h-4" /> {t('admin.security.tabHistory')}
        </Button>
        <Button variant={activeTab === 'sessions' ? 'primary' : 'outline'} onClick={() => setActiveTab('sessions')}>
          <Users className="w-4 h-4" /> {t('admin.security.tabSessions')}
        </Button>
        <Button variant={activeTab === 'ip' ? 'primary' : 'outline'} onClick={() => setActiveTab('ip')}>
          <Globe className="w-4 h-4" /> {t('admin.security.tabIp')}
        </Button>
      </div>

      {/* Login History Tab */}
      {activeTab === 'history' && (
        <>
          {loginStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <Card className="p-4">
                <p className="text-2xl font-bold dark:text-gray-100">{loginStats.totalLogins}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.security.statTotal')}</p>
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold text-green-600">{loginStats.successfulLogins}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.security.statSuccess')}</p>
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold text-red-600">{loginStats.failedLogins}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.security.statFailed')}</p>
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold text-orange-600">{loginStats.blockedAttempts}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.security.statBlocked')}</p>
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold dark:text-gray-100">{loginStats.uniqueUsers}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.security.statUsers')}</p>
              </Card>
            </div>
          )}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.security.colTime')}</th>
                    <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.security.colUser')}</th>
                    <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.security.colIp')}</th>
                    <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.security.colStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {isLoading ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center dark:text-gray-400">{t('common.loading')}</td></tr>
                  ) : loginHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm dark:text-gray-300">{new Date(item.created_at).toLocaleString('th-TH')}</td>
                      <td className="px-4 py-3 text-sm font-medium dark:text-gray-100">{item.username}</td>
                      <td className="px-4 py-3 text-sm font-mono dark:text-gray-300">{item.ip_address}</td>
                      <td className="px-4 py-3">
                        {item.status === 'success' && <Badge variant="success"><CheckCircle className="w-3 h-3" /> {t('admin.security.statusSuccess')}</Badge>}
                        {item.status === 'failed' && <Badge variant="error"><XCircle className="w-3 h-3" /> {t('admin.security.statusFailed')}</Badge>}
                        {item.status === 'blocked' && <Badge variant="warning"><AlertTriangle className="w-3 h-3" /> {t('admin.security.statusBlocked')}</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.security.colUser')}</th>
                  <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.security.colIp')}</th>
                  <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.security.colLastActive')}</th>
                  <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.security.colExpires')}</th>
                  <th className="text-right px-4 py-3 text-sm dark:text-gray-300">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center dark:text-gray-400">{t('common.loading')}</td></tr>
                ) : sessions.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{t('admin.security.noSession')}</td></tr>
                ) : sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm font-medium dark:text-gray-100">{session.username}</td>
                    <td className="px-4 py-3 text-sm font-mono dark:text-gray-300">{session.ip_address}</td>
                    <td className="px-4 py-3 text-sm dark:text-gray-300">{new Date(session.last_activity_at).toLocaleString('th-TH')}</td>
                    <td className="px-4 py-3 text-sm dark:text-gray-300">{new Date(session.expires_at).toLocaleString('th-TH')}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleTerminateSession(session.id)} className="text-red-600">
                        <XCircle className="w-4 h-4" /> {t('admin.security.terminateBtn')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* IP Whitelist Tab */}
      {activeTab === 'ip' && (
        <>
          <Card className="p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold dark:text-gray-100">{t('admin.security.ipWhitelist')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.security.ipWhitelistDesc')}</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm dark:text-gray-300">{ipEnabled ? t('admin.security.ipEnabled') : t('admin.security.ipDisabled')}</span>
                <button onClick={handleToggleIpWhitelist} className={`w-12 h-6 rounded-full transition-colors ${ipEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${ipEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </label>
            </div>
            {ipEnabled && <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">{t('admin.security.ipWarning')}</p>}
          </Card>

          <Card className="p-4 mb-6">
            <h4 className="font-medium mb-3 dark:text-gray-100">{t('admin.security.addIp')}</h4>
            <form onSubmit={handleAddIp} className="flex gap-4">
              <Input
                placeholder={t('admin.security.ipPlaceholder')}
                value={newIp.ip_address}
                onChange={(e) => setNewIp({ ...newIp, ip_address: e.target.value })}
                required
                className="flex-1"
              />
              <Input
                placeholder={t('admin.security.ipDescPlaceholder')}
                value={newIp.description}
                onChange={(e) => setNewIp({ ...newIp, description: e.target.value })}
                className="flex-1"
              />
              <Button type="submit"><Plus className="w-4 h-4" /> {t('admin.security.addIp')}</Button>
            </form>
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm dark:text-gray-300">IP Address</th>
                    <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.security.colDescription')}</th>
                    <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.security.colAddedBy')}</th>
                    <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.security.colDate')}</th>
                    <th className="text-right px-4 py-3 text-sm dark:text-gray-300">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {isLoading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center dark:text-gray-400">{t('common.loading')}</td></tr>
                  ) : ipWhitelist.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{t('admin.security.noIp')}</td></tr>
                  ) : ipWhitelist.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-mono dark:text-gray-300">{item.ip_address}</td>
                      <td className="px-4 py-3 text-sm dark:text-gray-300">{item.description || '-'}</td>
                      <td className="px-4 py-3 text-sm dark:text-gray-300">{item.created_by_name}</td>
                      <td className="px-4 py-3 text-sm dark:text-gray-300">{new Date(item.created_at).toLocaleString('th-TH')}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveIp(item.id)} className="text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </AdminLayout>
  );
}