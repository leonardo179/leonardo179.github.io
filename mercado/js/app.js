/*
 * Mercado Gestor — versao PWA (funciona no iPhone e no Android pelo navegador).
 * Mesma loja, mesmos dados e mesmas regras do aplicativo Android.
 */
import { Dados, Prefs, Sync } from './dados.js?v=202607281711';
import * as D from './dominio.js?v=202607281711';
import { h, cabecalho, cartao, campo, area, lista, marcador, barra, vazio, aviso, toast, confirmar, subtitulo } from './ui.js?v=202607281711';
import { semear } from './semente.js?v=202607281711';
import * as M from './modulos.js?v=202607281711';

const app = document.getElementById('app');

// ------------------------------------------------------------------ roteador

const telas = {};
export function registrar(nome, fn) { telas[nome] = fn; }

export function ir(nome, params = {}) {
  const q = new URLSearchParams(params).toString();
  location.hash = '#' + nome + (q ? '?' + q : '');
}

export function voltar() {
  if (history.length > 1) history.back();
  else ir('painel');
}

function render() {
  const [nome, query] = location.hash.replace('#', '').split('?');
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

window.addEventListener('hashchange', render);

// --------------------------------------------------------------------- login

function telaLogin() {
  const temDono = Dados.d.usuarios.some(u => !u.excluido && u.ativo && u.perfil === D.PERFIL.DONO);
  if (temDono) return telaEntrar();
  // Sem cadastro NESTE aparelho: pode ser loja nova ou aparelho novo de uma
  // loja que ja existe. O iPhone trata Safari e app instalado como aparelhos
  // diferentes, entao esta escolha precisa existir sempre.
  return telaPrimeiroAcesso();
}

/**
 * Aparelho novo: o app ja sabe qual e a loja, entao ele mesmo busca os cadastros
 * e cai na tela de entrar. Ninguem precisa digitar endereco.
 */
function telaPrimeiroAcesso() {
  const recado = aviso('Procurando a loja...', '#0277BD');

  // Busca sozinho assim que a tela aparece.
  setTimeout(async () => {
    const r = await Sync.executar();
    Dados.carregar();
    if (Dados.d.usuarios.some(u => !u.excluido && u.ativo)) {
      render();   // achou gente cadastrada: cai na tela de login
      return;
    }
    recado.textContent = r.ok
      ? 'Esta loja ainda nao tem ninguem cadastrado. Se voce e o dono, crie a sua conta abaixo.'
      : 'Nao consegui falar com a loja agora (' + r.msg + '). Confira a internet e tente de novo.';
  }, 50);

  return h('div', {}, [
    cabecalho({ titulo: '🛒 Mercado Gestor', sub: 'Primeiro acesso neste aparelho' }),
    h('main', {}, [
      recado,
      h('div', { class: 'aviso-instalar', onclick: async () => {
        recado.textContent = 'Procurando a loja...';
        await Sync.executar();
        Dados.carregar();
        render();
      } }, '🔄  Tentar de novo'),

      h('div', { class: 'rotulo-secao' }, 'Sou o dono e ainda nao criei minha conta'),
      h('div', { class: 'sub' }, 'A primeira conta criada e a de DONO: ela enxerga a loja '
        + 'inteira e cadastra o restante da equipe.'),
      h('div', { class: 'aviso-instalar', onclick: () => { app.replaceChildren(telaCriarLoja()); } },
        '🛒  Criar a minha conta de dono'),

      h('div', { class: 'rotulo-secao' }, 'Trocar de loja'),
      h('div', { class: 'sub' }, 'So mexa aqui se este aparelho for de outra loja.'),
      h('div', { class: 'aviso-instalar', onclick: () => ir('ajustes') },
        '⚙  Ajustar a conexao manualmente')
    ])
  ]);
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
      voltar: () => app.replaceChildren(telaPrimeiroAcesso()) }),
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

  async function buscar() {
    if (!Prefs.lojaConectada()) {
      alert('Loja nao conectada\n\nPeca ao dono o endereco e a senha da loja — ele encontra '
        + 'esses dados em Ajustes, no aparelho dele.');
      return;
    }
    toast('Buscando os cadastros da loja...');
    const r = await Sync.executar();
    toast(r.ok ? 'Cadastros atualizados.' : r.msg);
    render();
  }

  return h('div', {}, [
    cabecalho({ titulo: '🛒 Mercado Gestor', sub: Prefs.get('nomeLoja') || Prefs.get('loja') || 'Entre com seu usuario' }),
    h('main', {}, [
      login.el, senha.el, erro,
      h('div', { class: 'aviso-instalar', onclick: buscar },
        '🔄  Ainda nao aparece meu usuario — toque para buscar os cadastros da loja.')
    ]),
    barra([{ texto: 'Entrar', onclick: entrar }])
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
  const resumo = h('div', { class: 'resumo' }, [
    h('div', { onclick: () => ir('validades', { filtro: 'janela' }) },
      [h('b', {}, validades.length), h('span', {}, 'vencendo em 30d')]),
    h('div', { onclick: () => ir('validades', { filtro: 'urgentes' }) },
      [h('b', { estilo: { color: '#FFCDD2' } }, urgentes), h('span', {}, 'urgentes / vencidos')]),
    h('div', { onclick: () => ir('pendencias') },
      [h('b', { estilo: { color: '#FFE0B2' } }, pendencias.length), h('span', {}, 'tarefas em aberto')])
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
    resumo, conexao
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
    a.veValores() ? D.moeda(prejuizo) + ' nos ultimos 7 dias' : semana.length + ' registros',
    null, '#6D4C41', 'quebras');

  const equips = Dados.ativos('equipamentos').filter(e => e.ativo && a.veSetor(e.setor));
  const fora = M.leiturasForaDaFaixa();
  mod('🌡', 'Temperatura', equips.length + ' equipamentos',
    fora ? fora + ' fora da faixa' : null, '#D32F2F', 'temperatura');

  if (a.gerenciaUsuarios()) {
    mod('👤', 'Usuarios', Dados.ativos('usuarios').filter(u => u.ativo).length + ' conta(s)',
      null, '#455A64', 'usuarios');
  }
  mod('⚙', 'Ajustes', 'Sua conta, avisos e conexao da loja', null, '#455A64', 'ajustes');

  return h('div', {}, [
    cab,
    h('main', {}, [
      h('div', { class: 'grade' }, mods),
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
    Prefs.set('loja', loja.input.value.trim());
    Prefs.set('pin', pin.input.value.trim());
    Prefs.set('url', url.input.value.trim());
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

  function exportar() {
    const blob = new Blob([JSON.stringify(Dados.d, null, 2)], { type: 'application/json' });
    const link = h('a', { href: URL.createObjectURL(blob), download: 'mercado_' + D.hoje() + '.json' });
    document.body.append(link);
    link.click();
    link.remove();
  }

  function importar() {
    const inp = h('input', { type: 'file', accept: '.json,application/json' });
    inp.addEventListener('change', async () => {
      const arq = inp.files[0];
      if (!arq) return;
      try {
        Dados.juntar(JSON.parse(await arq.text()));
        Dados.salvar();
        toast('Dados importados e juntados.');
        render();
      } catch (e) {
        toast('Arquivo invalido.');
      }
    });
    inp.click();
  }

  return h('div', {}, [
    cabecalho({ titulo: '⚙ Ajustes', sub: 'Sua conta e a conexao da loja', voltar }),
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

      h('div', { class: 'rotulo-secao' }, 'Conexao da loja'),
      h('div', { class: 'sub' }, 'Com a loja conectada, o que a equipe registra aparece nos outros '
        + 'celulares sozinho, em segundos. Use os mesmos dados em todos os aparelhos — '
        + 'inclusive nos que usam o aplicativo Android.'),
      loja.el, pin.el, url.el, status,
      h('div', {
        class: 'aviso-instalar',
        onclick: async () => {
          salvar();
          status.textContent = 'Testando...';
          const r = await Sync.executar();
          toast(r.ok ? 'Conexao funcionando.' : r.msg);
          atualizarStatus();
        }
      }, '🔌  Testar a conexao'),

      h('div', { class: 'rotulo-secao' }, 'Copia dos dados'),
      h('div', { class: 'aviso-instalar', onclick: exportar }, '📤  Exportar arquivo de dados'),
      h('div', { class: 'aviso-instalar', onclick: importar }, '📥  Importar arquivo de dados')
    ]),
    barra([{ texto: 'Salvar ajustes', onclick: () => { salvar(); toast('Ajustes salvos.'); voltar(); } }])
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
  if (u.perfil === D.PERFIL.LIDER) return 'Lider de ' + D.setor(u.setor).nome;
  return 'Funcionario - ' + D.setor(u.setor).nome;
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
  const setorSel = lista('Setor',
    Object.entries(D.SETORES).map(([k, v]) => ({ valor: k, texto: v.icone + ' ' + v.nome })),
    u.setor);
  setorSel.input.disabled = !a.dono();
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
    u.setor = a.dono() ? setorSel.input.value : a.meuSetor();
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

Dados.carregar();
Prefs.carregar();
Sync.iniciarCiclo();
Sync.aoAtualizar(() => { Dados.carregar(); render(); });
if (Prefs.lojaConectada()) Sync.executar();
render();

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
