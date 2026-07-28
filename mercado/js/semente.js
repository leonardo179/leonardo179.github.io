/*
 * Na primeira abertura a loja ja nasce com um checklist por setor e o cronograma
 * de limpeza/reposicao — os mesmos textos do aplicativo Android.
 */
import { Dados, uuid } from './dados.js?v=202607281715';

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
