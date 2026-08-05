/*
 * Na primeira abertura a loja ja nasce com um checklist por setor e o cronograma
 * de limpeza/reposicao — os mesmos textos do aplicativo Android.
 */
import { Dados, uuid } from './dados.js?v=202608051847';
import { SETORES_PADRAO } from './dominio.js?v=202608051847';

export const CHECKLISTS = {
  HORTIFRUTI: ['Retirar frutas, legumes e verduras improprios para venda',
    'Borrifar agua nas folhosas', 'Conferir temperatura da camara fria (8 a 10 C)',
    'Repor gondola e virar produto mais antigo para frente (PVPS)',
    'Higienizar caixas de exposicao e bancadas', 'Conferir balanca e etiquetas de preco por kg'],
  ACOUGUE: ['Aferir temperatura do balcao refrigerado (0 a 4 C)',
    'Aferir temperatura da camara de congelados (-18 C)',
    'Higienizar serra fita, moedor e tabuas', 'Conferir validade das bandejas embaladas na loja',
    'Conferir uso de EPI (luva de malha, avental, touca)', 'Registrar descarte de aparas e ossos'],
  PEIXARIA: ['Repor gelo na bancada de pescados', 'Avaliar aspecto, olhos e guelras do peixe fresco',
    'Aferir temperatura do expositor (0 a 2 C)', 'Higienizar bancada, facas e ralo',
    'Conferir data de recebimento dos pescados'],
  PADARIA: ['Ligar forno e conferir temperatura', 'Registrar producao do dia (paes, salgados, bolos)',
    'Etiquetar produtos com data de fabricacao e validade', 'Retirar produtos do dia anterior',
    'Higienizar masseira, cilindro e bancadas', 'Conferir estoque de farinha, fermento e embalagens'],
  FRIOS: ['Aferir temperatura das ilhas refrigeradas (0 a 4 C)',
    'Aplicar PVPS: produto de validade menor na frente', 'Higienizar fatiador de frios',
    'Conferir embalagens estufadas ou furadas', 'Retirar produtos vencidos e registrar como quebra'],
  MERCEARIA: ['Frente de gondola abastecida e alinhada',
    'Conferir etiquetas de preco e ofertas do tabloide', 'Retirar produtos vencidos das gondolas',
    'Conferir embalagens amassadas ou violadas', 'Repor produtos do deposito conforme ruptura'],
  BEBIDAS: ['Abastecer cervejeiro e refrigerados', 'Conferir validade de sucos, leites e agua de coco',
    'Organizar engradados e vasilhames de retorno', 'Conferir temperatura do refrigerado de bebidas',
    'Verificar avarias de latas e garrafas'],
  CONGELADOS: ['Aferir temperatura dos freezers (-18 C ou menos)',
    'Verificar acumulo de gelo / necessidade de degelo',
    'Conferir embalagens com sinais de descongelamento', 'Aplicar PVPS nos freezers',
    'Nao ultrapassar a linha de carga do freezer'],
  LIMPEZA: ['Repor gondola de limpeza', 'Conferir lacres e vazamentos nos frascos',
    'Conferir validade de produtos quimicos', 'Separar produtos quimicos de alimentos'],
  HIGIENE: ['Repor gondola de higiene e perfumaria', 'Conferir validade de cosmeticos e fraldas',
    'Conferir travas e antifurto dos itens de alto valor', 'Organizar por marca e tamanho'],
  PET: ['Conferir validade das racoes e sachês', 'Verificar embalagens rasgadas ou perfuradas',
    'Repor gondola e organizar por porte do animal'],
  CAIXA: ['Conferir fundo de troco de cada caixa', 'Testar impressora fiscal e leitor de codigo',
    'Repor sacolas e bobinas', 'Limpar esteiras e organizar checkouts',
    'Conferir produtos deixados no caixa e devolver a gondola'],
  DEPOSITO: ['Paletes organizados e identificados', 'Nada em contato direto com o chao ou parede',
    'Aplicar PVPS: lote mais antigo na frente', 'Corredores e saidas de emergencia livres',
    'Conferir avarias no recebimento', 'Registrar entrada de mercadoria no estoque do app']
};

/**
 * Catalogo pronto para o cadastro em massa: os produtos que praticamente todo
 * mercado vende. O dono escolhe quais entram na loja dele em Estoque >
 * Importar — ninguem e obrigado a aceitar a lista inteira, e todo item
 * continua editavel (inclusive o codigo) depois.
 *
 * O codigo de barras fica vazio de proposito: nao ha como garantir aqui um
 * EAN-13 verdadeiro por produto sem uma fonte confiavel, e um numero errado
 * atrapalha mais do que ajuda (o leitor de camera nunca vai bater com ele).
 * A tela ja trata "sem codigo" normalmente — o dono completa na hora que
 * escanear o produto de verdade pela primeira vez.
 *
 * Mesma lista, com os mesmos valores, do ProdutosSemente.ITENS do Android
 * (app/src/main/java/com/lhapps/mercadogestor/data/ProdutosSemente.java) —
 * os dois lados precisam enxergar o mesmo catalogo.
 */
export const PRODUTOS_SEMENTE = [
  // HORTIFRUTI
  { codigo: '', nome: 'Banana Prata', marca: '', setor: 'HORTIFRUTI', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Maca Gala', marca: '', setor: 'HORTIFRUTI', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Tomate', marca: '', setor: 'HORTIFRUTI', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Batata Inglesa', marca: '', setor: 'HORTIFRUTI', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Cebola', marca: '', setor: 'HORTIFRUTI', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Alface Crespa', marca: '', setor: 'HORTIFRUTI', unidade: 'UND', porCaixa: 1 },
  { codigo: '', nome: 'Laranja Pera', marca: '', setor: 'HORTIFRUTI', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Limao Tahiti', marca: '', setor: 'HORTIFRUTI', unidade: 'KG', porCaixa: 1 },

  // ACOUGUE
  { codigo: '', nome: 'Picanha Bovina', marca: '', setor: 'ACOUGUE', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Alcatra Bovina', marca: '', setor: 'ACOUGUE', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Frango Inteiro Resfriado', marca: '', setor: 'ACOUGUE', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'File de Peito de Frango', marca: '', setor: 'ACOUGUE', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Costela Bovina', marca: '', setor: 'ACOUGUE', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Linguica Toscana', marca: '', setor: 'ACOUGUE', unidade: 'KG', porCaixa: 1 },

  // PEIXARIA
  { codigo: '', nome: 'File de Tilapia', marca: '', setor: 'PEIXARIA', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'File de Salmao', marca: '', setor: 'PEIXARIA', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Camarao Medio Limpo', marca: '', setor: 'PEIXARIA', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Bacalhau Dessalgado', marca: '', setor: 'PEIXARIA', unidade: 'KG', porCaixa: 1 },

  // PADARIA
  { codigo: '', nome: 'Pao Frances', marca: '', setor: 'PADARIA', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Pao de Forma', marca: 'Pullman', setor: 'PADARIA', unidade: 'UND', porCaixa: 1 },
  { codigo: '', nome: 'Pao de Forma Integral', marca: 'Wickbold', setor: 'PADARIA', unidade: 'UND', porCaixa: 1 },
  { codigo: '', nome: 'Bolo Caseiro', marca: '', setor: 'PADARIA', unidade: 'UND', porCaixa: 1 },
  { codigo: '', nome: 'Rosca Doce', marca: '', setor: 'PADARIA', unidade: 'UND', porCaixa: 1 },

  // FRIOS
  { codigo: '', nome: 'Leite Integral 1L', marca: 'Piracanjuba', setor: 'FRIOS', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Leite Integral 1L', marca: 'Italac', setor: 'FRIOS', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Queijo Mussarela Fatiado', marca: '', setor: 'FRIOS', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Presunto Fatiado', marca: 'Sadia', setor: 'FRIOS', unidade: 'KG', porCaixa: 1 },
  { codigo: '', nome: 'Requeijao Cremoso 200g', marca: 'Catupiry', setor: 'FRIOS', unidade: 'CX', porCaixa: 24 },
  { codigo: '', nome: 'Manteiga com Sal 200g', marca: 'Aviacao', setor: 'FRIOS', unidade: 'CX', porCaixa: 24 },
  { codigo: '', nome: 'Iogurte Morango 170g', marca: 'Danone', setor: 'FRIOS', unidade: 'CX', porCaixa: 12 },

  // MERCEARIA
  { codigo: '', nome: 'Arroz Branco Tipo 1 5kg', marca: 'Tio Joao', setor: 'MERCEARIA', unidade: 'PCT', porCaixa: 1 },
  { codigo: '', nome: 'Feijao Carioca 1kg', marca: 'Camil', setor: 'MERCEARIA', unidade: 'PCT', porCaixa: 1 },
  { codigo: '', nome: 'Acucar Refinado 1kg', marca: 'Uniao', setor: 'MERCEARIA', unidade: 'PCT', porCaixa: 1 },
  { codigo: '', nome: 'Cafe Torrado e Moido 500g', marca: 'Pilao', setor: 'MERCEARIA', unidade: 'PCT', porCaixa: 1 },
  { codigo: '', nome: 'Oleo de Soja 900ml', marca: 'Soya', setor: 'MERCEARIA', unidade: 'CX', porCaixa: 20 },
  { codigo: '', nome: 'Sal Refinado 1kg', marca: 'Cisne', setor: 'MERCEARIA', unidade: 'PCT', porCaixa: 1 },
  { codigo: '', nome: 'Farinha de Trigo 1kg', marca: 'Dona Benta', setor: 'MERCEARIA', unidade: 'PCT', porCaixa: 1 },
  { codigo: '', nome: 'Macarrao Espaguete 500g', marca: 'Adria', setor: 'MERCEARIA', unidade: 'PCT', porCaixa: 1 },
  { codigo: '', nome: 'Molho de Tomate 340g', marca: 'Fugini', setor: 'MERCEARIA', unidade: 'CX', porCaixa: 24 },
  { codigo: '', nome: 'Vinagre de Alcool 750ml', marca: 'Castelo', setor: 'MERCEARIA', unidade: 'CX', porCaixa: 12 },

  // MATINAIS
  { codigo: '', nome: 'Achocolatado em Po 400g', marca: 'Nescau', setor: 'MATINAIS', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Achocolatado em Po 400g', marca: 'Toddy', setor: 'MATINAIS', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Leite em Po 400g', marca: 'Ninho', setor: 'MATINAIS', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Cereal Matinal 300g', marca: "Kellogg's", setor: 'MATINAIS', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Geleia de Morango 200g', marca: 'Queensberry', setor: 'MATINAIS', unidade: 'CX', porCaixa: 12 },

  // DOCES
  { codigo: '', nome: 'Biscoito Recheado 126g', marca: 'Trakinas', setor: 'DOCES', unidade: 'CX', porCaixa: 24 },
  { codigo: '', nome: 'Biscoito Cream Cracker 200g', marca: 'Adria', setor: 'DOCES', unidade: 'CX', porCaixa: 24 },
  { codigo: '', nome: 'Chocolate ao Leite 90g', marca: 'Lacta', setor: 'DOCES', unidade: 'CX', porCaixa: 20 },
  { codigo: '', nome: 'Bala de Goma', marca: 'Fini', setor: 'DOCES', unidade: 'CX', porCaixa: 24 },
  { codigo: '', nome: 'Chocolate ao Leite', marca: 'Garoto', setor: 'DOCES', unidade: 'CX', porCaixa: 20 },
  { codigo: '', nome: 'Po para Pudim 40g', marca: 'Royal', setor: 'DOCES', unidade: 'CX', porCaixa: 24 },

  // SALGADINHOS
  { codigo: '', nome: 'Salgadinho de Batata Ondulado 96g', marca: 'Ruffles', setor: 'SALGADINHOS', unidade: 'CX', porCaixa: 15 },
  { codigo: '', nome: 'Salgadinho de Tortilha 84g', marca: 'Doritos', setor: 'SALGADINHOS', unidade: 'CX', porCaixa: 15 },
  { codigo: '', nome: 'Batata Frita Chips', marca: "Lay's", setor: 'SALGADINHOS', unidade: 'CX', porCaixa: 15 },
  { codigo: '', nome: 'Amendoim Japones 150g', marca: 'Yoki', setor: 'SALGADINHOS', unidade: 'CX', porCaixa: 24 },

  // BEBIDAS
  { codigo: '', nome: 'Refrigerante Cola 2L', marca: 'Coca-Cola', setor: 'BEBIDAS', unidade: 'FD', porCaixa: 6 },
  { codigo: '', nome: 'Refrigerante Guarana 2L', marca: 'Antarctica', setor: 'BEBIDAS', unidade: 'FD', porCaixa: 6 },
  { codigo: '', nome: 'Suco de Uva 1L', marca: 'Del Valle', setor: 'BEBIDAS', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Agua Mineral sem Gas 500ml', marca: 'Crystal', setor: 'BEBIDAS', unidade: 'FD', porCaixa: 12 },
  { codigo: '', nome: 'Cerveja Lata 350ml', marca: 'Skol', setor: 'BEBIDAS', unidade: 'FD', porCaixa: 12 },
  { codigo: '', nome: 'Cerveja Lata 350ml', marca: 'Brahma', setor: 'BEBIDAS', unidade: 'FD', porCaixa: 12 },
  { codigo: '', nome: 'Refrigerante Guarana Lata 350ml', marca: 'Antarctica', setor: 'BEBIDAS', unidade: 'FD', porCaixa: 12 },

  // CONGELADOS
  { codigo: '', nome: 'Lasanha Congelada', marca: 'Sadia', setor: 'CONGELADOS', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Batata Frita Congelada', marca: 'McCain', setor: 'CONGELADOS', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Hamburguer Bovino Congelado', marca: 'Sadia', setor: 'CONGELADOS', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Polpa de Acai Congelada', marca: 'De Marchi', setor: 'CONGELADOS', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Nuggets de Frango', marca: 'Perdigao', setor: 'CONGELADOS', unidade: 'CX', porCaixa: 12 },

  // LIMPEZA
  { codigo: '', nome: 'Detergente Liquido 500ml', marca: 'Ype', setor: 'LIMPEZA', unidade: 'CX', porCaixa: 24 },
  { codigo: '', nome: 'Sabao em Po 1kg', marca: 'OMO', setor: 'LIMPEZA', unidade: 'CX', porCaixa: 9 },
  { codigo: '', nome: 'Agua Sanitaria 1L', marca: 'Qboa', setor: 'LIMPEZA', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Amaciante de Roupas 1L', marca: 'Comfort', setor: 'LIMPEZA', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Desinfetante 500ml', marca: 'Pinho Sol', setor: 'LIMPEZA', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Esponja de Aco', marca: 'Bombril', setor: 'LIMPEZA', unidade: 'CX', porCaixa: 24 },
  { codigo: '', nome: 'Sabao em Barra', marca: 'Ype', setor: 'LIMPEZA', unidade: 'CX', porCaixa: 24 },

  // HIGIENE
  { codigo: '', nome: 'Papel Higienico Folha Dupla 4un', marca: 'Neve', setor: 'HIGIENE', unidade: 'FD', porCaixa: 16 },
  { codigo: '', nome: 'Sabonete em Barra 85g', marca: 'Lux', setor: 'HIGIENE', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Shampoo 325ml', marca: 'Seda', setor: 'HIGIENE', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Creme Dental 90g', marca: 'Colgate', setor: 'HIGIENE', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Fralda Descartavel Tamanho M', marca: 'Pampers', setor: 'HIGIENE', unidade: 'PCT', porCaixa: 1 },
  { codigo: '', nome: 'Absorvente com Abas', marca: 'Sempre Livre', setor: 'HIGIENE', unidade: 'CX', porCaixa: 12 },
  { codigo: '', nome: 'Desodorante Aerosol', marca: 'Rexona', setor: 'HIGIENE', unidade: 'CX', porCaixa: 12 },

  // UTILIDADES
  { codigo: '', nome: 'Saco de Lixo 30L', marca: 'Bralyx', setor: 'UTILIDADES', unidade: 'PCT', porCaixa: 1 },
  { codigo: '', nome: 'Papel Aluminio', marca: 'Wyda', setor: 'UTILIDADES', unidade: 'CX', porCaixa: 24 },
  { codigo: '', nome: 'Filme PVC', marca: 'Wyda', setor: 'UTILIDADES', unidade: 'CX', porCaixa: 24 },
  { codigo: '', nome: 'Vela Branca', marca: 'Bahia', setor: 'UTILIDADES', unidade: 'CX', porCaixa: 20 },
  { codigo: '', nome: 'Fosforo', marca: 'Fiat Lux', setor: 'UTILIDADES', unidade: 'CX', porCaixa: 20 },
  { codigo: '', nome: 'Pilha AA', marca: 'Duracell', setor: 'UTILIDADES', unidade: 'CX', porCaixa: 24 },

  // PET
  { codigo: '', nome: 'Racao para Caes Adultos 15kg', marca: 'Golden', setor: 'PET', unidade: 'PCT', porCaixa: 1 },
  { codigo: '', nome: 'Racao para Gatos 1kg', marca: 'Whiskas', setor: 'PET', unidade: 'PCT', porCaixa: 1 },
  { codigo: '', nome: 'Areia Sanitaria para Gatos', marca: 'Pipicat', setor: 'PET', unidade: 'PCT', porCaixa: 1 },
  { codigo: '', nome: 'Petisco para Caes', marca: 'Pedigree', setor: 'PET', unidade: 'CX', porCaixa: 12 },
];

const ROTINAS = [
  ['Aferir temperatura dos freezers', 'CONGELADOS', '🌡', '08:00', 30],
  ['Aferir temperatura do balcao de frios', 'FRIOS', '🌡', '08:30', 30],
  ['Borrifar agua nas folhosas', 'HORTIFRUTI', '📌', '09:00', 60],
  ['Limpar o fatiador de frios', 'FRIOS', '🧽', '13:00', 30],
  ['Higienizar serra fita e moedor', 'ACOUGUE', '🧽', '13:30', 30],
  ['Repor gelo da peixaria', 'PEIXARIA', '📥', '14:00', 30],
  ['Limpar masseira e bancadas', 'PADARIA', '🧽', '15:00', 45],
  ['Reposicao de gondola da mercearia', 'MERCEARIA', '📥', '16:00', 60],
  ['Retirar vencidos e lancar quebras', 'FRIOS', '🗑', '17:00', 60],
  ['Abastecer cervejeiro e refrigerados', 'BEBIDAS', '📥', '18:00', 60],
  ['Limpeza dos checkouts', 'CAIXA', '🧽', '21:00', 45]
];

export function semear(autor) {
  // Os setores viram cadastro desde o inicio, para o dono poder editar e criar.
  Object.entries(SETORES_PADRAO).forEach(([chave, v], i) => {
    Dados.d.setores.push(Dados.novo({
      chave, nome: v.nome, icone: v.icone, cor: v.cor, ordem: i, ativo: true, autor
    }));
  });

  Object.entries(CHECKLISTS).forEach(([setor, itens]) => {
    Dados.d.checklists.push(Dados.novo({
      nome: 'Checklist diario - ' + setor, setor, diario: true, ativo: true, autor,
      itens: itens.map(texto => ({ id: uuid(), texto, exigeObservacao: false }))
    }));
  });

  ROTINAS.forEach(([titulo, setor, icone, horario, tolerancia]) => {
    Dados.d.rotinas.push(Dados.novo({
      titulo, setor, icone, horario, tolerancia, autor,
      dias: [true, true, true, true, true, true, true],
      responsavel: '', instrucao: '', ativo: true, tipo: 'LIMPEZA'
    }));
  });

  Dados.salvar({ enviar: false });
}
