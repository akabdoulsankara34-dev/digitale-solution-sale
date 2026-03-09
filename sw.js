// sw.js — Service Worker Digitale Solution
const CACHE_NAME = 'ds-pos-v1';
const OFFLINE_QUEUE_KEY = 'ds_offline_queue';

// Ressources à mettre en cache immédiatement
const PRECACHE = [
  '/',
  '/index.html'
];

// ============================================================
// INSTALLATION — mise en cache initiale
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE);
    }).then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATION — nettoyage anciens caches
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — stratégie intelligente
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Requêtes API — Network first, fallback queue hors ligne
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstApi(event.request));
    return;
  }

  // Ressources statiques — Cache first
  event.respondWith(cacheFirst(event.request));
});

// Network first pour API — si hors ligne, mettre en file d'attente
async function networkFirstApi(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch(e) {
    // Hors ligne — mettre en file d'attente si c'est une écriture
    if (request.method === 'POST') {
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
    // Lecture hors ligne — retourner erreur propre
    return new Response(JSON.stringify({
      success: false,
      offline: true,
      error: 'Hors ligne. Données locales utilisées.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Cache first pour ressources statiques
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    // Mettre en cache les ressources réussies
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch(e) {
    // Retourner index.html pour navigation hors ligne
    return caches.match('/index.html');
  }
}

// ============================================================
// FILE D'ATTENTE HORS LIGNE
// ============================================================
async function queueRequest(request) {
  try {
    const body = await request.clone().json();
    const queue = await getQueue();
    queue.push({
      url: request.url,
      method: request.method,
      body,
      timestamp: Date.now()
    });
    await saveQueue(queue);
    console.log('[SW] Requête mise en file:', request.url);
  } catch(e) {
    console.warn('[SW] Impossible de mettre en file:', e);
  }
}

async function getQueue() {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction('queue', 'readonly');
    const store = tx.objectStore('queue');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

async function saveQueue(queue) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    store.clear();
    queue.forEach((item, i) => store.put(item, i));
    tx.oncomplete = resolve;
  });
}

// IndexedDB simple pour persister la file d'attente
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ds_sw_db', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('queue');
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = reject;
  });
}

// ============================================================
// SYNC EN ARRIÈRE-PLAN — quand la connexion revient
// ============================================================
self.addEventListener('sync', event => {
  if (event.tag === 'ds-sync-queue') {
    event.waitUntil(flushQueue());
  }
});

async function flushQueue() {
  const queue = await getQueue();
  if (!queue.length) return;

  console.log('[SW] Flush de', queue.length, 'requêtes en attente...');
  const failed = [];

  for (const item of queue) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body)
      });
      if (!response.ok) failed.push(item);
      else console.log('[SW] ✅ Sync:', item.url);
    } catch(e) {
      failed.push(item); // Encore hors ligne
    }
  }

  await saveQueue(failed);

  // Notifier l'app que la sync est terminée
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      synced: queue.length - failed.length,
      pending: failed.length
    });
  });
}

// ============================================================
// MESSAGE depuis l'app — forcer sync manuelle
// ============================================================
self.addEventListener('message', event => {
  if (event.data?.type === 'FORCE_SYNC') {
    flushQueue();
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
