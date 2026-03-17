import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { Plus, Pencil, Trash2, TrendingUp, Camera, Ruler, Leaf } from 'lucide-react';
import { useT } from '@/i18n';

interface GrowthRecord {
  id: number;
  crop_id: number;
  crop_name: string;
  record_date: string;
  height: number | null;
  leaf_count: number | null;
  health_status: 'excellent' | 'good' | 'fair' | 'poor';
  notes: string | null;
  photo_url: string | null;
  recorded_by_name: string;
}

interface Crop {
  id: number;
  name: string;
  variety: string;
  greenhouse_name: string;
  status: string;
}

type HealthStatus = 'excellent' | 'good' | 'fair' | 'poor';

export function GrowthRecordsPage() {
  const { t } = useT();
  const { addToast } = useToast();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GrowthRecord | null>(null);

  const HEALTH_CONFIG = {
    excellent: { label: t('agri.growth.health.excellent'), color: 'bg-green-100 text-green-700', icon: '🌟' },
    good: { label: t('agri.growth.health.good'), color: 'bg-blue-100 text-blue-700', icon: '😊' },
    fair: { label: t('agri.growth.health.fair'), color: 'bg-yellow-100 text-yellow-700', icon: '😐' },
    poor: { label: t('agri.growth.health.poor'), color: 'bg-red-100 text-red-700', icon: '😟' },
  };

  useEffect(() => { fetchCrops(); }, []);
  useEffect(() => { if (selectedCrop) fetchRecords(); }, [selectedCrop]);

  const fetchCrops = async () => {
    try {
      const response = await api.get<{ crops: Crop[] }>('/agriculture/crops');
      if (response.success && response.data) {
        const active = response.data.crops.filter(
          c => (c as any).status === 'planted' || (c as any).status === 'growing'
        );
        setCrops(active);
      }
    } catch {}
  };

  const fetchRecords = async () => {
    if (!selectedCrop) return;
    setIsLoading(true);
    try {
      const response = await api.get<{ records: GrowthRecord[] }>(`/agriculture/crops/${selectedCrop}/growth`);
      if (response.success && response.data) setRecords(response.data.records);
    } catch {
      addToast({ type: 'error', message: t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (record: GrowthRecord) => {
    if (!confirm(t('agri.growth.confirmDelete'))) return;
    try {
      await api.delete(`/agriculture/growth/${record.id}`);
      addToast({ type: 'success', message: t('msg.deleted') });
      fetchRecords();
    } catch {
      addToast({ type: 'error', message: t('common.error') });
    }
  };

  const getGrowthTrend = () => {
    if (records.length < 2) return null;
    const sorted = [...records].sort(
      (a, b) => new Date(a.record_date).getTime() - new Date(b.record_date).getTime()
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (first.height && last.height) {
      const growth = last.height - first.height;
      const days = Math.ceil(
        (new Date(last.record_date).getTime() - new Date(first.record_date).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return { growth, days, perDay: days > 0 ? (growth / days).toFixed(2) : 0 };
    }
    return null;
  };

  const trend = getGrowthTrend();

  return (
    <PageContainer title={t('agri.menu.growth')} subtitle={t('agri.menu.growthDesc')}>
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('agri.growth.selectCrop')}</label>
          <select value={selectedCrop} onChange={(e) => setSelectedCrop(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
            <option value="">{t('agri.growth.selectCropPlaceholder')}</option>
            {crops.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.variety && `(${c.variety})`} - {c.greenhouse_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={() => { setEditingRecord(null); setShowModal(true); }} disabled={!selectedCrop}>
            <Plus className="w-4 h-4" /> {t('agri.growth.addRecord')}
          </Button>
        </div>
      </div>

      {!selectedCrop ? (
        <Card><div className="p-8 text-center text-gray-500">{t('agri.growth.pleaseSelect')}</div></Card>
      ) : (
        <>
          {trend && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">+{trend.growth} cm</p>
                    <p className="text-sm text-gray-500">{t('agri.growth.totalGrowth')}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Ruler className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{trend.perDay} cm/{t('agri.growth.day')}</p>
                    <p className="text-sm text-gray-500">{t('agri.growth.avgRate')}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{records.length}</p>
                    <p className="text-sm text-gray-500">{t('agri.growth.recordCount')}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm">{t('agri.growth.colDate')}</th>
                    <th className="text-left px-4 py-3 text-sm">{t('agri.growth.colHeight')}</th>
                    <th className="text-left px-4 py-3 text-sm">{t('agri.growth.colLeafCount')}</th>
                    <th className="text-left px-4 py-3 text-sm">{t('agri.growth.colHealth')}</th>
                    <th className="text-left px-4 py-3 text-sm">{t('agri.label.notes')}</th>
                    <th className="text-left px-4 py-3 text-sm">{t('agri.growth.colPhoto')}</th>
                    <th className="text-left px-4 py-3 text-sm">{t('agri.growth.colRecordedBy')}</th>
                    <th className="text-right px-4 py-3 text-sm">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center">{t('common.loading')}</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">{t('agri.growth.noData')}</td></tr>
                  ) : records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 text-sm">{new Date(record.record_date).toLocaleDateString('th-TH')}</td>
                      <td className="px-4 py-3 text-sm font-medium">{record.height ? `${record.height} cm` : '-'}</td>
                      <td className="px-4 py-3 text-sm">{record.leaf_count ?? '-'}</td>
                      <td className="px-4 py-3">
                        {record.health_status && (
                          <span className={`px-2 py-1 rounded-full text-xs ${HEALTH_CONFIG[record.health_status].color}`}>
                            {HEALTH_CONFIG[record.health_status].icon} {HEALTH_CONFIG[record.health_status].label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-32 truncate">{record.notes || '-'}</td>
                      <td className="px-4 py-3">
                        {record.photo_url ? (
                          <a href={record.photo_url} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">
                            <Camera className="w-4 h-4" /> {t('agri.growth.viewPhoto')}
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">{record.recorded_by_name}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingRecord(record); setShowModal(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(record)} className="text-red-600">
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

      {showModal && (
        <GrowthModal
          cropId={selectedCrop}
          record={editingRecord}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchRecords(); }}
        />
      )}
    </PageContainer>
  );
}

function GrowthModal({ cropId, record, onClose, onSuccess }: {
  cropId: string;
  record: GrowthRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useT();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const HEALTH_CONFIG = {
    excellent: { label: t('agri.growth.health.excellent'), icon: '🌟' },
    good: { label: t('agri.growth.health.good'), icon: '😊' },
    fair: { label: t('agri.growth.health.fair'), icon: '😐' },
    poor: { label: t('agri.growth.health.poor'), icon: '😟' },
  };

  const [form, setForm] = useState<{
    record_date: string;
    height: string | number;
    leaf_count: string | number;
    health_status: HealthStatus;
    notes: string;
    photo_url: string;
  }>({
    record_date: record?.record_date || new Date().toISOString().split('T')[0],
    height: record?.height ?? '',
    leaf_count: record?.leaf_count ?? '',
    health_status: (record?.health_status as HealthStatus) || 'good',
    notes: record?.notes || '',
    photo_url: record?.photo_url || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (record) {
        await api.put(`/agriculture/growth/${record.id}`, form);
      } else {
        await api.post(`/agriculture/crops/${cropId}/growth`, form);
      }
      addToast({ type: 'success', message: t('msg.saved') });
      onSuccess();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{record ? t('agri.growth.editTitle') : t('agri.growth.addTitle')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label={t('agri.growth.colDate')} type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} required />
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('agri.growth.fieldHeight')} type="number" step="0.1" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} placeholder="15.5" />
              <Input label={t('agri.growth.fieldLeafCount')} type="number" value={form.leaf_count} onChange={(e) => setForm({ ...form, leaf_count: e.target.value })} placeholder="8" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('agri.growth.colHealth')}</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(HEALTH_CONFIG) as [HealthStatus, { label: string; icon: string }][]).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, health_status: key })}
                    className={`p-2 rounded-lg border text-center transition-colors ${form.health_status === key ? 'border-primary bg-primary/10' : 'border-gray-200'}`}
                  >
                    <span className="text-xl">{config.icon}</span>
                    <p className="text-xs mt-1">{config.label}</p>
                  </button>
                ))}
              </div>
            </div>
            <Input label={t('agri.growth.fieldPhotoUrl')} value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} placeholder="https://..." />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('agri.label.notes')}</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder={t('agri.label.notesPlaceholder')} />
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">{t('common.save')}</Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}