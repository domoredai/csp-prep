/*=============================================
   CSP Exam Prep — Service Worker
   Caches all study content for offline access.
   Cache-First strategy for static assets.
   =============================================*/

const CACHE_NAME = 'csp-exam-prep-v3';
const ASSETS = [
  '/',
  'index.html',
  'quiz-styles.css',
  'quiz-engine.js',
  'vocab-engine.js',
  // Weeks 1-24
  'week-01.html','week-02.html','week-03.html','week-04.html',
  'week-05.html','week-06.html','week-07.html','week-08.html',
  'week-09.html','week-10.html','week-11.html','week-12.html',
  'week-13.html','week-14.html','week-15.html','week-16.html',
  'week-17.html','week-18.html','week-19.html','week-20.html',
  'week-21.html','week-22.html','week-23.html','week-24.html',
  // Monthly exams
  'exam-month-01.html','exam-month-02.html','exam-month-03.html',
  'exam-month-04.html','exam-month-05.html','exam-month-06.html',
  // Review & glossary
  'review-wrong.html','glossary.html','vocab-flashcards.html',
  // Icons
  'icon-192.png','icon-512.png'
];

// Install: pre-cache all files
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching all assets...');
      // Cache one by one to avoid all-or-nothing failure
      return Promise.allSettled(
        ASSETS.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] Failed to cache:', url, err)
          )
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first strategy
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Return cached; if not cached, fetch from network and add to cache
      if (cached) return cached;

      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => {
        // If network fails and not cached, return a fallback
        if (e.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
