import { api } from '../services/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if Push Notifications are supported by browser
 */
export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get current push subscription state
 */
export async function getPushSubscription() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Subscribe user to push notifications
 */
export async function subscribeToPush() {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported by this browser.');
  }

  // 1. Request Permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permission for notifications was denied.');
  }

  // 2. Fetch public VAPID key
  const { publicKey } = await api.getPushVapidPublicKey();
  if (!publicKey) {
    throw new Error('VAPID key not configured on server.');
  }

  // 3. Register Subscription in browser
  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey
  });

  // 4. Send subscription to backend
  await api.registerPushSubscription(subscription);
  console.log('📶 Push subscription successfully registered on server');
  return subscription;
}

/**
 * Unsubscribe user from push notifications
 */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;

  const subscription = await getPushSubscription();
  if (subscription) {
    // 1. Remove from backend
    await api.unregisterPushSubscription(subscription.endpoint);

    // 2. Unsubscribe in browser
    await subscription.unsubscribe();
    console.log('📶 Push subscription successfully unregistered');
  }
}

/**
 * Sync push subscription with backend (run on app startup if already authorized)
 */
export async function syncPushSubscription() {
  if (!isPushSupported() || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Refresh subscription on server
      await api.registerPushSubscription(subscription);
    } else {
      // Re-subscribe if permission is granted but subscription got lost
      const { publicKey } = await api.getPushVapidPublicKey();
      if (publicKey) {
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
        await api.registerPushSubscription(subscription);
      }
    }
  } catch (err) {
    console.warn('Failed to sync push subscription:', err.message);
  }
}
