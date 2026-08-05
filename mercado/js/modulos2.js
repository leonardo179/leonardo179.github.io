/*
 * Os demais modulos do dia a dia: estoque e paletes, contagem, preco do
 * concorrente, gondola vazia, desistencias no caixa, escala e desempenho.
 * Mesmas regras do aplicativo Android.
 */
import { Dados, Prefs } from './dados.js?v=202608051921';
import * as D from './dominio.js?v=202608051921';
import { h, cabecalho, cartao, campo, area, lista, marcador, barra, vazio, aviso, toast, confirmar, modal,
  leitorCodigoBarras, botaoScan } from './ui.js?v=202608051921';
import { PRODUTOS_SEMENTE } from './semente.js?v=202608051921';

let ir, voltar, render;

export function instalarModulos2(api) {
  ir = api.ir; voltar = api.voltar; render = api.render;
  estoque(api.registrar);
  importarProdutos(api.registrar);
  contagem(api.registrar);
  precos(api.registrar);
  ruptura(api.registrar);
  desistencias(api.registrar);
  escala(api.registrar);
  desempenho(api.registrar);
}

/**
 * Abre a camera, acha o produto pelo codigo no catalogo e devolve a ficha —
 * ou, se o codigo for novo na loja, pede o nome uma unica vez e cadastra ali
 * mesmo. Mesmo espirito do leitor do Android: codigo conhecido reconhece na
 * hora, codigo novo aprende com uma pergunta so.
 */
export function scannearProduto(aoIdentificar) {
  leitorCodigoBarras(codigo => {
    const achado = Dados.ativos('catalogo').find(c => c.codigo === codigo);
    if (achado) { toast('Bipado: ' + achado.nome); aoIdentificar(achado); return; }
    cadastrarPorCodigo(codigo, aoIdentificar);
  });
}

function cadastrarPorCodigo(codigo, aoIdentificar) {
  const a = D.Acesso;
  const nome = campo('Nome do produto', '');
  const setorSel = lista('Setor', opcoesSetor(), a.dono() ? 'MERCEARIA' : a.meuSetor());
  modal({
    titulo: 'Produto novo: ' + codigo,
    textoOk: 'Cadastrar',
    conteudo: [
      aviso('Este codigo ainda nao existe na loja. Cadastre uma vez e todo mundo passa a reconhecer ele.'),
      nome.el, setorSel.el
    ],
    aoConfirmar: () => {
      if (!nome.input.value.trim()) { toast('Sem nome nao da para cadastrar.'); return false; }
      const c = Dados.gravar('catalogo', Dados.novo({
        codigo, nome: nome.input.value.trim(), marca: '', setor: setorSel.input.value,
        unidade: 'UND', porCaixa: 12, preco: 0
      }), a.nome());
      aoIdentificar(c);
    }
  });
}

const opcoesSetor = () =>
  D.setoresAtivos().map(s => ({ valor: s.chave, texto: s.icone + ' ' + s.nome }));

const opcoesUnidade = () =>
  Object.entries(D.UNIDADES).map(([k, v]) => ({ valor: k, texto: v.sigla }));

const app = () => document.getElementById('app');

/** Escala o funcionario le; quem monta e o dono ou o lider do setor. */
const soChefeMexeNaEscala = titulo => h('div', {}, [
  cabecalho({ titulo, voltar }),
  h('main', {}, [vazio('Quem monta a escala e o dono ou o lider do setor.\n'
    + 'Volte para ver o seu horario.')])
]);

/** Quem nao cuida do caixa nao ve o que ficou largado la. */
const semAcessoAoCaixa = () => h('div', {}, [
  cabecalho({ titulo: '🛒 Desistencias no caixa', voltar }),
  h('main', {}, [vazio('Esta tela e da frente de caixa.\n'
    + 'Fale com o dono se voce tambem cuida do caixa.')])
]);

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
  telaDeposito(registrar);

  registrar('estoque', params => {
    const a = D.Acesso;
    const aba = params.aba || 'produtos';
    const busca = campo('', '', { placeholder: aba === 'paletes'
      ? 'Buscar produto ou endereco (A3)...' : 'Buscar produto, marca ou codigo...' });
    const corpo = h('div', {});

    const troca = h('div', { estilo: { display: 'flex', gap: '6px', margin: '4px 0 10px' } }, [
      abaBotao('Produtos', aba === 'produtos', () => ir('estoque', { aba: 'produtos' })),
      abaBotao('Paletes', aba === 'paletes', () => ir('estoque', { aba: 'paletes' })),
      abaBotao('🗺 Mapa', false, () => ir('deposito'))
    ]);

    function desenharPaletes(termo) {
      const paletes = Dados.ativos('paletes')
        .filter(x => a.veSetor(x.setor))
        .filter(x => !termo || (x.codigo + ' ' + endereco(x) + ' '
          + (x.itens || []).map(i => i.produto).join(' ')).toLowerCase().includes(termo))
        .sort((x, y) => (x.rua || '').localeCompare(y.rua || '') || (x.posicao || 0) - (y.posicao || 0));

      corpo.replaceChildren(...(paletes.length ? paletes.map(x => cartao({
        cor: D.setor(x.setor).cor,
        icone: '\ud83d\udce6',
        titulo: 'Palete ' + endereco(x) + (x.codigo ? '  (' + x.codigo + ')' : ''),
        sub: D.setor(x.setor).icone + ' ' + D.setor(x.setor).nome
          + '  \u2022  ' + (x.itens || []).length + ' item(ns)',
        extra: resumoPalete(x),
        destaque: x.observacao ? { texto: x.observacao, cor: D.setor(x.setor).cor } : null,
        onclick: () => formPalete(x)
      })) : [vazio(termo ? 'Nada encontrado para "' + termo + '".'
        : 'Nenhum palete cadastrado.\nToque em Novo palete para comecar o mapa.')]));
    }

    function desenharProdutos(termo) {
      const produtos = Dados.ativos('catalogo')
        .filter(c => a.veSetor(c.setor))
        .filter(c => !termo || ((c.nome || '') + ' ' + (c.marca || '') + ' '
          + (c.codigo || '')).toLowerCase().includes(termo))
        .sort((x, y) => (x.nome || '').localeCompare(y.nome || ''));

      corpo.replaceChildren(...(produtos.length ? produtos.map(c => {
        // Validade no proprio item do estoque: quem abre a lista quer saber o que
        // ja esta com data marcada sem ter que ir ate o outro modulo conferir.
        const lotes = validadesDoProduto(c.nome).filter(p => !p.resolvido)
          .sort((x, y) => x.validade.localeCompare(y.validade));
        const proximo = lotes[0];
        const f = proximo ? D.faixa(proximo) : null;

        return cartao({
          cor: f && f.chave !== 'OK' ? f.cor : D.setor(c.setor).cor,
          icone: D.setor(c.setor).icone,
          titulo: c.nome || 'Sem nome',
          sub: (c.marca ? c.marca + '  \u2022  ' : '') + D.setor(c.setor).nome
            + (c.codigo ? '  \u2022  ' + c.codigo : ''),
          extra: [
            (D.UNIDADES[c.unidade] || D.UNIDADES.UND).sigla
              + (D.temFator(c.unidade) && c.porCaixa > 1 ? ' de ' + c.porCaixa + ' und' : ''),
            c.preco > 0 ? D.moeda(c.preco) : null,
            // Cada lote com a sua data: "45 und vence 12/08  \u2022  60 und vence 02/09".
            ...lotes.slice(0, 3).map(p => D.quantidadeTexto(p) + ' vence ' + D.data(p.validade)
              + (p.lote ? ' (lote ' + p.lote + ')' : ''))
          ].filter(Boolean).join('\n')
            + (lotes.length > 3 ? '\n+ ' + (lotes.length - 3) + ' lote(s)' : ''),
          selo: proximo
            ? { texto: lotes.length > 1 ? lotes.length + ' lotes \u2022 ' + D.data(proximo.validade)
                : 'vence ' + D.data(proximo.validade), cor: f.cor }
            : { texto: 'sem validade', cor: '#90A4AE' },
          botoes: a.configura(c.setor)
            ? [{ texto: 'Lancar validade', onclick: () => lancarValidade(c, desenhar) },
               { texto: 'Editar', sec: true, onclick: () => formProduto(c, desenhar) },
               { texto: 'Excluir', sec: true, onclick: () => excluirProduto(c, desenhar) }] : null,
          onclick: () => formProduto(c, desenhar)
        });
      }) : [vazio(termo ? 'Nada encontrado para "' + termo + '".'
        : 'Nenhum produto cadastrado.\nCadastre aqui e ele ja aparece nas outras telas.')]));
    }

    function desenhar() {
      const termo = busca.input.value.trim().toLowerCase();
      if (aba === 'paletes') desenharPaletes(termo); else desenharProdutos(termo);
    }
    busca.input.addEventListener('input', desenhar);
    desenhar();

    const linhaBusca = h('div', { estilo: { display: 'flex', gap: '8px', alignItems: 'flex-end' } }, [
      h('div', { estilo: { flex: '1' } }, busca.el),
      aba === 'paletes' ? null : botaoScan(() => leitorCodigoBarras(codigo => {
        busca.input.value = codigo;
        desenhar();
      }))
    ]);

    return h('div', {}, [
      cabecalho({ titulo: '\ud83d\udce6 Estoque',
        sub: aba === 'paletes' ? 'Quantos tem e onde estao'
          : Dados.ativos('catalogo').length + ' produto(s) cadastrados', voltar,
        acao: aba === 'paletes' ? null : { texto: '\ud83d\udce5 Importar', onclick: () => ir('estoque-importar') } }),
      h('main', {}, [troca, linhaBusca, corpo]),
      h('button', { class: 'fab', onclick: () => aba === 'paletes'
        ? formPalete(null) : formProduto(null, desenhar) },
        aba === 'paletes' ? 'Novo palete' : 'Novo produto')
    ]);
  });
}

/**
 * Cadastro em massa: produtos comuns de mercado, ja com codigo de barras,
 * agrupados por setor. O dono marca so o que a loja dele vende — ninguem e
 * obrigado a aceitar a lista inteira — e cada um entra editavel depois,
 * igual a um cadastro manual.
 */
function importarProdutos(registrar) {
  registrar('estoque-importar', () => {
    const a = D.Acesso;
    const jaTem = new Set(Dados.ativos('catalogo').map(c => c.codigo).filter(Boolean));
    const marcados = new Set();
    let filtro = '';

    const porSetor = {};
    PRODUTOS_SEMENTE.forEach(p => {
      if (!a.veSetor(p.setor)) return;
      (porSetor[p.setor] = porSetor[p.setor] || []).push(p);
    });

    const corpo = h('main', {});
    const rodapeTexto = h('div', { class: 'contador' });
    const btImportar = h('button', { onclick: () => importar() }, 'Importar selecionados');

    const chave = p => p.codigo || (p.nome + '|' + p.setor);

    function atualizarRodape() {
      rodapeTexto.textContent = marcados.size
        ? marcados.size + ' produto(s) selecionados'
        : 'Marque os produtos que a sua loja vende.';
      btImportar.disabled = !marcados.size;
    }

    function linha(p) {
      const k = chave(p);
      const jaCadastrado = p.codigo && jaTem.has(p.codigo);
      const caixa = h('input', { type: 'checkbox', disabled: jaCadastrado });
      caixa.checked = marcados.has(k);
      const alternar = () => {
        if (jaCadastrado) return;
        if (marcados.has(k)) marcados.delete(k); else marcados.add(k);
        caixa.checked = marcados.has(k);
        atualizarRodape();
      };
      caixa.onclick = ev => { ev.stopPropagation(); alternar(); };
      return h('div', {
        class: 'linha-marcar', estilo: jaCadastrado ? { opacity: '.5' } : null,
        onclick: alternar
      }, [
        caixa,
        h('div', { class: 'texto' }, [
          h('b', { texto: p.nome + (p.marca ? ' - ' + p.marca : '') }),
          h('small', { texto: (jaCadastrado ? 'ja cadastrado  •  ' : '') + (p.codigo || 'sem codigo') })
        ])
      ]);
    }

    function desenhar() {
      const f = filtro.trim().toLowerCase();
      const grupos = Object.entries(porSetor)
        .map(([setorChave, itens]) => [setorChave, itens.filter(p =>
          !f || (p.nome + ' ' + (p.marca || '') + ' ' + (p.codigo || '')).toLowerCase().includes(f))])
        .filter(([, itens]) => itens.length)
        .sort((x, y) => D.setor(x[0]).nome.localeCompare(D.setor(y[0]).nome));

      const filhos = grupos.map(([setorChave, itens]) => {
        const disponiveis = itens.filter(p => !(p.codigo && jaTem.has(p.codigo)));
        return h('div', {}, [
          h('div', {
            class: 'rotulo-secao', estilo: { display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', cursor: disponiveis.length ? 'pointer' : 'default' },
            onclick: () => {
              if (!disponiveis.length) return;
              const todosMarcados = disponiveis.every(p => marcados.has(chave(p)));
              disponiveis.forEach(p => todosMarcados ? marcados.delete(chave(p)) : marcados.add(chave(p)));
              desenhar();
              atualizarRodape();
            }
          }, [
            h('span', { texto: D.setor(setorChave).icone + ' ' + D.setor(setorChave).nome }),
            disponiveis.length ? h('span', { estilo: { color: '#2E7D32', fontWeight: '700', fontSize: '11px' },
              texto: 'marcar todos' }) : null
          ].filter(Boolean)),
          ...itens.map(linha)
        ]);
      });

      corpo.replaceChildren(...(filhos.length ? filhos
        : [vazio(f ? 'Nada encontrado para "' + f + '".'
          : PRODUTOS_SEMENTE.length ? 'Nenhum produto disponivel para os seus setores.'
            : 'Lista ainda nao carregada. Tente novamente mais tarde.')]));
    }

    function importar() {
      let n = 0;
      PRODUTOS_SEMENTE.forEach(p => {
        if (!marcados.has(chave(p))) return;
        if (p.codigo && jaTem.has(p.codigo)) return;
        Dados.gravar('catalogo', Dados.novo({
          codigo: p.codigo || '', nome: p.nome, marca: p.marca || '', setor: p.setor,
          unidade: p.unidade || 'UND', porCaixa: p.porCaixa || 1, preco: 0
        }), a.nome());
        n++;
      });
      toast(n + ' produto(s) importados. Edite preco e codigo quando precisar.');
      ir('estoque');
      render();
    }

    const busca = campo('', '', { placeholder: 'Procurar na lista pronta...' });
    busca.input.oninput = () => { filtro = busca.input.value; desenhar(); };

    desenhar();
    atualizarRodape();

    return h('div', {}, [
      cabecalho({ titulo: '📥 Importar produtos',
        sub: 'Marque o que a sua loja vende — o resto fica editavel depois',
        voltar: () => { ir('estoque'); render(); } }),
      h('div', { class: 'topo-marcar' }, busca.el),
      corpo,
      h('div', { class: 'rodape-marcar' }, [rodapeTexto, btImportar])
    ]);
  });
}

/** Lotes de validade ja lancados para este produto. */
const validadesDoProduto = nome => Dados.ativos('produtos')
  .filter(p => (p.nome || '').trim().toLowerCase() === (nome || '').trim().toLowerCase());

/**
 * Excluir produto do cadastro. Os lotes de validade dele ficam orfaos na tela de
 * validades, entao a pergunta e honesta: some so o cadastro ou some tudo.
 */
function excluirProduto(c, aoSalvar) {
  const a = D.Acesso;
  if (!a.configura(c.setor)) return toast('Sem permissao para excluir neste setor.');

  const lotes = validadesDoProduto(c.nome).filter(p => !p.resolvido);
  const tambemLotes = marcador('Apagar tambem os ' + lotes.length + ' lote(s) de validade', true);

  modal({
    titulo: 'Excluir ' + c.nome,
    textoOk: 'Excluir',
    conteudo: [
      aviso('O historico de quebra, contagem e falta que ja citou este produto continua '
        + 'como esta — o que sai e o cadastro.', '#455A64'),
      lotes.length ? tambemLotes.el : null,
      lotes.length ? h('div', { class: 'sub' }, lotes
        .map(p => '• ' + D.quantidadeTexto(p) + ' vence ' + D.data(p.validade)).join('\n')) : null
    ].filter(Boolean),
    aoConfirmar: () => {
      if (lotes.length && tambemLotes.input.checked) {
        lotes.forEach(p => Dados.excluir('produtos', p, a.nome()));
      }
      Dados.excluir('catalogo', c, a.nome());
      toast(c.nome + ' excluido do cadastro.');
      if (aoSalvar) aoSalvar();
    }
  });
}

/**
 * Cadastro do produto em si. E esta lista que alimenta a busca da contagem, das
 * faltas na gondola, das desistencias e do leitor de codigo de barras — por isso
 * ela merece um cadastro proprio, e nao so nascer de um bipe.
 */
function formProduto(existente, aoSalvar) {
  const a = D.Acesso;
  const c = existente || Dados.novo({
    codigo: '', nome: '', marca: '', setor: a.dono() ? 'MERCEARIA' : a.meuSetor(),
    unidade: 'UND', porCaixa: 12, preco: 0
  });

  const nome = campo('Nome do produto', c.nome);
  const marca = campo('Marca', c.marca || '');
  const codigo = campo('Codigo de barras', c.codigo || '', { inputmode: 'numeric' });
  const linhaCodigo = h('div', { estilo: { display: 'flex', gap: '8px', alignItems: 'flex-end' } }, [
    h('div', { estilo: { flex: '1' } }, codigo.el),
    botaoScan(() => leitorCodigoBarras(lido => { codigo.input.value = lido; }))
  ]);
  const setorSel = lista('Setor', opcoesSetor(), c.setor);
  const unidade = lista('Como e vendido', opcoesUnidade(), c.unidade || 'UND');
  const porCaixa = campo(D.rotuloFator(c.unidade), String(c.porCaixa || 1), { type: 'number' });
  const preco = campo('Preco de venda', c.preco ? D.numero(c.preco) : '', { inputmode: 'decimal' });

  // Vendido por unidade nao tem "quantas vem na caixa". O campo some em vez de
  // ficar pedindo um numero que nao existe.
  const ajustarFator = () => {
    const mostra = D.temFator(unidade.input.value);
    porCaixa.el.style.display = mostra ? '' : 'none';
    porCaixa.el.querySelector('label').textContent = D.rotuloFator(unidade.input.value);
    if (!mostra) porCaixa.input.value = 1;
  };
  unidade.input.addEventListener('change', ajustarFator);
  setTimeout(ajustarFator);

  const lotes = existente ? validadesDoProduto(c.nome).filter(p => !p.resolvido)
    .sort((x, y) => x.validade.localeCompare(y.validade)) : [];

  modal({
    titulo: existente ? c.nome || 'Produto' : 'Novo produto',
    conteudo: [nome.el, marca.el, linhaCodigo, setorSel.el, unidade.el, porCaixa.el, preco.el,
      lotes.length ? h('div', { class: 'rotulo-secao' }, 'Lotes em estoque') : null,
      lotes.length ? h('div', { class: 'sub', texto: lotes
        .map(p => '• ' + D.quantidadeTexto(p) + ' vence ' + D.data(p.validade)
          + (p.lote ? '  (lote ' + p.lote + ')' : '')).join('\n') }) : null,
      existente ? h('div', { class: 'sub', estilo: { marginTop: '10px' },
        texto: lotes.length ? 'Use "Lancar validade" para somar mais um lote com outra data.'
          : 'Nenhum lote de validade lancado ainda.' }) : null
    ].filter(Boolean),
    aoConfirmar: () => {
      if (!nome.input.value.trim()) { toast('Falta o nome do produto.'); return false; }
      const codigoNovo = codigo.input.value.trim();
      const repetido = Dados.ativos('catalogo')
        .find(x => x.id !== c.id && codigoNovo && x.codigo === codigoNovo);
      if (repetido) { toast('Este codigo ja e de ' + repetido.nome + '.'); return false; }

      Object.assign(c, {
        nome: nome.input.value.trim(), marca: marca.input.value.trim(), codigo: codigoNovo,
        setor: setorSel.input.value, unidade: unidade.input.value,
        porCaixa: D.temFator(unidade.input.value)
          ? Math.max(1, parseInt(porCaixa.input.value) || 1) : 1,
        preco: D.lerNumero(preco.input.value),
        incompleto: false
      });
      Dados.gravar('catalogo', c, a.nome());
      toast('Produto salvo.');
      if (aoSalvar) aoSalvar();
    }
  });
}

/**
 * Do cadastro para a validade. Cada chamada cria um LOTE novo: 45 und da bolacha
 * que vence dia 12 e 60 und da mesma bolacha que vence dia 02 sao duas linhas,
 * nao uma que sobrescreve a outra.
 */
function lancarValidade(c, aoSalvar) {
  const a = D.Acesso;
  const validade = campo('Vence em', D.hoje(), { type: 'date' });
  const quantidade = campo('Quantidade', '1', { type: 'number', inputmode: 'decimal' });
  const unidade = lista('Unidade', opcoesUnidade(), c.unidade || 'UND');
  const fator = campo(D.rotuloFator(c.unidade), String(c.porCaixa || 1), { type: 'number' });
  const lote = campo('Lote (opcional)', '');

  const ajustarFator = () => {
    const mostra = D.temFator(unidade.input.value);
    fator.el.style.display = mostra ? '' : 'none';
    fator.el.querySelector('label').textContent = D.rotuloFator(unidade.input.value);
    if (!mostra) fator.input.value = 1;
  };
  unidade.input.addEventListener('change', ajustarFator);
  setTimeout(ajustarFator);

  const jaTem = validadesDoProduto(c.nome).filter(p => !p.resolvido)
    .sort((x, y) => x.validade.localeCompare(y.validade));

  modal({
    titulo: 'Novo lote de ' + c.nome,
    textoOk: 'Lancar lote',
    conteudo: [
      jaTem.length ? aviso('Ja existe(m) ' + jaTem.length + ' lote(s) deste produto:\n'
        + jaTem.map(p => '• ' + D.quantidadeTexto(p) + ' vence ' + D.data(p.validade)).join('\n')
        + '\n\nEste vai ser mais um, separado.', '#0277BD') : null,
      validade.el, quantidade.el, unidade.el, fator.el, lote.el
    ].filter(Boolean),
    aoConfirmar: () => {
      if (!validade.input.value) { toast('Falta a data de validade.'); return false; }
      const qtd = D.lerNumero(quantidade.input.value);
      if (qtd <= 0) { toast('Coloque a quantidade do lote.'); return false; }

      const igual = jaTem.find(p => p.validade === validade.input.value
        && (p.lote || '') === lote.input.value.trim());
      if (igual) {
        toast('Ja existe um lote com essa data. Edite ele em Validades.');
        return false;
      }

      Dados.gravar('produtos', Dados.novo({
        nome: c.nome, marca: c.marca || '', setor: c.setor, validade: validade.input.value,
        quantidade: qtd,
        unidade: unidade.input.value,
        fator: D.temFator(unidade.input.value)
          ? Math.max(1, parseInt(fator.input.value) || 1) : 1,
        precoUnitario: c.preco || 0, lote: lote.input.value.trim(),
        localizacao: '', observacao: '', resolvido: false,
        avisou30: false, avisou15: false, avisou2: false
      }), a.nome());
      toast('Lote lancado.');
      if (aoSalvar) aoSalvar();
    }
  });
}

// ------------------------------------------------------- mapa do deposito

/**
 * Endereco de palete: corredor + posicao + lado + nivel. O lado existe porque
 * "palete A3" sozinho manda a pessoa procurar nos dois lados do corredor.
 */
const LADOS = [
  { valor: 'E', texto: 'Esquerda', curto: 'ESQ' },
  { valor: 'D', texto: 'Direita', curto: 'DIR' }
];

const endereco = p => (p.rua || 'A') + (p.posicao || 1)
  + (p.lado ? '-' + p.lado : '') + (p.nivel ? '-N' + p.nivel : '');

/** Corredores que o dono desenhou; sem nenhum, o mapa usa o que os paletes dizem. */
function corredores() {
  const salvos = Dados.ativos('corredores')
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || (a.nome || '').localeCompare(b.nome || ''));
  if (salvos.length) return salvos;

  // Deposito ainda nao desenhado: o mapa nasce do que ja existe cadastrado, para
  // a tela nunca aparecer vazia para quem ja tem palete lancado.
  const mapa = new Map();
  Dados.ativos('paletes').forEach(p => {
    const nome = p.rua || 'A';
    const c = mapa.get(nome) || { id: 'auto:' + nome, nome, posicoes: 1, niveis: 1,
      lados: ['E', 'D'], automatico: true };
    c.posicoes = Math.max(c.posicoes, p.posicao || 1);
    c.niveis = Math.max(c.niveis, (p.nivel || 0) + 1);
    mapa.set(nome, c);
  });
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

const paleteEm = (corredor, posicao, lado, nivel) => Dados.ativos('paletes').find(p =>
  (p.rua || 'A') === corredor && (p.posicao || 1) === posicao
  && (p.lado || 'E') === lado && (p.nivel || 0) === nivel);

/** O mapa em si: cada corredor visto de cima, com os dois lados e os niveis. */
function telaDeposito(registrar) {
  registrar('deposito', () => {
    const a = D.Acesso;
    const lista = corredores();
    const automatico = lista.length && lista[0].automatico;

    const desenharCorredor = c => {
      const lados = (c.lados && c.lados.length ? c.lados : ['E', 'D']);
      const colunaLado = ladoChave => {
        const posicoes = [];
        for (let pos = 1; pos <= (c.posicoes || 1); pos++) {
          const niveis = [];
          // Nivel mais alto em cima, como a prateleira e vista de frente.
          for (let n = (c.niveis || 1) - 1; n >= 0; n--) {
            const p = paleteEm(c.nome, pos, ladoChave, n);
            const cor = p ? D.setor(p.setor).cor : null;
            niveis.push(h('div', {
              class: 'celula' + (p ? ' cheia' : ''),
              estilo: p ? { background: cor, borderColor: cor } : {},
              onclick: () => p ? formPalete(p)
                : (a.configura(null)
                  ? formPalete(null, { rua: c.nome, posicao: pos, lado: ladoChave, nivel: n })
                  : toast('Posicao vazia.'))
            }, p ? [
              h('b', { texto: (n ? 'N' + n + '  ' : 'Chao  ') + (p.codigo || '') }),
              h('small', { texto: resumoPalete(p) })
            ] : [
              h('small', { texto: (n ? 'N' + n : 'Chao') + ' — vazio' })
            ]));
          }
          posicoes.push(h('div', { class: 'pos' }, [
            h('div', { class: 'num', texto: c.nome + pos }),
            h('div', { class: 'niveis' }, niveis)
          ]));
        }
        return h('div', { class: 'lado' }, [
          h('div', { class: 'rotulo-lado',
            texto: (LADOS.find(l => l.valor === ladoChave) || LADOS[0]).curto }),
          ...posicoes
        ]);
      };

      const ocupados = Dados.ativos('paletes').filter(p => (p.rua || 'A') === c.nome).length;
      return h('div', { class: 'corredor' }, [
        h('div', { class: 'cab' }, [
          h('b', { texto: 'Corredor ' + c.nome }),
          h('small', { texto: ocupados + ' palete(s)  •  ' + (c.posicoes || 1) + ' posicao(oes)  •  '
            + (c.niveis || 1) + ' nivel(is)' }),
          a.configuraLoja() && !c.automatico
            ? h('span', { estilo: { cursor: 'pointer', fontSize: '18px' },
                onclick: () => formCorredor(c) }, '✎') : null
        ].filter(Boolean)),
        h('div', { class: 'corredor-grade' }, [
          colunaLado(lados[0] || 'E'),
          h('div', { class: 'via' }, [h('span', { texto: 'CORREDOR' })]),
          lados.length > 1 ? colunaLado(lados[1]) : null
        ].filter(Boolean))
      ]);
    };

    return h('div', {}, [
      cabecalho({ titulo: '🗺 Mapa do deposito',
        sub: lista.length + ' corredor(es)  •  '
          + Dados.ativos('paletes').length + ' palete(s)',
        voltar,
        acao: a.configuraLoja()
          ? { texto: '＋ Corredor', onclick: () => formCorredor(null) } : null }),
      h('main', {}, lista.length ? [
        automatico
          ? aviso('Este mapa foi montado a partir dos paletes ja cadastrados. '
            + (a.configuraLoja()
              ? 'Toque em "＋ Corredor" para desenhar o deposito do jeito que ele e.'
              : 'O dono pode desenhar os corredores de verdade.'), '#0277BD')
          : aviso('Toque numa posicao vazia para colocar um palete ali; '
            + 'toque num palete para ver o que tem dentro.', '#455A64'),
        ...lista.map(desenharCorredor)
      ] : [vazio('Deposito ainda sem corredores.\n'
        + (a.configuraLoja() ? 'Toque em "＋ Corredor" para desenhar o seu.'
          : 'Peca ao dono para desenhar o deposito.'))])
    ]);
  });
}

/** Onde o dono descreve um corredor do deposito dele. */
function formCorredor(existente) {
  const a = D.Acesso;
  if (!a.configuraLoja()) return toast('Só o dono desenha o deposito.');

  const c = existente && !existente.automatico ? existente : Dados.novo({
    nome: existente ? existente.nome : proximaLetraCorredor(),
    posicoes: existente ? existente.posicoes : 6,
    niveis: existente ? existente.niveis : 2,
    lados: ['E', 'D'],
    ordem: Dados.ativos('corredores').length
  });

  const nome = campo('Nome do corredor (A, B, Rua 1...)', c.nome);
  const posicoes = campo('Quantas posicoes tem o corredor', c.posicoes || 6, { type: 'number' });
  const niveis = campo('Quantos niveis empilham (1 = so o chao)', c.niveis || 1, { type: 'number' });
  const esq = marcador('Tem palete do lado esquerdo', (c.lados || []).includes('E'));
  const dir = marcador('Tem palete do lado direito', (c.lados || []).includes('D'));

  modal({
    titulo: existente ? 'Corredor ' + c.nome : 'Novo corredor',
    conteudo: [
      aviso('Desenhe como o deposito e de verdade: quantas posicoes o corredor tem '
        + 'de ponta a ponta, quantos paletes empilham em cada uma e se ha mercadoria '
        + 'dos dois lados.', '#455A64'),
      nome.el, posicoes.el, niveis.el, esq.el, dir.el
    ],
    aoConfirmar: () => {
      const lados = [esq.input.checked ? 'E' : null, dir.input.checked ? 'D' : null].filter(Boolean);
      if (!nome.input.value.trim()) { toast('Falta o nome do corredor.'); return false; }
      if (!lados.length) { toast('Marque pelo menos um lado.'); return false; }
      Object.assign(c, {
        nome: nome.input.value.trim().toUpperCase(),
        posicoes: Math.max(1, parseInt(posicoes.input.value) || 1),
        niveis: Math.max(1, parseInt(niveis.input.value) || 1),
        lados
      });
      delete c.automatico;
      Dados.gravar('corredores', c, a.nome());
      toast('Corredor ' + c.nome + ' salvo.');
      ir('deposito');
      render();
    }
  });
}

const proximaLetraCorredor = () => {
  const usados = new Set(Dados.ativos('corredores').map(c => (c.nome || '').toUpperCase()));
  for (let i = 0; i < 26; i++) {
    const letra = String.fromCharCode(65 + i);
    if (!usados.has(letra)) return letra;
  }
  return 'A';
};

function resumoPalete(p) {
  const itens = p.itens || [];
  if (!itens.length) return 'Vazio';
  return itens.slice(0, 3).map(i => textoItemPalete(i)).join('  |  ')
    + (itens.length > 3 ? '  |  +' + (itens.length - 3) : '');
}

const textoItemPalete = i =>
  D.numero(i.quantidade || 0) + ' ' + (D.UNIDADES[i.unidade] || D.UNIDADES.UND).sigla + '  ' + i.produto
  + (i.validade ? '  •  vence ' + D.data(i.validade) : '')
  + (i.lote ? '  (lote ' + i.lote + ')' : '');

function formPalete(existente, posicaoInicial) {
  const a = D.Acesso;
  const p = existente || Dados.novo(Object.assign({
    codigo: 'Palete ' + (Dados.ativos('paletes').length + 1),
    setor: a.dono() ? 'DEPOSITO' : a.meuSetor(),
    rua: 'A', posicao: 1, lado: 'E', nivel: 0, observacao: '', itens: []
  }, posicaoInicial || {}));
  const itens = (p.itens || []).map(i => ({ ...i }));

  const codigo = campo('Identificacao', p.codigo);
  const setorSel = lista('Setor dono da mercadoria', opcoesSetor(), p.setor);
  const rua = campo('Corredor', p.rua || 'A');
  const posicao = campo('Posicao', p.posicao || 1, { type: 'number' });
  const ladoSel = lista('Lado do corredor',
    LADOS.map(l => ({ valor: l.valor, texto: l.texto })), p.lado || 'E');
  const nivel = campo('Nivel (0 = chao)', p.nivel || 0, { type: 'number' });
  const obs = area('Observacao', p.observacao);
  const ondeFica = aviso('', '#455A64');

  function atualizarEndereco() {
    const tmp = {
      rua: (rua.input.value.trim() || 'A').toUpperCase(),
      posicao: Math.max(1, parseInt(posicao.input.value) || 1),
      lado: ladoSel.input.value,
      nivel: Math.max(0, parseInt(nivel.input.value) || 0)
    };
    const ocupante = paleteEm(tmp.rua, tmp.posicao, tmp.lado, tmp.nivel);
    const lado = (LADOS.find(l => l.valor === tmp.lado) || LADOS[0]).texto.toLowerCase();
    ondeFica.textContent = 'Endereco: ' + endereco(tmp) + '\n'
      + 'Corredor ' + tmp.rua + ', posicao ' + tmp.posicao + ', lado ' + lado + ', '
      + (tmp.nivel ? 'nivel ' + tmp.nivel : 'no chao') + '.'
      + (ocupante && ocupante.id !== p.id
        ? '\n⚠ Ja existe o palete "' + ocupante.codigo + '" nessa posicao.' : '');
  }
  [rua, posicao, nivel].forEach(c => c.input.addEventListener('input', atualizarEndereco));
  ladoSel.input.addEventListener('change', atualizarEndereco);
  setTimeout(atualizarEndereco);

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
      codigo: codigo.input.value.trim() || ('Palete ' + (Dados.ativos('paletes').length + 1)),
      setor: setorSel.input.value,
      rua: (rua.input.value.trim() || 'A').toUpperCase(),
      posicao: Math.max(1, parseInt(posicao.input.value) || 1),
      lado: ladoSel.input.value,
      nivel: Math.max(0, parseInt(nivel.input.value) || 0),
      observacao: obs.input.value.trim(),
      itens: itens.filter(i => i.produto)
    });
    Dados.gravar('paletes', p, a.nome());
    toast('Palete ' + endereco(p) + ' salvo.');
    ir('deposito');
    render();
  }

  app().replaceChildren(h('div', {}, [
    cabecalho({ titulo: existente ? '📦 ' + p.codigo : '📦 Novo palete',
      sub: 'Diga onde ele esta e o que tem nele',
      voltar: () => { ir('deposito'); render(); } }),
    h('main', {}, [
      codigo.el, setorSel.el,
      h('div', { class: 'rotulo-secao' }, 'Onde ele esta no deposito'),
      h('div', { estilo: { display: 'flex', gap: '8px' } }, [rua.el, posicao.el, nivel.el]),
      ladoSel.el, ondeFica,
      h('div', { class: 'rotulo-secao' }, 'Produtos no palete'),
      editor.caixa,
      h('div', { class: 'aviso-instalar', estilo: { cursor: 'pointer', fontWeight: '700',
        color: '#2E7D32' }, onclick: novoItem }, '＋  Adicionar produto ao palete'),
      obs.el
    ]),
    barra([
      { texto: 'Salvar', onclick: salvar },
      existente ? { texto: 'Excluir', classe: 'vermelho', onclick: () => confirmar('Excluir palete',
        'Remover o palete ' + endereco(p) + ' do mapa?', () => {
          Dados.excluir('paletes', p, a.nome()); ir('deposito'); render();
        }) } : null
    ])
  ]));
}

/**
 * Colocar produto no palete.
 *
 * Antes isso era uma fila de tres prompt() do navegador — e prompt() dentro do
 * PWA instalado no iPhone simplesmente nao abre: a pessoa tocava em "adicionar
 * produto" e nada acontecia. Agora e um formulario de verdade, com o produto
 * vindo do cadastro e o lote escolhido na lista, para saber qual data esta
 * naquele palete quando o mesmo produto tem duas.
 */
function dialogoItemPalete(item, pronto) {
  const catalogo = Dados.ativos('catalogo')
    .filter(c => (c.nome || '').trim())
    .sort((x, y) => (x.nome || '').localeCompare(y.nome || ''));

  const escolha = lista('Produto do cadastro',
    [{ valor: '', texto: '— digitar um produto novo —' }].concat(
      catalogo.map(c => ({ valor: c.id,
        texto: c.nome + (c.marca ? ' - ' + c.marca : '') }))),
    (catalogo.find(c => c.nome === item.produto) || {}).id || '');

  const nome = campo('Nome do produto', item.produto || '');
  const quantidade = campo('Quantidade', item.quantidade || 1,
    { type: 'number', inputmode: 'decimal' });
  const unidade = lista('Unidade', opcoesUnidade(), item.unidade || 'CX');

  // Lote: so aparece quando o produto TEM mais de uma data lancada, que e
  // exatamente quando saber qual delas esta no palete importa.
  const caixaLote = h('div', {});
  let loteSel = null;

  function montarLotes() {
    const lotes = validadesDoProduto(nome.input.value).filter(x => !x.resolvido)
      .sort((x, y) => x.validade.localeCompare(y.validade));
    caixaLote.replaceChildren();
    loteSel = null;
    if (!lotes.length) {
      caixaLote.append(h('div', { class: 'sub' },
        'Nenhum lote de validade lancado para este produto.'));
      return;
    }
    loteSel = lista('Qual lote esta neste palete',
      [{ valor: '', texto: '— nao sei / misturado —' }].concat(
        lotes.map(x => ({ valor: x.id,
          texto: 'Vence ' + D.data(x.validade) + '  •  ' + D.quantidadeTexto(x)
            + (x.lote ? '  (lote ' + x.lote + ')' : '') }))),
      item.validadeId || '');
    caixaLote.append(loteSel.el);
  }

  escolha.input.addEventListener('change', () => {
    const c = catalogo.find(x => x.id === escolha.input.value);
    if (!c) return;
    nome.input.value = c.nome;
    if (D.temFator(c.unidade)) unidade.input.value = c.unidade;
    montarLotes();
  });
  nome.input.addEventListener('change', montarLotes);
  setTimeout(montarLotes);

  modal({
    titulo: item.produto ? 'Editar item do palete' : 'Produto no palete',
    textoOk: 'Colocar no palete',
    conteudo: [escolha.el, nome.el, quantidade.el, unidade.el, caixaLote],
    aoConfirmar: () => {
      if (!nome.input.value.trim()) { toast('Escolha ou digite o produto.'); return false; }
      const qtd = D.lerNumero(quantidade.input.value);
      if (qtd <= 0) { toast('Coloque a quantidade.'); return false; }

      item.produto = nome.input.value.trim();
      item.quantidade = qtd;
      item.unidade = unidade.input.value;
      item.validadeId = loteSel ? loteSel.input.value : '';
      const lote = item.validadeId
        ? Dados.ativos('produtos').find(x => x.id === item.validadeId) : null;
      item.validade = lote ? lote.validade : '';
      item.lote = lote ? (lote.lote || '') : '';
      if (!item.id) item.id = crypto.randomUUID();

      // Produto digitado na hora entra no cadastro, igual ao resto do app.
      D.garantirProduto(item.produto, D.Acesso.meuSetor(), D.Acesso.nome());
      pronto();
    }
  });
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

/** Unidades em que da para contar. "avulso" e o caso do produto solto na gondola. */
const UNIDADES_CONTAGEM = [
  { valor: 'UND', texto: 'Unidade (solto)', volume: false },
  { valor: 'CX', texto: 'Caixa', volume: true, sigla: 'cx' },
  { valor: 'FD', texto: 'Fardo', volume: true, sigla: 'fd' },
  { valor: 'PALETE', texto: 'Palete', volume: true, sigla: 'palete' },
  { valor: 'KG', texto: 'Quilo', volume: false, sigla: 'kg' }
];

const unidadeContagem = i => UNIDADES_CONTAGEM.find(u => u.valor === (i.unidade || 'CX'))
  || UNIDADES_CONTAGEM[1];

/** "4 cx x 24 + 2 und = 98 unidades" — ou so "12 und", quando e tudo solto. */
function contaTexto(i) {
  const u = unidadeContagem(i);
  const cx = Math.round(i.caixas || 0), un = Math.round(i.unidades || 0);
  if (!u.volume) return un + (u.valor === 'KG' ? ' kg' : ' und');
  if (!cx) return un + ' und';
  let t = cx + ' ' + u.sigla + ' x ' + (i.porCaixa || 1);
  if (un) t += ' + ' + un + ' und';
  return t + ' = ' + Math.round(totalItemContagem(i)) + ' unidades';
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
    const item = { produto: '', unidade: 'CX', caixas: 0, unidades: 0, porCaixa: 24 };
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
      sub: 'Escolha a unidade de cada produto; o total sai pronto',
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

/**
 * Formulario do item contado. A unidade manda na tela: em caixa/fardo/palete
 * aparecem os campos de multiplicacao; em solto ou quilo, so a quantidade —
 * ninguem deveria ter que inventar "1 caixa de 1" para contar 12 unidades.
 */
function dialogoItemContagem(item, pronto) {
  const u0 = item.unidade || 'CX';
  const nome = campo('Produto', item.produto || '');
  const linhaNome = h('div', { estilo: { display: 'flex', gap: '8px', alignItems: 'flex-end' } }, [
    h('div', { estilo: { flex: '1' } }, nome.el),
    botaoScan(() => scannearProduto(c => {
      nome.input.value = c.nome;
      const emVolume = D.temFator(c.unidade);
      unidade.input.value = emVolume ? c.unidade
        : c.unidade === 'KG' ? 'KG' : 'UND';
      if (emVolume) porVolume.input.value = Math.max(1, c.porCaixa || 1);
      atualizar();
    }))
  ]);
  const unidade = lista('Como voce esta contando',
    UNIDADES_CONTAGEM.map(u => ({ valor: u.valor, texto: u.texto })), u0);

  const volumes = campo('Quantos volumes', String(item.caixas || ''), { type: 'number', inputmode: 'numeric' });
  const porVolume = campo('Unidades por volume', String(item.porCaixa || 24), { type: 'number', inputmode: 'numeric' });
  const soltas = campo('Unidades soltas (sobra)', String(item.unidades || ''), { type: 'number', inputmode: 'numeric' });
  const simples = campo('Quantidade', String(item.unidades || ''), { type: 'number', inputmode: 'decimal' });
  const total = aviso('');

  function ler() {
    const u = UNIDADES_CONTAGEM.find(x => x.valor === unidade.input.value) || UNIDADES_CONTAGEM[1];
    if (!u.volume) return { u, caixas: 0, porCaixa: 1, unidades: D.lerNumero(simples.input.value) };
    return {
      u,
      caixas: D.lerNumero(volumes.input.value),
      porCaixa: Math.max(1, parseInt(porVolume.input.value) || 1),
      unidades: D.lerNumero(soltas.input.value)
    };
  }

  function atualizar() {
    const v = ler();
    const emVolume = v.u.volume;
    volumes.el.style.display = porVolume.el.style.display = soltas.el.style.display
      = emVolume ? '' : 'none';
    simples.el.style.display = emVolume ? 'none' : '';
    total.textContent = contaTexto({
      unidade: v.u.valor, caixas: v.caixas, porCaixa: v.porCaixa, unidades: v.unidades
    });
  }

  unidade.input.onchange = atualizar;
  [volumes, porVolume, soltas, simples].forEach(c => c.input.oninput = atualizar);
  atualizar();

  modal({
    titulo: item.produto ? item.produto : 'Contar produto',
    conteudo: [linhaNome, unidade.el, volumes.el, porVolume.el, soltas.el, simples.el, total],
    aoConfirmar: () => {
      if (!nome.input.value.trim()) { toast('Falta o nome do produto.'); return false; }
      const v = ler();
      item.produto = nome.input.value.trim();
      D.garantirProduto(item.produto, D.Acesso.meuSetor(), D.Acesso.nome());
      item.unidade = v.u.valor;
      item.caixas = v.caixas;
      item.porCaixa = v.porCaixa;
      item.unidades = v.unidades;
      if (!item.id) item.id = crypto.randomUUID();
      pronto();
    }
  });
}

// ------------------------------------------------------- preco do concorrente

/**
 * Preco do concorrente, do jeito que a loja usa de verdade:
 *   1. o dono monta a lista de produtos que quer vigiar;
 *   2. quem vai ao concorrente so digita o preco de la e uma observacao;
 *   3. com a lista preenchida, o dono poe o preco daqui e ve a diferenca.
 * Nada de pesquisa, historico ou sugestao — isso so atrapalhava quem esta no
 * corredor com o celular na mao.
 */
function precos(registrar) {
  registrar('precos', () => {
    const a = D.Acesso;
    const dono = a.configuraLoja();
    const itens = Dados.ativos('cesta').filter(c => c.ativo !== false)
      .sort((x, y) => (x.nome || '').localeCompare(y.nome || ''));

    const concorrente = campo('Concorrente pesquisado', Prefs.get('concorrente') || '');
    concorrente.input.onchange = () => Prefs.set('concorrente', concorrente.input.value.trim());
    concorrente.input.disabled = !dono;

    const cartoes = itens.map(c => linhaPreco(c, dono));
    const faltam = itens.filter(c => !(c.precoConcorrente > 0)).length;

    return h('div', {}, [
      cabecalho({ titulo: '\ud83d\udd0e Preco do concorrente',
        sub: itens.length + ' produto(s)  \u2022  ' + faltam + ' sem preco ainda', voltar }),
      h('main', {}, [
        concorrente.el,
        dono
          ? aviso('Monte a lista abaixo. Quem for ao concorrente so preenche o preco de la; '
            + 'depois voce poe o nosso preco e a diferenca aparece sozinha.')
          : aviso('Preencha so o preco que o concorrente cobra e, se quiser, uma observacao.'),
        ...(cartoes.length ? cartoes
          : [vazio(dono ? 'Lista vazia.\nToque em Adicionar produto.'
            : 'O dono ainda nao montou a lista de produtos.')])
      ]),
      dono ? h('button', { class: 'fab', onclick: () => formItemPreco(null) }, 'Adicionar produto') : null
    ]);
  });
}

/** Uma linha da lista: o produto, o preco de la, o nosso e a diferenca. */
function linhaPreco(c, dono) {
  const a = D.Acesso;
  const deles = campo('Preco do concorrente', c.precoConcorrente ? D.numero(c.precoConcorrente) : '',
    { inputmode: 'decimal', placeholder: 'R$' });
  const obs = campo('Observacao', c.observacao || '', { placeholder: 'estava em promocao, faltou...' });
  const nosso = dono
    ? campo('Nosso preco', c.nossoPreco ? D.numero(c.nossoPreco) : '', { inputmode: 'decimal' })
    : null;

  const resultado = h('div', { class: 'resultado-preco' });

  function mostrar() {
    const deValor = D.lerNumero(deles.input.value);
    const nosValor = nosso ? D.lerNumero(nosso.input.value) : (c.nossoPreco || 0);
    if (!(deValor > 0) || !(nosValor > 0)) {
      resultado.textContent = deValor > 0 && !dono
        ? 'Preco anotado. O dono compara com o nosso.'
        : 'Falta preco para comparar.';
      resultado.className = 'resultado-preco';
      return;
    }
    const dif = nosValor - deValor;
    const pct = dif / deValor * 100;
    resultado.textContent = dif === 0
      ? 'Preco igual ao do concorrente.'
      : (dif > 0 ? 'Estamos ' + D.moeda(dif) + ' mais caro  (' + D.numero(pct) + '%)'
        : 'Estamos ' + D.moeda(-dif) + ' mais barato  (' + D.numero(-pct) + '%)');
    resultado.className = 'resultado-preco ' + (dif > 0 ? 'caro' : 'barato');
  }

  [deles, obs, nosso].filter(Boolean).forEach(x => x.input.oninput = mostrar);
  mostrar();

  const salvar = h('button', { class: 'salvar-linha', onclick: () => {
    c.precoConcorrente = D.lerNumero(deles.input.value);
    c.observacao = obs.input.value.trim();
    if (nosso) c.nossoPreco = D.lerNumero(nosso.input.value);
    c.coletadoPor = a.nome();
    c.coletadoEm = D.hoje();
    c.concorrente = Prefs.get('concorrente') || '';
    Dados.gravar('cesta', c, a.nome());
    toast('Preco de ' + c.nome + ' salvo.');
  } }, 'Salvar');

  return h('div', { class: 'linha-preco' }, [
    h('div', { class: 'topo' }, [
      h('b', { texto: c.nome }),
      h('small', { texto: D.setor(c.setor).icone + ' ' + D.setor(c.setor).nome
        + (c.coletadoPor ? '  \u2022  anotado por ' + c.coletadoPor : '') })
    ]),
    deles.el, nosso ? nosso.el : null, obs.el, resultado,
    h('div', { class: 'botoes-linha' }, [
      salvar,
      dono ? h('button', { class: 'remover', onclick: () => confirmar('Tirar da lista',
        'Parar de vigiar o preco de ' + c.nome + '?', () => {
          Dados.excluir('cesta', c, a.nome());
          ir('precos');
        }) }, 'Tirar da lista') : null
    ].filter(Boolean))
  ].filter(Boolean));
}

/** O dono adiciona um produto na lista; se ele nao existir, entra no cadastro tambem. */
function formItemPreco(existente) {
  const a = D.Acesso;
  const c = existente || Dados.novo({
    nome: '', setor: a.dono() ? 'MERCEARIA' : a.meuSetor(), nossoPreco: 0,
    precoConcorrente: 0, observacao: '', coletadoPor: '', coletadoEm: '',
    concorrente: '', ativo: true
  });

  const nome = campo('Produto', c.nome);
  const setorSel = lista('Setor', opcoesSetor(), c.setor);

  modal({
    titulo: existente ? c.nome : 'Adicionar produto na lista',
    conteudo: [nome.el, setorSel.el,
      h('div', { class: 'sub', texto: 'Se este produto ainda nao estiver em Estoque > Produtos, '
        + 'ele e cadastrado automaticamente.' })],
    aoConfirmar: () => {
      if (!nome.input.value.trim()) { toast('Falta o nome do produto.'); return false; }
      c.nome = nome.input.value.trim();
      c.setor = setorSel.input.value;
      D.garantirProduto(c.nome, c.setor, a.nome());
      Dados.gravar('cesta', c, a.nome());
      toast('Produto na lista.');
      ir('precos');
    }
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

// -------------------------------------------------------------- gondola vazia

const SITUACOES_RUPTURA = {
  ABERTA: { rotulo: 'Aberta', cor: '#D32F2F' },
  NO_DEPOSITO: { rotulo: 'Tem no deposito', cor: '#F57C00' },
  COMPRAR: { rotulo: 'Pedir ao fornecedor', cor: '#6A1B9A' },
  RESOLVIDA: { rotulo: 'Reposta', cor: '#388E3C' }
};

function ruptura(registrar) {
  telaMarcarRuptura(registrar);
  registrar('ruptura', () => {
    const a = D.Acesso;
    const todos = Dados.ativos('rupturas')
      .filter(r => a.veSetor(r.setor) && a.vePessoa(r.funcionario, r.autor))
      .sort((x, y) => (x.situacao === 'RESOLVIDA') - (y.situacao === 'RESOLVIDA')
        || y.atualizadoEm - x.atualizadoEm);

    const corpo = h('div', {});

    function desenhar(termo) {
      const itens = !termo ? todos : todos.filter(r =>
        ((r.produto || '') + ' ' + (r.codigo || '')).toLowerCase().includes(termo));

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
      corpo.replaceChildren(...(cartoes.length ? cartoes
        : [vazio(termo ? 'Nada encontrado para "' + termo + '".'
          : 'Nenhuma falta registrada.\nViu buraco na gondola? Avise aqui.')]));
    }

    const busca = campo('', '', { placeholder: 'Buscar produto ou codigo...' });
    busca.input.addEventListener('input',
      () => desenhar(busca.input.value.trim().toLowerCase()));
    desenhar('');

    const abertas = todos.filter(r => r.situacao !== 'RESOLVIDA').length;
    return h('div', {}, [
      cabecalho({ titulo: '🕳 Gondola vazia',
        sub: abertas + ' em aberto  •  ' + todos.length + ' no total', voltar }),
      h('main', {}, [busca.el, corpo]),
      h('button', { class: 'fab', onclick: () => ir('ruptura-marcar') }, 'Marcar faltas')
    ]);
  });
}

/** Onde o produto esta, sem dizer a ninguem o que fazer. */
function orientacaoRuptura(r) {
  if (r.situacao === 'NO_DEPOSITO') return 'Tem no estoque: ' + r.ondeTem + '.';
  if (r.situacao === 'COMPRAR') return 'Sem estoque no deposito.';
  if (r.situacao === 'RESOLVIDA') return 'Gondola reposta.';
  return 'Estoque ainda nao conferido.';
}

function cruzar(r) {
  const onde = ondeTemNoEstoque(r.produto);
  r.ondeTem = onde;
  r.situacao = onde ? 'NO_DEPOSITO' : 'COMPRAR';
}

/**
 * Marcar falta e coisa de corredor: a pessoa ve o buraco na gondola e marca.
 * Uma tela so, lista do que a loja conhece, e o aviso vai para o lider e o dono.
 */
function telaMarcarRuptura(registrar) {
  registrar('ruptura-marcar', () => {
    const a = D.Acesso;
    const itens = itensConhecidos().filter(i => a.veSetor(i.setor));
    const marcados = new Set();
    let filtro = '';

    const corpo = h('main', {});
    const rodapeTexto = h('div', { class: 'contador' });
    const btSalvar = h('button', { class: 'principal', onclick: () => gravar() }, 'Registrar faltas');

    function atualizarRodape() {
      rodapeTexto.textContent = marcados.size
        ? marcados.size + ' produto(s) em falta marcados'
        : 'Marque tudo que estiver faltando na gondola.';
      btSalvar.disabled = !marcados.size;
    }

    function linha(item) {
      const caixa = h('input', { type: 'checkbox' });
      caixa.checked = marcados.has(item.nome);
      const alternar = () => {
        if (marcados.has(item.nome)) marcados.delete(item.nome); else marcados.add(item.nome);
        caixa.checked = marcados.has(item.nome);
        atualizarRodape();
      };
      caixa.onclick = ev => { ev.stopPropagation(); alternar(); };
      return h('div', { class: 'linha-marcar', onclick: alternar }, [
        caixa,
        h('div', { class: 'texto' }, [
          h('b', { texto: item.nome }),
          h('small', { texto: D.setor(item.setor).icone + ' ' + D.setor(item.setor).nome })
        ])
      ]);
    }

    function desenhar() {
      const f = filtro.trim().toLowerCase();
      const visiveis = itens.filter(i => !f
        || (i.nome + ' ' + (i.codigo || '')).toLowerCase().includes(f));
      const filhos = [];

      /*
       * Falta e coisa de corredor: o repositor ve o buraco na gondola de um
       * produto que ninguem cadastrou ainda e precisa marcar assim mesmo.
       *
       * O botao ja existia, mas so no FIM da lista — com 40 produtos parecidos
       * acima dele, ninguem rolava ate la e a tela parecia so aceitar produto
       * cadastrado. Agora ele e a primeira coisa que aparece ao digitar.
       */
      if (f && !itens.some(i => i.nome.trim().toLowerCase() === f)) {
        filhos.push(h('button', {
          class: 'principal',
          estilo: { marginBottom: '10px' },
          onclick: () => {
            const nome = filtro.trim();
            itens.push({ nome, setor: a.meuSetor(), preco: 0, codigo: '' });
            itens.sort((x, y) => x.nome.localeCompare(y.nome));
            marcados.add(nome);
            filtro = '';
            busca.input.value = '';
            desenhar();
            atualizarRodape();
          }
        }, '＋ Marcar "' + filtro.trim() + '" (produto novo)'));
      }

      filhos.push(...visiveis.map(linha));

      if (!visiveis.length && !f) {
        filhos.push(vazio('Nenhum produto cadastrado ainda.\n'
          + 'Digite o nome do produto acima para marcar a falta dele.'));
      } else if (!visiveis.length) {
        filhos.push(vazio('Nenhum produto cadastrado com esse nome.\n'
          + 'Use o botao acima para marcar assim mesmo.'));
      }
      corpo.replaceChildren(...filhos);
    }

    function gravar() {
      const nomes = [...marcados];
      nomes.forEach(nome => {
        const item = itens.find(i => i.nome === nome) || { setor: a.meuSetor() };
        D.garantirProduto(nome, item.setor, a.nome());
        const r = Dados.novo({
          codigo: item.codigo || '', produto: nome, setor: item.setor, data: D.hoje(),
          hora: D.agora(), funcionario: a.nome(), situacao: 'ABERTA', ondeTem: '',
          observacao: '', avisouGestor: false
        });
        cruzar(r);
        Dados.gravar('rupturas', r, a.nome());
        avisarFalta(r);
      });
      toast(nomes.length + ' falta(s) registradas. Lider e dono avisados.');
      voltar();
    }

    const busca = campo('', '', { placeholder: 'Procurar, bipar ou escrever um produto novo...' });
    busca.input.oninput = () => { filtro = busca.input.value; desenhar(); };
    const linhaBusca = h('div', { estilo: { display: 'flex', gap: '8px', alignItems: 'flex-end' } }, [
      h('div', { estilo: { flex: '1' } }, busca.el),
      botaoScan(() => scannearProduto(c => {
        if (!itens.some(i => i.nome.trim().toLowerCase() === c.nome.trim().toLowerCase())) {
          itens.push({ nome: c.nome, setor: c.setor, preco: c.preco || 0, codigo: c.codigo || '' });
          itens.sort((x, y) => x.nome.localeCompare(y.nome));
        }
        marcados.add(c.nome);
        filtro = ''; busca.input.value = '';
        desenhar();
        atualizarRodape();
      }))
    ]);

    desenhar();
    atualizarRodape();

    return h('div', {}, [
      cabecalho({ titulo: '\ud83d\udd73 Marcar faltas',
        sub: 'Nao achou? escreva o nome e marque assim mesmo', voltar }),
      h('div', { class: 'topo-marcar' }, [linhaBusca]),
      corpo,
      h('div', { class: 'rodape-marcar' }, [rodapeTexto, btSalvar])
    ]);
  });
}

/**
 * Falta na gondola e recado de chefe. Nao existe lista separada de avisos: a
 * propria falta em aberto ja aparece para o lider do setor e para o dono, no
 * contador do painel e na lista. O Android ainda transforma isso em notificacao.
 */
function avisarFalta(r) {
  r.avisouGestor = true;
  Dados.gravar('rupturas', r, r.funcionario);
}

/** Quantas faltas estao em aberto para quem esta olhando o painel. */
export function contarFaltas() {
  const a = D.Acesso;
  return Dados.ativos('rupturas')
    .filter(r => r.situacao !== 'RESOLVIDA' && a.veSetor(r.setor)).length;
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
  telaMarcarDesistencia(registrar);
  registrar('desistencias', () => {
    const a = D.Acesso;
    if (!a.veDesistencias()) return semAcessoAoCaixa();
    const itens = Dados.ativos('desistencias')
      .filter(d => a.vePessoa(d.operador, d.autor))
      .sort((x, y) => (x.recolhido - y.recolhido) || y.atualizadoEm - x.atualizadoEm);

    const cartoes = itens.map(d => {
      const perecivel = PERECIVEIS.includes(d.setor);
      const atrasado = !d.recolhido && minutosParados(d) > prazoRecolher(d.setor);
      const cor = d.recolhido ? '#388E3C' : (atrasado ? '#D32F2F' : (perecivel ? '#F57C00' : '#757575'));
      const motivo = MOTIVOS_DESISTENCIA.find(m => m.valor === d.motivo) || MOTIVOS_DESISTENCIA[0];

      // Texto seco de status: onde o item esta. Sem recomendar nada a ninguem.
      let alerta;
      if (d.recolhido) alerta = 'Item ja recolhido por ' + d.recolhidoPor + ' as ' + d.recolhidoAs + '.';
      else if (perecivel) alerta = '\ud83e\uddca ' + d.produto + ' parado no caixa ha '
        + minutosParados(d) + ' min (prazo de ' + prazoRecolher(d.setor) + ' min).';
      else alerta = d.produto + ' parado no caixa ha ' + minutosParados(d) + ' min.';

      const divergencia = (d.precoCaixa || 0) - (d.precoEtiqueta || 0);
      const recadoGestor = divergencia
        ? 'Etiqueta ' + D.moeda(d.precoEtiqueta) + '  \u2022  caixa ' + D.moeda(d.precoCaixa)
          + '  \u2022  diferenca de ' + D.moeda(Math.abs(divergencia))
        : '';

      return cartao({
        cor,
        icone: D.setor(d.setor).icone,
        titulo: d.produto || 'Item sem nome',
        sub: D.dataCurta(d.data) + ' ' + d.hora
          + ((d.quantidade || 1) > 1 ? '  \u2022  ' + d.quantidade + 'x' : '')
          + '  \u2022  ' + motivo.texto
          + (d.operador ? '  •  ' + d.operador : ''),
        extra: recadoGestor || null,
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
      h('button', { class: 'fab', onclick: () => ir('desistencia-marcar') }, 'Marcar desistencias')
    ]);
  });
}

/**
 * Marcar desistencia sem digitar: a lista ja vem com o que a loja conhece e a
 * pessoa so toca no quadradinho. Tudo numa tela so - motivo em cima, salvar embaixo.
 */
function telaMarcarDesistencia(registrar) {
  registrar('desistencia-marcar', () => {
    const a = D.Acesso;
    if (!a.veDesistencias()) return semAcessoAoCaixa();
    const itens = itensConhecidos();
    const marcados = new Map();   // nome -> quantidade
    let filtro = '';
    let motivoEscolhido = MOTIVOS_DESISTENCIA[0].valor;

    const corpo = h('main', {});
    const rodapeTexto = h('div', { class: 'contador' });
    const btSalvar = h('button', { class: 'principal', onclick: () => gravar() }, 'Registrar desistencias');

    function atualizarRodape() {
      const produtos = marcados.size;
      const unidades = [...marcados.values()].reduce((t, n) => t + n, 0);
      rodapeTexto.textContent = produtos
        ? produtos + ' produto(s)  \u2022  ' + unidades + ' unidade(s) marcadas'
        : 'Nenhum item marcado. Toque no numero para somar mais de um.';
      btSalvar.disabled = !produtos;
    }

    function linha(item) {
      const marcado = marcados.has(item.nome);
      const caixa = h('input', { type: 'checkbox' });
      caixa.checked = marcado;

      const qtd = h('span', { class: 'qtd' }, marcado ? marcados.get(item.nome) + 'x' : '');
      qtd.onclick = ev => {
        ev.stopPropagation();
        const atual = marcados.get(item.nome) || 0;
        marcados.set(item.nome, atual >= 9 ? 1 : atual + 1);
        caixa.checked = true;
        qtd.textContent = marcados.get(item.nome) + 'x';
        atualizarRodape();
      };

      const alternar = () => {
        if (marcados.has(item.nome)) { marcados.delete(item.nome); caixa.checked = false; qtd.textContent = ''; }
        else { marcados.set(item.nome, 1); caixa.checked = true; qtd.textContent = '1x'; }
        atualizarRodape();
      };
      caixa.onclick = ev => { ev.stopPropagation(); alternar(); };

      return h('div', { class: 'linha-marcar', onclick: alternar }, [
        caixa,
        h('div', { class: 'texto' }, [
          h('b', { texto: item.nome }),
          h('small', { texto: D.setor(item.setor).icone + ' ' + D.setor(item.setor).nome
            + (item.preco > 0 ? '  \u2022  ' + D.moeda(item.preco) : '') })
        ]),
        qtd
      ]);
    }

    function desenhar() {
      const f = filtro.trim().toLowerCase();
      const visiveis = itens.filter(i => !f || i.nome.toLowerCase().includes(f));
      const filhos = visiveis.map(linha);

      // O botao de criar aparece sempre que o nome digitado nao existe igualzinho.
      // So mostrar quando a busca zera deixava a pessoa presa: "Leite Italac 2L"
      // cai na lista do "Leite Italac 1L" e nao havia como cadastrar o novo.
      if (f && !itens.some(i => i.nome.trim().toLowerCase() === f)) {
        filhos.push(h('button', {
          class: 'principal',
          onclick: () => {
            const nome = filtro.trim();
            itens.push({ nome, setor: a.meuSetor(), preco: 0, codigo: '' });
            itens.sort((x, y) => x.nome.localeCompare(y.nome));
            marcados.set(nome, 1);
            filtro = '';
            busca.input.value = '';
            desenhar();
            atualizarRodape();
          }
        }, '+ Marcar "' + filtro.trim() + '" assim mesmo'));
      }
      if (!filhos.length) {
        filhos.push(vazio('Nenhum produto cadastrado ainda. Digite o nome acima para criar.'));
      }
      corpo.replaceChildren(...filhos);
    }

    function gravar() {
      const nomes = [...marcados.keys()];
      nomes.forEach(nome => {
        const item = itens.find(i => i.nome === nome) || { setor: a.meuSetor(), preco: 0, codigo: '' };
        // Produto digitado na hora vira cadastro: o dono completa depois.
        D.garantirProduto(nome, item.setor, a.nome());
        Dados.gravar('desistencias', Dados.novo({
          codigo: item.codigo || '', produto: nome, setor: item.setor, data: D.hoje(),
          hora: D.agora(), operador: a.nome(), motivo: motivoEscolhido,
          precoEtiqueta: item.preco || 0, precoCaixa: 0, quantidade: marcados.get(nome),
          observacao: '', recolhido: false, recolhidoPor: '', recolhidoAs: '',
          avisouRecolher: false, avisouAtraso: false
        }), a.nome());
      });
      toast(nomes.length + ' desistencia(s) registradas.');
      voltar();
    }

    const escolha = lista('Por que deixou (vale para os marcados)',
      MOTIVOS_DESISTENCIA.map(m => ({ valor: m.valor, texto: m.texto })), motivoEscolhido);
    escolha.input.onchange = () => { motivoEscolhido = escolha.input.value; };

    const busca = campo('', '', { placeholder: 'Procurar produto...' });
    busca.input.oninput = () => { filtro = busca.input.value; desenhar(); };

    desenhar();
    atualizarRodape();

    return h('div', {}, [
      cabecalho({ titulo: '\ud83d\uded2 Marcar desistencia',
        sub: 'So marcar o que o cliente deixou. Nao precisa digitar nada.', voltar }),
      h('div', { class: 'topo-marcar' }, [escolha.el, busca.el]),
      corpo,
      h('div', { class: 'rodape-marcar' }, [rodapeTexto, btSalvar])
    ]);
  });
}

/**
 * O que a loja ja conhece: catalogo de codigo de barras, produtos de validade e
 * o que ja apareceu em desistencia antes. E dai que sai a lista de marcar.
 */
function itensConhecidos() {
  const mapa = new Map();
  const por = nome => (nome || '').trim().toLowerCase();

  Dados.ativos('catalogo').forEach(c => {
    if (!c.nome || !c.nome.trim()) return;
    mapa.set(por(c.nome), { nome: c.nome, setor: c.setor, preco: c.preco || 0, codigo: c.codigo || '' });
  });
  Dados.ativos('produtos').forEach(x => {
    if (!x.nome || !x.nome.trim() || mapa.has(por(x.nome))) return;
    mapa.set(por(x.nome), { nome: x.nome, setor: x.setor, preco: 0, codigo: '' });
  });
  Dados.ativos('desistencias').forEach(d => {
    if (!d.produto || !d.produto.trim() || mapa.has(por(d.produto))) return;
    mapa.set(por(d.produto), { nome: d.produto, setor: d.setor, preco: d.precoEtiqueta || 0, codigo: d.codigo || '' });
  });

  return [...mapa.values()].sort((x, y) => x.nome.localeCompare(y.nome));
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
  telaPessoa(registrar);
  telaAjusteDoDia(registrar);
  telaDomingos(registrar);
  telaFeriado(registrar);

  registrar('escala', params => {
    const a = D.Acesso;
    const aba = params.aba || 'mes';
    sincronizarEquipe();

    const mes = params.mes ? new Date(params.mes + '-01T00:00:00') : new Date();
    const ano = mes.getFullYear(), m = mes.getMonth();
    const chaveMes = ano + '-' + String(m + 1).padStart(2, '0');

    const troca = h('div', { estilo: { display: 'flex', gap: '6px', margin: '4px 0 10px' } }, [
      abaBotao('Mes', aba === 'mes', () => ir('escala', { aba: 'mes', mes: chaveMes })),
      abaBotao('Equipe', aba === 'equipe', () => ir('escala', { aba: 'equipe', mes: chaveMes })),
      abaBotao('Domingos', aba === 'domingos', () => ir('escala', { aba: 'domingos', mes: chaveMes })),
      abaBotao('Datas', aba === 'datas', () => ir('escala', { aba: 'datas', mes: chaveMes }))
    ]);

    let corpo = [], fab = null, sub = '';

    if (aba === 'equipe') {
      const pessoas = equipe().filter(f => a.veSetor(f.setor));
      corpo = pessoas.length ? pessoas.map(f => {
        const padrao = padraoDe(f.id);
        const dom = domingoEscolhido(f.id, ano, m);
        return cartao({
          cor: D.setor(f.setor).cor, icone: '\ud83d\udc64', titulo: f.nome,
          sub: (f.cargo || 'Sem cargo') + '  \u2022  ' + D.setor(f.setor).nome
            + (f.usuarioId ? '  \u2022  tem login' : ''),
          extra: (padrao ? resumoPadrao(padrao) : 'Sem escala padrao: os dias dele ficam vazios.')
            + '\nDomingo do mes: ' + (dom ? D.data(dom.data) : 'nenhum'),
          selo: padrao ? { texto: D.numero(horasSemana(padrao)) + 'h/sem', cor: D.setor(f.setor).cor }
            : { texto: 'sem padrao', cor: '#D32F2F' },
          botoes: a.editaEscala(f.setor) ? [
            { texto: padrao ? 'Editar escala padrao' : 'Definir escala padrao',
              onclick: () => formPadrao(f, padrao) },
            { texto: 'Editar pessoa', sec: true, onclick: () => ir('escala-pessoa', { id: f.id }) }
          ] : null
        });
      }) : [vazio('Cadastre usuarios em Ajustes > Usuarios: eles entram aqui sozinhos.')];
      sub = pessoas.length + ' pessoa(s) na equipe';
      if (a.editaEscala()) fab = { texto: 'Nova pessoa', onclick: () => ir('escala-pessoa', {}) };

    } else if (aba === 'domingos') {
      return telaResumoDomingos(ano, m, chaveMes, troca);

    } else if (aba === 'datas') {
      const datas = feriadosProximos(90);
      const pendentes = datas.filter(d => d.tipo === 'FERIADO' && !escalaDeFeriadoPronta(d.data));
      corpo = pendentes.length
        ? [aviso('\u26a0 ' + pendentes.length + ' feriado(s) ainda sem escala montada. '
            + 'Toque em "Montar a escala" para dizer quem folga e quem vem.', '#D32F2F')]
        : [aviso('Todos os feriados dos proximos 90 dias ja tem escala montada.')];

      corpo.push(...datas.map(d => {
        const pronta = d.tipo === 'FERIADO' && escalaDeFeriadoPronta(d.data);
        const cobra = d.tipo === 'FERIADO' && !pronta;
        const escalados = escalaDoDia(d.data).filter(t => !t.folga && a.veSetor(t.setor));
        return cartao({
          cor: cobra && d.dias <= AVISO_FERIADO ? '#D32F2F'
            : (d.tipo === 'COMERCIAL' ? '#6A1B9A' : '#F57C00'),
          icone: d.tipo === 'COMERCIAL' ? '\ud83d\udecd' : '\ud83c\udf89',
          titulo: d.nome,
          sub: D.diaSemana(d.data) + ', ' + D.data(d.data) + '  \u2022  '
            + (d.tipo === 'COMERCIAL' ? 'data comercial' : 'feriado'),
          extra: escalados.length
            ? escalados.map(t => '\u2022 ' + t.funcionarioNome + '  ' + t.inicio + ' as ' + t.fim).join('\n')
            : null,
          selo: { texto: d.dias === 0 ? 'HOJE' : 'em ' + d.dias + 'd',
            cor: d.dias <= AVISO_FERIADO ? '#D32F2F' : '#6A1B9A' },
          destaque: cobra
            ? { texto: d.dias <= AVISO_FERIADO
                ? '\u26a0 Faltam ' + d.dias + ' dia(s) e ninguem foi escalado ainda.'
                : 'Escala ainda nao montada.', cor: d.dias <= AVISO_FERIADO ? '#D32F2F' : '#F57C00' }
            : (pronta ? { texto: '\u2714 Escala montada.', cor: '#2E7D32' } : null),
          botoes: a.editaEscala()
            ? [{ texto: pronta ? 'Rever a escala' : 'Montar a escala',
                 onclick: () => ir('escala-feriado', { data: d.data }) }]
            : null
        });
      }));
      sub = datas.length + ' data(s) nos proximos 90 dias';

    } else {
      const dias = new Date(ano, m + 1, 0).getDate();
      const especiais = {};
      feriadosProximos(400).forEach(f => especiais[f.data] = f);

      let horas = 0;
      corpo = [navegarMes(ano, m)];
      for (let dia = 1; dia <= dias; dia++) {
        const iso = ano + '-' + String(m + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
        // Dia que ja passou nao se escala mais: a lista comeca em hoje.
        if (iso < D.hoje()) continue;
        const turnos = escalaDoDia(iso).filter(t => a.veSetor(t.setor));
        turnos.forEach(t => horas += horasTurno(t));
        const feriado = especiais[iso];
        const hoje = iso === D.hoje();
        const trabalhando = turnos.filter(t => !t.folga);
        // Feriado sem ninguem decidido ainda continua gritando ate alguem montar.
        const feriadoAberto = feriado && feriado.tipo === 'FERIADO' && !escalaDeFeriadoPronta(iso);
        corpo.push(cartao({
          cor: feriadoAberto ? '#D32F2F' : (feriado ? '#F57C00' : (hoje ? '#2E7D32' : '#90A4AE')),
          icone: feriado ? '\ud83c\udf89' : (hoje ? '\ud83d\udccd' : '\ud83d\uddd3'),
          titulo: dia + ' - ' + D.diaSemana(iso) + (hoje ? '  (hoje)' : ''),
          sub: trabalhando.length ? trabalhando.length + ' pessoa(s) escalada(s)' : 'Ninguem escalado',
          extra: trabalhando.map(t => '\u2022 ' + t.funcionarioNome + '  ' + t.inicio + ' as ' + t.fim
            + (t.doPadrao ? '' : '  (ajustado)')).join('\n'),
          selo: feriado ? { texto: feriado.nome, cor: feriadoAberto ? '#D32F2F' : '#F57C00' }
            : (hoje ? { texto: 'hoje', cor: '#2E7D32' } : null),
          destaque: feriadoAberto
            ? { texto: '\u26a0 Feriado sem escala montada: ninguem sabe quem folga e quem vem.',
                cor: '#D32F2F' }
            : null,
          botoes: a.editaEscala()
            ? [feriado
                ? { texto: 'Montar o feriado', onclick: () => ir('escala-feriado', { data: iso }) }
                : { texto: 'Ajustar este dia', onclick: () => ir('escala-dia', { data: iso }) }]
            : null
        }));
      }
      if (corpo.length === 1) corpo.push(vazio('Este mes ja passou. Use as setas para ver o proximo.'));
      sub = NOMES_MES[m] + ' de ' + ano + '  \u2022  ' + D.numero(horas) + 'h daqui pra frente';
    }

    return h('div', {}, [
      cabecalho({ titulo: '\ud83d\udc65 Escala e equipe', sub, voltar,
        acao: a.veTrabalhoDosOutros() ? { texto: '\ud83c\udfc6', onclick: () => ir('desempenho') } : null }),
      h('main', {}, [troca, ...corpo]),
      fab ? h('button', { class: 'fab', onclick: fab.onclick }, fab.texto) : null
    ]);
  });
}

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho',
  'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Setas de mes: a escala nao para em dezembro. */
function navegarMes(ano, m) {
  const passo = delta => {
    const d = new Date(ano, m + delta, 1);
    ir('escala', { aba: 'mes', mes: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') });
  };
  return h('div', { estilo: { display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' } }, [
    abaBotao('\u2039 anterior', false, () => passo(-1)),
    abaBotao('proximo \u203a', false, () => passo(1))
  ]);
}

// ------------------------------------------------------------------ equipe

/**
 * Quem tem login JA e da equipe: nao faz sentido cadastrar a mesma pessoa duas vezes.
 * Cada usuario ativo ganha (e mantem) a ficha dele na escala, ligada pelo usuarioId.
 */
function sincronizarEquipe() {
  const fichas = Dados.ativos('funcionarios');
  let mexeu = false;

  Dados.ativos('usuarios').filter(u => u.ativo !== false).forEach(u => {
    const setor = (u.setores && u.setores[0]) || u.setor || 'MERCEARIA';
    let f = fichas.find(x => x.usuarioId === u.id)
      || fichas.find(x => !x.usuarioId && (x.nome || '').trim().toLowerCase() === (u.nome || '').trim().toLowerCase());
    if (!f) {
      f = Dados.novo({ usuarioId: u.id, nome: u.nome, cargo: u.cargo || '', setor, telefone: '', ativo: true });
      Dados.gravar('funcionarios', f, u.nome);
      mexeu = true;
      return;
    }
    // Trocou de nome, cargo ou setor no cadastro: a escala acompanha.
    if (f.usuarioId !== u.id || f.nome !== u.nome || f.cargo !== (u.cargo || '') || f.setor !== setor) {
      f.usuarioId = u.id; f.nome = u.nome; f.cargo = u.cargo || ''; f.setor = setor;
      Dados.gravar('funcionarios', f, u.nome);
      mexeu = true;
    }
  });

  // Usuario apagado deixa de aparecer na escala, mas o historico dele continua.
  const vivos = new Set(Dados.ativos('usuarios').filter(u => u.ativo !== false).map(u => u.id));
  fichas.forEach(f => {
    if (f.usuarioId && !vivos.has(f.usuarioId) && f.ativo !== false) {
      f.ativo = false;
      Dados.gravar('funcionarios', f, D.Acesso.nome());
      mexeu = true;
    }
  });
  return mexeu;
}

const equipe = () => Dados.ativos('funcionarios').filter(f => f.ativo !== false)
  .sort((a, b) => a.nome.localeCompare(b.nome));

const padraoDe = id => Dados.ativos('padroes').find(p => p.funcionarioId === id && p.ativo !== false);

/** Cadastro/edicao de pessoa em tela cheia — nada de sequencia de perguntas. */
function telaPessoa(registrar) {
  registrar('escala-pessoa', params => {
    const a = D.Acesso;
    if (!a.editaEscala()) return soChefeMexeNaEscala('👤 Equipe');
    const existente = params.id ? Dados.ativos('funcionarios').find(f => f.id === params.id) : null;
    const f = existente || Dados.novo({
      usuarioId: '', nome: '', cargo: '', setor: a.dono() ? 'MERCEARIA' : a.meuSetor(),
      telefone: '', ativo: true
    });

    const nome = campo('Nome', f.nome);
    const cargo = campo('Cargo (repositor, caixa, acougueiro...)', f.cargo || '');
    const setor = lista('Setor', opcoesSetor(), f.setor);
    const telefone = campo('Telefone (opcional)', f.telefone || '');

    return h('div', {}, [
      cabecalho({ titulo: existente ? '\ud83d\udc64 ' + f.nome : '\ud83d\udc64 Nova pessoa',
        sub: 'Quem tem login ja entra aqui sozinho', voltar }),
      h('main', {}, [
        f.usuarioId ? aviso('Esta pessoa tem conta no app. Nome, cargo e setor vem do cadastro '
          + 'de usuarios e sao atualizados por la.') : null,
        nome.el, cargo.el, setor.el, telefone.el
      ].filter(Boolean)),
      barra([
        { texto: 'Salvar', onclick: () => {
          if (!nome.input.value.trim()) return toast('Falta o nome.');
          Object.assign(f, {
            nome: nome.input.value.trim(), cargo: cargo.input.value.trim(),
            setor: setor.input.value, telefone: telefone.input.value.trim()
          });
          Dados.gravar('funcionarios', f, a.nome());
          toast('Equipe atualizada.');
          voltar();
        } },
        existente && !f.usuarioId ? { texto: 'Remover', classe: 'vermelho',
          onclick: () => confirmar('Remover da equipe', 'Tirar ' + f.nome + ' da escala?', () => {
            Dados.excluir('funcionarios', f, a.nome());
            voltar();
          }) } : null
      ])
    ]);
  });
}

// ------------------------------------------------------------------ ajuste do dia

/** Ajustar um dia inteiro numa tela so: cada pessoa com folga, entrada e saida. */
function telaAjusteDoDia(registrar) {
  registrar('escala-dia', params => {
    const a = D.Acesso;
    const iso = params.data || D.hoje();
    sincronizarEquipe();
    if (!a.editaEscala()) return soChefeMexeNaEscala('🗓 ' + D.data(iso));
    const pessoas = equipe().filter(f => a.veSetor(f.setor));

    const linhas = pessoas.map(f => {
      const atual = turnoDoDia(f.id, iso);
      const folg = marcador('Folga', atual.folga);
      const ini = campo('', atual.inicio, { type: 'time' });
      const fim = campo('', atual.fim, { type: 'time' });
      ini.input.disabled = fim.input.disabled = atual.folga;
      folg.input.addEventListener('change', () => {
        ini.input.disabled = fim.input.disabled = folg.input.checked;
      });
      return { f, folg, ini, fim, el: h('div', { class: 'linha-dia' }, [
        h('label', { texto: f.nome + '  \u2022  ' + D.setor(f.setor).nome }),
        h('div', { estilo: { display: 'flex', gap: '8px', alignItems: 'center' } },
          [ini.el, fim.el, folg.el])
      ]) };
    });

    return h('div', {}, [
      cabecalho({ titulo: '\ud83d\uddd3 ' + D.diaSemana(iso) + ', ' + D.data(iso),
        sub: 'O que mudar aqui vale so neste dia', voltar }),
      h('main', {}, linhas.length
        ? [aviso('Sem mexer em nada, o dia segue a escala padrao de cada um.'), ...linhas.map(l => l.el)]
        : [vazio('Ninguem na equipe ainda.')]),
      linhas.length ? barra([
        { texto: 'Salvar o dia', onclick: () => {
          linhas.forEach(l => {
            const gravado = Dados.ativos('turnos').find(t => t.funcionarioId === l.f.id && t.data === iso)
              || Dados.novo({ funcionarioId: l.f.id, funcionarioNome: l.f.nome, setor: l.f.setor,
                data: iso, inicio: '08:00', fim: '16:00', folga: false, observacao: '' });
            Object.assign(gravado, {
              funcionarioNome: l.f.nome, setor: l.f.setor,
              folga: l.folg.input.checked, inicio: l.ini.input.value, fim: l.fim.input.value
            });
            Dados.gravar('turnos', gravado, a.nome());
          });
          toast('Dia ajustado.');
          voltar();
        } },
        { texto: 'Voltar ao padrao', classe: 'vermelho', onclick: () => confirmar('Voltar ao padrao',
          'Apagar os ajustes deste dia e deixar a escala normal?', () => {
            Dados.ativos('turnos').filter(t => t.data === iso).forEach(t => Dados.excluir('turnos', t, a.nome()));
            toast('Dia de volta ao padrao.');
            voltar();
          }) }
      ]) : null
    ]);
  });
}

/** O turno de alguem num dia: o ajuste manual manda; senao vale o padrao. */
function turnoDoDia(funcionarioId, iso) {
  const gravado = Dados.ativos('turnos').find(t => t.funcionarioId === funcionarioId && t.data === iso);
  if (gravado) return gravado;
  const p = padraoDe(funcionarioId);
  const i = (new Date(iso + 'T00:00:00').getDay() + 6) % 7;
  if (!p) return { inicio: '08:00', fim: '16:00', folga: true };
  return { inicio: p.inicio[i], fim: p.fim[i], folga: p.folga[i] };
}

// ------------------------------------------------------------------ feriado

/** Com quantos dias de antecedencia o app comeca a cobrar a escala do feriado. */
export const AVISO_FERIADO = 7;

/**
 * Feriado "montado" e feriado em que alguem ja decidiu o dia: existe pelo menos
 * um turno gravado naquela data. Enquanto ninguem decide, o dia so herda o
 * padrao da semana — e feriado que segue o padrao da terca normal e justamente
 * o erro que essa tela existe para evitar.
 */
export function escalaDeFeriadoPronta(iso) {
  return Dados.ativos('turnos').some(t => t.data === iso);
}

/** Feriados que ja entraram na janela de aviso e continuam sem escala. */
export function feriadosSemEscala(dias = AVISO_FERIADO) {
  return feriadosProximos(dias)
    .filter(f => f.tipo === 'FERIADO' && !escalaDeFeriadoPronta(f.data));
}

/** O feriado (ou data comercial) que cai num dia, se cair. */
const feriadoEm = iso => feriadosProximos(400).find(f => f.data === iso);

/**
 * Montar o feriado numa tela so: quem folga, quem vem e a que horas. E o mesmo
 * turno gravado que a escala do mes le, entao salvar aqui ja atualiza o mes.
 */
function telaFeriado(registrar) {
  registrar('escala-feriado', params => {
    const a = D.Acesso;
    const iso = params.data || D.hoje();
    const info = feriadoEm(iso);
    sincronizarEquipe();

    if (!a.editaEscala()) {
      return h('div', {}, [
        cabecalho({ titulo: '🎉 ' + (info ? info.nome : D.data(iso)), voltar }),
        h('main', {}, [
          aviso('Quem monta a escala do feriado e o dono ou o lider. '
            + 'Abaixo esta como o dia ficou.', '#455A64'),
          ...escalaDoDia(iso).filter(t => a.veSetor(t.setor)).map(t => cartao({
            cor: t.folga ? '#90A4AE' : D.setor(t.setor).cor,
            icone: t.folga ? '🏖' : '👤',
            titulo: t.funcionarioNome,
            sub: D.setor(t.setor).nome,
            selo: { texto: t.folga ? 'folga' : t.inicio + ' as ' + t.fim,
              cor: t.folga ? '#90A4AE' : '#2E7D32' }
          }))
        ])
      ]);
    }

    const pessoas = equipe().filter(f => a.veSetor(f.setor));
    const linhas = pessoas.map(f => {
      const atual = turnoDoDia(f.id, iso);
      const folg = marcador('Folga', atual.folga);
      const ini = campo('', atual.inicio || '08:00', { type: 'time' });
      const fim = campo('', atual.fim || '16:00', { type: 'time' });
      const aplicar = () => { ini.input.disabled = fim.input.disabled = folg.input.checked; };
      folg.input.addEventListener('change', () => { aplicar(); atualizarResumo(); });
      [ini, fim].forEach(c => c.input.addEventListener('input', atualizarResumo));
      aplicar();
      return { f, folg, ini, fim, el: h('div', { class: 'linha-dia' }, [
        h('label', { texto: f.nome + '  •  ' + D.setor(f.setor).nome
          + (f.cargo ? '  •  ' + f.cargo : '') }),
        h('div', { estilo: { display: 'flex', gap: '8px', alignItems: 'center' } },
          [ini.el, fim.el, folg.el])
      ]) };
    });

    const resumo = aviso('');
    function atualizarResumo() {
      const vem = linhas.filter(l => !l.folg.input.checked);
      const folga = linhas.length - vem.length;
      resumo.textContent = vem.length + ' pessoa(s) trabalham  •  ' + folga + ' de folga\n'
        + (vem.length
          ? 'Abrindo com: ' + vem.map(l => l.f.nome.split(' ')[0] + ' ' + l.ini.input.value).join(', ')
          : '⚠ Ninguem escalado: a loja fica sem equipe neste dia.');
    }

    function definirTodos(folga, inicio, fim) {
      linhas.forEach(l => {
        l.folg.input.checked = folga;
        if (inicio) l.ini.input.value = inicio;
        if (fim) l.fim.input.value = fim;
        l.ini.input.disabled = l.fim.input.disabled = folga;
      });
      atualizarResumo();
    }

    function salvar() {
      linhas.forEach(l => {
        const gravado = Dados.ativos('turnos').find(t => t.funcionarioId === l.f.id && t.data === iso)
          || Dados.novo({ funcionarioId: l.f.id, funcionarioNome: l.f.nome, setor: l.f.setor,
            data: iso, inicio: '08:00', fim: '16:00', folga: false, observacao: '' });
        Object.assign(gravado, {
          funcionarioNome: l.f.nome, setor: l.f.setor,
          folga: l.folg.input.checked,
          inicio: l.ini.input.value || '08:00',
          fim: l.fim.input.value || '16:00',
          feriado: true,
          observacao: info ? info.nome : 'Feriado'
        });
        Dados.gravar('turnos', gravado, a.nome());
      });
      toast('Feriado montado. O mes ja esta atualizado.');
      ir('escala', { aba: 'mes', mes: iso.slice(0, 7) });
      render();
    }

    setTimeout(atualizarResumo);

    return h('div', {}, [
      cabecalho({ titulo: '🎉 ' + (info ? info.nome : 'Feriado'),
        sub: D.diaSemana(iso) + ', ' + D.data(iso) + '  •  quem folga e quem vem', voltar }),
      h('main', {}, linhas.length ? [
        aviso('O que voce salvar aqui vale so neste dia e ja aparece na escala do mes '
          + 'para a equipe inteira.', '#F57C00'),
        h('div', { estilo: { display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '10px 0' } }, [
          abaBotao('Todos folgam', false, () => definirTodos(true)),
          abaBotao('Todos no horario normal', false, () => definirTodos(false)),
          abaBotao('Meio periodo 08:00-14:00', false, () => definirTodos(false, '08:00', '14:00'))
        ]),
        resumo,
        ...linhas.map(l => l.el)
      ] : [vazio('Ninguem na equipe ainda.')]),
      linhas.length ? barra([
        { texto: 'Salvar o feriado', onclick: salvar },
        escalaDeFeriadoPronta(iso) ? { texto: 'Voltar ao padrao', classe: 'vermelho',
          onclick: () => confirmar('Voltar ao padrao',
            'Apagar a escala deste feriado e deixar o horario normal da semana?', () => {
              Dados.ativos('turnos').filter(t => t.data === iso)
                .forEach(t => Dados.excluir('turnos', t, a.nome()));
              toast('Feriado de volta ao padrao.');
              ir('escala', { aba: 'datas' });
              render();
            }) } : null
      ]) : null
    ]);
  });
}

// ------------------------------------------------------------------ domingos

const domingosDoMes = (ano, m) => {
  const r = [];
  const dias = new Date(ano, m + 1, 0).getDate();
  for (let dia = 1; dia <= dias; dia++) {
    const d = new Date(ano, m, dia);
    if (d.getDay() === 0) {
      r.push(ano + '-' + String(m + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0'));
    }
  }
  return r;
};

/** O domingo que a pessoa pegou no mes: um turno gravado, num domingo, sem folga. */
function domingoEscolhido(funcionarioId, ano, m) {
  const dias = domingosDoMes(ano, m);
  return Dados.ativos('turnos')
    .find(t => t.funcionarioId === funcionarioId && !t.folga && dias.includes(t.data));
}

/**
 * Escala de domingo: cada um pega um domingo do mes. Dois da mesma secao no
 * mesmo domingo deixa outro domingo descoberto, entao a tela avisa na hora.
 */
function telaResumoDomingos(ano, m, chaveMes, troca) {
  const a = D.Acesso;
  const dias = domingosDoMes(ano, m);
  const pessoas = equipe().filter(f => a.veSetor(f.setor));
  const podeMexer = a.editaEscala();

  const escolhas = new Map();
  pessoas.forEach(f => {
    const d = domingoEscolhido(f.id, ano, m);
    escolhas.set(f.id, d ? d.data : '');
  });

  // Choque = mais de uma pessoa do mesmo setor no mesmo domingo.
  const choques = [];
  dias.forEach(iso => {
    const porSetor = {};
    pessoas.forEach(f => {
      if (escolhas.get(f.id) !== iso) return;
      (porSetor[f.setor] = porSetor[f.setor] || []).push(f.nome);
    });
    Object.entries(porSetor).forEach(([setor, nomes]) => {
      if (nomes.length > 1) choques.push({ iso, setor, nomes });
    });
  });

  const cartoesDia = dias.map(iso => {
    const doDia = pessoas.filter(f => escolhas.get(f.id) === iso);
    const choque = choques.filter(c => c.iso === iso);
    return cartao({
      cor: choque.length ? '#D32F2F' : (doDia.length ? '#2E7D32' : '#90A4AE'),
      icone: '\ud83d\uddd3',
      titulo: 'Domingo ' + D.data(iso),
      sub: doDia.length ? doDia.length + ' pessoa(s)' : 'Ninguem escalado',
      extra: doDia.map(f => '\u2022 ' + f.nome + '  (' + D.setor(f.setor).nome + ')').join('\n'),
      selo: choque.length ? { texto: 'choque', cor: '#D32F2F' } : null,
      destaque: choque.length ? { texto: choque.map(c => '\u26a0 ' + D.setor(c.setor).nome + ': '
        + c.nomes.join(' e ') + ' caem no mesmo domingo.').join('\n'), cor: '#D32F2F' } : null
    });
  });

  const linhasPessoa = pessoas.map(f => {
    const opcoes = [{ valor: '', texto: 'Nao trabalha domingo' }]
      .concat(dias.map(iso => ({ valor: iso, texto: 'Domingo ' + D.data(iso) })));
    const sel = lista(f.nome + '  \u2022  ' + D.setor(f.setor).nome, opcoes, escolhas.get(f.id));
    sel.input.disabled = !podeMexer;
    sel.input.onchange = () => {
      definirDomingo(f, ano, m, sel.input.value);
      ir('escala', { aba: 'domingos', mes: chaveMes });
    };
    return sel.el;
  });

  return h('div', {}, [
    cabecalho({ titulo: '\ud83d\uddd3 Domingos de ' + NOMES_MES[m],
      sub: dias.length + ' domingo(s)  \u2022  ' + pessoas.length + ' pessoa(s)', voltar }),
    h('main', {}, [
      troca,
      choques.length
        ? aviso('\u26a0 ' + choques.length + ' choque(s) de domingo no mesmo setor. '
          + 'Espalhe as pessoas para nao ficar domingo sem ninguem.', '#D32F2F')
        : aviso('Cada pessoa pega um domingo do mes. O resto dos domingos ela folga.'),
      ...cartoesDia,
      h('h3', { texto: 'Quem pega qual domingo' }),
      ...(linhasPessoa.length ? linhasPessoa : [vazio('Ninguem na equipe ainda.')])
    ])
  ]);
}

/** Grava o domingo escolhido e devolve os outros domingos do mes para folga. */
function definirDomingo(f, ano, m, iso) {
  const a = D.Acesso;
  const dias = domingosDoMes(ano, m);
  const p = padraoDe(f.id);

  dias.forEach(dia => {
    const gravado = Dados.ativos('turnos').find(t => t.funcionarioId === f.id && t.data === dia);
    if (dia === iso) {
      const horario = p ? { inicio: p.inicio[6], fim: p.fim[6] } : { inicio: '08:00', fim: '14:00' };
      // Se o padrao marca domingo como folga, o horario dele vem do sabado.
      if (p && p.folga[6]) { horario.inicio = p.inicio[5]; horario.fim = p.fim[5]; }
      const t = gravado || Dados.novo({ funcionarioId: f.id, funcionarioNome: f.nome, setor: f.setor,
        data: dia, inicio: horario.inicio, fim: horario.fim, folga: false, observacao: 'Domingo do mes' });
      Object.assign(t, { funcionarioNome: f.nome, setor: f.setor, folga: false,
        inicio: horario.inicio, fim: horario.fim, observacao: 'Domingo do mes' });
      Dados.gravar('turnos', t, a.nome());
    } else if (gravado && !gravado.folga && gravado.observacao === 'Domingo do mes') {
      Dados.excluir('turnos', gravado, a.nome());
    }
  });
  toast(iso ? f.nome + ' escalado(a) no domingo ' + D.data(iso) : f.nome + ' sem domingo neste mes.');
}

/** Tela de domingos aberta pelo menu do mes. */
function telaDomingos(registrar) {
  registrar('escala-domingos', params => {
    const mes = params.mes ? new Date(params.mes + '-01T00:00:00') : new Date();
    return telaResumoDomingos(mes.getFullYear(), mes.getMonth(),
      mes.getFullYear() + '-' + String(mes.getMonth() + 1).padStart(2, '0'), null);
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

function formPadrao(funcionario, existente) {
  const a = D.Acesso;
  if (!a.editaEscala(funcionario.setor)) {
    toast('Só o dono ou o líder define a escala.');
    return;
  }
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
    const dias = parseInt(params.dias) || 30;

    // O funcionario ve a propria pontuacao (e o que ela premia); o ranking dos
    // colegas continua sendo assunto de quem cobra resultado.
    let fichas = ranking(dias);
    if (!a.veTrabalhoDosOutros()) {
      const eu = (a.nome() || '').trim().toLowerCase();
      fichas = fichas.filter(f => (f.nome || '').trim().toLowerCase() === eu);
    } else if (!a.dono()) {
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
      cabecalho({ titulo: a.veTrabalhoDosOutros() ? '🏆 Desempenho da equipe' : '🏆 Meus pontos',
        sub: 'Ultimos ' + dias + ' dias' + (a.veTrabalhoDosOutros()
          ? '  •  ' + fichas.length + ' pessoa(s) com registros' : ''), voltar }),
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
