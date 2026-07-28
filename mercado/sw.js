/* Guarda o app no aparelho: abre e funciona mesmo sem internet. */
const CACHE = 'mercado-gestor-v1';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest',
  './js/app.js', './js/dados.js', './js/dominio.js', './js/modulos.js',
  './js/semente.js', './js/ui.js',
  './icons/icone-180.png', './icons/icone-192.png', './icons/icone-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ns => Promise.all(ns.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // A conversa com a loja nunca sai do cache.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
      return r;
    }).catch(() => caches.match('./index.html')))
  );
});
