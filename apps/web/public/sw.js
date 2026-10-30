/* Sportexus PWA Service Worker.
 * Cache static shell and brand assets only.
 * NEVER cache /v1 API, /version.json, /sw.js, cookies, or authenticated HTML.
 */
const VERSION = 'sportexus-shell-v2';
const PRECACHE = ['/offline', '/manifest.webmanifest', '/icon', '/apple-icon'];

self.addEventListener('install', (event) => {
  // Pre-cache core offline assets.
  // DO NOT call self.skipWaiting() here — allow existing pages to finish their workflows.
  // skipWaiting will only be called when the user confirms the update prompt.
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE)),
  );
});

self.addEventListener('activate', (event) => {
  // Clean up older caches
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))),
      ),
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith('/v1') || url.pathname.includes('/v1/');
}

function isBypassedAsset(url) {
  // Never cache version metadata or service worker file itself
  return (
    url.pathname === '/version.json' ||
    url.pathname === '/sw.js' ||
    isApiRequest(url)
  );
}

function isStaticAsset(url) {
  if (isBypassedAsset(url)) {
    return false;
  }
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/icon' ||
    url.pathname === '/apple-icon' ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg')
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-only for API, version manifest, and SW
  if (isBypassedAsset(url)) {
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(VERSION);
        return (await cache.match('/offline')) || new Response('Offline', { status: 503 });
      }),
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
