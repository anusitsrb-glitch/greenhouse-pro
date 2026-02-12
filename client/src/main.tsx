import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logEnvironmentInfo, ENV } from './config/env';

// ✨ เพิ่ม Capacitor plugins
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// ✅ Log environment BEFORE render
logEnvironmentInfo();

// ✨ Initialize Capacitor plugins (mobile only)
if (ENV.IS_CAPACITOR) {
  // ✨ FIX: ปิด StatusBar overlay เพื่อให้ content ไม่ถูกทับ
  StatusBar.setOverlaysWebView({ overlay: false }).catch(console.error);
  // Configure status bar
  StatusBar.setBackgroundColor({ color: '#22c55e' }).catch(console.error);
  StatusBar.setStyle({ style: Style.Dark }).catch(console.error);
  
  // Hide splash screen after app loads
  window.addEventListener('load', () => {
    setTimeout(() => {
      SplashScreen.hide().catch(console.error);
    }, 2000);
  });
}

// ✅ Service Worker: เปิดเฉพาะ Production
if ('serviceWorker' in navigator) {
  if (import.meta.env?.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  }
}

// ✅ Render only ONCE
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);