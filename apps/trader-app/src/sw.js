import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Precache all assets compiled by Vite
precacheAndRoute(self.__WB_MANIFEST || []);

// Cache Google Fonts
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);

// ── API cache (cross-origin backend) ──────────────────────────────────────────
// IMPORTANT: The backend is on a different origin (onrender.com), so
// url.pathname-based matching never fires for cross-origin fetches.
// We match by origin hostname instead.

const isBackendRequest = ({ url }) =>
  url.hostname.includes('api.stockslab.live') ||
  url.hostname.includes('onrender.com') ||
  url.hostname.includes('stockslab-backend') ||
  url.pathname.startsWith('/api/');

// Instruments list: rarely changes — serve from cache instantly, refresh in background
registerRoute(
  ({ url }) => isBackendRequest({ url }) && url.pathname.includes('/instruments'),
  new StaleWhileRevalidate({
    cacheName: 'api-instruments-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 30 * 60 }), // 30 min
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);

// All other API calls: network-first, fall back to cache within 1 hour
registerRoute(
  isBackendRequest,
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);

// Immediately activate new service worker
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle push notifications
self.addEventListener('push', (event) => {
  try {
    const payload = event.data ? event.data.json() : { title: 'Stocks Lab', body: 'New alert received.' };
    const options = {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/favicon.svg',
      vibrate: [100, 50, 100],
      data: {
        url: payload.url || '/'
      }
    };
    event.waitUntil(
      self.registration.showNotification(payload.title, options)
    );
  } catch (err) {
    console.error('Push handling error:', err);
  }
});

// Handle clicking on notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate to target URL
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
