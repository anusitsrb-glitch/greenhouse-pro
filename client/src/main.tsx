import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// ✅ Service Worker: เปิดเฉพาะ Production (Railway)
// ✅ Dev: ถ้าเคยมี SW ค้าง ให้ถอนออก กัน cache หลอน
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
