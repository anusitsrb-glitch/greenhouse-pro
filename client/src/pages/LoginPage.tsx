import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

function PremiumLeafLogo({ className = 'w-16 h-16' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* soft glow */}
      <div className="absolute -inset-2 rounded-[22px] bg-emerald-500/15 blur-xl" />
      {/* icon badge */}
      <div className="relative h-full w-full rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg ring-1 ring-black/5 flex items-center justify-center">
        <svg
          viewBox="0 0 128 128"
          className="w-9 h-9"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="GreenHouse Pro"
        >
          <defs>
            <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.78" />
            </linearGradient>
          </defs>

          {/* leaf (minimal + balanced) */}
          <g fill="none" stroke="url(#stroke)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
            {/* outer */}
            <path d="M64 24c-20 12-34 33-34 54 0 24 16 40 34 40s34-16 34-40c0-21-14-42-34-54Z" />
            {/* vein */}
            <path d="M64 42v58" opacity="0.55" />
            {/* subtle side veins */}
            <path d="M64 64c11-7 20-11 29-13" opacity="0.28" />
            <path d="M64 78c-11-7-20-11-29-13" opacity="0.22" />
          </g>
        </svg>

        {/* highlight corner */}
        <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
      </div>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Remember username (เหมือนที่คุณเคยใช้)
  useEffect(() => {
    const savedUser = localStorage.getItem('gh_remember_user');
    if (savedUser) {
      setUsername(savedUser);
      setRemember(true);
    }
  }, []);

 const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('กรุณากรอกชื่อผู้ใช้');
      return;
    }
    if (!password) {
      setError('กรุณากรอกรหัสผ่าน');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('🔵 Calling login...'); // debug
      const success = await login(username.trim(), password);
      console.log('🟢 Login result:', success); // debug

      if (success) {
        console.log('✅ Login success!'); // debug
        
        if (remember) localStorage.setItem('gh_remember_user', username.trim());
        else localStorage.removeItem('gh_remember_user');

        console.log('🚀 Redirecting to /'); // debug
        
        // ✅ ใช้ window.location.href แทน navigate (force full page reload)
        window.location.href = '/';
        
        // หรือถ้าอยากใช้ navigate ให้ใส่ replace: true
        // navigate('/', { replace: true });
      } else {
        console.log('❌ Login failed'); // debug
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (err) {
      console.error('🔴 Login error:', err);
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isSubmitting || isLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <PremiumLeafLogo className="w-16 h-16" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900">GreenHouse Pro</h1>
          <p className="text-gray-500 mt-2">ระบบจัดการโรงเรือนอัจฉริยะ </p>
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-xl rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-xl">เข้าสู่ระบบ</CardTitle>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-200">
                  ⚠️ {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อผู้ใช้
                </label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="กรอกชื่อผู้ใช้"
                  autoComplete="username"
                  disabled={busy}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รหัสผ่าน
                </label>

                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่าน"
                    autoComplete="current-password"
                    disabled={busy}
                    className="pr-10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    disabled={busy}
                  />
                  จำฉันไว้ในระบบ
                </label>

                <span className="text-green-600 hover:underline cursor-pointer">
                  
                </span>
              </div>

              <Button type="submit" className="w-full rounded-xl h-11" disabled={busy}>
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังเข้าสู่ระบบ...
                  </span>
                ) : (
                  'เข้าสู่ระบบ'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-400 mt-8">
          GreenHouse Pro V2
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
