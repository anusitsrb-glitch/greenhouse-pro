import { useState, useEffect, useMemo } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { useTranslation, type Language } from '@/i18n';
import { User, Lock, Globe, Palette, Eye, EyeOff, Check, X } from 'lucide-react';

type ThemeMode = 'light' | 'dark' | 'system';

const applyTheme = (theme: ThemeMode) => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    return;
  }
  if (theme === 'light') {
    document.documentElement.classList.remove('dark');
    return;
  }
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', isDark);
};

const toLocale = (lang: Language) => {
  switch (lang) {
    case 'en':
      return 'en-US';
    case 'mm':
      return 'my-MM';
    default:
      return 'th-TH';
  }
};

export function ProfilePage() {
  // ✅ รองรับทั้งกรณี useAuth มี updateUser แล้ว และกรณียังไม่มี (ไม่พัง)
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

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
    level: 'weak' | 'medium' | 'strong' | string;
    feedback: string[];
  } | null>(null);

  const [preferences, setPreferences] = useState<{
    language: Language;
    theme: ThemeMode;
  }>({
    language: (user?.language as Language) || 'th',
    theme: (user?.theme as ThemeMode) || 'light',
  });

  // ✅ กัน useEffect ทับค่าหลัง Save: ให้ init จาก user แค่ครั้งแรก
  const [didInitPrefs, setDidInitPrefs] = useState(false);

  // ✅ ให้หน้าเปลี่ยนภาษาทันทีตามที่เลือก
  const { t } = useTranslation(preferences.language);
  const locale = useMemo(() => toLocale(preferences.language), [preferences.language]);

  // ✅ init preferences จาก user แค่ครั้งแรก (กันรีเฟรชทับค่าที่เพิ่งเซฟ)
  useEffect(() => {
    if (!user) return;
    if (didInitPrefs) return;

    setPreferences({
      language: ((user.language as Language) || 'th'),
      theme: ((user.theme as ThemeMode) || 'light'),
    });

    // ✅ apply theme ตอนเข้า page ครั้งแรกให้ตรงกับ user
    applyTheme(((user.theme as ThemeMode) || 'light'));

    setDidInitPrefs(true);
  }, [user, didInitPrefs]);

  // ✅ preview theme ทันทีตอนกดเลือก
  useEffect(() => {
    applyTheme(preferences.theme);
  }, [preferences.theme]);

  // Check password strength (debounce)
  useEffect(() => {
    const checkStrength = async () => {
      if (passwordForm.newPassword.length >= 4) {
        try {
          const response = await api.post<any>('/password/strength', {
            password: passwordForm.newPassword,
          });
          if (response.success && response.data) setPasswordStrength(response.data);
        } catch {
          // ignore
        }
      } else {
        setPasswordStrength(null);
      }
    };

    const timer = setTimeout(checkStrength, 300);
    return () => clearTimeout(timer);
  }, [passwordForm.newPassword]);

  const getStrengthColor = (level: string) => {
    switch (level) {
      case 'weak':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'strong':
        return 'bg-green-500';
      default:
        return 'bg-gray-300 dark:bg-gray-700';
    }
  };

  const getStrengthLabel = (level: string) => {
    if (level === 'weak') return t('profile.strengthWeak');
    if (level === 'medium') return t('profile.strengthMedium');
    if (level === 'strong') return t('profile.strengthStrong');
    return level;
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadmin':
        return <Badge variant="error">{t('role.superadmin')}</Badge>;
      case 'admin':
        return <Badge variant="primary">{t('role.admin')}</Badge>;
      case 'operator':
        return <Badge variant="success">{t('role.operator')}</Badge>;
      default:
        return <Badge variant="secondary">{t('role.viewer')}</Badge>;
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast({ type: 'error', message: t('profile.passwordMismatch') });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      addToast({ type: 'error', message: t('profile.passwordMin6') });
      return;
    }

    setIsLoading(true);
    try {
      // ✅ ให้ตรงกับ server ที่คุณใช้จริง: /api/auth/change-password
      const response = await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      if (response.success) {
        addToast({ type: 'success', message: t('profile.passwordChanged') });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordForm(false);
        setPasswordStrength(null);
      } else {
        addToast({ type: 'error', message: response.error || response.message || t('msg.error') });
      }
    } catch (error: any) {
      addToast({ type: 'error', message: error?.message || t('msg.error') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setIsLoading(true);

    try {
      await api.getCsrfToken();

      const response = await api.put<{ user: { language: Language; theme: ThemeMode } }>(
        '/auth/preferences',
        preferences
      );

      if (response.success && response.data?.user) {
        addToast({ type: 'success', message: t('profile.preferencesSaved') });

        // ✅ ใช้ค่าจริงจาก server เป็น source of truth
        const saved = response.data.user;

        setPreferences({
          language: saved.language,
          theme: saved.theme,
        });

        // ✅ ทำให้ “ออกหน้า/กลับมา” ยังเป็นค่าที่บันทึกแล้ว (ถ้า useAuth มี updateUser)
        if (typeof updateUser === 'function') {
          updateUser({ language: saved.language, theme: saved.theme }); // ✅ จะไม่เด้ง/ไม่ย้อนค่า
        }

        // ✅ apply theme ทันที
        applyTheme(saved.theme);
      } else {
        addToast({
          type: 'error',
          message: response.error || response.message || t('msg.error'),
        });
      }
    } catch (error: any) {
      addToast({ type: 'error', message: error?.message || t('msg.error') });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <PageContainer title={t('profile.title')} subtitle={t('profile.subtitle')}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* User Info */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{user.username}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {getRoleBadge(user.role)}
                  {user.email && <span className="text-sm text-gray-500 dark:text-gray-300">{user.email}</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-300">{t('profile.lastLogin')}</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString(locale) : '-'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-300">{t('profile.createdAt')}</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {user.createdAt ? new Date(user.createdAt).toLocaleString(locale) : '-'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Change Password */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('profile.changePassword')}
                </h3>
              </div>

              {!showPasswordForm && (
                <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(true)}>
                  {t('profile.changePassword')}
                </Button>
              )}
            </div>

            {showPasswordForm && (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="relative">
                  <Input
                    label={t('profile.currentPassword')}
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  >
                    {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="relative">
                  <Input
                    label={t('profile.newPassword')}
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {passwordStrength && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${getStrengthColor(passwordStrength.level)}`}
                          style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {getStrengthLabel(passwordStrength.level)}
                      </span>
                    </div>

                    {!!passwordStrength.feedback?.length && (
                      <ul className="text-xs text-gray-500 dark:text-gray-300 space-y-1">
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
                    label={t('profile.confirmPassword')}
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>

                  {passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword && (
                    <Check className="absolute right-10 top-9 w-4 h-4 text-green-500" />
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                      setPasswordStrength(null);
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" isLoading={isLoading}>
                    {t('profile.changePassword')}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Card>

        {/* Preferences */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('profile.preferencesTitle')}
              </h3>
            </div>

            <div className="space-y-4">
              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  <Globe className="w-4 h-4 inline mr-1" />
                  {t('profile.language')}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'th' as const, label: '🇹🇭 ไทย' },
                    { value: 'en' as const, label: '🇺🇸 English' },
                    { value: 'mm' as const, label: '🇲🇲 မြန်မာ' },
                  ].map((lang) => (
                    <button
                      key={lang.value}
                      type="button"
                      onClick={() => setPreferences({ ...preferences, language: lang.value })}
                      className={`px-4 py-2 rounded-lg border transition-colors text-sm ${
                        preferences.language === lang.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  <Palette className="w-4 h-4 inline mr-1" />
                  {t('profile.theme')}
                </label>

                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'light' as const, label: t('profile.themeLight') },
                    { value: 'dark' as const, label: t('profile.themeDark') },
                    { value: 'system' as const, label: t('profile.themeSystem') },
                  ].map((theme) => (
                    <button
                      key={theme.value}
                      type="button"
                      onClick={() => setPreferences({ ...preferences, theme: theme.value })}
                      className={`px-4 py-2 rounded-lg border transition-colors text-sm ${
                        preferences.theme === theme.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="button" onClick={handleSavePreferences} isLoading={isLoading}>
                {t('profile.savePreferences')}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
