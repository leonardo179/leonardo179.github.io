/*
 * Camada de dados do PWA — o espelho exato do Repo.java do Android.
 *
 * Mesmo formato de arquivo, mesmas chaves, mesma regra de juntar (vence o
 * atualizadoEm maior) e mesmo endereco de loja. Por isso um iPhone com este PWA
 * e um Android com o aplicativo enxergam exatamente a mesma loja.
 */

const LISTAS = [
  'produtos', 'checklists', 'respostas', 'paletes', 'quebras', 'funcionarios',
  'turnos', 'datas', 'rotinas', 'execucoes', 'contagens', 'cesta', 'pesquisas',
  'equipamentos', 'leituras', 'catalogo', 'rupturas', 'desistencias', 'padroes',
  'entregas', 'usuarios', 'setores'
];

const CHAVE_DADOS = 'mercado_dados';
const CHAVE_PREFS = 'mercado_prefs';

/**
 * A loja ja vem configurada no app: quem instala nao precisa digitar endereco
 * nenhum, so entrar com usuario e senha. Da para trocar em Ajustes, e um convite
 * com ?loja=&pin=&url= sobrescreve isso (util se um dia houver mais de uma loja).
 *
 * Sinceridade sobre seguranca: como o app e publico, esta senha de loja nao e
 * segredo de verdade — ela evita que alguem esbarre nos dados por acaso, mas o
 * que realmente controla o acesso e o login de cada pessoa.
 */
export const LOJA_PADRAO = {
  url: 'https://script.google.com/macros/s/AKfycbxDYdLE7mbz8BgqI4NOhBLtjehY_N0HdgyxORgtvdZ5JA8hiVHMhU8sUM9X80HIoL4c/exec',
  loja: 'mercado-central',
  pin: 'lucas1123'
};

export const Dados = {
  d: null,

  vazio() {
    const d = { versao: 1 };
    LISTAS.forEach(l => d[l] = []);
    return d;
  },

  carregar() {
    try {
      const txt = localStorage.getItem(CHAVE_DADOS);
      this.d = txt ? JSON.parse(txt) : this.vazio();
    } catch (e) {
      console.error('dados corrompidos, recomecando', e);
      this.d = this.vazio();
    }
    // Arquivo antigo pode nao ter uma lista nova.
    LISTAS.forEach(l => { if (!Array.isArray(this.d[l])) this.d[l] = []; });
    return this.d;
  },

  salvar({ enviar = true } = {}) {
    localStorage.setItem(CHAVE_DADOS, JSON.stringify(this.d));
    if (enviar) Sync.marcarSujo();
  },

  /** Cria a base de um registro novo, igual ao Registro.java. */
  novo(extra = {}) {
    return Object.assign({
      id: uuid(),
      atualizadoEm: Date.now(),
      excluido: false,
      autor: ''
    }, extra);
  },

  gravar(lista, item, autor) {
    item.atualizadoEm = Date.now();
    if (autor) item.autor = autor;
    const arr = this.d[lista];
    const i = arr.findIndex(x => x.id === item.id);
    if (i >= 0) arr[i] = item; else arr.push(item);
    this.salvar();
    return item;
  },

  /** Exclusao logica, para o outro aparelho tambem apagar. */
  excluir(lista, item, autor) {
    item.excluido = true;
    this.gravar(lista, item, autor);
  },

  ativos(lista) {
    return (this.d[lista] || []).filter(x => !x.excluido);
  },

  /** Junta o retrato do servidor com o daqui: para cada id, vence o mais recente. */
  juntar(remoto) {
    if (!remoto) return;
    LISTAS.forEach(nome => {
      const mapa = new Map();
      (this.d[nome] || []).forEach(x => x && x.id && mapa.set(x.id, x));
      (remoto[nome] || []).forEach(x => {
        if (!x || !x.id) return;
        const atual = mapa.get(x.id);
        if (!atual || (x.atualizadoEm || 0) > (atual.atualizadoEm || 0)) mapa.set(x.id, x);
      });
      this.d[nome] = Array.from(mapa.values());
    });
  }
};

export const Prefs = {
  p: {},

  carregar() {
    try {
      this.p = JSON.parse(localStorage.getItem(CHAVE_PREFS) || '{}');
    } catch (e) {
      this.p = {};
    }

    // Convite com os dados na propria URL (?loja=&pin=&url=) tem prioridade.
    const q = new URLSearchParams(location.search);
    ['url', 'loja', 'pin'].forEach(k => {
      if (q.get(k)) this.set(k, q.get(k));
    });

    // Sem nada configurado, assume a loja que veio embutida no app.
    if (!this.p.url) this.set('url', LOJA_PADRAO.url);
    if (!this.p.loja) this.set('loja', LOJA_PADRAO.loja);
    if (!this.p.pin) this.set('pin', LOJA_PADRAO.pin);

    return this.p;
  },

  get(k, padrao = '') {
    const v = this.p[k];
    return v === undefined || v === null ? padrao : v;
  },

  set(k, v) {
    this.p[k] = v;
    localStorage.setItem(CHAVE_PREFS, JSON.stringify(this.p));
  },

  logado() { return !!this.get('usuarioId'); },

  entrar(u) {
    this.set('usuarioId', u.id);
    this.set('nome', u.nome);
    this.set('perfil', u.perfil);
    this.set('setor', u.setor);
  },

  sair() { this.set('usuarioId', ''); },

  lojaConectada() { return !!this.get('url') && !!this.get('loja'); }
};

/**
 * Conversa com o mesmo endereco do Android (sync.php ou a planilha do Google).
 * Envia poucos segundos depois de cada gravacao e busca novidades a cada 45s.
 */
export const Sync = {
  pendente: null,
  ouvintes: [],
  /** 'ao-vivo' | 'sem-internet' | 'desligado' | 'atualizando' */
  estado: 'desligado',

  aoAtualizar(fn) { this.ouvintes.push(fn); },
  avisar() { this.ouvintes.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); },

  /** Gravou algo: sobe quase na hora, so agrupando digitacao seguida. */
  marcarSujo() {
    if (!Prefs.lojaConectada()) return;
    clearTimeout(this.pendente);
    this.pendente = setTimeout(() => this.executar(), 1200);
  },

  async chamar(corpo) {
    // Content-Type de texto simples de proposito: com 'application/json' o
    // navegador manda antes um pedido de permissao (preflight) que o Apps Script
    // nao responde, e a chamada morre em CORS. Do outro lado o script le o corpo
    // do mesmo jeito, entao nada muda para ele.
    const r = await fetch(Prefs.get('url'), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corpo)
    });
    const txt = await r.text();
    let json;
    try {
      json = JSON.parse(txt);
    } catch (e) {
      throw new Error('resposta invalida do servidor');
    }
    if (json.erro) throw new Error(json.erro);
    return json;
  },

  /** Baixa, junta, salva e devolve o combinado — igual ao Sync.java. */
  async executar() {
    if (!Prefs.lojaConectada()) {
      this.estado = 'desligado';
      return { ok: false, msg: 'Loja nao conectada.' };
    }
    if (!navigator.onLine) {
      this.estado = 'sem-internet';
      this.avisar();
      return { ok: false, msg: 'Sem internet — vou mandar assim que voltar.' };
    }
    const loja = Prefs.get('loja'), pin = Prefs.get('pin');
    try {
      const baixou = await this.chamar({ acao: 'baixar', loja, pin });
      if (baixou.dados) {
        Dados.juntar(baixou.dados);
        Dados.salvar({ enviar: false });
      }
      await this.chamar({
        acao: 'enviar', loja, pin,
        dispositivo: dispositivo(),
        dados: Dados.d
      });
      // Depois de mandar, confere o que voltou: se dois celulares gravaram quase
      // juntos, esta segunda leitura ja traz o do colega — e a tela se redesenha.
      const conferencia = await this.chamar({ acao: 'baixar', loja, pin });
      if (conferencia.dados) {
        Dados.juntar(conferencia.dados);
        Dados.salvar({ enviar: false });
      }
      Prefs.set('ultimaSync', Date.now());
      this.estado = 'ao-vivo';
      this.avisar();
      return { ok: true, msg: 'Tudo em dia.' };
    } catch (e) {
      console.warn('falha ao falar com a loja', e);
      this.estado = 'sem-internet';
      this.avisar();
      return { ok: false, msg: 'Nao consegui falar com a loja: ' + e.message };
    }
  },

  /**
   * Com a tela aberta o app fica de olho na loja o tempo todo: busca novidades
   * a cada 8 segundos, volta a buscar quando a tela reaparece e assim que a
   * internet volta. E o que faz o dono ver o registro do funcionario na hora.
   */
  iniciarCiclo() {
    const tique = () => {
      if (!Prefs.lojaConectada()) return;
      if (document.visibilityState !== 'visible') return;  // tela apagada nao gasta dados
      this.executar();
    };
    setInterval(tique, 8000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tique();
    });

    window.addEventListener('online', () => {
      this.estado = 'atualizando';
      this.avisar();
      this.executar();
    });
    window.addEventListener('offline', () => {
      this.estado = 'sem-internet';
      this.avisar();
    });
  }
};

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function dispositivo() {
  let d = Prefs.get('dispositivo');
  if (!d) {
    d = uuid().slice(0, 8);
    Prefs.set('dispositivo', d);
  }
  return d;
}
