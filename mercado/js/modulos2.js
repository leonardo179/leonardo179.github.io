/*
 * Os demais modulos do dia a dia: estoque e paletes, contagem, preco do
 * concorrente, gondola vazia, desistencias no caixa, escala e desempenho.
 * Mesmas regras do aplicativo Android.
 */
import { Dados, Prefs } from './dados.js?v=202607281818';
import * as D from './dominio.js?v=202607281818';
import { h, cabecalho, cartao, campo, area, lista, marcador, barra, vazio, aviso, toast, confirmar } from './ui.js?v=202607281818';

let ir, voltar, render;

export function instalarModulos2(api) {
  ir = api.ir; voltar = api.voltar; render = api.render;
  estoque(api.registrar);
  contagem(api.registrar);
  precos(api.registrar);
  ruptura(api.registrar);
  desistencias(api.registrar);
  escala(api.registrar);
  desempenho(api.registrar);
}

const opcoesSetor = () =>
  D.setoresAtivos().map(s => ({ valor: s.chave, texto: s.icone + ' ' + s.nome }));

const opcoesUnidade = () =>
  Object.entries(D.UNIDADES).map(([k, v]) => ({ valor: k, texto: v.sigla }));

const app = () => document.getElementById('app');

/** Caixinha de itens que varias telas usam (palete, contagem, pesquisa). */
function listaEditavel(itens, desenhar, aoTocar, aoRemover) {
  const caixa = h('div', {});
  const redesenhar = () => {
    caixa.replaceChildren(...itens.map((item, i) => {
      const linha = h('div', {
        class: 'cartao', estilo: { marginTop: '6px' },
        onclick: () => aoTocar(item, i)
      }, [
        h('div', { class: 'faixa', estilo: { background: '#90A4AE' } }),
        h('div', { class: 'corpo' }, desenhar(item)),
        h('div', {
          estilo: { color: '#D32F2F', fontSize: '20px', padding: '12px', cursor: 'pointer' },
          onclick: e => { e.stopPropagation(); aoRemover(i); redesenhar(); }
        }, '✕')
      ]);
      return linha;
    }));
    if (!itens.length) caixa.append(h('div', { class: 'sub' }, 'Nenhum item ainda.'));
  };
  redesenhar();
  return { caixa, redesenhar };
}

// -------------------------------------------------------- estoque e paletes

function estoque(registrar) {
  registrar('estoque', () => {
    const a = D.Acesso;
    const busca = campo('', '', { placeholder: 'Buscar produto ou endereco (A3)...' });
    const corpo = h('div', {});

    function desenhar() {
      const termo = busca.input.value.trim().toLowerCase();
      const paletes = Dados.ativos('paletes')
        .filter(p => a.veSetor(p.setor))
        .filter(p => !termo || (p.codigo + ' ' + endereco(p) + ' '
          + (p.itens || []).map(i => i.produto).join(' ')).toLowerCase().includes(termo))
        .sort((x, y) => (x.rua || '').localeCompare(y.rua || '') || (x.posicao || 0) - (y.posicao || 0));

      corpo.replaceChildren(...(paletes.length ? paletes.map(p => cartao({
        cor: D.setor(p.setor).cor,
        icone: '📦',
        titulo: 'Palete ' + endereco(p) + (p.codigo ? '  (' + p.codigo + ')' : ''),
        sub: D.setor(p.setor).icone + ' ' + D.setor(p.setor).nome
          + '  •  ' + (p.itens || []).length + ' item(ns)',
        extra: resumoPalete(p),
        destaque: p.observacao ? { texto: p.observacao, cor: D.setor(p.setor).cor } : null,
        onclick: () => formPalete(p)
      })) : [vazio(termo ? 'Nada encontrado para "' + termo + '".'
        : 'Nenhum palete cadastrado.\nToque em Novo palete para comecar o mapa.')]));
    }
    busca.input.addEventListener('input', desenhar);
    desenhar();

    return h('div', {}, [
      cabecalho({ titulo: '📦 Estoque e paletes', sub: 'Quantos tem e onde estao', voltar }),
      h('main', {}, [busca.el, corpo]),
      h('button', { class: 'fab', onclick: () => formPalete(null) }, 'Novo palete')
    ]);
  });
}

const endereco = p => (p.rua || 'A') + (p.posicao || 1) + (p.nivel ? '-N' + p.nivel : '');

function resumoPalete(p) {
  const itens = p.itens || [];
  if (!itens.length) return 'Vazio';
  return itens.slice(0, 3).map(i => textoItemPalete(i)).join('  |  ')
    + (itens.length > 3 ? '  |  +' + (itens.length - 3) : '');
}

const textoItemPalete = i =>
  D.numero(i.quantidade || 0) + ' ' + (D.UNIDADES[i.unidade] || D.UNIDADES.UND).sigla + '  ' + i.produto;

function formPalete(existente) {
  const a = D.Acesso;
  const p = existente || Dados.novo({
    codigo: 'Palete ' + (Dados.ativos('paletes').length + 1),
    setor: a.dono() ? 'DEPOSITO' : a.meuSetor(),
    rua: 'A', posicao: 1, nivel: 0, observacao: '', itens: []
  });
  const itens = (p.itens || []).map(i => ({ ...i }));

  const codigo = campo('Identificacao', p.codigo);
  const setorSel = lista('Setor dono da mercadoria', opcoesSetor(), p.setor);
  const rua = campo('Rua', p.rua || 'A');
  const posicao = campo('Posicao', p.posicao || 1, { type: 'number' });
  const nivel = campo('Nivel (0 = chao)', p.nivel || 0, { type: 'number' });
  const obs = area('Observacao', p.observacao);

  const editor = listaEditavel(itens,
    item => [h('div', { class: 'titulo', texto: item.produto || 'Sem nome' }),
             h('div', { class: 'sub', texto: textoItemPalete(item) })],
    item => dialogoItemPalete(item, () => editor.redesenhar()),
    i => itens.splice(i, 1));

  function novoItem() {
    const item = { produto: '', quantidade: 1, unidade: 'CX' };
    dialogoItemPalete(item, () => {
      if (item.produto) itens.push(item);
      editor.redesenhar();
    });
  }

  function salvar() {
    Object.assign(p, {
      codigo: codigo.input.value.trim(),
      setor: setorSel.input.value,
      rua: (rua.input.value.trim() || 'A').toUpperCase(),
      posicao: Math.max(1, parseInt(posicao.input.value) || 1),
      nivel: Math.max(0, parseInt(nivel.input.value) || 0),
      observacao: obs.input.value.trim(),
      itens: itens.filter(i => i.produto)
    });
    Dados.gravar('paletes', p, a.nome());
    toast('Palete ' + endereco(p) + ' salvo.');
    ir('estoque');
    render();
  }

  app().replaceChildren(h('div', {}, [
    cabecalho({ titulo: existente ? '📦 ' + p.codigo : '📦 Novo palete',
      sub: 'Diga onde ele esta e o que tem nele',
      voltar: () => { ir('estoque'); render(); } }),
    h('main', {}, [
      codigo.el, setorSel.el,
      h('div', { class: 'rotulo-secao' }, 'Endereco no deposito'),
      h('div', { estilo: { display: 'flex', gap: '8px' } }, [rua.el, posicao.el, nivel.el]),
      h('div', { class: 'rotulo-secao' }, 'Produtos no palete'),
      editor.caixa,
      h('div', { class: 'aviso-instalar', onclick: novoItem }, '+  Adicionar produto'),
      obs.el
    ]),
    barra([
      { texto: 'Salvar', onclick: salvar },
      existente ? { texto: 'Excluir', classe: 'vermelho', onclick: () => confirmar('Excluir palete',
        'Remover o palete ' + endereco(p) + ' do mapa?', () => {
          Dados.excluir('paletes', p, a.nome()); ir('estoque'); render();
        }) } : null
    ])
  ]));
}

function dialogoItemPalete(item, pronto) {
  const produto = prompt('Produto:', item.produto || '');
  if (produto === null) return;
  const qtd = prompt('Quantidade:', item.quantidade || 1);
  if (qtd === null) return;
  const unidades = Object.keys(D.UNIDADES);
  const un = prompt('Unidade (' + unidades.join(', ') + '):', item.unidade || 'CX');
  if (un === null) return;
  item.produto = produto.trim();
  item.quantidade = D.lerNumero(qtd);
  item.unidade = unidades.includes((un || '').toUpperCase()) ? un.toUpperCase() : 'CX';
  if (!item.id) item.id = crypto.randomUUID();
  pronto();
}

/** Cruza a falta na gondola com o estoque conhecido — igual ao Repo.java. */
function ondeTemNoEstoque(produto) {
  const alvo = (produto || '').trim().toLowerCase();
  if (!alvo) return '';
  for (const p of Dados.ativos('paletes')) {
    for (const i of (p.itens || [])) {
      if ((i.produto || '').toLowerCase().includes(alvo)) {
        return 'Palete ' + endereco(p) + (p.codigo ? ' (' + p.codigo + ')' : '')
          + ' - ' + textoItemPalete(i);
      }
    }
  }
  for (const c of Dados.ativos('contagens')) {
    for (const i of (c.itens || [])) {
      const total = (i.caixas || 0) * Math.max(1, i.porCaixa || 1) + (i.unidades || 0);
      if ((i.produto || '').toLowerCase().includes(alvo) && total > 0) {
        return 'Contagem ' + c.fornecedor + ' de ' + D.data(c.data) + ': '
          + Math.round(total) + ' unidades';
      }
    }
  }
  return '';
}

// ----------------------------------------------------------------- contagem

const totalItemContagem = i =>
  (i.caixas || 0) * Math.max(1, i.porCaixa || 1) + (i.unidades || 0);

function contaTexto(i) {
  const cx = Math.round(i.caixas || 0), un = Math.round(i.unidades || 0);
  if (!cx) return un + ' und';
  let s = cx + ' cx x ' + (i.porCaixa || 1);
  if (un) s += ' + ' + un + ' und';
  return s + ' = ' + Math.round(totalItemContagem(i)) + ' unidades';
}

function contagem(registrar) {
  registrar('contagem', () => {
    const a = D.Acesso;
    const itens = Dados.ativos('contagens')
      .filter(c => a.veSetor(c.setor) && a.vePessoa(c.funcionario, c.autor))
      .sort((x, y) => y.atualizadoEm - x.atualizadoEm);

    const cartoes = itens.map(c => cartao({
      cor: D.setor(c.setor).cor,
      icone: c.concluida ? '✔' : '🧮',
      titulo: c.fornecedor || 'Contagem',
      sub: (c.concluida
        ? 'Concluida por ' + c.funcionario + (c.concluidaAs ? ' as ' + c.concluidaAs : '')
        : 'Em andamento') + '  •  ' + D.data(c.data),
      extra: (c.itens || []).length + ' produto(s) — '
        + Math.round((c.itens || []).reduce((s, i) => s + totalItemContagem(i), 0)) + ' unidades',
      selo: c.concluida
        ? { texto: c.vistaPeloGestor ? 'vista' : 'NOVA', cor: c.vistaPeloGestor ? '#9E9E9E' : '#2E7D32' }
        : { texto: 'em andamento', cor: '#F57C00' },
      destaque: c.concluida && (c.itens || []).length
        ? { texto: c.itens.map(i => '• ' + i.produto + ': ' + contaTexto(i)).join('\n'),
            cor: D.setor(c.setor).cor }
        : null,
      botoes: a.veTrabalhoDosOutros() && c.concluida && !c.vistaPeloGestor
        ? [{ texto: 'Marcar como visto', onclick: () => {
            c.vistaPeloGestor = true;
            Dados.gravar('contagens', c, a.nome());
            render();
          } }] : null,
      onclick: () => formContagem(c)
    }));

    return h('div', {}, [
      cabecalho({ titulo: '🧮 Contagem de estoque',
        sub: itens.length + ' contagem(ns)  •  caixas e unidades viram total sozinho', voltar }),
      h('main', {}, cartoes.length ? cartoes
        : [vazio('Nenhuma contagem ainda.\nCrie uma quando o representante chegar.')]),
      h('button', { class: 'fab', onclick: () => formContagem(null) }, 'Nova contagem')
    ]);
  });
}

function formContagem(existente) {
  const a = D.Acesso;
  const c = existente || Dados.novo({
    fornecedor: '', setor: a.dono() ? 'BEBIDAS' : a.meuSetor(), data: D.hoje(),
    funcionario: '', concluidaAs: '', concluida: false, vistaPeloGestor: false,
    observacao: '', itens: []
  });
  const itens = (c.itens || []).map(i => ({ ...i }));

  const fornecedor = campo('Fornecedor / representante', c.fornecedor);
  const setorSel = lista('Setor', opcoesSetor(), c.setor);
  const obs = area('Observacao para o dono', c.observacao);
  const total = aviso('');

  function atualizarTotal() {
    total.textContent = 'Total contado: '
      + Math.round(itens.reduce((s, i) => s + totalItemContagem(i), 0))
      + ' unidades em ' + itens.length + ' produto(s)';
  }

  const editor = listaEditavel(itens,
    item => [h('div', { class: 'titulo', texto: item.produto }),
             h('div', { class: 'sub', texto: contaTexto(item) })],
    item => dialogoItemContagem(item, () => { editor.redesenhar(); atualizarTotal(); }),
    i => { itens.splice(i, 1); atualizarTotal(); });

  function novoItem() {
    const item = { produto: '', caixas: 0, unidades: 0, porCaixa: 24 };
    dialogoItemContagem(item, () => {
      if (item.produto) itens.push(item);
      editor.redesenhar();
      atualizarTotal();
    });
  }

  function gravar(concluir) {
    Object.assign(c, {
      fornecedor: fornecedor.input.value.trim(),
      setor: setorSel.input.value,
      observacao: obs.input.value.trim(),
      itens: itens.filter(i => i.produto)
    });
    if (concluir) {
      if (!c.itens.length) return toast('Conte pelo menos um produto antes de enviar.');
      c.concluida = true;
      c.funcionario = a.nome();
      c.concluidaAs = D.agora();
      c.vistaPeloGestor = false;
    }
    Dados.gravar('contagens', c, a.nome());
    toast(concluir ? 'Contagem enviada ao gestor.' : 'Contagem salva.');
    ir('contagem');
    render();
  }

  atualizarTotal();
  app().replaceChildren(h('div', {}, [
    cabecalho({ titulo: existente ? '🧮 ' + (c.fornecedor || 'Contagem') : '🧮 Nova contagem',
      sub: 'Digite caixas e unidades; o total sai pronto',
      voltar: () => { ir('contagem'); render(); } }),
    h('main', {}, [
      fornecedor.el, setorSel.el,
      h('div', { class: 'rotulo-secao' }, 'Produtos contados'),
      editor.caixa, total,
      h('div', { class: 'aviso-instalar', onclick: novoItem }, '+  Contar produto'),
      obs.el
    ]),
    barra([
      { texto: c.concluida ? 'Salvar alteracoes' : 'Concluir e enviar', onclick: () => gravar(!c.concluida) },
      { texto: 'Só salvar', classe: 'cinza', onclick: () => gravar(false) }
    ])
  ]));
}

function dialogoItemContagem(item, pronto) {
  const produto = prompt('Produto:', item.produto || '');
  if (produto === null) return;
  const caixas = prompt('Quantas caixas/fardos:', item.caixas || 0);
  if (caixas === null) return;
  const porCaixa = prompt('Unidades por caixa:', item.porCaixa || 24);
  if (porCaixa === null) return;
  const soltas = prompt('Unidades soltas:', item.unidades || 0);
  if (soltas === null) return;
  item.produto = produto.trim();
  item.caixas = D.lerNumero(caixas);
  item.porCaixa = Math.max(1, parseInt(porCaixa) || 1);
  item.unidades = D.lerNumero(soltas);
  if (!item.id) item.id = crypto.randomUUID();
  pronto();
}

// ------------------------------------------------------- preco do concorrente

function precos(registrar) {
  registrar('precos', params => {
    const a = D.Acesso;
    const aba = params.aba || 'pesquisas';

    const troca = h('div', { estilo: { display: 'flex', gap: '8px', margin: '4px 0 10px' } }, [
      abaBotao('Pesquisas', aba === 'pesquisas', () => { ir('precos', { aba: 'pesquisas' }); render(); }),
      abaBotao('Cesta vigiada', aba === 'cesta', () => { ir('precos', { aba: 'cesta' }); render(); })
    ]);

    let corpo, fab;
    if (aba === 'cesta') {
      const cesta = Dados.ativos('cesta').filter(c => c.ativo !== false)
        .sort((x, y) => x.nome.localeCompare(y.nome));
      corpo = cesta.length ? cesta.map(c => cartao({
        cor: D.setor(c.setor).cor,
        icone: D.setor(c.setor).icone,
        titulo: c.nome,
        sub: D.setor(c.setor).nome + '  •  nosso preco ' + D.moeda(c.nossoPreco),
        botoes: a.configuraLoja() ? [
          { texto: 'Editar', onclick: () => dialogoCesta(c) },
          { texto: 'Remover', sec: true, onclick: () => confirmar('Remover da cesta',
            'Parar de vigiar o preco de ' + c.nome + '?', () => {
              Dados.excluir('cesta', c, a.nome()); render();
            }) }
        ] : null
      })) : [vazio('Cesta vazia.\nCadastre os produtos mais vendidos da loja.')];
      fab = { texto: 'Novo produto', onclick: () => dialogoCesta(null) };
    } else {
      const pesquisas = Dados.ativos('pesquisas')
        .filter(p => a.vePessoa(p.funcionario, p.autor))
        .sort((x, y) => y.atualizadoEm - x.atualizadoEm);
      corpo = pesquisas.length ? pesquisas.map(p => {
        const perdendo = (p.itens || []).filter(i => estamosPerdendo(i));
        return cartao({
          cor: perdendo.length ? '#D32F2F' : '#2E7D32',
          icone: '🔎',
          titulo: p.concorrente || 'Concorrente',
          sub: (p.concluida ? 'Concluida por ' + p.funcionario + ' as ' + p.concluidaAs
            : 'Em andamento') + '  •  ' + (p.itens || []).filter(i => i.coletado).length
            + '/' + (p.itens || []).length + ' precos',
          selo: p.concluida
            ? { texto: perdendo.length ? perdendo.length + ' perdendo' : 'na frente',
                cor: perdendo.length ? '#D32F2F' : '#388E3C' }
            : { texto: 'em andamento', cor: '#F57C00' },
          destaque: perdendo.length
            ? { texto: perdendo.map(i => '• ' + sugestaoPreco(i, p.concorrente)).join('\n'),
                cor: '#D32F2F' }
            : null,
          onclick: () => formPesquisa(p)
        });
      }) : [vazio('Nenhuma pesquisa ainda.\nMonte a cesta e mande alguem ao concorrente.')];
      fab = { texto: 'Nova pesquisa', onclick: () => formPesquisa(null) };
    }

    return h('div', {}, [
      cabecalho({ titulo: '🔎 Preco do concorrente', sub: 'Compare e reaja no mesmo dia', voltar }),
      h('main', {}, [troca, ...corpo]),
      h('button', { class: 'fab', onclick: fab.onclick }, fab.texto)
    ]);
  });
}

function abaBotao(texto, ativa, onclick) {
  return h('div', {
    onclick,
    estilo: {
      flex: '1', textAlign: 'center', padding: '10px', borderRadius: '12px', cursor: 'pointer',
      background: ativa ? '#2E7D32' : '#fff', color: ativa ? '#fff' : '#6B7A6B',
      fontWeight: ativa ? '700' : '400', fontSize: '14px'
    }
  }, texto);
}

const diferencaPreco = i => (i.nossoPreco || 0) - (i.precoConcorrente || 0);
const estamosPerdendo = i => i.coletado && i.precoConcorrente > 0 && i.nossoPreco > 0
  && diferencaPreco(i) > 0.001;
const estamosGanhando = i => i.coletado && i.precoConcorrente > 0 && i.nossoPreco > 0
  && diferencaPreco(i) < -0.001;

function percentual(i) {
  if (!i.nossoPreco) return 0;
  return Math.abs(diferencaPreco(i) * 100 / i.nossoPreco);
}

function sugestaoPreco(i, concorrente) {
  const onde = concorrente ? 'no ' + concorrente : 'no concorrente';
  const dif = Math.abs(diferencaPreco(i));
  const pct = D.numero(percentual(i)) + '%';
  if (estamosPerdendo(i)) {
    return `O ${i.produto} ${onde} esta ${D.moeda(dif)} mais barato (${pct}). `
      + `Sugestao: baixar o nosso para ${D.moeda(Math.max(0.01, i.precoConcorrente - 0.01))}.`;
  }
  if (estamosGanhando(i)) {
    return `Estamos ${D.moeda(dif)} mais baratos (${pct}) no ${i.produto}.`;
  }
  return 'Preco empatado.';
}

function dialogoCesta(existente) {
  const a = D.Acesso;
  const c = existente || Dados.novo({ nome: '', setor: 'MERCEARIA', unidade: 'UND', nossoPreco: 0, ativo: true });
  const nome = prompt('Produto vigiado:', c.nome);
  if (nome === null) return;
  const preco = prompt('Nosso preco:', c.nossoPreco || '');
  if (preco === null) return;
  c.nome = nome.trim();
  c.nossoPreco = D.lerNumero(preco);
  if (!c.nome) return toast('Falta o nome do produto.');
  Dados.gravar('cesta', c, a.nome());
  toast('Produto vigiado salvo.');
  render();
}

function formPesquisa(existente) {
  const a = D.Acesso;
  const p = existente || Dados.novo({
    concorrente: '', data: D.hoje(), funcionario: '', concluidaAs: '',
    concluida: false, vistaPeloGestor: false, observacao: '',
    itens: Dados.ativos('cesta').filter(c => c.ativo !== false).map(c => ({
      id: crypto.randomUUID(), produtoId: c.id, produto: c.nome,
      nossoPreco: c.nossoPreco, precoConcorrente: 0, coletado: false, observacao: ''
    }))
  });
  const itens = (p.itens || []).map(i => ({ ...i }));

  const concorrente = campo('Concorrente', p.concorrente);
  const obs = area('Observacao', p.observacao);
  const placar = aviso('');

  function atualizarPlacar() {
    const coletados = itens.filter(i => i.coletado).length;
    const perdendo = itens.filter(estamosPerdendo).length;
    const ganhando = itens.filter(estamosGanhando).length;
    placar.textContent = `${coletados} de ${itens.length} precos coletados\n`
      + `⚠ perdendo em ${perdendo}  •  ✔ na frente em ${ganhando}`;
    const cor = perdendo ? '#D32F2F' : '#2E7D32';
    placar.style.background = cor + '22';
    placar.style.color = cor;
    placar.style.border = '1px solid ' + cor + '55';
  }

  const editor = listaEditavel(itens,
    item => [
      h('div', { class: 'titulo', texto: item.produto }),
      h('div', { class: 'sub', texto: item.coletado
        ? (item.nossoPreco
          ? 'Nos ' + D.moeda(item.nossoPreco) + '  x  eles ' + D.moeda(item.precoConcorrente)
          : 'Concorrente ' + D.moeda(item.precoConcorrente) + '  •  nosso preco em branco')
        : 'Toque para digitar o preco encontrado' }),
      item.coletado ? h('div', {
        estilo: { fontSize: '12px', marginTop: '2px',
                  color: estamosPerdendo(item) ? '#D32F2F' : '#2E7D32' },
        texto: sugestaoPreco(item, concorrente.input.value)
      }) : null
    ],
    item => dialogoItemPreco(item, () => { editor.redesenhar(); atualizarPlacar(); }),
    i => { itens.splice(i, 1); atualizarPlacar(); });

  function novoItem() {
    const item = { produto: '', nossoPreco: 0, precoConcorrente: 0, coletado: false };
    dialogoItemPreco(item, () => {
      if (item.produto) itens.push(item);
      editor.redesenhar();
      atualizarPlacar();
    });
  }

  function gravar(concluir) {
    Object.assign(p, {
      concorrente: concorrente.input.value.trim(),
      observacao: obs.input.value.trim(),
      itens: itens.filter(i => i.produto)
    });
    if (concluir) {
      if (!p.itens.some(i => i.coletado)) return toast('Digite pelo menos um preco.');
      p.concluida = true;
      p.funcionario = a.nome();
      p.concluidaAs = D.agora();
      p.vistaPeloGestor = false;
    }
    Dados.gravar('pesquisas', p, a.nome());
    toast(concluir ? 'Pesquisa enviada ao gestor.' : 'Pesquisa salva.');
    ir('precos');
    render();
  }

  atualizarPlacar();
  app().replaceChildren(h('div', {}, [
    cabecalho({ titulo: existente ? '🔎 ' + (p.concorrente || 'Pesquisa') : '🔎 Nova pesquisa',
      sub: 'Digite o preco que voce encontrou la',
      voltar: () => { ir('precos'); render(); } }),
    h('main', {}, [
      concorrente.el,
      h('div', { class: 'rotulo-secao' }, 'Produtos da cesta'),
      editor.caixa, placar,
      h('div', { class: 'aviso-instalar', onclick: novoItem }, '+  Adicionar produto fora da cesta'),
      obs.el
    ]),
    barra([
      { texto: p.concluida ? 'Salvar alteracoes' : 'Concluir e enviar', onclick: () => gravar(!p.concluida) },
      { texto: 'Só salvar', classe: 'cinza', onclick: () => gravar(false) }
    ])
  ]));
}

function dialogoItemPreco(item, pronto) {
  const produto = prompt('Produto:', item.produto || '');
  if (produto === null) return;
  const deles = prompt('Preco no concorrente:', item.precoConcorrente || '');
  if (deles === null) return;
  const nosso = prompt('Nosso preco (opcional — deixe como esta se ja souber):', item.nossoPreco || '');
  if (nosso === null) return;
  item.produto = produto.trim();
  item.precoConcorrente = D.lerNumero(deles);
  item.nossoPreco = D.lerNumero(nosso);
  item.coletado = item.precoConcorrente > 0;
  if (!item.id) item.id = crypto.randomUUID();
  pronto();
}

// -------------------------------------------------------------- gondola vazia

const SITUACOES_RUPTURA = {
  ABERTA: { rotulo: 'Aberta', cor: '#D32F2F' },
  NO_DEPOSITO: { rotulo: 'Tem no deposito', cor: '#F57C00' },
  COMPRAR: { rotulo: 'Pedir ao fornecedor', cor: '#6A1B9A' },
  RESOLVIDA: { rotulo: 'Reposta', cor: '#388E3C' }
};

function ruptura(registrar) {
  registrar('ruptura', () => {
    const a = D.Acesso;
    const itens = Dados.ativos('rupturas')
      .filter(r => a.veSetor(r.setor) && a.vePessoa(r.funcionario, r.autor))
      .sort((x, y) => (x.situacao === 'RESOLVIDA') - (y.situacao === 'RESOLVIDA')
        || y.atualizadoEm - x.atualizadoEm);

    const cartoes = itens.map(r => {
      const s = SITUACOES_RUPTURA[r.situacao] || SITUACOES_RUPTURA.ABERTA;
      return cartao({
        cor: s.cor,
        icone: D.setor(r.setor).icone,
        titulo: r.produto || 'Produto sem nome',
        sub: D.dataCurta(r.data) + ' ' + (r.hora || '') + '  •  ' + D.setor(r.setor).nome
          + (r.funcionario ? '  •  ' + r.funcionario : ''),
        extra: r.observacao,
        selo: { texto: s.rotulo, cor: s.cor },
        destaque: { texto: orientacaoRuptura(r), cor: s.cor },
        botoes: r.situacao !== 'RESOLVIDA' ? [
          { texto: 'Gondola reposta', onclick: () => {
            r.situacao = 'RESOLVIDA';
            Dados.gravar('rupturas', r, a.nome());
            render();
          } },
          { texto: 'Reconferir estoque', sec: true, onclick: () => {
            cruzar(r);
            Dados.gravar('rupturas', r, a.nome());
            render();
          } }
        ] : null
      });
    });

    const abertas = itens.filter(r => r.situacao !== 'RESOLVIDA').length;
    return h('div', {}, [
      cabecalho({ titulo: '🕳 Gondola vazia',
        sub: abertas + ' em aberto  •  ' + itens.length + ' no total', voltar }),
      h('main', {}, cartoes.length ? cartoes
        : [vazio('Nenhuma falta registrada.\nViu buraco na gondola? Avise aqui.')]),
      h('button', { class: 'fab', onclick: registrarRuptura }, 'Avisar falta')
    ]);
  });
}

function orientacaoRuptura(r) {
  if (r.situacao === 'NO_DEPOSITO') return '📦 Tem no estoque: ' + r.ondeTem + '. Buscar e repor agora.';
  if (r.situacao === 'COMPRAR') return '🛒 Nao ha estoque no deposito. Pedir urgente ao fornecedor.';
  if (r.situacao === 'RESOLVIDA') return 'Gondola reposta.';
  return 'Conferir o deposito e repor.';
}

function cruzar(r) {
  const onde = ondeTemNoEstoque(r.produto);
  r.ondeTem = onde;
  r.situacao = onde ? 'NO_DEPOSITO' : 'COMPRAR';
}

function registrarRuptura() {
  const a = D.Acesso;
  const produto = prompt('Qual produto faltou na gondola?');
  if (produto === null || !produto.trim()) return;
  const setores = D.setoresAtivos();
  const opcoes = setores.map((s, i) => (i + 1) + ' = ' + s.nome).join('\n');
  const escolha = prompt('Setor:\n' + opcoes, '1');
  const idx = parseInt(escolha) - 1;
  const setorEscolhido = setores[idx] ? setores[idx].chave : a.meuSetor();
  const obs = prompt('Observacao (opcional):') || '';

  const r = Dados.novo({
    codigo: '', produto: produto.trim(), setor: setorEscolhido, data: D.hoje(),
    hora: D.agora(), funcionario: a.nome(), situacao: 'ABERTA', ondeTem: '',
    observacao: obs.trim(), avisouGestor: false
  });
  cruzar(r);
  Dados.gravar('rupturas', r, a.nome());
  alert(orientacaoRuptura(r));
  render();
}

// ------------------------------------------------------ desistencias no caixa

const MOTIVOS_DESISTENCIA = [
  { valor: 'ACHOU_CARO', texto: 'Cliente achou caro', preco: true },
  { valor: 'PRECO_DIVERGENTE', texto: 'Preco divergente da etiqueta', preco: true },
  { valor: 'SEM_DINHEIRO', texto: 'Dinheiro nao deu' },
  { valor: 'DESISTIU', texto: 'Desistiu / mudou de ideia' },
  { valor: 'ITEM_ERRADO', texto: 'Pegou o item errado' },
  { valor: 'PRODUTO_RUIM', texto: 'Produto danificado ou vencido' },
  { valor: 'DEMORA', texto: 'Demora na fila' }
];

const PERECIVEIS = ['CONGELADOS', 'FRIOS', 'ACOUGUE', 'PEIXARIA', 'HORTIFRUTI'];
const prazoRecolher = setor => setor === 'CONGELADOS' ? 15
  : ['FRIOS', 'ACOUGUE', 'PEIXARIA'].includes(setor) ? 30
    : setor === 'HORTIFRUTI' ? 60 : 180;

function minutosParados(d) {
  const inicio = new Date(d.data + 'T' + (d.hora || '00:00') + ':00');
  return Math.max(0, Math.round((Date.now() - inicio) / 60000));
}

function desistencias(registrar) {
  registrar('desistencias', () => {
    const a = D.Acesso;
    const itens = Dados.ativos('desistencias')
      .filter(d => a.vePessoa(d.operador, d.autor))
      .sort((x, y) => (x.recolhido - y.recolhido) || y.atualizadoEm - x.atualizadoEm);

    const cartoes = itens.map(d => {
      const perecivel = PERECIVEIS.includes(d.setor);
      const atrasado = !d.recolhido && minutosParados(d) > prazoRecolher(d.setor);
      const cor = d.recolhido ? '#388E3C' : (atrasado ? '#D32F2F' : (perecivel ? '#F57C00' : '#757575'));
      const motivo = MOTIVOS_DESISTENCIA.find(m => m.valor === d.motivo) || MOTIVOS_DESISTENCIA[0];

      let alerta;
      if (d.recolhido) alerta = 'Item ja recolhido por ' + d.recolhidoPor + ' as ' + d.recolhidoAs + '.';
      else if (perecivel) alerta = '🧊 ' + d.produto + ' deixado no caixa. Recolher em ate '
        + prazoRecolher(d.setor) + ' min ou vira quebra.';
      else alerta = 'Recolher ' + d.produto + ' no caixa e devolver a gondola.';

      const divergencia = (d.precoCaixa || 0) - (d.precoEtiqueta || 0);
      const recadoGestor = d.motivo === 'PRECO_DIVERGENTE' && divergencia
        ? 'Etiqueta ' + D.moeda(d.precoEtiqueta) + ' x caixa ' + D.moeda(d.precoCaixa)
          + ' (diferenca de ' + D.moeda(Math.abs(divergencia)) + '). Corrigir a etiqueta hoje.'
        : (motivo.preco ? 'Desistencia por preco. Vale comparar com o concorrente.' : '');

      return cartao({
        cor,
        icone: D.setor(d.setor).icone,
        titulo: d.produto || 'Item sem nome',
        sub: D.dataCurta(d.data) + ' ' + d.hora + '  •  ' + motivo.texto
          + (d.operador ? '  •  ' + d.operador : ''),
        extra: recadoGestor ? '💰 ' + recadoGestor : null,
        selo: d.recolhido ? { texto: 'recolhido', cor: '#388E3C' }
          : atrasado ? { texto: 'URGENTE ' + minutosParados(d) + ' min', cor: '#D32F2F' }
            : perecivel ? { texto: 'recolher em ' + prazoRecolher(d.setor) + ' min', cor: '#F57C00' }
              : { texto: 'aguardando', cor: '#757575' },
        destaque: { texto: alerta, cor },
        botoes: !d.recolhido ? [{
          texto: 'Recolhi o item', onclick: () => {
            d.recolhido = true;
            d.recolhidoPor = a.nome();
            d.recolhidoAs = D.agora();
            Dados.gravar('desistencias', d, a.nome());
            render();
          }
        }] : null
      });
    });

    const aguardando = itens.filter(d => !d.recolhido).length;
    return h('div', {}, [
      cabecalho({ titulo: '🛒 Desistencias no caixa',
        sub: aguardando + ' item(ns) para recolher', voltar,
        acao: a.veTrabalhoDosOutros() ? { texto: '📊', onclick: () => resumoDesistencias(itens) } : null }),
      h('main', {}, cartoes.length ? cartoes : [vazio('Nenhuma desistencia registrada.')]),
      h('button', { class: 'fab', onclick: registrarDesistencia }, 'Cliente desistiu')
    ]);
  });
}

function registrarDesistencia() {
  const a = D.Acesso;
  const produto = prompt('Produto que o cliente deixou:');
  if (produto === null || !produto.trim()) return;
  const setores = D.setoresAtivos();
  const escolha = prompt('Setor:\n' + setores.map((s, i) => (i + 1) + ' = ' + s.nome).join('\n'), '1');
  const setorEscolhido = setores[parseInt(escolha) - 1]
    ? setores[parseInt(escolha) - 1].chave : a.meuSetor();
  const m = prompt('Motivo:\n'
    + MOTIVOS_DESISTENCIA.map((x, i) => (i + 1) + ' = ' + x.texto).join('\n'), '1');
  const motivo = MOTIVOS_DESISTENCIA[parseInt(m) - 1] || MOTIVOS_DESISTENCIA[0];
  const etiqueta = prompt('Preco da etiqueta (opcional):', '');
  const caixa = prompt('Preco que apareceu no caixa (opcional):', '');

  const d = Dados.novo({
    codigo: '', produto: produto.trim(), setor: setorEscolhido, data: D.hoje(),
    hora: D.agora(), operador: a.nome(), motivo: motivo.valor,
    precoEtiqueta: D.lerNumero(etiqueta), precoCaixa: D.lerNumero(caixa),
    quantidade: 1, observacao: '', recolhido: false, recolhidoPor: '', recolhidoAs: '',
    avisouRecolher: false, avisouAtraso: false
  });
  Dados.gravar('desistencias', d, a.nome());
  alert(PERECIVEIS.includes(setorEscolhido)
    ? '🧊 Produto refrigerado: recolher em ate ' + prazoRecolher(setorEscolhido) + ' min ou vira quebra.'
    : 'Registrado. Recolher e devolver a gondola.');
  render();
}

function resumoDesistencias(itens) {
  const trinta = itens.filter(d => D.diasAte(d.data) >= -30);
  if (!trinta.length) return alert('Nenhuma desistencia nos ultimos 30 dias.');
  const porProduto = {};
  let porPreco = 0;
  trinta.forEach(d => {
    porProduto[d.produto] = (porProduto[d.produto] || 0) + 1;
    const m = MOTIVOS_DESISTENCIA.find(x => x.valor === d.motivo);
    if (m && m.preco) porPreco++;
  });
  const ranking = Object.entries(porProduto).sort((a, b) => b[1] - a[1]).slice(0, 8);
  alert(`${trinta.length} desistencias em 30 dias\n${porPreco} delas por preco\n\n`
    + 'Produtos mais abandonados:\n'
    + ranking.map(([p, n]) => `• ${p} — ${n}x`).join('\n'));
}

// -------------------------------------------------------------------- escala

function escala(registrar) {
  registrar('escala', params => {
    const a = D.Acesso;
    const aba = params.aba || 'mes';

    const troca = h('div', { estilo: { display: 'flex', gap: '6px', margin: '4px 0 10px' } }, [
      abaBotao('Mes', aba === 'mes', () => { ir('escala', { aba: 'mes' }); render(); }),
      abaBotao('Equipe', aba === 'equipe', () => { ir('escala', { aba: 'equipe' }); render(); }),
      abaBotao('Datas', aba === 'datas', () => { ir('escala', { aba: 'datas' }); render(); })
    ]);

    let corpo = [], fab = null, sub = '';

    if (aba === 'equipe') {
      const pessoas = Dados.ativos('funcionarios').filter(f => f.ativo !== false)
        .filter(f => a.veSetor(f.setor))
        .sort((x, y) => x.nome.localeCompare(y.nome));
      corpo = pessoas.length ? pessoas.map(f => {
        const padrao = Dados.ativos('padroes').find(p => p.funcionarioId === f.id && p.ativo !== false);
        return cartao({
          cor: D.setor(f.setor).cor, icone: '👤', titulo: f.nome,
          sub: (f.cargo || 'Sem cargo') + '  •  ' + D.setor(f.setor).nome,
          extra: padrao ? resumoPadrao(padrao) : 'Sem escala padrao: os dias dele ficam vazios.',
          selo: padrao ? { texto: D.numero(horasSemana(padrao)) + 'h/sem', cor: D.setor(f.setor).cor }
            : { texto: 'sem padrao', cor: '#D32F2F' },
          botoes: a.configura(f.setor) ? [
            { texto: padrao ? 'Editar escala padrao' : 'Definir escala padrao',
              onclick: () => formPadrao(f, padrao) },
            { texto: 'Editar pessoa', sec: true, onclick: () => dialogoFuncionario(f) }
          ] : null
        });
      }) : [vazio('Cadastre a equipe para montar a escala.')];
      sub = pessoas.length + ' pessoa(s) na equipe';
      fab = { texto: 'Novo funcionario', onclick: () => dialogoFuncionario(null) };

    } else if (aba === 'datas') {
      const datas = feriadosProximos(90);
      corpo = datas.map(d => cartao({
        cor: d.dias <= 7 ? '#F57C00' : '#6A1B9A',
        icone: d.tipo === 'COMERCIAL' ? '🛍' : '🎉',
        titulo: d.nome,
        sub: D.diaSemana(d.data) + ', ' + D.data(d.data) + '  •  '
          + (d.tipo === 'COMERCIAL' ? 'data comercial' : 'feriado'),
        selo: { texto: d.dias === 0 ? 'HOJE' : 'em ' + d.dias + 'd',
          cor: d.dias <= 7 ? '#F57C00' : '#6A1B9A' },
        destaque: d.dias <= 7
          ? { texto: '💡 Movimento diferente. Confira quem trabalha e o horario da loja.', cor: '#F57C00' }
          : null
      }));
      sub = datas.length + ' data(s) nos proximos 90 dias';

    } else {
      const mes = params.mes ? new Date(params.mes + '-01T00:00:00') : new Date();
      const ano = mes.getFullYear(), m = mes.getMonth();
      const dias = new Date(ano, m + 1, 0).getDate();
      const especiais = {};
      feriadosProximos(400).forEach(f => especiais[f.data] = f);

      let horas = 0;
      corpo = [];
      for (let dia = 1; dia <= dias; dia++) {
        const iso = `${ano}-${String(m + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const turnos = escalaDoDia(iso).filter(t => a.veSetor(t.setor));
        turnos.forEach(t => horas += horasTurno(t));
        const feriado = especiais[iso];
        const hoje = iso === D.hoje();
        const trabalhando = turnos.filter(t => !t.folga);
        corpo.push(cartao({
          cor: feriado ? '#F57C00' : (hoje ? '#2E7D32' : '#90A4AE'),
          icone: feriado ? '🎉' : (hoje ? '📍' : '🗓'),
          titulo: dia + ' - ' + D.diaSemana(iso) + (hoje ? '  (hoje)' : ''),
          sub: trabalhando.length ? trabalhando.length + ' pessoa(s) escalada(s)' : 'Ninguem escalado',
          extra: trabalhando.map(t => '• ' + t.funcionarioNome + '  ' + t.inicio + ' as ' + t.fim
            + (t.doPadrao ? '' : '  (ajustado)')).join('\n'),
          selo: feriado ? { texto: feriado.nome, cor: '#F57C00' }
            : (hoje ? { texto: 'hoje', cor: '#2E7D32' } : null),
          botoes: a.configura(null) || a.lider()
            ? [{ texto: 'Ajustar este dia', onclick: () => ajustarDia(iso, turnos) }] : null
        }));
      }
      const nomes = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho',
        'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      sub = nomes[m] + ' de ' + ano + '  •  ' + D.numero(horas) + 'h no mes';
    }

    return h('div', {}, [
      cabecalho({ titulo: '👥 Escala e equipe', sub, voltar,
        acao: a.veTrabalhoDosOutros()
          ? { texto: '🏆', onclick: () => { ir('desempenho'); render(); } } : null }),
      h('main', {}, [troca, ...corpo]),
      fab ? h('button', { class: 'fab', onclick: fab.onclick }, fab.texto) : null
    ]);
  });
}

const DIAS_SEMANA = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo'];

function horasTurno(t) {
  if (t.folga) return 0;
  const [h1, m1] = (t.inicio || '08:00').split(':').map(Number);
  const [h2, m2] = (t.fim || '16:00').split(':').map(Number);
  let min = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (min < 0) min += 24 * 60;
  return min / 60;
}

function horasSemana(padrao) {
  let h = 0;
  for (let i = 0; i < 7; i++) {
    if (padrao.folga[i]) continue;
    h += horasTurno({ inicio: padrao.inicio[i], fim: padrao.fim[i], folga: false });
  }
  return h;
}

function resumoPadrao(p) {
  const n = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  return n.map((dia, i) => dia + ' ' + (p.folga[i] ? 'folga' : p.inicio[i])).join('  ');
}

/** A escala de um dia: o que foi ajustado na mao vale; o resto vem do padrao. */
function escalaDoDia(iso) {
  const indice = (new Date(iso + 'T00:00:00').getDay() + 6) % 7;
  const turnos = [];
  Dados.ativos('funcionarios').filter(f => f.ativo !== false).forEach(f => {
    const gravado = Dados.ativos('turnos').find(t => t.funcionarioId === f.id && t.data === iso);
    if (gravado) { turnos.push(Object.assign({ doPadrao: false }, gravado)); return; }
    const padrao = Dados.ativos('padroes').find(p => p.funcionarioId === f.id && p.ativo !== false);
    if (!padrao) return;
    turnos.push({
      id: 'padrao:' + padrao.id + ':' + iso, funcionarioId: f.id, funcionarioNome: f.nome,
      setor: padrao.setor || f.setor, data: iso, inicio: padrao.inicio[indice],
      fim: padrao.fim[indice], folga: padrao.folga[indice], observacao: '', doPadrao: true
    });
  });
  return turnos.sort((a, b) => (a.folga - b.folga) || a.inicio.localeCompare(b.inicio));
}

function ajustarDia(iso, turnos) {
  if (!turnos.length) return alert('Cadastre a equipe e a escala padrao antes de ajustar um dia.');
  const escolha = prompt('Ajustar ' + D.data(iso) + ':\n'
    + turnos.map((t, i) => (i + 1) + ' = ' + t.funcionarioNome + ' ('
      + (t.folga ? 'folga' : t.inicio + ' as ' + t.fim) + ')').join('\n')
    + '\n\nDigite o numero:');
  const t = turnos[parseInt(escolha) - 1];
  if (!t) return;

  const folga = confirm('Marcar FOLGA para ' + t.funcionarioNome + ' neste dia?\n\n'
    + 'OK = folga    |    Cancelar = definir horario');
  const gravado = Dados.ativos('turnos').find(x => x.funcionarioId === t.funcionarioId && x.data === iso)
    || Dados.novo({
      funcionarioId: t.funcionarioId, funcionarioNome: t.funcionarioNome,
      setor: t.setor, data: iso, inicio: t.inicio, fim: t.fim, folga: false, observacao: ''
    });

  if (folga) {
    gravado.folga = true;
  } else {
    const inicio = prompt('Entrada (HH:MM):', t.inicio);
    if (inicio === null) return;
    const fim = prompt('Saida (HH:MM):', t.fim);
    if (fim === null) return;
    gravado.folga = false;
    gravado.inicio = inicio;
    gravado.fim = fim;
  }
  Dados.gravar('turnos', gravado, D.Acesso.nome());
  toast('Dia ajustado.');
  render();
}

function dialogoFuncionario(existente) {
  const a = D.Acesso;
  const f = existente || Dados.novo({
    nome: '', cargo: '', setor: a.dono() ? 'MERCEARIA' : a.meuSetor(),
    telefone: '', ativo: true
  });
  const nome = prompt('Nome:', f.nome);
  if (nome === null || !nome.trim()) return;
  const cargo = prompt('Cargo (repositor, caixa, acougueiro...):', f.cargo) || '';
  const setores = D.setoresAtivos();
  const escolha = prompt('Setor:\n' + setores.map((s, i) => (i + 1) + ' = ' + s.nome).join('\n'),
    String(Math.max(1, setores.findIndex(s => s.chave === f.setor) + 1)));
  f.nome = nome.trim();
  f.cargo = cargo.trim();
  if (setores[parseInt(escolha) - 1]) f.setor = setores[parseInt(escolha) - 1].chave;
  Dados.gravar('funcionarios', f, a.nome());
  toast('Equipe atualizada.');
  render();
}

function formPadrao(funcionario, existente) {
  const a = D.Acesso;
  const p = existente || Dados.novo({
    funcionarioId: funcionario.id, funcionarioNome: funcionario.nome, setor: funcionario.setor,
    inicio: ['08:00', '08:00', '08:00', '08:00', '08:00', '08:00', '08:00'],
    fim: ['16:00', '16:00', '16:00', '16:00', '16:00', '16:00', '16:00'],
    folga: [false, false, false, false, false, false, true], ativo: true
  });
  const inicio = p.inicio.slice(), fim = p.fim.slice(), folga = p.folga.slice();
  const total = aviso('');

  function atualizarTotal() {
    total.textContent = 'Total da semana: '
      + D.numero(horasSemana({ inicio, fim, folga })) + ' horas\n'
      + 'Este horario se repete em todos os meses.';
  }

  const linhas = DIAS_SEMANA.map((dia, i) => {
    const ini = campo('', inicio[i], { type: 'time' });
    const f = campo('', fim[i], { type: 'time' });
    const folg = marcador('Folga', folga[i]);
    ini.input.addEventListener('input', () => { inicio[i] = ini.input.value; atualizarTotal(); });
    f.input.addEventListener('input', () => { fim[i] = f.input.value; atualizarTotal(); });
    folg.input.addEventListener('change', () => {
      folga[i] = folg.input.checked;
      ini.input.disabled = f.input.disabled = folga[i];
      atualizarTotal();
    });
    ini.input.disabled = f.input.disabled = folga[i];
    return h('div', { estilo: { marginTop: '10px' } }, [
      h('label', { texto: dia }),
      h('div', { estilo: { display: 'flex', gap: '8px', alignItems: 'center' } },
        [ini.el, f.el, folg.el])
    ]);
  });

  atualizarTotal();
  app().replaceChildren(h('div', {}, [
    cabecalho({ titulo: '🔁 Escala padrao', sub: funcionario.nome + ' — vale para todo mes',
      voltar: () => { ir('escala', { aba: 'equipe' }); render(); } }),
    h('main', {}, [
      aviso('Isto e o horario normal da semana. O mes inteiro nasce assim, automaticamente. '
        + 'Feriado ou troca pontual voce ajusta no dia, sem mexer aqui.'),
      ...linhas, total
    ]),
    barra([
      { texto: 'Salvar escala padrao', onclick: () => {
        Object.assign(p, { inicio, fim, folga, funcionarioNome: funcionario.nome, setor: funcionario.setor });
        Dados.gravar('padroes', p, a.nome());
        toast('Escala padrao salva. O mes ja esta montado.');
        ir('escala', { aba: 'equipe' });
        render();
      } },
      existente ? { texto: 'Remover', classe: 'vermelho', onclick: () => confirmar('Remover padrao',
        'Sem escala padrao os dias ficam vazios. Continuar?', () => {
          Dados.excluir('padroes', p, a.nome());
          ir('escala', { aba: 'equipe' });
          render();
        }) } : null
    ])
  ]));
}

/** Feriados nacionais e datas comerciais, calculados no proprio app. */
function feriadosProximos(dias) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const limite = new Date(hoje.getTime() + dias * 86400000);
  const lista = [];
  [hoje.getFullYear(), hoje.getFullYear() + 1].forEach(ano => lista.push(...feriadosDoAno(ano)));
  return lista
    .map(f => Object.assign(f, {
      dias: Math.round((new Date(f.data + 'T00:00:00') - hoje) / 86400000)
    }))
    .filter(f => f.dias >= 0 && new Date(f.data + 'T00:00:00') <= limite)
    .sort((a, b) => a.data.localeCompare(b.data));
}

function feriadosDoAno(ano) {
  const iso = d => d.toISOString().slice(0, 10);
  const pascoa = calcularPascoa(ano);
  const dia = (m, d) => iso(new Date(ano, m - 1, d));
  const somar = (base, n) => iso(new Date(base.getTime() + n * 86400000));
  const segundoDomingo = mes => {
    const d = new Date(ano, mes - 1, 1);
    const primeiro = (7 - d.getDay()) % 7;
    return iso(new Date(ano, mes - 1, 1 + primeiro + 7));
  };
  const blackFriday = () => {
    const d = new Date(ano, 10, 1);
    const primeiraQuinta = (4 - d.getDay() + 7) % 7;
    return iso(new Date(ano, 10, 1 + primeiraQuinta + 21 + 1));
  };
  return [
    { nome: 'Confraternizacao Universal', data: dia(1, 1), tipo: 'FERIADO' },
    { nome: 'Carnaval', data: somar(pascoa, -47), tipo: 'FERIADO' },
    { nome: 'Sexta-feira Santa', data: somar(pascoa, -2), tipo: 'FERIADO' },
    { nome: 'Pascoa', data: iso(pascoa), tipo: 'COMERCIAL' },
    { nome: 'Tiradentes', data: dia(4, 21), tipo: 'FERIADO' },
    { nome: 'Dia do Trabalho', data: dia(5, 1), tipo: 'FERIADO' },
    { nome: 'Corpus Christi', data: somar(pascoa, 60), tipo: 'FERIADO' },
    { nome: 'Independencia do Brasil', data: dia(9, 7), tipo: 'FERIADO' },
    { nome: 'Nossa Senhora Aparecida', data: dia(10, 12), tipo: 'FERIADO' },
    { nome: 'Finados', data: dia(11, 2), tipo: 'FERIADO' },
    { nome: 'Proclamacao da Republica', data: dia(11, 15), tipo: 'FERIADO' },
    { nome: 'Consciencia Negra', data: dia(11, 20), tipo: 'FERIADO' },
    { nome: 'Natal', data: dia(12, 25), tipo: 'FERIADO' },
    { nome: 'Dia do Consumidor', data: dia(3, 15), tipo: 'COMERCIAL' },
    { nome: 'Dia das Maes', data: segundoDomingo(5), tipo: 'COMERCIAL' },
    { nome: 'Dia dos Namorados', data: dia(6, 12), tipo: 'COMERCIAL' },
    { nome: 'Festa Junina / Sao Joao', data: dia(6, 24), tipo: 'COMERCIAL' },
    { nome: 'Dia dos Pais', data: segundoDomingo(8), tipo: 'COMERCIAL' },
    { nome: 'Dia das Criancas', data: dia(10, 12), tipo: 'COMERCIAL' },
    { nome: 'Black Friday', data: blackFriday(), tipo: 'COMERCIAL' },
    { nome: 'Vespera de Natal', data: dia(12, 24), tipo: 'COMERCIAL' },
    { nome: 'Vespera de Ano Novo', data: dia(12, 31), tipo: 'COMERCIAL' }
  ];
}

function calcularPascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), hh = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - hh - k) % 7;
  const m = Math.floor((a + 11 * hh + 22 * l) / 451);
  const mes = Math.floor((hh + l - 7 * m + 114) / 31);
  const dia = ((hh + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

// ---------------------------------------------------------------- desempenho

const PONTOS = {
  checklist: 10, checklistObs: 3, rotinaPrazo: 5, rotinaAtraso: 2, rotinaPerdida: -3,
  temperatura: 3, temperaturaAcao: 3, contagem: 8, pesquisa: 8, validade: 2,
  quebra: 2, ruptura: 3
};

export function ranking(dias) {
  const limite = D.hoje();
  const inicio = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const fichas = new Map();
  const pega = nome => {
    const chave = (nome || 'Sem identificacao').trim();
    if (!fichas.has(chave)) {
      fichas.set(chave, { nome: chave, pontos: 0, partes: {} });
    }
    return fichas.get(chave);
  };
  const marca = (f, rotulo, pontos) => {
    f.pontos += pontos;
    f.partes[rotulo] = (f.partes[rotulo] || 0) + 1;
  };
  const dentro = d => d && d >= inicio && d <= limite;

  Dados.ativos('respostas').filter(r => r.concluido && dentro(r.data)).forEach(r => {
    const f = pega(r.funcionario || r.autor);
    marca(f, 'checklist', PONTOS.checklist);
    const temObs = (r.observacaoGeral || '').trim()
      || (r.itens || []).some(i => (i.observacao || '').trim());
    if (temObs) f.pontos += PONTOS.checklistObs;
  });

  Dados.ativos('execucoes').filter(e => dentro(e.data)).forEach(e => {
    const quem = (e.funcionario || e.autor || '').trim();
    if (e.feita) {
      const f = pega(quem);
      marca(f, e.atrasada ? 'tarefa com atraso' : 'tarefa no prazo',
        e.atrasada ? PONTOS.rotinaAtraso : PONTOS.rotinaPrazo);
    } else if (e.atrasada && quem) {
      const f = pega(quem);
      marca(f, 'tarefa perdida', PONTOS.rotinaPerdida);
    }
  });

  Dados.ativos('leituras').filter(l => l.registradaAs && dentro(l.data)).forEach(l => {
    const f = pega(l.funcionario || l.autor);
    marca(f, 'temperatura', PONTOS.temperatura);
    if (l.foraDaFaixa && (l.acaoTomada || '').trim()) f.pontos += PONTOS.temperaturaAcao;
  });

  Dados.ativos('contagens').filter(c => c.concluida && dentro(c.data))
    .forEach(c => marca(pega(c.funcionario || c.autor), 'contagem', PONTOS.contagem));
  Dados.ativos('pesquisas').filter(p => p.concluida && dentro(p.data))
    .forEach(p => marca(pega(p.funcionario || p.autor), 'pesquisa', PONTOS.pesquisa));
  Dados.ativos('quebras').filter(q => dentro(q.data))
    .forEach(q => marca(pega(q.autor), 'quebra', PONTOS.quebra));
  Dados.ativos('rupturas').filter(r => dentro(r.data))
    .forEach(r => marca(pega(r.funcionario || r.autor), 'gondola vazia', PONTOS.ruptura));
  Dados.ativos('produtos').filter(p => p.atualizadoEm >= Date.now() - dias * 86400000)
    .forEach(p => marca(pega(p.autor), 'validade', PONTOS.validade));

  return Array.from(fichas.values()).sort((a, b) => b.pontos - a.pontos);
}

function desempenho(registrar) {
  registrar('desempenho', params => {
    const a = D.Acesso;
    if (!a.veTrabalhoDosOutros()) { ir('painel'); return h('div'); }
    const dias = parseInt(params.dias) || 30;

    let fichas = ranking(dias);
    if (!a.dono()) {
      const meuPessoal = Dados.ativos('funcionarios')
        .filter(f => a.veSetor(f.setor)).map(f => f.nome);
      fichas = fichas.filter(f => meuPessoal.includes(f.nome));
    }

    const maior = Math.max(1, ...fichas.map(f => f.pontos));
    const medalhas = ['🥇', '🥈', '🥉'];

    const blocos = fichas.map((f, i) => {
      const cor = i === 0 ? '#F9A825' : i === 1 ? '#90A4AE' : i === 2 ? '#8D6E63' : '#2E7D32';
      const largura = Math.max(3, Math.round(f.pontos * 100 / maior)) + '%';
      return h('div', { class: 'cartao' }, [
        h('div', { class: 'faixa', estilo: { background: cor } }),
        h('div', { class: 'corpo' }, [
          h('div', { class: 'linha' }, [
            h('div', { class: 'titulo', texto: (i < 3 ? medalhas[i] + ' ' : (i + 1) + 'º  ') + f.nome }),
            h('span', { class: 'selo', estilo: { position: 'static', background: cor } },
              f.pontos + ' pts')
          ]),
          h('div', {
            estilo: { height: '8px', borderRadius: '8px', background: cor + '33',
                      marginTop: '8px', overflow: 'hidden' }
          }, [h('div', { estilo: { height: '100%', width: largura, background: cor } })]),
          h('div', { class: 'sub', texto: Object.entries(f.partes)
            .map(([k, n]) => n + ' ' + k).join(' • ') || 'Sem registros no periodo' })
        ])
      ]);
    });

    return h('div', {}, [
      cabecalho({ titulo: '🏆 Desempenho da equipe',
        sub: 'Ultimos ' + dias + ' dias  •  ' + fichas.length + ' pessoa(s) com registros', voltar }),
      h('main', {}, [
        h('div', { estilo: { display: 'flex', gap: '8px', marginBottom: '10px' } }, [
          abaBotao('7 dias', dias === 7, () => { ir('desempenho', { dias: 7 }); render(); }),
          abaBotao('30 dias', dias === 30, () => { ir('desempenho', { dias: 30 }); render(); })
        ]),
        ...(blocos.length ? blocos : [vazio('Ninguem registrou nada no periodo.\n\n'
          + 'Os pontos aparecem sozinhos conforme a equipe fecha checklist, cumpre o '
          + 'cronograma, confere temperatura e registra contagem, validade, quebra ou '
          + 'gondola vazia.')]),
        h('div', { class: 'sub', estilo: { marginTop: '16px', fontSize: '11px' } },
          'Como pontua: checklist +' + PONTOS.checklist + ', tarefa no prazo +' + PONTOS.rotinaPrazo
          + ', temperatura +' + PONTOS.temperatura + ', contagem +' + PONTOS.contagem
          + ', pesquisa +' + PONTOS.pesquisa + ', validade +' + PONTOS.validade
          + ', quebra +' + PONTOS.quebra + ', gondola vazia +' + PONTOS.ruptura
          + '. Tarefa perdida ' + PONTOS.rotinaPerdida + '.')
      ])
    ]);
  });
}
