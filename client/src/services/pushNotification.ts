import { PushNotifications } from '@capacitor/push-notifications';
import { ENV, getPlatform, getApiUrl } from '@/config/env';

async function registerTokenWithServer(token: string): Promise<void> {
  const platform = getPlatform();
  try {
    const res = await fetch(getApiUrl('/api/notifications/register-token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, platform }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    localStorage.setItem('fcm_token', token); // ✅ เก็บไว้ใช้ตอน unregister
    console.log('✅ FCM token registered with server');
  } catch (err) {
    console.error('❌ Failed to register FCM token:', err);
  }
}

export async function initPushNotifications(): Promise<void> {
  if (!ENV.IS_CAPACITOR) return;

  try {
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('⚠️ Push notification permission denied');
      return;
    }

    await PushNotifications.register();

    await PushNotifications.addListener('registration', async (token) => {
      console.log('📱 FCM Token:', token.value);
      await registerTokenWithServer(token.value);
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('❌ Push registration error:', err);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('🔔 Push received (foreground):', notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('👆 Push tapped:', action);
    });

  } catch (err) {
    console.error('❌ initPushNotifications error:', err);
  }
}

export async function unregisterPushToken(): Promise<void> {
  if (!ENV.IS_CAPACITOR) return;

  try {
    const token = localStorage.getItem('fcm_token');
    if (!token) return;

    await fetch(getApiUrl('/api/notifications/unregister-token'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });

    localStorage.removeItem('fcm_token');
    console.log('✅ FCM token unregistered');
  } catch (err) {
    console.error('❌ Failed to unregister FCM token:', err);
  }
}