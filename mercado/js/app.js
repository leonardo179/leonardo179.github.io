/*
 * Mercado Gestor — versao PWA (funciona no iPhone e no Android pelo navegador).
 * Mesma loja, mesmos dados e mesmas regras do aplicativo Android.
 */
import { Dados, Prefs, Sync } from './dados.js?v=202608051829';
import * as D from './dominio.js?v=202608051829';
import { h, cabecalho, cartao, campo, area, lista, marcador, barra, vazio, aviso, toast, confirmar, subtitulo } from './ui.js?v=202608051829';
import { semear } from './semente.js?v=202608051829';
import * as M from './modulos.js?v=202608051829';
import * as M2 from './modulos2.js?v=202608051829';
import { instalarTelasExtra } from './telas-extra.js?v=202608051829';
import { instalarEncartes } from './encartes.js?v=202608051829';
import { popularDemo, limparDemo, contarDemo } from './demo.js?v=202608051829';
import { instalarDashboard } from './dashboard.js?v=202608051829';
import { faixaDeAvisos, botaoAtivarAvisos, iniciarAvisos } from './avisos.js?v=202608051829';

const app = document.getElementById('app');

// ------------------------------------------------------------------ roteador

const telas = {};
export function registrar(nome, fn) { telas[nome] = fn; }

// A pilha espelha o historico do navegador so com o NOME das telas. E ela que faz
// o voltar sair mesmo da tela atual, em vez de repetir o passo que a pessoa acabou
// de dar (salvar, filtrar, trocar de aba) — isso tudo troca a tela no lugar.
let pilha = [];

const telaDe = hash => (hash || '').replace('#', '').split('?')[0] || 'painel';

export function ir(nome, params = {}) {
  const q = new URLSearchParams(params).toString();
  const alvo = '#' + nome + (q ? '?' + q : '');
  const atual = telaDe(location.hash);

  // Continuar na mesma tela (outro filtro, outra aba) nao vira passo de historico.
  if (nome === atual) {
    if (location.hash === alvo) render();
    else location.replace(alvo);
    return;
  }
  // Ir para a tela de onde viemos e voltar, nao avancar.
  if (pilha.length > 1 && pilha[pilha.length - 2] === nome) {
    history.back();
    return;
  }
  location.hash = alvo;
}

export function voltar() {
  if (pilha.length > 1) history.back();
  else ir('painel');
}

function render() {
  const [nome, query] = location.hash.replace('#', '').split('?');
  sincronizarPilha(nome || 'painel');
  const params = Object.fromEntries(new URLSearchParams(query || ''));
  const tela = telas[nome] || telas.painel;

  Dados.carregar();
  Prefs.carregar();

  // Sem ninguem logado, so existe a tela de entrada.
  if (!Prefs.logado() || !D.Acesso.usuario()) {
    app.replaceChildren(telaLogin());
    return;
  }
  app.replaceChildren(tela(params));
}

/** Mantem a pilha igual ao historico, inclusive quando a pessoa usa o voltar do aparelho. */
function sincronizarPilha(nome) {
  if (pilha[pilha.length - 1] === nome) return;
  if (pilha[pilha.length - 2] === nome) pilha.pop();
  else pilha.push(nome);
}

window.addEventListener('hashchange', render);

// --------------------------------------------------------------------- login

/**
 * Uma tela de entrada so: usuario, senha e — enquanto a loja nao tem dono —
 * o botao de criar a primeira conta.
 *
 * A busca dos cadastros da loja acontece sozinha, sem botao e sem recado: um
 * aparelho novo nao precisa saber que existe um "sincronizar" para conseguir
 * entrar. Se os usuarios chegarem, a tela se redesenha e o login funciona.
 */
function telaLogin() {
  buscarCadastrosEmSilencio();
  return telaEntrar();
}

let buscando = false;
function buscarCadastrosEmSilencio() {
  if (buscando || !Prefs.lojaConectada()) return;
  buscando = true;
  setTimeout(async () => {
    await Sync.executar();
    Dados.carregar();
    buscando = false;
    if (!Prefs.logado() && Dados.d.usuarios.some(u => !u.excluido && u.ativo)) render();
  }, 50);
}

function telaCriarLoja() {
  const loja = campo('Nome da loja');
  const nome = campo('Seu nome');
  const login = campo('Usuario para entrar (ex: joao)');
  const senha = campo('Senha', '', { type: 'password' });
  const senha2 = campo('Repita a senha', '', { type: 'password' });
  const erro = aviso('', '#D32F2F');
  erro.style.display = 'none';

  const mostrar = m => { erro.textContent = m; erro.style.display = 'block'; };

  async function criar() {
    const usuario = D.normalizarLogin(login.input.value);
    if (!loja.input.value.trim() || !nome.input.value.trim() || !usuario) {
      return mostrar('Preencha o nome da loja, o seu nome e o usuario.');
    }
    if (senha.input.value.length < 4) return mostrar('A senha precisa de pelo menos 4 caracteres.');
    if (senha.input.value !== senha2.input.value) return mostrar('As duas senhas nao sao iguais.');

    const dono = Dados.novo({
      nome: nome.input.value.trim(), login: usuario, perfil: D.PERFIL.DONO,
      setor: 'CAIXA', cargo: 'Dono', ativo: true, trocarSenha: false, ultimoAcesso: Date.now()
    });
    await D.definirSenha(dono, senha.input.value);
    Dados.gravar('usuarios', dono, dono.nome);

    // O endereco da loja ja vem no app; aqui so guardamos o nome que aparece na tela.
    Prefs.set('nomeLoja', loja.input.value.trim());
    Prefs.entrar(dono);

    if (!Prefs.get('semeado')) { semear(dono.nome); Prefs.set('semeado', true); }
    toast('Conta criada. Bem-vindo, ' + dono.nome + '.');
    ir('painel');
    render();
  }

  return h('div', {}, [
    cabecalho({ titulo: '🛒 Criar a conta da loja', sub: 'A primeira conta e a do dono',
      voltar: () => render() }),
    h('main', {}, [
      aviso('Ninguem cadastrado ainda. A conta que voce criar agora sera a de DONO: '
        + 'ela enxerga a loja inteira e cadastra o restante da equipe (lideres de setor '
        + 'e funcionarios), cada um com a propria senha.'),
      loja.el, nome.el, login.el, senha.el, senha2.el,
      erro
    ]),
    barra([{ texto: 'Criar conta e entrar', onclick: criar }])
  ]);
}

function telaEntrar() {
  const login = campo('Usuario');
  const senha = campo('Senha', '', { type: 'password' });
  const erro = aviso('', '#D32F2F');
  erro.style.display = 'none';

  async function entrar() {
    const alvo = D.normalizarLogin(login.input.value);
    const u = Dados.d.usuarios.find(x => !x.excluido && x.ativo && x.login === alvo);
    if (!u || !(await D.senhaConfere(u, senha.input.value))) {
      erro.textContent = 'Usuario ou senha nao conferem.';
      erro.style.display = 'block';
      return;
    }
    u.ultimoAcesso = Date.now();
    Dados.gravar('usuarios', u, u.nome);
    Prefs.entrar(u);
    toast('Ola, ' + u.nome + '.');
    ir('painel');
    render();
  }

  // Enquanto a loja nao tem dono, a unica outra coisa que cabe nesta tela e
  // criar a primeira conta. Depois disso o botao some sozinho.
  const temDono = Dados.d.usuarios.some(u => !u.excluido && u.ativo && u.perfil === D.PERFIL.DONO);

  return h('div', {}, [
    cabecalho({ titulo: '🛒 Mercado Gestor',
      sub: Prefs.get('nomeLoja') || Prefs.get('loja') || 'Entre com seu usuario' }),
    h('main', {}, [login.el, senha.el, erro]),
    barra([
      { texto: 'Entrar', onclick: entrar },
      temDono ? null : { texto: 'Criar conta', classe: 'cinza',
        onclick: () => app.replaceChildren(telaCriarLoja()) }
    ])
  ]);
}

// -------------------------------------------------------------------- painel

registrar('painel', () => {
  const a = D.Acesso;
  const hoje = D.hoje();

  const validades = Dados.ativos('produtos')
    .filter(p => !p.resolvido && a.veSetor(p.setor) && D.diasAte(p.validade) <= D.DIAS_AVISO);
  const urgentes = validades.filter(p => D.diasAte(p.validade) <= D.DIAS_URGENTE).length;
  const pendencias = M.contarPendencias();

  const cab = cabecalho({
    titulo: '🛒 Mercado Gestor',
    sub: (Prefs.get('nomeLoja') || Prefs.get('loja') || 'Loja') + '  •  ' + a.nome() + ' - ' + a.rotuloPerfil(),
    acao: { texto: '⚙', onclick: () => ir('ajustes') }
  });

  cab.append(h('div', { estilo: { width: '100%' } }));
  const feitos = M.contarRealizados();
  const resumo = h('div', {}, [
    h('div', { class: 'resumo' }, [
      h('div', { onclick: () => ir('validades', { filtro: 'janela' }) },
        [h('b', {}, validades.length), h('span', {}, 'vencendo em 30d')]),
      h('div', { onclick: () => ir('validades', { filtro: 'urgentes' }) },
        [h('b', { estilo: { color: '#FFCDD2' } }, urgentes), h('span', {}, 'urgentes / vencidos')]),
      h('div', { onclick: () => ir('pendencias') },
        [h('b', { estilo: { color: '#FFE0B2' } }, pendencias.length), h('span', {}, 'tarefas em aberto')])
    ]),
    // O outro lado da moeda: o que a equipe JA fez hoje.
    h('div', { class: 'resumo', estilo: { marginTop: '6px' } }, [
      h('div', { onclick: () => ir('realizados', { aba: 'tarefas' }) },
        [h('b', { estilo: { color: '#C5E1A5' } }, feitos.tarefas),
         h('span', {}, 'tarefas realizadas')]),
      h('div', { onclick: () => ir('realizados', { aba: 'checklists' }) },
        [h('b', { estilo: { color: '#B3E5FC' } }, feitos.itens),
         h('span', {}, 'itens marcados hoje')]),
      // Falta na gondola some do corredor se ninguem ve: fica no painel do dono.
      h('div', { onclick: () => ir('ruptura') },
        [h('b', { estilo: { color: '#FFCDD2' } }, M2.contarFaltas()),
         h('span', {}, 'faltas na gondola')])
    ])
  ]);

  // Nada de status nem botao de atualizar: o app se vira sozinho. So aparece
  // alguma coisa aqui quando ha problema de verdade — e ai e um alerta, nao um botao.
  const conexao = avisoDeProblema();

  // O cabecalho do painel carrega resumo e conexao dentro dele.
  const bloco = h('div', { estilo: { flex: '1' } }, []);
  cab.replaceChildren(h('div', { estilo: { width: '100%' } }, [
    h('div', { class: 'linha' }, [
      h('h1', { estilo: { flex: '1' } }, '🛒 Mercado Gestor'),
      h('div', { class: 'acao', onclick: () => ir('ajustes') }, '⚙')
    ]),
    h('div', { class: 'sub' }, (Prefs.get('nomeLoja') || Prefs.get('loja') || 'Loja') + '  •  ' + a.nome() + ' - ' + a.rotuloPerfil()),
    resumo, faixaDeAvisos(ir), conexao
  ]));

  const mods = [];
  const mod = (icone, titulo, sub, selo, cor, destino) => mods.push(
    h('div', { class: 'modulo', onclick: () => ir(destino) }, [
      h('div', { class: 'ic' }, icone),
      selo ? h('span', { class: 'selo', estilo: { background: cor } }, selo) : null,
      h('h3', { texto: titulo }), h('p', { texto: sub })
    ]));

  mod('📅', 'Validades', validades.length + ' na janela de 30 dias',
    urgentes ? urgentes + ' urgente' : null, '#D32F2F', 'validades');

  const checklists = Dados.ativos('checklists').filter(c => c.ativo && a.veSetor(c.setor));
  const clAbertos = checklists.filter(c => {
    const r = Dados.ativos('respostas').find(x => x.checklistId === c.id && x.data === hoje);
    return !r || !r.concluido;
  }).length;
  mod('✅', 'Checklists', checklists.length + ' setores configurados',
    clAbertos ? clAbertos + ' hoje' : null, '#F57C00', 'checklists');

  const rotinas = M.rotinasDeHoje();
  const atrasadas = rotinas.filter(r => M.statusRotina(r).chave === 'ATRASADA').length;
  mod('🕒', 'Cronograma', rotinas.length + ' tarefas hoje',
    atrasadas ? atrasadas + ' atrasada' : null, '#D32F2F', 'cronograma');

  const entregas = Dados.ativos('entregas').filter(e => e.data === hoje);
  const naFila = entregas.filter(e => e.situacao === 'NA_FILA' || e.situacao === 'EM_ROTA');
  const urg = naFila.filter(e => e.urgente).length;
  mod('🚚', 'Entregas', naFila.length + ' na fila  •  ' + entregas.length + ' hoje',
    urg ? '🔴 ' + urg + ' urgente' : null, '#D32F2F', 'entregas');

  const semana = Dados.ativos('quebras')
    .filter(q => a.veSetor(q.setor) && a.vePessoa('', q.autor) && D.diasAte(q.data) >= -7);
  const prejuizo = semana.reduce((s, q) => s + M.prejuizo(q), 0);
  mod('🗑', 'Quebras e descarte',
    a.vePerdas() ? D.moeda(prejuizo) + ' nos ultimos 7 dias' : semana.length + ' registros',
    null, '#6D4C41', 'quebras');

  const equips = Dados.ativos('equipamentos').filter(e => e.ativo && a.veSetor(e.setor));
  const fora = M.leiturasForaDaFaixa();
  mod('🌡', 'Temperatura', equips.length + ' equipamentos',
    fora ? fora + ' fora da faixa' : null, '#D32F2F', 'temperatura');

  mod('📦', 'Estoque e paletes',
    Dados.ativos('paletes').filter(p => a.veSetor(p.setor)).length + ' posicoes mapeadas',
    null, '#455A64', 'estoque');

  mod('🖼', 'Encartes', Dados.ativos('encartes').length + ' encarte(s)',
    null, '#8D5A2B', 'encartes');

  const contagensNovas = Dados.ativos('contagens')
    .filter(c => c.concluida && !c.vistaPeloGestor && a.veTrabalhoDosOutros()).length;
  mod('🧮', 'Contagem de estoque', Dados.ativos('contagens').length + ' contagens',
    contagensNovas ? contagensNovas + ' nova' : null, '#2E7D32', 'contagem');

  // O que interessa no menu e quanto da lista ainda esta sem preco anotado.
  const semPreco = Dados.ativos('cesta')
    .filter(c => c.ativo !== false && !(c.precoConcorrente > 0)).length;
  mod('🔎', 'Preco do concorrente',
    Dados.ativos('cesta').filter(c => c.ativo !== false).length + ' produtos na lista',
    semPreco ? semPreco + ' sem preco' : null, '#0277BD', 'precos');

  const rupturasAbertas = Dados.ativos('rupturas')
    .filter(r => r.situacao !== 'RESOLVIDA' && a.veSetor(r.setor)).length;
  mod('🕳', 'Gondola vazia', rupturasAbertas + ' falta(s) em aberto',
    rupturasAbertas ? String(rupturasAbertas) : null, '#D32F2F', 'ruptura');

  // Item largado no caixa e tarefa da frente de caixa: quem cuida de outro setor
  // nao recolhe nada e so recebia ruido no menu.
  if (a.veDesistencias()) {
    const paraRecolher = Dados.ativos('desistencias').filter(d => !d.recolhido).length;
    mod('🛒', 'Desistencias no caixa', paraRecolher + ' item(ns) para recolher',
      paraRecolher ? String(paraRecolher) : null, '#D32F2F', 'desistencias');
  }

  // Escala o funcionario ve (precisa saber o proprio horario), mas nao mexe.
  mod('👥', 'Escala e equipe',
    Dados.ativos('funcionarios').filter(f => f.ativo !== false).length + ' pessoas cadastradas',
    M2.feriadosSemEscala().length ? '⚠ feriado' : null, '#F57C00', 'escala');

  // O dono entra e ve a loja inteira num lugar so.
  if (a.dono()) {
    mod('📊', 'Painel do dono', 'Graficos dos ultimos 30 dias', null, '#0277BD', 'dashboard');
  }

  // Pontuacao propria o funcionario ve; o ranking dos outros so chefe.
  mod('🏆', 'Desempenho',
    a.veTrabalhoDosOutros() ? 'Ranking e pontos da equipe' : 'Seus pontos',
    null, '#F9A825', 'desempenho');

  if (a.gerenciaUsuarios()) {
    mod('👤', 'Usuarios', Dados.ativos('usuarios').filter(u => u.ativo).length + ' conta(s)',
      null, '#455A64', 'usuarios');
  }
  if (a.configuraLoja()) {
    mod('🏷', 'Setores', D.setoresAtivos().length + ' setores da loja',
      null, '#00897B', 'setores');
  }
  mod('⚙', a.configuraLoja() ? 'Ajustes' : 'Minha conta',
    a.configuraLoja() ? 'Conta, avisos e conexao da loja' : 'Sua senha e sua sessao',
    null, '#455A64', 'ajustes');

  return h('div', {}, [
    cab,
    h('main', {}, [
      h('div', { class: 'grade' }, mods),
      botaoAtivarAvisos(),
      instalarDica(),
      h('div', { class: 'vazio', estilo: { fontSize: '11px', padding: '18px' } },
        'Com a loja conectada, o que a equipe registra aparece aqui na hora.')
    ])
  ]);
});

function estadoConexao() {
  if (!Prefs.lojaConectada()) return 'desligado';
  if (!navigator.onLine) return 'sem-internet';
  return Sync.estado === 'sem-internet' ? 'sem-internet' : 'ao-vivo';
}

/**
 * Quando esta tudo certo, a tela nao fala nada sobre conexao — o app so funciona.
 * Aviso so quando o dado NAO esta chegando em ninguem, que e quando o usuario
 * precisa saber.
 */
function avisoDeProblema() {
  const estado = estadoConexao();
  if (estado === 'ao-vivo') return null;

  const desligado = estado === 'desligado';
  const texto = desligado
    ? '⚠ Este aparelho nao esta ligado a loja: o que voce registrar fica so aqui e '
      + 'ninguem mais ve. ' + (D.Acesso.dono()
        ? 'Toque para ligar em Ajustes.' : 'Avise o dono.')
    : '📴 Sem internet agora. Pode continuar registrando — sobe sozinho quando o sinal voltar.';

  return h('div', {
    class: 'conexao',
    estilo: {
      background: 'rgba(255,255,255,.16)', borderRadius: '12px', padding: '10px 12px',
      cursor: desligado && D.Acesso.dono() ? 'pointer' : 'default', display: 'block',
      color: '#fff', fontSize: '12px', lineHeight: '1.35'
    },
    onclick: desligado && D.Acesso.dono() ? () => ir('ajustes') : null
  }, texto);
}

/**
 * No iPhone o app so vira icone pelo menu Compartilhar do Safari — e, detalhe
 * importante, o icone instalado tem armazenamento SEPARADO do Safari. Por isso
 * o aviso deixa claro que a conta precisa ser criada dentro do app instalado
 * (ou que a loja precisa estar conectada para o cadastro atravessar).
 */
function instalarDica() {
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return null;
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!iOS) {
    return h('div', { class: 'aviso-instalar' },
      '📲 Para virar aplicativo: menu do navegador → "Instalar aplicativo" / '
      + '"Adicionar a tela inicial".');
  }
  return h('div', { class: 'aviso-instalar', estilo: { borderLeft: '4px solid #F57C00' } },
    '📲 Voce esta no Safari. Para virar aplicativo: Compartilhar → "Adicionar a Tela de Inicio".\n\n'
    + '⚠ Atencao: no iPhone o icone instalado guarda os dados separado do Safari. '
    + 'Depois de instalar, abra pelo icone e conecte na loja (ou crie a conta por la) — '
    + 'senao vai parecer que o cadastro sumiu.');
}

// ------------------------------------------------------------------- ajustes

registrar('ajustes', () => {
  const a = D.Acesso;
  const u = a.usuario();
  const loja = campo('Codigo da loja (ex: mercado-central)', Prefs.get('loja'));
  const pin = campo('Senha da loja', Prefs.get('pin'));
  const url = campo('Endereco da loja (planilha do Google ou sync.php)', Prefs.get('url'));
  const status = aviso('', Prefs.lojaConectada() ? '#2E7D32' : '#757575');
  // A chave do Gemini fica so neste aparelho — nunca entra no JSON sincronizado
  // com a loja, entao cada celular/computador que for gerar encarte com IA
  // precisa colar a sua propria.
  const geminiKey = campo('Chave da API Gemini (opcional, so pra gerar encarte com IA)',
    Prefs.get('geminiKey'), { type: 'password' });

  function atualizarStatus() {
    if (!Prefs.lojaConectada()) {
      status.textContent = 'Loja nao conectada — os dados ficam so neste aparelho.';
      return;
    }
    const ultima = Prefs.get('ultimaSync', 0);
    const min = Math.floor((Date.now() - ultima) / 60000);
    status.textContent = 'Loja ' + Prefs.get('loja') + ' — '
      + (!ultima ? 'conectando...' : (min < 2 ? 'tudo em dia' : 'atualizado ha ' + min + ' min')) + '.';
  }
  atualizarStatus();

  function salvar() {
    if (a.configuraLoja()) {
      Prefs.set('loja', loja.input.value.trim());
      Prefs.set('pin', pin.input.value.trim());
      Prefs.set('url', url.input.value.trim());
    }
    Prefs.set('geminiKey', geminiKey.input.value.trim());
  }

  async function trocarSenha() {
    const atual = prompt('Senha atual:');
    if (atual === null) return;
    if (!(await D.senhaConfere(u, atual))) return toast('Senha atual nao confere.');
    const nova = prompt('Nova senha (minimo 4 caracteres):');
    if (nova === null) return;
    if (nova.length < 4) return toast('Use pelo menos 4 caracteres.');
    await D.definirSenha(u, nova);
    Dados.gravar('usuarios', u, a.nome());
    toast('Senha alterada.');
  }

  return h('div', {}, [
    cabecalho({ titulo: a.configuraLoja() ? '⚙ Ajustes' : '⚙ Minha conta',
      sub: a.configuraLoja() ? 'Sua conta e a conexao da loja' : 'Sua senha e sua sessao', voltar }),
    h('main', {}, [
      h('div', { class: 'rotulo-secao' }, 'Sua conta'),
      aviso(a.nome() + '\n' + a.rotuloPerfil() + '\n' + (a.dono()
        ? 'Ve a loja inteira e configura tudo.'
        : a.lider() ? 'Ve e configura o setor ' + D.setor(a.meuSetor()).nome + '.'
          : 'Executa as tarefas do setor e ve os proprios registros.'),
        a.dono() ? '#2E7D32' : a.lider() ? '#6A1B9A' : '#455A64'),
      h('div', { class: 'aviso-instalar', onclick: trocarSenha }, '🔑  Trocar minha senha'),
      a.gerenciaUsuarios()
        ? h('div', { class: 'aviso-instalar', onclick: () => ir('usuarios') }, '👤  Usuarios da loja')
        : null,
      h('div', {
        class: 'aviso-instalar',
        onclick: () => confirmar('Sair da conta', 'Para entrar de novo e preciso usuario e senha.',
          () => { Prefs.sair(); render(); })
      }, '🚪  Sair desta conta'),

      h('div', { class: 'rotulo-secao' }, 'Encartes com IA'),
      h('div', { class: 'sub' }, 'Cole aqui a sua chave da API do Gemini pra gerar encarte '
        + 'com IA neste aparelho. Ela fica so aqui, nao vai para a loja nem para os outros '
        + 'celulares — cada aparelho usa a sua propria.'),
      geminiKey.el,

      // Endereco, codigo e senha da loja sao assunto de dono: a equipe nao precisa
      // (o app ja vem conectado) e nao deve sair repassando esses dados.
      ...(a.configuraLoja() ? [
        h('div', { class: 'rotulo-secao' }, 'Conexao da loja'),
        h('div', { class: 'sub' }, 'Com a loja conectada, o que a equipe registra aparece nos '
          + 'outros celulares sozinho, em segundos. Use os mesmos dados em todos os aparelhos — '
          + 'inclusive nos que usam o aplicativo Android.'),
        loja.el, pin.el, url.el, status,

        // Para experimentar o app sem esperar a equipe usar. Sai tudo junto depois.
        h('div', { class: 'rotulo-secao' }, 'Dados de teste'),
        h('div', { class: 'sub' }, contarDemo() + ' registro(s) de teste na loja. '
          + 'Eles ficam marcados e saem todos de uma vez, sem levar junto o que e real.'),
        h('div', { class: 'aviso-instalar', onclick: () => confirmar('Popular com dados de teste',
          'Vai criar validades, quebras, contagens, temperaturas, faltas, desistencias, '
          + 'entregas e checklists ficticios para voce experimentar. Continuar?', () => {
            const n = popularDemo(a.nome());
            toast(n + ' registros de teste criados.');
            render();
          }) }, '🧪  Popular com dados de teste'),
        contarDemo() ? h('div', { class: 'aviso-instalar', onclick: () => confirmar('Limpar dados de teste',
          'Apagar TODOS os registros de teste? O que a equipe registrou de verdade continua.', () => {
            const n = limparDemo(a.nome());
            toast(n + ' registros de teste apagados.');
            render();
          }) }, '🧹  Limpar dados de teste') : null
      ] : [
        h('div', { class: 'rotulo-secao' }, 'Loja'),
        h('div', { class: 'sub' }, 'Conectado a loja ' + (Prefs.get('nomeLoja') || Prefs.get('loja'))
          + '. A configuracao da conexao fica com o dono.')
      ])
    ]),
    barra([{ texto: 'Salvar ajustes',
      onclick: () => { salvar(); toast('Ajustes salvos.'); voltar(); } }])
  ]);
});

// ------------------------------------------------------------------ usuarios

registrar('usuarios', () => {
  const a = D.Acesso;
  if (!a.gerenciaUsuarios()) { ir('painel'); return h('div'); }

  const usuarios = Dados.ativos('usuarios')
    .filter(u => u.ativo && (a.dono() || a.veSetor(u.setor)))
    .sort((x, y) => {
      const p = u => u.perfil === D.PERFIL.DONO ? 0 : u.perfil === D.PERFIL.LIDER ? 1 : 2;
      return p(x) - p(y) || x.nome.localeCompare(y.nome);
    });

  const podeMexer = u => a.dono()
    || (a.lider() && u.perfil === D.PERFIL.FUNCIONARIO && a.veSetor(u.setor));

  const cartoes = usuarios.map(u => {
    const cor = u.perfil === D.PERFIL.DONO ? '#2E7D32'
      : u.perfil === D.PERFIL.LIDER ? '#6A1B9A' : D.setor(u.setor).cor;
    const eu = u.id === Prefs.get('usuarioId');
    return cartao({
      cor,
      icone: u.perfil === D.PERFIL.DONO ? '👑' : u.perfil === D.PERFIL.LIDER ? '⭐' : '👤',
      titulo: u.nome + (eu ? '  (voce)' : ''),
      sub: '@' + u.login + '  •  ' + rotuloPerfil(u) + (u.cargo ? '  •  ' + u.cargo : ''),
      extra: D.setoresDe(u).length > 1
        ? 'Setores: ' + D.setoresDe(u).map(x => D.setor(x).nome).join(', ') : null,
      extra: u.trocarSenha ? 'Senha resetada — ele escolhe uma nova ao entrar.'
        : (u.ultimoAcesso ? 'Ultimo acesso: ' + D.data(new Date(u.ultimoAcesso).toISOString().slice(0, 10))
          : 'Ainda nao entrou no app'),
      selo: { texto: u.perfil === D.PERFIL.DONO ? 'DONO' : u.perfil === D.PERFIL.LIDER ? 'LIDER' : 'EQUIPE', cor },
      botoes: podeMexer(u) ? [
        { texto: 'Editar', onclick: () => formUsuario(u) },
        { texto: 'Resetar senha', sec: true, onclick: () => resetarSenha(u) },
        !eu ? { texto: 'Remover', sec: true, onclick: () => removerUsuario(u) } : null
      ] : null
    });
  });

  return h('div', {}, [
    cabecalho({ titulo: '👤 Usuarios', sub: usuarios.length + ' conta(s) de acesso', voltar }),
    h('main', {}, cartoes.length ? cartoes : [vazio('Nenhum usuario cadastrado.')]),
    h('button', { class: 'fab', onclick: () => formUsuario(null) }, 'Novo usuario')
  ]);
});

function rotuloPerfil(u) {
  if (u.perfil === D.PERFIL.DONO) return 'Dono / Gestor';
  const onde = D.setoresDe(u).map(s => D.setor(s).nome).join(', ') || 'sem setor';
  return (u.perfil === D.PERFIL.LIDER ? 'Lider de ' : 'Funcionario - ') + onde;
}

function formUsuario(existente) {
  const a = D.Acesso;
  const u = existente || Dados.novo({
    nome: '', login: '', cargo: '', perfil: D.PERFIL.FUNCIONARIO,
    setor: a.dono() ? 'MERCEARIA' : a.meuSetor(), ativo: true, trocarSenha: false, ultimoAcesso: 0
  });

  const nome = campo('Nome', u.nome);
  const login = campo('Usuario para entrar', u.login);
  const cargo = campo('Cargo (repositor, acougueiro, caixa...)', u.cargo);
  const perfis = a.dono()
    ? [{ valor: D.PERFIL.DONO, texto: 'Dono / Gestor' },
       { valor: D.PERFIL.LIDER, texto: 'Lider de setor' },
       { valor: D.PERFIL.FUNCIONARIO, texto: 'Funcionario' }]
    : [{ valor: D.PERFIL.FUNCIONARIO, texto: 'Funcionario' }];
  const perfil = lista('Papel no app', perfis, u.perfil);
  // Varios setores por pessoa: o repositor pode cuidar de matinais e doces ao
  // mesmo tempo. Guardamos a lista e tambem o primeiro em 'setor', para o app
  // Android (que so entende um) continuar funcionando.
  // Usuario novo comeca sem setor marcado: quem cadastra escolhe.
  const marcados = new Set(existente ? D.setoresDe(u) : []);
  const caixaSetores = h('div', {});
  const podeEscolher = a.dono();
  D.setoresAtivos().forEach(st => {
    const m = marcador(st.icone + '  ' + st.nome, marcados.has(st.chave));
    m.input.disabled = !podeEscolher;
    m.input.addEventListener('change', () => {
      if (m.input.checked) marcados.add(st.chave); else marcados.delete(st.chave);
    });
    caixaSetores.append(m.el);
  });
  const setorSel = {
    el: h('div', {}, [
      h('label', { texto: 'Setores que essa pessoa cuida' }),
      podeEscolher ? null : h('div', { class: 'sub' },
        'Como lider, voce cadastra no seu proprio setor.'),
      caixaSetores
    ])
  };
  const senha = existente ? null : campo('Senha inicial', '', { type: 'password' });

  async function salvar() {
    const alvo = D.normalizarLogin(login.input.value);
    if (!nome.input.value.trim() || !alvo) return toast('Nome e usuario sao obrigatorios.');
    const conflito = Dados.d.usuarios.find(x => !x.excluido && x.ativo && x.login === alvo && x.id !== u.id);
    if (conflito) return toast('Ja existe alguem com o usuario "' + alvo + '".');
    if (!existente) {
      if (senha.input.value.length < 4) return toast('A senha inicial precisa de 4 caracteres ou mais.');
      await D.definirSenha(u, senha.input.value);
    }
    u.nome = nome.input.value.trim();
    u.login = alvo;
    u.cargo = cargo.input.value.trim();
    u.perfil = a.dono() ? perfil.input.value : D.PERFIL.FUNCIONARIO;
    const escolhidos = a.dono() ? Array.from(marcados) : a.meusSetores();
    if (!escolhidos.length) return toast('Escolha pelo menos um setor.');
    u.setores = escolhidos;
    u.setor = escolhidos[0];   // compatibilidade com o app Android
    Dados.gravar('usuarios', u, D.Acesso.nome());
    toast(existente ? 'Usuario atualizado.' : 'Usuario criado. Ele entra com "' + u.login + '".');
    render();
  }

  app.replaceChildren(h('div', {}, [
    cabecalho({ titulo: existente ? '👤 ' + u.nome : '👤 Novo usuario',
      sub: 'Acesso, papel e setor', voltar: () => { ir('usuarios'); render(); } }),
    h('main', {}, [
      nome.el, login.el, cargo.el, perfil.el, setorSel.el, senha ? senha.el : null,
      aviso(a.dono()
        ? 'Lider enxerga e configura so o setor dele. Funcionario executa, sem ver valores '
          + 'nem o trabalho dos colegas.'
        : 'Como lider, voce cadastra funcionarios do setor ' + D.setor(a.meuSetor()).nome + '.',
        '#455A64')
    ]),
    barra([{ texto: 'Salvar', onclick: salvar }])
  ]));
}

async function resetarSenha(u) {
  const nova = prompt('Senha provisoria para ' + u.nome + ':');
  if (nova === null) return;
  if (nova.length < 4) return toast('Use pelo menos 4 caracteres.');
  await D.definirSenha(u, nova);
  u.trocarSenha = true;
  Dados.gravar('usuarios', u, D.Acesso.nome());
  toast('Senha provisoria definida.');
  render();
}

function removerUsuario(u) {
  if (!D.Acesso.dono()) {
    confirmar('Desativar acesso', u.nome + ' nao entra mais no app. O historico continua.', () => {
      u.ativo = false;
      Dados.gravar('usuarios', u, D.Acesso.nome());
      render();
    });
    return;
  }
  const escolha = prompt('Remover ' + u.nome + ':\n1 = desativar (mantem o historico)\n'
    + '2 = excluir o cadastro de vez\n\nDigite 1 ou 2:');
  if (escolha === '1') {
    u.ativo = false;
    Dados.gravar('usuarios', u, D.Acesso.nome());
    toast(u.nome + ' nao entra mais no app.');
    render();
  } else if (escolha === '2') {
    Dados.excluir('usuarios', u, D.Acesso.nome());
    toast('Cadastro excluido.');
    render();
  }
}

// --------------------------------------------------------------------- saida

M.instalarModulos({ registrar, ir, voltar, render });
M2.instalarModulos2({ registrar, ir, voltar, render });
instalarTelasExtra({ registrar, ir, voltar, render });
instalarDashboard({ registrar, ir, voltar, render });
instalarEncartes({ registrar, ir, voltar, render });

Dados.carregar();
Prefs.carregar();
Sync.iniciarCiclo();
/*
 * Chegou dado novo da loja: redesenha a tela para o dono ver na hora.
 *
 * Menos quando tem formulario aberto (a barra de botoes embaixo denuncia isso):
 * redesenhar no meio de um cadastro apagaria o que a pessoa esta digitando.
 * Nesse caso o dado fica guardado e aparece assim que ela terminar.
 */
Sync.aoAtualizar(() => {
  Dados.carregar();
  if (document.querySelector('.barra')) return;
  render();
});
if (Prefs.lojaConectada()) Sync.executar();
render();
iniciarAvisos();

/*
 * Registro do service worker com updateViaCache: 'none'.
 *
 * Sem isso o navegador pode servir um sw.js guardado no cache HTTP e o celular
 * fica preso numa versao antiga do app por horas. Com 'none', ele sempre confere
 * o arquivo de verdade no servidor; e a cada carga pedimos update() explicito.
 */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then(reg => {
      reg.update();
      // Versao nova pronta: assume o controle e recarrega uma vez so.
      reg.addEventListener('updatefound', () => {
        const novo = reg.installing;
        if (!novo) return;
        novo.addEventListener('statechange', () => {
          if (novo.state === 'activated' && !sessionStorage.getItem('recarregado')) {
            sessionStorage.setItem('recarregado', '1');
            location.reload();
          }
        });
      });
    })
    .catch(e => console.warn('sw', e));
}
