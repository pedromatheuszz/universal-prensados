/**
 * Universal Prensados - Service Worker
 * Versão: 1.3.0
 * Estratégia: Cache First para assets estáticos, Network First para dados dinâmicos
 */

const CACHE_NAME = 'universal-prensados-v1.4.0';
const STATIC_CACHE = 'universal-prensados-static-v1.3.0';
const DYNAMIC_CACHE = 'universal-prensados-dynamic-v1.3.0';
const IMAGE_CACHE = 'universal-prensados-images-v1.3.0';

// Assets essenciais para funcionamento offline.
// JS/CSS gerados pelo Vite têm hash no nome e entram no cache na primeira visita.
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/icon-192.png',
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Cacheando assets essenciais...');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Assets essenciais cacheados com sucesso');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Erro ao cachear assets essenciais:', error);
      })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Remover caches antigos
              return name.startsWith('universal-prensados-') && 
                     name !== STATIC_CACHE && 
                     name !== DYNAMIC_CACHE && 
                     name !== IMAGE_CACHE;
            })
            .map((name) => {
              console.log('[SW] Removendo cache antigo:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker ativado');
        return self.clients.claim();
      })
  );
});

// Interceptação de requisições (Fetch)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requisições não-HTTP/HTTPS
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // API (pedidos, cardápio) e métodos que não sejam GET nunca passam pelo cache
  if (url.pathname.startsWith('/api/') || request.method !== 'GET') {
    return;
  }

  // Ignorar requisições de extensões do navegador
  if (url.origin === 'chrome-extension' || url.origin === 'moz-extension') {
    return;
  }
  
  // Estratégia baseada no tipo de recurso
  if (isStaticAsset(request)) {
    // Cache First para assets estáticos
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else if (isImageRequest(request)) {
    // Cache First para imagens com fallback
    event.respondWith(imageCacheStrategy(request));
  } else if (isExternalResource(request)) {
    // Stale While Revalidate para recursos externos (fonts, CDN)
    event.respondWith(staleWhileRevalidateStrategy(request, DYNAMIC_CACHE));
  } else if (isNavigationRequest(request)) {
    // Network First para navegação (HTML) com fallback offline
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  } else {
    // Padrão: Network First
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  }
});

// Verificar se é asset estático (CSS, JS, manifest)
function isStaticAsset(request) {
  const url = new URL(request.url);
  return request.method === 'GET' && url.origin === self.location.origin && (
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.eot') ||
    url.pathname === '/manifest.json'
  );
}

// Verificar se é requisição de imagem
function isImageRequest(request) {
  const url = new URL(request.url);
  return request.method === 'GET' && (
    url.pathname.match(/\.(jpg|jpeg|png|gif|webp|avif|svg|ico)$/i) ||
    url.pathname.startsWith('/images/')
  );
}

// Verificar se é recurso externo (fonts, CDN)
function isExternalResource(request) {
  const url = new URL(request.url);
  return request.method === 'GET' && (
    url.origin.includes('fonts.googleapis.com') ||
    url.origin.includes('fonts.gstatic.com') ||
    url.origin.includes('cdnjs.cloudflare.com')
  );
}

// Verificar se é navegação (HTML)
function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

// Estratégia Cache First
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Erro na rede para:', request.url, error);
    throw error;
  }
}

// Estratégia para imagens com placeholder offline
async function imageCacheStrategy(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Retornar placeholder SVG para imagens offline
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect fill="#f5f0e8" width="400" height="300"/>
        <text x="200" y="150" font-family="system-ui" font-size="16" fill="#9c9489" text-anchor="middle" dominant-baseline="middle">
          📷 Imagem indisponível offline
        </text>
      </svg>`,
      {
        headers: { 'Content-Type': 'image/svg+xml' }
      }
    );
  }
}

// Estratégia Stale While Revalidate
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Fetch em background para atualizar cache
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cachedResponse); // Se falhar, usa cache
  
  // Retorna cache imediatamente se disponível, senão espera network
  return cachedResponse || fetchPromise;
}

// Estratégia Network First com fallback offline
async function networkFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Rede indisponível, tentando cache para:', request.url);
    
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback para página offline se for navegação
    if (isNavigationRequest(request)) {
      const offlineResponse = await cache.match('/index.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    // Resposta genérica de erro
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'Você está offline e este conteúdo não foi cacheado.' 
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Sincronização em background (para futuros pedidos offline)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    console.log('[SW] Sincronizando pedidos pendentes...');
    event.waitUntil(syncPendingOrders());
  }
});

async function syncPendingOrders() {
  // Implementação futura: sincronizar pedidos feitos offline
  // quando a conexão for restaurada
  console.log('[SW] Sincronização de pedidos não implementada ainda');
}

// Notificações Push (futuro)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'Nova notificação da Universal Prensados',
    icon: '/images/icon-192.png',
    badge: '/images/icon-72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Dispensar' }
    ],
    requireInteraction: true
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Universal Prensados', options)
  );
});

// Clique em notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Focar janela existente se houver
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          // Abrir nova janela
          return clients.openWindow('/');
        })
    );
  }
});

// Mensagens do cliente principal
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

console.log('[SW] Service Worker carregado:', CACHE_NAME);