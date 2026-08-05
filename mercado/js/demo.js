/*
 * Dados de teste: enche a loja com um dia inteiro de movimento fingido para
 * dar para experimentar o app sem esperar a equipe usar. Todo registro criado
 * aqui leva demo:true, entao da para limpar tudo depois sem tocar no que e real.
 */
import { Dados } from './dados.js?v=202608051826';
import * as D from './dominio.js?v=202608051826';

const dia = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const sorteio = arr => arr[Math.floor(Math.random() * arr.length)];
const inteiro = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const hora = (h, m) => String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');

const PRODUTOS = [
  { nome: 'Leite integral Italac 1L', setor: 'FRIOS', preco: 5.49, cx: 12 },
  { nome: 'Iogurte Danone morango 540g', setor: 'FRIOS', preco: 9.90, cx: 6 },
  { nome: 'Presunto cozido Sadia kg', setor: 'FRIOS', preco: 32.90, cx: 1 },
  { nome: 'Queijo mussarela Tirolez kg', setor: 'FRIOS', preco: 44.90, cx: 1 },
  { nome: 'Bolacha recheada Nikito chocolate', setor: 'DOCES', preco: 2.49, cx: 40 },
  { nome: 'Biscoito agua e sal Marilan', setor: 'DOCES', preco: 4.29, cx: 20 },
  { nome: 'Chocolate Lacta ao leite 90g', setor: 'DOCES', preco: 7.99, cx: 17 },
  { nome: 'Salgadinho Fandangos queijo', setor: 'SALGADINHOS', preco: 6.49, cx: 20 },
  { nome: 'Batata Ruffles original 84g', setor: 'SALGADINHOS', preco: 9.99, cx: 20 },
  { nome: 'Cafe Pilao 500g', setor: 'MATINAIS', preco: 18.90, cx: 10 },
  { nome: 'Achocolatado Nescau 370g', setor: 'MATINAIS', preco: 8.49, cx: 12 },
  { nome: 'Pao de forma Pullman 500g', setor: 'PADARIA', preco: 9.90, cx: 10 },
  { nome: 'Arroz Tio Joao 5kg', setor: 'MERCEARIA', preco: 27.90, cx: 6 },
  { nome: 'Feijao carioca Kicaldo 1kg', setor: 'MERCEARIA', preco: 8.29, cx: 10 },
  { nome: 'Oleo de soja Liza 900ml', setor: 'MERCEARIA', preco: 7.49, cx: 20 },
  { nome: 'Acucar refinado Uniao 1kg', setor: 'MERCEARIA', preco: 4.99, cx: 10 },
  { nome: 'Cerveja Brahma lata 350ml', setor: 'BEBIDAS', preco: 3.79, cx: 12 },
  { nome: 'Refrigerante Coca-Cola 2L', setor: 'BEBIDAS', preco: 10.90, cx: 6 },
  { nome: 'Suco Del Valle uva 1L', setor: 'BEBIDAS', preco: 8.90, cx: 12 },
  { nome: 'Detergente Ype neutro 500ml', setor: 'LIMPEZA', preco: 2.39, cx: 24 },
  { nome: 'Sabao em po Omo 1,6kg', setor: 'LIMPEZA', preco: 24.90, cx: 9 },
  { nome: 'Papel higienico Neve 12 rolos', setor: 'HIGIENE', preco: 21.90, cx: 8 },
  { nome: 'Shampoo Seda 325ml', setor: 'HIGIENE', preco: 13.90, cx: 12 },
  { nome: 'Banana prata kg', setor: 'HORTIFRUTI', preco: 6.99, cx: 1 },
  { nome: 'Tomate italiano kg', setor: 'HORTIFRUTI', preco: 8.49, cx: 1 },
  { nome: 'Alface crespa unidade', setor: 'HORTIFRUTI', preco: 3.99, cx: 1 },
  { nome: 'Picanha bovina kg', setor: 'ACOUGUE', preco: 89.90, cx: 1 },
  { nome: 'File de frango kg', setor: 'ACOUGUE', preco: 19.90, cx: 1 },
  { nome: 'Linguica toscana Seara kg', setor: 'ACOUGUE', preco: 24.90, cx: 1 },
  { nome: 'Tilapia congelada kg', setor: 'PEIXARIA', preco: 39.90, cx: 1 },
  { nome: 'Lasanha congelada Sadia 600g', setor: 'CONGELADOS', preco: 22.90, cx: 8 },
  { nome: 'Pizza congelada Perdigao', setor: 'CONGELADOS', preco: 19.90, cx: 8 },
  { nome: 'Esponja de aco Bombril', setor: 'UTILIDADES', preco: 3.49, cx: 24 },
  { nome: 'Pote plastico 1L', setor: 'UTILIDADES', preco: 12.90, cx: 12 }
];

const FORNECEDORES = ['Ambev', 'Coca-Cola FEMSA', 'Nestle', 'Sadia', 'Ype', 'Italac'];
const CONCORRENTES = ['Mercado do Bairro', 'Atacadao da Esquina', 'Super Economico'];

/** Um setor que exista de verdade nesta loja; se sumiu, cai na mercearia. */
const setorValido = chave =>
  D.setoresAtivos().some(s => s.chave === chave) ? chave : 'MERCEARIA';

const criar = (lista, campos, autor) =>
  Dados.gravar(lista, Dados.novo(Object.assign({ demo: true }, campos)), autor);

/** Quanto ja existe de dados de teste na loja. */
export function contarDemo() {
  return Object.keys(Dados.d)
    .filter(k => Array.isArray(Dados.d[k]))
    .reduce((t, k) => t + Dados.d[k].filter(x => x && x.demo && !x.excluido).length, 0);
}

export function limparDemo(autor) {
  let n = 0;
  Object.keys(Dados.d).filter(k => Array.isArray(Dados.d[k])).forEach(k => {
    Dados.d[k].filter(x => x && x.demo && !x.excluido).forEach(x => {
      Dados.excluir(k, x, autor);
      n++;
    });
  });
  return n;
}

/**
 * Enche a loja de movimento. Nao mexe em usuarios nem em senhas: quem entra no
 * app continua sendo quem o dono cadastrou.
 */
export function popularDemo(autor) {
  const eu = autor || D.Acesso.nome() || 'Teste';
  const pessoas = Dados.ativos('usuarios').filter(u => u.ativo !== false).map(u => u.nome);
  const quem = () => pessoas.length ? sorteio(pessoas) : eu;

  catalogo(eu);
  validades(eu);
  paletes(eu);
  quebras(eu, quem);
  contagens(eu, quem);
  precos(eu);
  temperaturas(eu, quem);
  rupturas(eu, quem);
  desistencias(eu, quem);
  entregas(eu);
  checklistsRespondidos(eu, quem);
  rotinasFeitas(eu, quem);

  return contarDemo();
}

// ------------------------------------------------------------------ blocos

function catalogo(autor) {
  PRODUTOS.forEach((p, i) => criar('catalogo', {
    codigo: '789' + String(1000000 + i * 137).padStart(10, '0'),
    nome: p.nome, marca: '', setor: setorValido(p.setor),
    unidade: 'UND', porCaixa: p.cx, preco: p.preco
  }, autor));
}

/** Validades espalhadas: vencido, urgente, atencao e tranquilo. */
function validades(autor) {
  const prazos = [-3, -1, 1, 2, 4, 7, 9, 12, 15, 18, 22, 26, 29, 35, 44, 60, 75, 90];
  PRODUTOS.forEach((p, i) => {
    const dias = prazos[i % prazos.length];
    criar('produtos', {
      nome: p.nome, setor: setorValido(p.setor), validade: dia(dias),
      quantidade: inteiro(2, 40), unidade: sorteio(['UND', 'CX', 'FD']),
      fator: p.cx, valorUnitario: p.preco, lote: 'L' + inteiro(1000, 9999),
      observacao: '', avisou30: false, avisou15: false, avisou2: false
    }, autor);
  });
  // Uns poucos com muito estoque e pouco prazo: o caso que pede desconto agressivo.
  ['Iogurte Danone morango 540g', 'Pao de forma Pullman 500g'].forEach(nome => {
    const p = PRODUTOS.find(x => x.nome === nome);
    criar('produtos', {
      nome: p.nome, setor: setorValido(p.setor), validade: dia(2),
      quantidade: 120, unidade: 'UND', fator: 1, valorUnitario: p.preco,
      lote: 'L' + inteiro(1000, 9999), observacao: 'Recebido em excesso',
      avisou30: false, avisou15: false, avisou2: false
    }, autor);
  });
}

function paletes(autor) {
  const locais = ['Deposito A', 'Deposito B', 'Corredor 3', 'Camara fria', 'Mezanino'];
  for (let i = 1; i <= 6; i++) {
    const p = sorteio(PRODUTOS);
    criar('paletes', {
      codigo: 'Palete ' + i, local: sorteio(locais), setor: setorValido(p.setor),
      produto: p.nome, quantidade: inteiro(8, 40), unidade: 'CX', fator: p.cx,
      observacao: '', ativo: true
    }, autor);
  }
}

function quebras(autor, quem) {
  const motivos = ['VENCIMENTO', 'AVARIA', 'TEMPERATURA', 'MANUSEIO', 'ROEDOR'];
  for (let i = 0; i < 9; i++) {
    const p = sorteio(PRODUTOS);
    criar('quebras', {
      produto: p.nome, setor: setorValido(p.setor), data: dia(-inteiro(0, 6)),
      quantidade: inteiro(1, 6), unidade: sorteio(['UND', 'CX', 'KG']), fator: p.cx,
      valorUnitario: p.preco, motivo: sorteio(motivos), detalhe: '', foto: '',
      funcionario: quem()
    }, autor);
  }
}

function contagens(autor, quem) {
  FORNECEDORES.slice(0, 4).forEach(f => {
    const itens = PRODUTOS.filter(() => Math.random() < 0.25).slice(0, 5);
    criar('contagens', {
      fornecedor: f, setor: setorValido(sorteio(itens).setor || 'MERCEARIA'),
      data: dia(-inteiro(0, 3)), funcionario: quem(), concluida: true,
      horaFim: hora(inteiro(8, 11), sorteio([0, 15, 30, 45])),
      itens: itens.map(p => (p.cx > 1
        ? { produto: p.nome, unidade: 'CX', caixas: inteiro(1, 8), porCaixa: p.cx, unidades: inteiro(0, 11) }
        // Produto de peso ou solto nao tem caixa: conta como esta na gondola.
        : { produto: p.nome, unidade: sorteio(['UND', 'KG']), caixas: 0, porCaixa: 1, unidades: inteiro(3, 40) }))
    }, autor);
  });
}

function precos(autor) {
  const concorrente = sorteio(CONCORRENTES);
  PRODUTOS.filter((_, i) => i % 3 === 0).forEach(p => {
    const nosso = p.preco;
    const deles = Math.round(nosso * (0.82 + Math.random() * 0.4) * 100) / 100;
    criar('precos', {
      produto: p.nome, setor: setorValido(p.setor), concorrente,
      data: dia(-inteiro(0, 5)), nossoPreco: nosso, precoConcorrente: deles,
      coletado: true, funcionario: '', observacao: ''
    }, autor);
  });
}

function temperaturas(autor, quem) {
  const equipamentos = [
    { nome: 'Camara fria de frios', setor: 'FRIOS', min: 0, max: 4 },
    { nome: 'Balcao de acougue', setor: 'ACOUGUE', min: 0, max: 4 },
    { nome: 'Ilha de congelados', setor: 'CONGELADOS', min: -22, max: -18 },
    { nome: 'Expositor de pescados', setor: 'PEIXARIA', min: 0, max: 2 }
  ];
  equipamentos.forEach(e => {
    const eq = criar('equipamentos', {
      nome: e.nome, setor: setorValido(e.setor), minima: e.min, maxima: e.max,
      horarios: ['08:00', '14:00', '20:00'], ativo: true
    }, autor);

    ['08:00', '14:00'].forEach(hAlvo => {
      const fora = Math.random() < 0.25;
      const t = fora ? e.max + inteiro(2, 5) : e.min + Math.random() * (e.max - e.min);
      criar('leituras', {
        equipamentoId: eq.id, equipamento: e.nome, setor: setorValido(e.setor),
        data: dia(0), horarioAlvo: hAlvo,
        registradaAs: hAlvo === '08:00' ? hora(8, inteiro(2, 20)) : hora(14, inteiro(1, 25)),
        temperatura: Math.round(t * 10) / 10, foraDaFaixa: fora,
        acaoTomada: fora ? 'Chamado o tecnico e produtos passados para outra camara' : '',
        funcionario: quem()
      }, autor);
    });
  });
}

function rupturas(autor, quem) {
  PRODUTOS.filter(() => Math.random() < 0.18).slice(0, 6).forEach(p => {
    const temEstoque = Math.random() < 0.5;
    criar('rupturas', {
      produto: p.nome, setor: setorValido(p.setor), data: dia(0),
      hora: hora(inteiro(8, 17), sorteio([0, 10, 20, 30, 40, 50])),
      funcionario: quem(), temNoDeposito: temEstoque, resolvida: Math.random() < 0.3,
      resolvidaPor: '', observacao: ''
    }, autor);
  });
}

function desistencias(autor, quem) {
  const motivos = ['ACHOU_CARO', 'PRECO_DIVERGENTE', 'SEM_DINHEIRO', 'DESISTIU', 'ITEM_ERRADO'];
  PRODUTOS.filter(() => Math.random() < 0.2).slice(0, 7).forEach(p => {
    const motivo = sorteio(motivos);
    criar('desistencias', {
      codigo: '', produto: p.nome, setor: setorValido(p.setor), data: dia(0),
      hora: hora(inteiro(9, 19), sorteio([0, 12, 25, 38, 47])), operador: quem(),
      motivo, precoEtiqueta: p.preco,
      precoCaixa: motivo === 'PRECO_DIVERGENTE' ? Math.round(p.preco * 1.15 * 100) / 100 : 0,
      quantidade: inteiro(1, 3), observacao: '', recolhido: Math.random() < 0.4,
      recolhidoPor: '', recolhidoAs: '', avisouRecolher: false, avisouAtraso: false
    }, autor);
  });
}

function entregas(autor) {
  const enderecos = [
    'Rua das Flores 220, Centro', 'Av. Brasil 1450, apto 302', 'Rua Sao Jorge 87, Vila Nova',
    'Travessa do Comercio 12', 'Rua 15 de Novembro 940', 'Restaurante Sabor da Praca, Praca Matriz'
  ];
  enderecos.forEach((e, i) => {
    const urgente = i === enderecos.length - 1;
    criar('entregas', {
      endereco: e, temFrios: Math.random() < 0.5, urgente,
      pagamento: sorteio(['PAGO', 'DINHEIRO', 'CARTAO']), valor: inteiro(45, 320),
      troco: 0, observacao: urgente ? 'Restaurante: precisa antes das 11h' : '',
      data: dia(0), hora: hora(inteiro(8, 15), sorteio([0, 15, 30, 45])),
      status: i < 2 ? 'ENTREGUE' : 'FILA', entregador: '', motivoProblema: ''
    }, autor);
  });
}

function checklistsRespondidos(autor, quem) {
  Dados.ativos('checklists').filter(c => c.ativo !== false).slice(0, 4).forEach(c => {
    const itens = (c.itens || []).map(t => {
      const texto = typeof t === 'string' ? t : (t.texto || '');
      const marcado = Math.random() < 0.75;
      return { texto, marcado, observacao: marcado ? '' : sorteio(['Faltou material', 'Sem tempo', '']) };
    });
    criar('respostas', {
      checklistId: c.id, setor: c.setor, data: dia(0), funcionario: quem(),
      itens, concluido: true, observacaoGeral: '',
      entregueAs: hora(inteiro(9, 18), sorteio([5, 17, 34, 48]))
    }, autor);
  });
}

function rotinasFeitas(autor, quem) {
  Dados.ativos('rotinas').filter(r => r.ativo !== false).slice(0, 6).forEach((r, i) => {
    if (i % 3 === 0) return;   // uma parte fica em aberto de proposito
    criar('execucoes', {
      rotinaId: r.id, data: dia(0), feita: true,
      concluidaAs: hora(inteiro(8, 17), sorteio([3, 19, 27, 41, 55])),
      funcionario: quem(), observacao: '', atrasada: Math.random() < 0.25
    }, autor);
  });
}
