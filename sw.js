// sw.js — Service Worker Digitale Solution v2
const CACHE_NAME = 'ds-pos-v2';
const STATIC_CACHE = 'ds-static-v2';

// Ressources à précacher
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap'
];

// ============================================================
// INSTALLATION
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE.filter(u => !u.startsWith('http'))))
      .then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATION — nettoyage anciens caches
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — stratégie intelligente
// ============================================================
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignorer les requêtes non-GET sauf API POST
  if (req.method !== 'GET' && !url.pathname.startsWith('/api/')) {
    return;
  }

  // Requêtes API — Network first, offline queue pour POST
  if (url.pathname.startsWith('/api/')) {
    if (req.method === 'POST') {
      event.respondWith(networkFirstWithQueue(req));
    } else {
      event.respondWith(networkFirst(req));
    }
    return;
  }

  // Google Fonts — Stale While Revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // HTML — Network first (pour avoir toujours la dernière version)
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstHtml(req));
    return;
  }

  // Autres ressources statiques — Cache first
  event.respondWith(cacheFirst(req));
});

// Network first pour API GET
async function networkFirst(request) {
  try {
    const response = await fetchWithTimeout(request, 5000);
    return response;
  } catch(e) {
    return new Response(JSON.stringify({
      success: false,
      offline: true,
      error: 'Hors ligne. Données locales utilisées.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Offline': '1' }
    });
  }
}

// Network first avec file d'attente pour POST
async function networkFirstWithQueue(request) {
  try {
    const response = await fetchWithTimeout(request.clone(), 8000);
    return response;
  } catch(e) {
    await queueRequest(request);
    return new Response(JSON.stringify({
      success: true,
      offline: true,
      message: 'Sauvegardé hors ligne. Sera synchronisé dès reconnexion.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Network first pour HTML avec fallback
async function networkFirstHtml(request) {
  try {
    const response = await fetchWithTimeout(request, 5000);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch(e) {
    const cached = await caches.match('/index.html') || await caches.match('/');
    return cached || new Response('Hors ligne', { status: 503 });
  }
}

// Cache first pour assets
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetchWithTimeout(request, 10000);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch(e) {
    return caches.match('/index.html') || new Response('', { status: 503 });
  }
}

// Stale While Revalidate pour fonts
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);
  return cached || await fetchPromise;
}

// Fetch avec timeout
function fetchWithTimeout(request, ms) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// ============================================================
// FILE D'ATTENTE HORS LIGNE (IndexedDB)
// ============================================================
async function queueRequest(request) {
  try {
    const body = await request.clone().json();
    const db = await openDB();
    const queue = await getQueue(db);
    queue.push({
      url: request.url,
      method: request.method,
      body,
      timestamp: Date.now()
    });
    await saveQueue(db, queue);
  } catch(e) {
    console.warn('[SW] Queue error:', e);
  }
}

async function getQueue(db) {
  return new Promise(resolve => {
    const tx = db.transaction('queue', 'readonly');
    const req = tx.objectStore('queue').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

async function saveQueue(db, queue) {
  return new Promise(resolve => {
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    store.clear();
    queue.forEach((item, i) => store.put(item, i));
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ds_sw_db', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('queue');
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = reject;
  });
}

// ============================================================
// BACKGROUND SYNC
// ============================================================
self.addEventListener('sync', event => {
  if (event.tag === 'ds-sync-queue') {
    event.waitUntil(flushQueue());
  }
});

async function flushQueue() {
  const db = await openDB();
  const queue = await getQueue(db);
  if (!queue.length) return;

  const failed = [];
  for (const item of queue) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body)
      });
      if (!response.ok) failed.push(item);
    } catch(e) {
      failed.push(item);
    }
  }

  await saveQueue(db, failed);

  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({
    type: 'SYNC_COMPLETE',
    synced: queue.length - failed.length,
    pending: failed.length
  }));
}

// ============================================================
// MESSAGES
// ============================================================
self.addEventListener('message', event => {
  if (event.data?.type === 'FORCE_SYNC') flushQueue();
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
