/*
 * O painel do dono: o que os 30 dias de registro da equipe dizem sobre a loja.
 * Nada de dado novo aqui — e leitura do que ja foi registrado nos modulos.
 */
import { Dados } from './dados.js?v=202607282207';
import * as D from './dominio.js?v=202607282207';
import { h, cabecalho, vazio, aviso } from './ui.js?v=202607282207';

let ir, voltar;

export function instalarDashboard(api) {
  ir = api.ir; voltar = api.voltar;

  api.registrar('dashboard', () => {
    const a = D.Acesso;
    if (!a.dono()) {
      return h('div', {}, [
        cabecalho({ titulo: '📊 Painel do dono', voltar }),
        h('main', {}, [vazio('Esta tela e so do dono.')])
      ]);
    }

    const desde = D.hoje();
    const dias = 30;
    const dentro = data => D.diasAte(data) >= -dias && D.diasAte(data) <= 0;

    return h('div', {}, [
      cabecalho({ titulo: '📊 Painel do dono', sub: 'Os ultimos ' + dias + ' dias da loja', voltar,
        acao: { texto: '🏆', onclick: () => ir('desempenho') } }),
      h('main', {}, [
        quebras(dentro),
        validades(),
        checklistsPorPessoa(dentro),
        faltas(dentro),
        desistencias(dentro),
        h('div', { class: 'sub', estilo: { marginTop: '18px' } },
          'Cada numero vem do que a equipe registrou. Toque no titulo do bloco para abrir o modulo.')
      ])
    ]);
  });
}

// ------------------------------------------------------------------ blocos

/** Quebra e o prejuizo que da para ver: entra em R$, que e a lingua do dono. */
function quebras(dentro) {
  const itens = Dados.ativos('quebras').filter(q => dentro(q.data));
  const porProduto = {}, porSetor = {};
  let total = 0;
  itens.forEach(q => {
    const v = prejuizo(q);
    total += v;
    porProduto[q.produto || 'Sem nome'] = (porProduto[q.produto || 'Sem nome'] || 0) + v;
    porSetor[q.setor] = (porSetor[q.setor] || 0) + v;
  });

  return bloco('🗑', 'O que mais quebra', 'quebras',
    itens.length ? D.moeda(total) + ' de prejuizo em ' + itens.length + ' registro(s)'
      : 'Nenhuma quebra registrada no periodo',
    [
      barras(porProduto, D.moeda),
      subtituloBloco('Por setor'),
      barras(porSetor, D.moeda, chave => D.setor(chave).icone + ' ' + D.setor(chave).nome,
        chave => D.setor(chave).cor)
    ]);
}

/** Validade nao espera 30 dias: aqui vale o que esta na janela agora. */
function validades() {
  const itens = Dados.ativos('produtos').filter(p => D.diasAte(p.validade) <= 30);
  const porProduto = {}, porSetor = {};
  let vencidos = 0, urgentes = 0;
  itens.forEach(p => {
    const q = p.quantidade || 1;
    porProduto[p.nome || 'Sem nome'] = (porProduto[p.nome || 'Sem nome'] || 0) + q;
    porSetor[p.setor] = (porSetor[p.setor] || 0) + q;
    const d = D.diasAte(p.validade);
    if (d < 0) vencidos++; else if (d <= 2) urgentes++;
  });

  return bloco('📅', 'O que mais vence', 'validades',
    itens.length ? itens.length + ' na janela  •  ' + vencidos + ' vencido(s)  •  '
      + urgentes + ' urgente(s)' : 'Nada perto de vencer',
    [
      barras(porProduto, n => D.numero(n) + ' un'),
      subtituloBloco('Por setor'),
      barras(porSetor, n => D.numero(n) + ' un',
        chave => D.setor(chave).icone + ' ' + D.setor(chave).nome,
        chave => D.setor(chave).cor)
    ]);
}

/** Quem entrega checklist e quem segura a rotina da loja de pe. */
function checklistsPorPessoa(dentro) {
  const itens = Dados.ativos('respostas').filter(r => dentro(r.data) && r.concluido);
  const porPessoa = {}, itensMarcados = {};
  itens.forEach(r => {
    const quem = r.funcionario || r.autor || 'Sem nome';
    porPessoa[quem] = (porPessoa[quem] || 0) + 1;
    itensMarcados[quem] = (itensMarcados[quem] || 0)
      + (r.itens || []).filter(i => i.marcado).length;
  });

  return bloco('✅', 'Quem preenche mais checklists', 'checklists',
    itens.length ? itens.length + ' checklist(s) entregues no periodo'
      : 'Nenhum checklist entregue no periodo',
    [
      barras(porPessoa, n => n + 'x'),
      subtituloBloco('Itens marcados por pessoa'),
      barras(itensMarcados, n => n + ' itens')
    ]);
}

/** Produto que vive acabando na gondola e produto mal abastecido. */
function faltas(dentro) {
  const itens = Dados.ativos('rupturas').filter(r => dentro(r.data));
  const porProduto = {}, porSetor = {};
  let semEstoque = 0;
  itens.forEach(r => {
    porProduto[r.produto || 'Sem nome'] = (porProduto[r.produto || 'Sem nome'] || 0) + 1;
    porSetor[r.setor] = (porSetor[r.setor] || 0) + 1;
    if (r.situacao === 'COMPRAR') semEstoque++;
  });

  return bloco('🕳', 'Produtos que mais acabam', 'ruptura',
    itens.length ? itens.length + ' falta(s)  •  ' + semEstoque + ' sem estoque no deposito'
      : 'Nenhuma falta registrada no periodo',
    [
      barras(porProduto, n => n + 'x'),
      subtituloBloco('Por setor'),
      barras(porSetor, n => n + 'x',
        chave => D.setor(chave).icone + ' ' + D.setor(chave).nome,
        chave => D.setor(chave).cor)
    ]);
}

/** Desistencia no caixa e o cliente dizendo o que ele nao aceita pagar. */
function desistencias(dentro) {
  const itens = Dados.ativos('desistencias').filter(d => dentro(d.data));
  const porProduto = {}, porMotivo = {};
  itens.forEach(d => {
    const q = d.quantidade || 1;
    porProduto[d.produto || 'Sem nome'] = (porProduto[d.produto || 'Sem nome'] || 0) + q;
    porMotivo[rotuloMotivo(d.motivo)] = (porMotivo[rotuloMotivo(d.motivo)] || 0) + 1;
  });

  return bloco('🛒', 'O que os clientes mais deixam', 'desistencias',
    itens.length ? itens.length + ' desistencia(s) no periodo'
      : 'Nenhuma desistencia registrada no periodo',
    [
      barras(porProduto, n => n + 'x'),
      subtituloBloco('Por motivo'),
      barras(porMotivo, n => n + 'x')
    ]);
}

// ------------------------------------------------------------------ desenho

function bloco(icone, titulo, tela, resumo, filhos) {
  return h('div', { class: 'bloco-dash' }, [
    h('div', { class: 'cabeca', onclick: () => ir(tela) }, [
      h('span', { class: 'ic', texto: icone }),
      h('div', {}, [h('b', { texto: titulo }), h('small', { texto: resumo })]),
      h('span', { class: 'seta', texto: '›' })
    ]),
    ...filhos
  ]);
}

const subtituloBloco = texto => h('div', { class: 'sub-bloco', texto });

/**
 * Grafico de barras em HTML puro: a maior barra ocupa a linha toda e as outras
 * ficam proporcionais. Sem biblioteca — o app precisa abrir rapido no celular
 * do mercado e funcionar dentro do PWA, que nao carrega script de fora.
 */
function barras(mapa, formatar, rotulo, cor) {
  const linhas = Object.entries(mapa)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (!linhas.length) return h('div', { class: 'sub-bloco', texto: 'Sem dados ainda.' });

  const maior = linhas[0][1];
  return h('div', { class: 'barras' }, linhas.map(([chave, valor]) => {
    const largura = Math.max(6, Math.round(valor / maior * 100));
    return h('div', { class: 'barra-linha' }, [
      h('div', { class: 'rot', texto: rotulo ? rotulo(chave) : chave }),
      h('div', { class: 'trilho' }, [
        h('div', { class: 'preenchida', estilo: {
          width: largura + '%', background: cor ? cor(chave) : '#2E7D32'
        } })
      ]),
      h('div', { class: 'val', texto: formatar(valor) })
    ]);
  }));
}

// ------------------------------------------------------------------ contas

function prejuizo(q) {
  const fracionada = q.unidade === 'KG' || q.unidade === 'L';
  const total = fracionada ? (q.quantidade || 0)
    : (q.quantidade || 0) * Math.max(1, q.fator || 1);
  return total * (q.valorUnitario || 0);
}

const MOTIVOS = {
  ACHOU_CARO: 'Achou caro', PRECO_DIVERGENTE: 'Preco divergente',
  SEM_DINHEIRO: 'Dinheiro nao deu', DESISTIU: 'Mudou de ideia',
  ITEM_ERRADO: 'Item errado', PRODUTO_RUIM: 'Produto ruim', DEMORA: 'Demora na fila'
};
const rotuloMotivo = m => MOTIVOS[m] || 'Outro';
