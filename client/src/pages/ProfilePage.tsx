import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { User, Lock, Globe, Palette, Eye, EyeOff, Check, X } from 'lucide-react';





export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    level: string;
    feedback: string[];
  } | null>(null);

  // Preferences form
  const [preferences, setPreferences] = useState({
    language: user?.language || 'th',
    theme: user?.theme || 'light',
  });

  useEffect(() => {
    if (user) {
      setPreferences({
        language: user.language || 'th',
        theme: user.theme || 'light',
      });
    }
  }, [user]);

  // Check password strength
  useEffect(() => {
    const checkStrength = async () => {
      if (passwordForm.newPassword.length >= 4) {
        try {
          const response = await api.post<any>('/password/strength', {
            password: passwordForm.newPassword,
          });
          if (response.success && response.data) {
            setPasswordStrength(response.data);
          }
        } catch {}
      } else {
        setPasswordStrength(null);
      }
    };

    const timer = setTimeout(checkStrength, 300);
    return () => clearTimeout(timer);
  }, [passwordForm.newPassword]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast({ type: 'error', message: 'รหัสผ่านใหม่ไม่ตรงกัน' });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      addToast({ type: 'error', message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/password/change', passwordForm);
      if (response.success) {
        addToast({ type: 'success', message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordForm(false);
      }
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setIsLoading(true);
    try {
      const response = await api.put('/auth/preferences', preferences);
      if (response.success) {
        addToast({ type: 'success', message: 'บันทึกการตั้งค่าสำเร็จ' });
        refreshUser();
        
        // Apply theme
        if (preferences.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthColor = (level: string) => {
    switch (level) {
      case 'weak': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'strong': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadmin': return <Badge variant="error">Super Admin</Badge>;
      case 'admin': return <Badge variant="primary">Admin</Badge>;
      case 'operator': return <Badge variant="success">Operator</Badge>;
      default: return <Badge variant="secondary">Viewer</Badge>;
    }
  };

  if (!user) return null;

  return (
    <PageContainer title="โปรไฟล์" subtitle="จัดการข้อมูลส่วนตัวและการตั้งค่า">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* User Info Card */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{user.username}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {getRoleBadge(user.role)}
                  {user.email && <span className="text-sm text-gray-500">{user.email}</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">เข้าสู่ระบบล่าสุด:</span>
                <p className="font-medium">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('th-TH') : '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">สร้างเมื่อ:</span>
                <p className="font-medium">{user.createdAt ? new Date(user.createdAt).toLocaleString('th-TH') : '-'}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Change Password Card */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold">เปลี่ยนรหัสผ่าน</h3>
              </div>
              {!showPasswordForm && (
                <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(true)}>
                  เปลี่ยนรหัสผ่าน
                </Button>
              )}
            </div>

            {showPasswordForm && (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="relative">
                  <Input
                    label="รหัสผ่านปัจจุบัน"
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  >
                    {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="relative">
                  <Input
                    label="รหัสผ่านใหม่"
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {passwordStrength && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${getStrengthColor(passwordStrength.level)}`}
                          style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {passwordStrength.level === 'weak' && 'อ่อน'}
                        {passwordStrength.level === 'medium' && 'ปานกลาง'}
                        {passwordStrength.level === 'strong' && 'แข็งแรง'}
                      </span>
                    </div>
                    {passwordStrength.feedback.length > 0 && (
                      <ul className="text-xs text-gray-500 space-y-1">
                        {passwordStrength.feedback.map((f, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <X className="w-3 h-3 text-red-500" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="relative">
                  <Input
                    label="ยืนยันรหัสผ่านใหม่"
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword && (
                    <Check className="absolute right-10 top-9 w-4 h-4 text-green-500" />
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowPasswordForm(false)}>
                    ยกเลิก
                  </Button>
                  <Button type="submit" isLoading={isLoading}>
                    เปลี่ยนรหัสผ่าน
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Card>

        {/* Preferences Card */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold">การตั้งค่าส่วนตัว</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Globe className="w-4 h-4 inline mr-1" />
                  ภาษา
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'th', label: '🇹🇭 ไทย' },
                    { value: 'en', label: '🇺🇸 English' },
                    { value: 'mm', label: '🇲🇲 မြန်မာ' },
                  ].map((lang) => (
                    <button
                      key={lang.value}
                      type="button"
                      onClick={() => setPreferences({ ...preferences, language: lang.value })}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        preferences.language === lang.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Palette className="w-4 h-4 inline mr-1" />
                  ธีม
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'light', label: '☀️ สว่าง' },
                    { value: 'dark', label: '🌙 มืด' },
                    { value: 'system', label: '💻 ตามระบบ' },
                  ].map((theme) => (
                    <button
                      key={theme.value}
                      type="button"
                      onClick={() => setPreferences({ ...preferences, theme: theme.value })}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        preferences.theme === theme.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleSavePreferences} isLoading={isLoading}>
                บันทึกการตั้งค่า
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
