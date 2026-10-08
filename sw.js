/**
 * DompetQu - Service Worker
 * Caches core app shell for fast startup and offline support.
 */

const CACHE_NAME = 'dompetqu-v1.5.5';
const CORE_ASSETS = [
  './',
  './index.html',
  './login.html',
  './register.html',
  './forgot-password.html',
  './404.html',
  './manifest.json',
  './manifest.webmanifest',
  './css/variables.css',
  './css/style.css',
  './css/components.css',
  './css/responsive.css',
  './js/utils.js',
  './js/firebase-config.js',
  './js/auth.js',
  './js/pundi.js',
  './js/transaction.js',
  './js/category.js',
  './js/goals.js',
  './js/reports.js',
  './js/settings.js',
  './js/charts.js',
  './js/notifications.js',
  './js/validation.js',
  './js/dashboard.js',
  './js/app.js',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './assets/favicon/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip Firebase APIs and external analytics from offline cache bypass
  if (url.origin.includes('firestore.googleapis.com') || url.origin.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  // Stale-While-Revalidate strategy for static resources
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If network fails and cached response is null, fallback for HTML navigation
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});
