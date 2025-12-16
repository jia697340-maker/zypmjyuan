// Service Worker for 章鱼喷墨机 PWA
// 每次更新时修改这个版本号，强制更新缓存
const CACHE_VERSION = '4';
const CACHE_NAME = `zhangyu-pwa-v${CACHE_VERSION}`;
const urlsToCache = [
  './',
  './index.html',
  'https://unpkg.com/dexie/dist/dexie.js',
  'https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js'
];

// 安装 Service Worker
self.addEventListener('install', event => {
  console.log(`Service Worker v${CACHE_VERSION} 安装中...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('缓存已打开');
        return cache.addAll(urlsToCache).catch(err => {
          console.error('缓存失败:', err);
        });
      })
  );
  // 立即激活新的 Service Worker，不等待
  self.skipWaiting();
});

// 激活 Service Worker
self.addEventListener('activate', event => {
  console.log(`Service Worker v${CACHE_VERSION} 激活中...`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 立即控制所有页面，包括当前页面
      return self.clients.claim();
    }).then(() => {
      // 通知所有客户端刷新页面
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION
          });
        });
      });
    })
  );
});

// 拦截请求 - 使用网络优先策略（确保总是获取最新内容）
self.addEventListener('fetch', event => {
  // 跳过非 GET 请求
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  
  // 对于 HTML 文件，强制使用网络优先，添加时间戳防止缓存
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request.url + '?t=' + Date.now(), {
        cache: 'no-store'
      })
        .then(response => {
          // 更新缓存
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络失败时才使用缓存
          return caches.match(event.request);
        })
    );
    return;
  }

  // 其他资源使用网络优先策略
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 如果网络请求成功，克隆响应并更新缓存
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // 网络请求失败，尝试从缓存获取
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 如果缓存也没有，返回离线页面或错误
          return new Response('网络连接失败，请检查网络设置', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain; charset=utf-8'
            })
          });
        });
      })
  );
});
