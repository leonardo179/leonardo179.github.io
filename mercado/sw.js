/*
 * O app e feito para ficar conectado e atualizando ao vivo.
 *
 * Por isso aqui e SEMPRE A REDE PRIMEIRO: toda abertura pega a versao mais nova
 * no servidor. O cache existe so como paraquedas — se o sinal cair no corredor do
 * freezer ou no deposito, a tela continua abrindo em vez de dar erro, e o que for
 * registrado sobe assim que a internet voltar.
 */
const CACHE = 'mercado-gestor-202608051829';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest',
  './js/app.js', './js/dados.js', './js/dominio.js', './js/modulos.js',
  './js/semente.js', './js/ui.js', './js/modulos2.js', './js/telas-extra.js', './js/cronograma.js',
  './js/demo.js', './js/dashboard.js', './js/avisos.js', './js/zxing-vendor.js',
  './js/encartes.js', './js/encarte-render.js', './js/temas-encarte.js', './js/modelo-gemini.js',
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

/*
 * Tocou na notificacao do feriado: em vez de abrir mais uma aba, traz para a
 * frente a janela do app que ja existe e leva direto para a tela de montar a
 * escala daquele dia.
 */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const dados = e.notification.data || {};
  const destino = dados.tela === 'escala-feriado' && dados.dataFeriado
    ? './#escala-feriado?data=' + dados.dataFeriado
    : './';

  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(janelas => {
      for (const j of janelas) {
        if ('focus' in j) {
          if ('navigate' in j) j.navigate(destino).catch(() => {});
          return j.focus();
        }
      }
      return self.clients.openWindow(destino);
    }));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // A conversa com a loja nunca passa por aqui: vai direto para a rede, sempre.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Abrir o app (navegacao) ignora ate o cache do proprio navegador: o GitHub
  // Pages manda guardar por 10 minutos, e sem isso o celular abriria a versao
  // velha depois de uma publicacao.
  const pedido = e.request.mode === 'navigate'
    ? new Request(e.request.url, { cache: 'reload', credentials: 'same-origin' })
    : e.request;

  e.respondWith(
    fetch(pedido)
      .then(resposta => {
        // Veio da rede: guarda uma copia so para o caso de o sinal cair depois.
        const copia = resposta.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return resposta;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
