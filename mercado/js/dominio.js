/*
 * Regras de negocio compartilhadas com o app Android: setores, faixas de validade,
 * perfis de acesso e senha. Os nomes das constantes sao iguais aos do Java porque
 * os dois lados leem e escrevem o mesmo arquivo.
 */
import { Dados, Prefs } from './dados.js?v=202608051829';

/**
 * Setores da loja.
 *
 * Estes sao os que ja vem prontos. A loja pode criar outros e editar estes na
 * tela Setores — por isso a lista de verdade fica nos dados, e esta aqui e so a
 * semente. Cada setor tem uma chave (que os registros guardam) e um nome, que o
 * dono muda quando quiser sem quebrar o historico.
 */
export const SETORES_PADRAO = {
  HORTIFRUTI: { nome: 'Hortifruti', icone: '🥬', cor: '#43A047' },
  ACOUGUE: { nome: 'Acougue', icone: '🥩', cor: '#C62828' },
  PEIXARIA: { nome: 'Peixaria', icone: '🐟', cor: '#0277BD' },
  PADARIA: { nome: 'Padaria', icone: '🥖', cor: '#EF6C00' },
  FRIOS: { nome: 'Frios e Laticinios', icone: '🧀', cor: '#F9A825' },
  MERCEARIA: { nome: 'Mercearia', icone: '🛒', cor: '#6D4C41' },
  MATINAIS: { nome: 'Matinais', icone: '☕', cor: '#795548' },
  DOCES: { nome: 'Doces e Bolachas', icone: '🍪', cor: '#D81B60' },
  SALGADINHOS: { nome: 'Salgadinhos', icone: '🍟', cor: '#FF7043' },
  BEBIDAS: { nome: 'Bebidas', icone: '🥤', cor: '#6A1B9A' },
  CONGELADOS: { nome: 'Congelados', icone: '❄', cor: '#00838F' },
  LIMPEZA: { nome: 'Limpeza', icone: '🧴', cor: '#00897B' },
  HIGIENE: { nome: 'Higiene e Perfumaria', icone: '🧷', cor: '#AD1457' },
  UTILIDADES: { nome: 'Utilidades', icone: '🍳', cor: '#5D4037' },
  PET: { nome: 'Pet Shop', icone: '🐶', cor: '#8D6E63' },
  CAIXA: { nome: 'Frente de Caixa', icone: '💰', cor: '#2E7D32' },
  DEPOSITO: { nome: 'Deposito', icone: '📦', cor: '#455A64' }
};

export const SETORES = SETORES_PADRAO;   // compatibilidade com o codigo antigo

/** A lista viva: o que a loja cadastrou, ou a semente enquanto nao cadastrou nada. */
export function setoresAtivos() {
  const salvos = (Dados.d.setores || []).filter(x => !x.excluido && x.ativo !== false);
  if (salvos.length) {
    return salvos.slice().sort((a, b) =>
      (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome));
  }
  return Object.entries(SETORES_PADRAO)
    .map(([chave, v], i) => ({ chave, nome: v.nome, icone: v.icone, cor: v.cor, ordem: i }));
}

/** Resolve a chave para o setor cadastrado (ou o padrao, ou um generico). */
export function setor(chave) {
  if (!chave) return { chave: '', nome: 'Sem setor', icone: '🛒', cor: '#6D4C41' };
  const salvo = (Dados.d.setores || []).find(x => x.chave === chave && !x.excluido);
  if (salvo) return salvo;
  const padrao = SETORES_PADRAO[chave];
  if (padrao) return Object.assign({ chave }, padrao);
  return { chave, nome: chave, icone: '🛒', cor: '#6D4C41' };
}

export const UNIDADES = {
  UND: { sigla: 'und', fator: 1 }, CX: { sigla: 'cx', fator: 12 },
  FD: { sigla: 'fd', fator: 6 }, PALETE: { sigla: 'palete', fator: 480 },
  KG: { sigla: 'kg', fator: 1, fracionada: true },
  L: { sigla: 'L', fator: 1, fracionada: true },
  PCT: { sigla: 'pct', fator: 1 }, BDJ: { sigla: 'bdj', fator: 1 }
};

/**
 * Unidades que sao um PACOTE de outras unidades — e so nelas que faz sentido
 * perguntar "quantas unidades vem dentro". Escolher "und" e continuar vendo
 * "unidades por caixa" na tela e o tipo de campo que faz a pessoa preencher
 * qualquer coisa so para o formulario parar de perguntar.
 */
export const UNIDADES_COM_FATOR = ['CX', 'FD', 'PALETE'];

export const temFator = unidade => UNIDADES_COM_FATOR.includes(unidade);

/** Rotulo certo para o campo, em vez de "caixa/fardo/palete" sempre. */
export function rotuloFator(unidade) {
  if (unidade === 'FD') return 'Unidades por fardo';
  if (unidade === 'PALETE') return 'Unidades por palete';
  return 'Unidades por caixa';
}

export const PERFIL = { DONO: 'DONO', LIDER: 'LIDER', FUNCIONARIO: 'FUNCIONARIO' };

// ------------------------------------------------------------------ validade

export const DIAS_AVISO = 30, DIAS_DETALHE = 15, DIAS_URGENTE = 2;

export function diasAte(iso) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(iso + 'T00:00:00');
  return Math.round((alvo - hoje) / 86400000);
}

export function faixa(p) {
  const d = diasAte(p.validade);
  if (d < 0) return { chave: 'VENCIDO', rotulo: 'VENCIDO', cor: '#7F0000' };
  if (d <= DIAS_URGENTE) return { chave: 'URGENTE', rotulo: 'URGENTE', cor: '#D32F2F' };
  if (d <= DIAS_DETALHE) return { chave: 'DETALHE', rotulo: 'ATENCAO', cor: '#F57C00' };
  if (d <= DIAS_AVISO) return { chave: 'AVISO', rotulo: 'PROXIMO', cor: '#FBC02D' };
  return { chave: 'OK', rotulo: 'OK', cor: '#388E3C' };
}

export function totalUnidades(p) {
  const u = UNIDADES[p.unidade] || UNIDADES.UND;
  return u.fracionada ? (p.quantidade || 0) : (p.quantidade || 0) * Math.max(1, p.fator || 1);
}

export function valorEmRisco(p) {
  return totalUnidades(p) * (p.precoUnitario || 0);
}

/**
 * O app nao sugere mais oferta nem desconto: preco e decisao do dono, e o
 * palpite so poluia a tela de quem esta conferindo validade no corredor.
 * O que fica e o alerta seco de quanto ainda ha em estoque perto de vencer.
 */
export function alertaQuantidade(p) {
  const d = diasAte(p.validade), t = totalUnidades(p);
  if (d < 0) return `Vencido ha ${-d} dia(s)` + (t > 0 ? ` com ${Math.round(t)} und em estoque.` : '.');
  if (d > DIAS_DETALHE || t < 20) return '';
  return `${Math.round(t)} und em estoque e vence em ${d} dia(s).`;
}

export function quantidadeTexto(p) {
  const u = UNIDADES[p.unidade] || UNIDADES.UND;
  const q = numero(p.quantidade || 0);
  let s = `${q} ${u.sigla}`;
  if (!u.fracionada && (p.fator || 1) > 1) s += ` (${Math.round(totalUnidades(p))} und)`;
  return s;
}

// -------------------------------------------------------------------- acesso

/** Setores de uma pessoa: aceita a lista nova e o campo antigo de um setor so. */
export function setoresDe(u) {
  if (!u) return [];
  if (Array.isArray(u.setores) && u.setores.length) return u.setores;
  return u.setor ? [u.setor] : [];
}

export const Acesso = {
  usuario() {
    return Dados.d.usuarios.find(u => u.id === Prefs.get('usuarioId') && !u.excluido) || null;
  },
  nome() { const u = this.usuario(); return u ? u.nome : Prefs.get('nome'); },
  perfil() { const u = this.usuario(); return u ? u.perfil : Prefs.get('perfil', PERFIL.FUNCIONARIO); },

  /** Todos os setores da pessoa — um repositor pode cuidar de varios. */
  meusSetores() {
    const u = this.usuario();
    const lista = setoresDe(u);
    return lista.length ? lista : [Prefs.get('setor', 'MERCEARIA')];
  },
  meuSetor() { return this.meusSetores()[0]; },

  dono() { return this.perfil() === PERFIL.DONO; },
  lider() { return this.perfil() === PERFIL.LIDER; },

  nomesDosMeusSetores() {
    return this.meusSetores().map(s => setor(s).nome).join(', ');
  },

  rotuloPerfil() {
    if (this.dono()) return 'Dono / Gestor';
    const onde = this.nomesDosMeusSetores();
    if (this.lider()) return 'Lider de ' + onde;
    return 'Funcionario - ' + onde;
  },

  /** Dono ve tudo; os demais veem os setores que cuidam. */
  veSetor(s) { return this.dono() || !s || this.meusSetores().includes(s); },
  veValores() { return this.dono() || this.lider(); },
  veTrabalhoDosOutros() { return this.dono() || this.lider(); },
  configura(s) { return this.dono() || (this.lider() && (!s || this.meusSetores().includes(s))); },
  configuraLoja() { return this.dono(); },

  /**
   * Conta de acesso e assunto de dono. O lider cuida do setor dele, mas quem
   * cria login, troca perfil e reseta senha e so o dono — senao a tranca do app
   * fica na mao de quem ela deveria limitar.
   */
  gerenciaUsuarios() { return this.dono(); },

  /**
   * Item largado no caixa so interessa a quem trabalha no caixa. O acougueiro
   * ver "iogurte parado no caixa 3" e ruido: ele nao vai recolher nada.
   */
  veDesistencias() { return this.dono() || this.meusSetores().includes('CAIXA'); },

  /**
   * Escala, equipe e desempenho: todo mundo ENXERGA (o funcionario precisa saber
   * o proprio horario e a propria pontuacao), mas so dono e lider MEXEM.
   */
  editaEscala(s) { return this.dono() || (this.lider() && (!s || this.meusSetores().includes(s))); },

  /** Quem executa o checklist nao decide o que vai nele. */
  editaChecklist(s) { return this.dono() || (this.lider() && (!s || this.meusSetores().includes(s))); },

  /** Camara fria, freezer e balcao sao patrimonio: quem cadastra e o dono. */
  cadastraEquipamento() { return this.dono(); },

  /**
   * Quebra: a equipe registra O QUE quebrou; quanto isso custou e quanto a loja
   * perdeu no mes e conta do dono, e so ele ve.
   */
  lancaValorQuebra() { return this.dono(); },
  vePerdas() { return this.dono(); },

  /** Historico: o funcionario ve apenas o que ele mesmo registrou. */
  vePessoa(funcionario, autor) {
    if (this.veTrabalhoDosOutros()) return true;
    const eu = (this.nome() || '').trim().toLowerCase();
    if (!eu) return true;
    return (funcionario || '').trim().toLowerCase() === eu
      || (autor || '').trim().toLowerCase() === eu;
  }
};

// -------------------------------------------------------------------- senha

/** Igual ao Usuario.java: SHA-256 de "sal|senha", em hexadecimal. */
export async function resumoSenha(senha, sal) {
  const bytes = new TextEncoder().encode(`${sal}|${senha || ''}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function novoSal() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function definirSenha(u, senha) {
  u.sal = novoSal();
  u.senhaHash = await resumoSenha(senha, u.sal);
  u.trocarSenha = false;
}

export async function senhaConfere(u, senha) {
  if (!u.senhaHash) return false;
  return u.senhaHash === await resumoSenha(senha, u.sal);
}

export const normalizarLogin = s => (s || '').trim().toLowerCase().replace(/\s/g, '');

// ------------------------------------------------------------------ formatos

export const hoje = () => new Date().toISOString().slice(0, 10);

export const agora = () => new Date().toTimeString().slice(0, 5);

export function data(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function dataCurta(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function diaSemana(iso) {
  const nomes = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
  return nomes[new Date(iso + 'T00:00:00').getDay()];
}

export function moeda(v) {
  return 'R$ ' + (v || 0).toFixed(2).replace('.', ',');
}

export function numero(v) {
  if (v === Math.floor(v)) return String(Math.round(v));
  return v.toFixed(2).replace('.', ',');
}

export function lerNumero(s) {
  if (!s) return 0;
  const n = parseFloat(String(s).replace('R$', '').replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

/**
 * Todo produto que alguem digita vira cadastro. A pessoa que registra uma quebra
 * as 6 da manha nao vai parar para cadastrar o produto antes — ela escreve o nome
 * e segue. O cadastro nasce aqui, meio vazio, e o dono completa depois com codigo
 * de barras, marca e preco. Devolve a ficha do produto, nova ou a que ja existia.
 */
/** Acha o cadastro pelo codigo de barras — o que o leitor de camera usa. */
export function produtoPorCodigo(codigo) {
  const c = (codigo || '').trim();
  if (!c) return null;
  return Dados.ativos('catalogo').find(x => x.codigo === c) || null;
}

export function garantirProduto(nome, setor, autor) {
  const limpo = (nome || '').trim();
  if (!limpo) return null;

  const igual = Dados.ativos('catalogo')
    .find(c => (c.nome || '').trim().toLowerCase() === limpo.toLowerCase());
  if (igual) return igual;

  const novo = Dados.novo({
    codigo: '', nome: limpo, marca: '', setor: setor || 'MERCEARIA',
    unidade: 'UND', porCaixa: 1, preco: 0,
    /** Nasceu de um registro do dia a dia, nao de um cadastro caprichado. */
    incompleto: true
  });
  Dados.gravar('catalogo', novo, autor || 'app');
  return novo;
}
