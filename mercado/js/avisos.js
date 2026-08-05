/*
 * Avisos que precisam ALCANCAR quem decide, em vez de esperar a pessoa abrir o
 * modulo certo. Hoje isso e o feriado chegando sem escala montada.
 *
 * Duas camadas, porque uma so nao cobre:
 *   1. Faixa no painel — aparece para dono e lider assim que o app abre.
 *   2. Notificacao do celular — chega mesmo com o app fechado no fundo.
 *
 * Limite honesto do PWA: sem servidor de push, a notificacao e disparada pelo
 * proprio app. Ela sai quando o aparelho abre o app (ou volta para ele), nao de
 * madrugada com o celular no bolso. Como o app abre todo dia no mercado, o aviso
 * de 7 dias chega com folga — mas nao e a mesma coisa que um alarme, e a faixa
 * do painel existe justamente para o recado nao depender so disso.
 */
import { Dados, Prefs } from './dados.js?v=202608051921';
import * as D from './dominio.js?v=202608051921';
import { h, toast } from './ui.js?v=202608051921';
import { feriadosSemEscala, AVISO_FERIADO } from './modulos2.js?v=202608051921';

/** Quem monta escala e quem recebe a cobranca: dono e lider. */
const cobraEscala = () => D.Acesso.dono() || D.Acesso.lider();

const suportaNotificacao = () => 'Notification' in window && 'serviceWorker' in navigator;

/**
 * Faixa no topo do painel. Some sozinha quando a escala e montada — nao tem
 * botao de "ok, entendi", porque o problema nao e o aviso, e o feriado sem escala.
 */
export function faixaDeAvisos(ir) {
  if (!cobraEscala()) return null;
  const pendentes = feriadosSemEscala(AVISO_FERIADO);
  if (!pendentes.length) return null;

  const f = pendentes[0];
  const texto = f.dias === 0 ? 'HOJE e ' + f.nome + ' e ninguem foi escalado.'
    : '⚠ ' + f.nome + ' em ' + f.dias + ' dia(s) ('
      + D.diaSemana(f.data) + ', ' + D.data(f.data) + ') e a escala nao foi montada.'
      + (pendentes.length > 1 ? '  +' + (pendentes.length - 1) + ' outro(s) feriado(s).' : '');

  return h('div', {
    class: 'conexao',
    estilo: {
      background: 'rgba(255,255,255,.22)', borderRadius: '12px', padding: '10px 12px',
      cursor: 'pointer', display: 'block', color: '#fff', fontSize: '12px',
      lineHeight: '1.35', marginTop: '10px', fontWeight: '600'
    },
    onclick: () => ir('escala-feriado', { data: f.data })
  }, texto + '\nToque para dizer quem folga e quem vem.');
}

/**
 * Pedir permissao precisa vir de um toque: Safari e Chrome ignoram (ou negam de
 * vez) requestPermission chamado sozinho ao carregar a pagina.
 */
export function botaoAtivarAvisos() {
  if (!cobraEscala() || !suportaNotificacao()) return null;
  if (Notification.permission === 'granted') return null;
  if (Notification.permission === 'denied') {
    return h('div', { class: 'aviso-instalar' },
      '🔕 Os avisos deste app estao bloqueados no navegador. Para receber o feriado '
      + 'no celular, libere as notificacoes nos ajustes do site.');
  }
  return h('div', {
    class: 'aviso-instalar',
    estilo: { cursor: 'pointer', fontWeight: '700', color: '#2E7D32' },
    onclick: async () => {
      const r = await Notification.requestPermission();
      toast(r === 'granted'
        ? 'Avisos ligados. Voce sera avisado 7 dias antes de cada feriado.'
        : 'Sem permissao o aviso continua so dentro do app.');
      if (r === 'granted') conferirAvisos();
    }
  }, '🔔  Receber os avisos de feriado no celular');
}

/** Uma notificacao por feriado por dia — o aviso e para lembrar, nao para irritar. */
const jaAvisou = chave => Prefs.get('aviso:' + chave) === D.hoje();
const marcarAvisado = chave => Prefs.set('aviso:' + chave, D.hoje());

/**
 * Confere o que esta pendente e manda para o celular. Chamado quando o app abre,
 * quando ele volta para a frente e de tempos em tempos com a tela ligada.
 */
export async function conferirAvisos() {
  if (!cobraEscala() || !suportaNotificacao()) return;
  if (Notification.permission !== 'granted') return;

  let reg;
  try {
    reg = await navigator.serviceWorker.ready;
  } catch (e) {
    return;   // sem service worker nao da para mostrar notificacao no iPhone
  }

  for (const f of feriadosSemEscala(AVISO_FERIADO)) {
    const chave = 'feriado:' + f.data;
    if (jaAvisou(chave)) continue;
    marcarAvisado(chave);
    try {
      await reg.showNotification('Feriado sem escala', {
        body: f.nome + ' e ' + (f.dias === 0 ? 'hoje' : 'em ' + f.dias + ' dia(s)')
          + '. Ninguem foi escalado ainda: diga quem folga e quem vem.',
        icon: 'icons/icone-180.png',
        badge: 'icons/icone-180.png',
        tag: chave,
        data: { tela: 'escala-feriado', dataFeriado: f.data },
        requireInteraction: false
      });
    } catch (e) {
      console.warn('nao consegui mostrar a notificacao', e);
    }
  }
}

/** Liga o ciclo: ao abrir, ao voltar para a tela e a cada 30 minutos. */
export function iniciarAvisos() {
  const conferir = () => {
    if (document.visibilityState !== 'visible') return;
    conferirAvisos();
  };
  setTimeout(conferir, 3000);
  setInterval(conferir, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', conferir);
}
