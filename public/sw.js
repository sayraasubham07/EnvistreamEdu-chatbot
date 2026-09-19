/* eslint-disable no-restricted-globals */

// Cache configuration with versioning
const CACHE_VERSION = 'sayraa-cache-v9';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const FLASH_IMAGE = '/suu-icon-512.png';

// Assets to cache for offline access (strictly unique items)
const STATIC_ASSETS = [
  FLASH_IMAGE,
  '/manifest.json',
  '/suu-icon-192.png',
  '/suu-icon-maskable-512.png',
  '/favicon.ico'
];

// Install event - caching static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      console.log('Service Worker: Caching static assets');
      const uniqueAssets = Array.from(new Set(STATIC_ASSETS));
      try {
        await cache.addAll(uniqueAssets);
      } catch (err) {
        console.warn('Service Worker cache.addAll failed, falling back to individual caching:', err);
        await Promise.all(
          uniqueAssets.map((url) => cache.add(url).catch((e) => console.warn('Failed to cache', url, e)))
        );
      }
    }).then(() => {
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          // Delete old version caches
          if (cache !== STATIC_CACHE && cache !== DYNAMIC_CACHE) {
            console.log('Service Worker: Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      // Claim clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Never intercept /api/ routes so live chat/STT calls reach the server directly
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // For HTML / Navigation requests: ALWAYS Network First
  // This prevents serving stale index.html which causes old bundle execution on first visit
  if (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    request.headers.get('accept')?.includes('text/html')
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // For same-origin static assets, use Stale-While-Revalidate
  if (url.origin === location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  } else {
    // For cross-origin requests, use Network First
    event.respondWith(networkFirst(request));
  }
});

// Stale-While-Revalidate strategy
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request, { ignoreSearch: true });

  const fetchPromise = fetch(request).then(async (response) => {
    // Only cache valid responses
    if (response && response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  }).catch(async (error) => {
    console.log('Fetch failed:', error);
    // Return cached response if network fails
    if (cachedResponse) {
      return cachedResponse;
    }
    // Fallback for navigation requests
    if (request.mode === 'navigate' || request.destination === 'document') {
      const fallback = await caches.match('/index.html') || await caches.match('/');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  });

  // Return cached response immediately, then update cache
  return cachedResponse || fetchPromise;
}

// Network First strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await caches.match(request, { ignoreSearch: true });
    if (cachedResponse) {
      return cachedResponse;
    }
    if (request.mode === 'navigate' || request.destination === 'document') {
      const fallback = await caches.match('/index.html') || await caches.match('/');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Push event - handling notifications with the "flash image"
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    data = event.data.json();
  }

  const title = data.title || 'Sayraa';
  const options = {
    body: data.body || 'New update from Sayraa!',
    icon: '/suu-icon-192.png',
    badge: '/suu-icon-192.png',
    image: FLASH_IMAGE,
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Close' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there is already a window open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background Sync for offline message sending
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Get pending messages from IndexedDB or cache
  const cache = await caches.open(DYNAMIC_CACHE);
  const pendingRequests = await cache.match('pending-messages');

  if (pendingRequests) {
    const messages = await pendingRequests.json();
    for (const message of messages) {
      try {
        await fetch(message.url, {
          method: message.method,
          headers: message.headers,
          body: JSON.stringify(message.body)
        });
      } catch (error) {
        console.log('Failed to sync message:', error);
      }
    }
  }
}

// Message handler for communication with the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = Array.from(new Set(event.data.urls || []));
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.addAll(urls).catch((err) => {
          console.warn('Dynamic cache.addAll failed:', err);
        });
      })
    );
  }
});
