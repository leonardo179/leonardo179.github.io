/*
 * O app e feito para ficar conectado e atualizando ao vivo.
 *
 * Por isso aqui e SEMPRE A REDE PRIMEIRO: toda abertura pega a versao mais nova
 * no servidor. O cache existe so como paraquedas — se o sinal cair no corredor do
 * freezer ou no deposito, a tela continua abrindo em vez de dar erro, e o que for
 * registrado sobe assim que a internet voltar.
 */
const CACHE = 'mercado-gestor-202607281711';
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
  // A conversa com a loja nunca passa por aqui: vai direto para a rede, sempre.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(resposta => {
        // Veio da rede: guarda uma copia so para o caso de o sinal cair depois.
        const copia = resposta.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return resposta;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
