/*
 * Modulos do dia a dia: validades, checklists, cronograma, entregas, quebras,
 * temperatura e a lista de pendencias. Mesma logica do aplicativo Android.
 */
import { Dados, Prefs } from './dados.js';
import * as D from './dominio.js';
import { h, cabecalho, cartao, campo, area, lista, marcador, barra, vazio, aviso, toast, confirmar } from './ui.js';

let ir, voltar, render;

export function instalarModulos(api) {
  ir = api.ir; voltar = api.voltar; render = api.render;
  validades(api.registrar);
  checklists(api.registrar);
  cronograma(api.registrar);
  entregas(api.registrar);
  quebras(api.registrar);
  temperatura(api.registrar);
  pendencias(api.registrar);
}

const opcoesSetor = () =>
  Object.entries(D.SETORES).map(([k, v]) => ({ valor: k, texto: v.icone + ' ' + v.nome }));

const opcoesUnidade = () =>
  Object.entries(D.UNIDADES).map(([k, v]) => ({ valor: k, texto: v.sigla }));

// ------------------------------------------------------------------ validade

function validades(registrar) {
  registrar('validades', params => {
    const a = D.Acesso;
    const filtro = params.filtro || 'todos';
    const itens = Dados.ativos('produtos')
      .filter(p => a.veSetor(p.setor))
      .filter(p => {
        const d = D.diasAte(p.validade);
        if (filtro === 'urgentes') return !p.resolvido && d <= D.DIAS_URGENTE;
        if (filtro === 'janela') return !p.resolvido && d <= D.DIAS_AVISO;
        return true;
      })
      .sort((x, y) => (x.resolvido - y.resolvido) || x.validade.localeCompare(y.validade));

    const risco = itens.filter(p => !p.resolvido).reduce((s, p) => s + D.valorEmRisco(p), 0);

    const cartoes = itens.map(p => {
      const f = D.faixa(p), d = D.diasAte(p.validade);
      const prazo = p.resolvido ? 'Resolvido'
        : d < 0 ? `venceu ha ${-d} dia(s)`
          : d === 0 ? 'vence HOJE' : d === 1 ? 'vence amanha' : `vence em ${d} dias`;
      const extra = [D.quantidadeTexto(p), p.localizacao,
        a.veValores() && D.valorEmRisco(p) ? D.moeda(D.valorEmRisco(p)) : null]
        .filter(Boolean).join('  •  ');

      return cartao({
        cor: p.resolvido ? '#BDBDBD' : f.cor,
        icone: D.setor(p.setor).icone,
        titulo: p.nome + (p.marca ? ' - ' + p.marca : ''),
        sub: D.setor(p.setor).nome + '  •  ' + D.data(p.validade) + '  •  ' + prazo,
        extra,
        selo: { texto: p.resolvido ? 'resolvido' : f.rotulo, cor: p.resolvido ? '#9E9E9E' : f.cor },
        destaque: !p.resolvido && ['VENCIDO', 'URGENTE', 'DETALHE'].includes(f.chave)
          ? { texto: '💡 ' + D.sugestaoAcao(p), cor: f.cor } : null,
        botoes: p.resolvido ? null : [
          { texto: 'Resolvido', onclick: () => confirmar('Baixar produto',
            `Marcar "${p.nome}" como vendido, devolvido ou descartado?`, () => {
              p.resolvido = true;
              Dados.gravar('produtos', p, a.nome());
              render();
            }) },
          { texto: 'Virou quebra', sec: true, onclick: () => formQuebra(null, p) }
        ],
        onclick: () => formValidade(p)
      });
    });

    return h('div', {}, [
      cabecalho({
        titulo: '📅 Validades',
        sub: itens.length + ' produto(s)' + (risco && a.veValores() ? '  •  ' + D.moeda(risco) + ' em risco' : ''),
        voltar
      }),
      h('main', {}, cartoes.length ? cartoes
        : [vazio('Nenhum produto nesse filtro.\nToque em Cadastrar para incluir o primeiro.')]),
      h('button', { class: 'fab', onclick: () => formValidade(null) }, 'Cadastrar')
    ]);
  });
}

function formValidade(existente) {
  const a = D.Acesso;
  const p = existente || Dados.novo({
    nome: '', marca: '', setor: a.dono() ? 'MERCEARIA' : a.meuSetor(), validade: D.hoje(),
    quantidade: 0, unidade: 'UND', fator: 1, precoUnitario: 0,
    localizacao: '', lote: '', observacao: '', resolvido: false
  });

  const nome = campo('Produto', p.nome);
  const marca = campo('Marca (opcional)', p.marca);
  const setorSel = lista('Setor', opcoesSetor(), p.setor);
  const validade = campo('Vence em', p.validade, { type: 'date' });
  const qtd = campo('Quantidade (opcional)', p.quantidade || '', { type: 'number', inputmode: 'decimal' });
  const unidade = lista('Unidade', opcoesUnidade(), p.unidade);
  const fator = campo('Unidades por caixa/fardo/palete', p.fator || 1, { type: 'number' });
  const preco = campo('Preco por unidade (opcional)', p.precoUnitario || '', { type: 'number', inputmode: 'decimal' });
  const local = campo('Onde esta (gondola, palete A3...)', p.localizacao);
  const obs = area('Observacao', p.observacao);
  const previa = aviso('');

  function montar() {
    return {
      validade: validade.input.value || D.hoje(),
      quantidade: D.lerNumero(qtd.input.value),
      unidade: unidade.input.value,
      fator: Math.max(1, parseInt(fator.input.value) || 1),
      precoUnitario: D.lerNumero(preco.input.value)
    };
  }

  function atualizarPrevia() {
    const tmp = montar();
    const d = D.diasAte(tmp.validade), f = D.faixa(tmp);
    let txt = `Faltam ${d} dia(s) para vencer.\n`;
    txt += d > D.DIAS_AVISO ? 'Fora da janela de aviso — comeco a avisar quando faltar 30 dias.'
      : d > D.DIAS_DETALHE ? 'Aviso diario simples ate chegar aos 15 dias.'
        : d > D.DIAS_URGENTE ? 'Aviso diario detalhado, com setor, quantidade e local.'
          : 'URGENTE: aviso com prioridade alta todos os dias.';
    if (D.totalUnidades(tmp)) txt += '\nEstoque: ' + D.quantidadeTexto(tmp);
    if (D.valorEmRisco(tmp) && a.veValores()) txt += '  •  ' + D.moeda(D.valorEmRisco(tmp)) + ' em risco';
    if (D.descontoSugerido(tmp)) txt += '\n💡 ' + D.sugestaoAcao(tmp);
    previa.textContent = txt;
    previa.style.background = f.cor + '22';
    previa.style.color = f.cor;
    previa.style.border = '1px solid ' + f.cor + '55';
  }
  [validade, qtd, fator, preco].forEach(c => c.input.addEventListener('input', atualizarPrevia));
  unidade.input.addEventListener('change', atualizarPrevia);
  setTimeout(atualizarPrevia);

  function salvar() {
    if (!nome.input.value.trim()) return toast('Falta o nome do produto.');
    Object.assign(p, montar(), {
      nome: nome.input.value.trim(), marca: marca.input.value.trim(),
      setor: setorSel.input.value, localizacao: local.input.value.trim(),
      observacao: obs.input.value.trim()
    });
    Dados.gravar('produtos', p, a.nome());
    toast('Produto salvo.');
    voltar();
    render();
  }

  document.getElementById('app').replaceChildren(h('div', {}, [
    cabecalho({ titulo: existente ? '📅 Editar produto' : '📅 Novo produto',
      sub: 'A quantidade e opcional', voltar: () => { ir('validades'); render(); } }),
    h('main', {}, [nome.el, marca.el, setorSel.el, validade.el, qtd.el, unidade.el,
      fator.el, preco.el, local.el, obs.el, previa]),
    barra([
      { texto: 'Salvar', onclick: salvar },
      existente ? { texto: 'Excluir', classe: 'vermelho', onclick: () => confirmar('Excluir',
        'Apagar este produto?', () => { Dados.excluir('produtos', p, a.nome()); ir('validades'); render(); }) } : null
    ])
  ]));
}

// ----------------------------------------------------------------- checklist

function checklists(registrar) {
  registrar('checklists', () => {
    const a = D.Acesso, hoje = D.hoje();
    const modelos = Dados.ativos('checklists')
      .filter(c => c.ativo && a.veSetor(c.setor))
      .sort((x, y) => D.setor(x.setor).nome.localeCompare(D.setor(y.setor).nome));

    const cartoes = modelos.map(c => {
      const r = Dados.ativos('respostas').find(x => x.checklistId === c.id && x.data === hoje);
      const pct = r && r.itens.length ? Math.round(r.itens.filter(i => i.marcado).length * 100 / r.itens.length) : 0;
      return cartao({
        cor: D.setor(c.setor).cor,
        icone: D.setor(c.setor).icone,
        titulo: D.setor(c.setor).nome,
        sub: c.nome + '  •  ' + c.itens.length + ' itens',
        extra: r && r.concluido
          ? 'Entregue por ' + (r.funcionario || r.autor) + (temObs(r) ? '  •  tem observacao' : '')
          : (r ? r.itens.filter(i => i.marcado).length + ' de ' + r.itens.length + ' marcados' : null),
        selo: r && r.concluido ? { texto: 'feito ' + pct + '%', cor: '#388E3C' }
          : r ? { texto: 'em andamento', cor: '#F57C00' } : { texto: 'hoje', cor: '#757575' },
        onclick: () => execChecklist(c)
      });
    });

    const abertos = modelos.filter(c => {
      const r = Dados.ativos('respostas').find(x => x.checklistId === c.id && x.data === hoje);
      return !r || !r.concluido;
    }).length;

    return h('div', {}, [
      cabecalho({ titulo: '✅ Checklists',
        sub: abertos + ' de ' + modelos.length + ' em aberto hoje', voltar }),
      h('main', {}, cartoes.length ? cartoes : [vazio('Nenhum checklist para o seu setor.')])
    ]);
  });
}

const temObs = r => (r.observacaoGeral || '').trim() || r.itens.some(i => (i.observacao || '').trim());

function execChecklist(modelo) {
  const a = D.Acesso, hoje = D.hoje();
  let r = Dados.ativos('respostas').find(x => x.checklistId === modelo.id && x.data === hoje);
  if (!r) {
    r = Dados.novo({
      checklistId: modelo.id, checklistNome: modelo.nome, setor: modelo.setor, data: hoje,
      funcionario: a.nome(), concluido: false, vistoPeloGestor: false, observacaoGeral: '',
      itens: modelo.itens.map(i => ({ itemId: i.id, texto: i.texto, marcado: false, observacao: '' }))
    });
  }

  const marcadores = [], observacoes = [];
  const progresso = aviso('', D.setor(modelo.setor).cor);

  function atualizar() {
    const n = marcadores.filter(m => m.input.checked).length;
    progresso.textContent = `✔ ${n} de ${marcadores.length} itens marcados `
      + `(${Math.round(n * 100 / Math.max(1, marcadores.length))}%)`
      + (r.concluido ? '\nJa entregue ao gestor.' : '');
  }

  const blocos = r.itens.map(item => {
    const m = marcador(item.texto, item.marcado);
    m.input.addEventListener('change', atualizar);
    marcadores.push(m);
    const o = campo('', item.observacao, { placeholder: 'Observacao (opcional)' });
    observacoes.push(o);
    return h('div', { class: 'cartao' }, [
      h('div', { class: 'faixa', estilo: { background: D.setor(modelo.setor).cor } }),
      h('div', { class: 'corpo' }, [m.el, o.input])
    ]);
  });

  const obsGeral = area('Recado para o dono / gestor', r.observacaoGeral);

  function coletar() {
    r.itens.forEach((item, i) => {
      item.marcado = marcadores[i].input.checked;
      item.observacao = observacoes[i].input.value.trim();
    });
    r.observacaoGeral = obsGeral.input.value.trim();
    if (!r.funcionario) r.funcionario = a.nome();
  }

  function gravar(concluir) {
    coletar();
    if (concluir) { r.concluido = true; r.vistoPeloGestor = false; }
    Dados.gravar('respostas', r, a.nome());
    toast(concluir ? 'Checklist entregue ao gestor.' : 'Rascunho salvo.');
    ir('checklists');
    render();
  }

  setTimeout(atualizar);
  document.getElementById('app').replaceChildren(h('div', {}, [
    cabecalho({ titulo: D.setor(modelo.setor).icone + ' ' + D.setor(modelo.setor).nome,
      sub: modelo.nome + '  •  ' + D.data(hoje), voltar: () => { ir('checklists'); render(); } }),
    h('main', {}, [progresso, ...blocos, obsGeral.el]),
    barra([
      { texto: r.concluido ? 'Atualizar entrega' : 'Concluir e enviar', onclick: () => gravar(true) },
      { texto: 'Salvar', classe: 'cinza', onclick: () => gravar(false) }
    ])
  ]));
}

// ---------------------------------------------------------------- cronograma

export function rotinasDeHoje() {
  const dia = (new Date().getDay() + 6) % 7; // segunda = 0
  return Dados.ativos('rotinas')
    .filter(r => r.ativo && D.Acesso.veSetor(r.setor) && (r.dias || [])[dia])
    .sort((a, b) => a.horario.localeCompare(b.horario));
}

export function statusRotina(r) {
  const e = execucaoDoDia(r.id);
  if (e && e.feita) return e.atrasada
    ? { chave: 'FEITA_ATRASO', rotulo: 'Feita com atraso', cor: '#F9A825' }
    : { chave: 'FEITA', rotulo: 'Feita', cor: '#388E3C' };
  const agora = new Date();
  const [hh, mm] = r.horario.split(':').map(Number);
  const marcado = new Date(); marcado.setHours(hh, mm, 0, 0);
  if (agora < marcado) return { chave: 'PENDENTE', rotulo: 'Pendente', cor: '#757575' };
  if (agora > new Date(marcado.getTime() + (r.tolerancia || 30) * 60000)) {
    return { chave: 'ATRASADA', rotulo: 'ATRASADA', cor: '#D32F2F' };
  }
  return { chave: 'AGORA', rotulo: 'Na hora', cor: '#F57C00' };
}

const execucaoDoDia = rotinaId =>
  Dados.ativos('execucoes').find(e => e.rotinaId === rotinaId && e.data === D.hoje());

function cronograma(registrar) {
  registrar('cronograma', () => {
    const a = D.Acesso;
    const rotinas = rotinasDeHoje();
    const feitas = rotinas.filter(r => ['FEITA', 'FEITA_ATRASO'].includes(statusRotina(r).chave)).length;
    const atrasadas = rotinas.filter(r => statusRotina(r).chave === 'ATRASADA').length;

    const cartoes = rotinas.map(r => {
      const s = statusRotina(r), e = execucaoDoDia(r.id);
      return cartao({
        cor: D.setor(r.setor).cor,
        icone: r.icone || '🕒',
        titulo: r.horario + '  ' + r.titulo,
        sub: D.setor(r.setor).icone + ' ' + D.setor(r.setor).nome
          + (r.responsavel ? '  •  ' + r.responsavel : ''),
        extra: e && e.feita ? 'Feita as ' + e.concluidaAs + ' por ' + (e.funcionario || e.autor) : r.instrucao,
        selo: { texto: s.rotulo, cor: s.cor },
        destaque: s.chave === 'ATRASADA'
          ? { texto: '⛔ Passou do horario de ' + r.horario + '. O gestor ja foi avisado.', cor: '#D32F2F' }
          : null,
        botoes: (!e || !e.feita) ? [{
          texto: 'Marcar feita',
          onclick: () => {
            const obs = prompt(s.chave === 'ATRASADA'
              ? 'O que aconteceu para atrasar? (opcional)' : 'Observacao (opcional):') || '';
            const ex = e || Dados.novo({
              rotinaId: r.id, titulo: r.titulo, setor: r.setor, data: D.hoje(),
              feita: false, concluidaAs: '', funcionario: '', observacao: '',
              atrasada: false, avisouHora: true, avisouAtraso: false
            });
            Object.assign(ex, {
              feita: true, atrasada: s.chave === 'ATRASADA', concluidaAs: D.agora(),
              funcionario: a.nome(), observacao: obs
            });
            Dados.gravar('execucoes', ex, a.nome());
            toast('Tarefa concluida.');
            render();
          }
        }] : [{
          texto: 'Desfazer', sec: true, onclick: () => {
            e.feita = false; e.concluidaAs = '';
            Dados.gravar('execucoes', e, a.nome());
            render();
          }
        }]
      });
    });

    return h('div', {}, [
      cabecalho({ titulo: '🕒 Cronograma',
        sub: feitas + ' feita(s) hoje' + (atrasadas ? '  •  ' + atrasadas + ' ATRASADA(S)' : ''),
        voltar }),
      h('main', {}, cartoes.length ? cartoes : [vazio('Nenhuma tarefa marcada para hoje.')])
    ]);
  });
}

// ------------------------------------------------------------------ entregas

function entregas(registrar) {
  registrar('entregas', () => {
    const a = D.Acesso, hoje = D.hoje();
    const itens = Dados.ativos('entregas')
      .filter(e => e.data === hoje || (e.situacao !== 'ENTREGUE' && e.situacao !== 'PROBLEMA'))
      .sort((x, y) => {
        const aberta = e => e.situacao === 'NA_FILA' || e.situacao === 'EM_ROTA';
        if (aberta(x) !== aberta(y)) return aberta(x) ? -1 : 1;
        if (aberta(x) && x.urgente !== y.urgente) return x.urgente ? -1 : 1;
        return (x.senha || 0) - (y.senha || 0) || (x.horaChegada || '').localeCompare(y.horaChegada || '');
      });

    const urgentes = itens.filter(e => e.urgente && e.situacao === 'NA_FILA').length;
    const frios = itens.filter(e => e.temFrios && e.situacao !== 'ENTREGUE').length;

    const cartoes = itens.map(e => {
      const cores = { NA_FILA: '#757575', EM_ROTA: '#0277BD', ENTREGUE: '#388E3C', PROBLEMA: '#D32F2F' };
      const rotulos = { NA_FILA: 'Na fila', EM_ROTA: 'Saiu para entrega', ENTREGUE: 'Entregue', PROBLEMA: 'Problema' };
      const aberta = e.situacao === 'NA_FILA' || e.situacao === 'EM_ROTA';
      const cor = e.urgente && aberta ? '#D32F2F' : (e.temFrios && aberta ? '#0277BD' : cores[e.situacao]);

      const pagamentos = { DINHEIRO: 'Dinheiro', PIX: 'Pix', CARTAO: 'Cartao na entrega',
        JA_PAGO: 'Ja pago na loja', FIADO: 'Anotado / fiado' };
      let pag = pagamentos[e.pagamento] || 'Dinheiro';
      if (e.valor) pag += '  ' + D.moeda(e.valor);
      if (e.pagamento === 'DINHEIRO' && e.trocoPara) {
        pag += '  •  troco para ' + D.moeda(e.trocoPara);
        const troco = e.trocoPara - (e.valor || 0);
        if (troco > 0) pag += ' (levar ' + D.moeda(troco) + ')';
      }

      const alerta = e.urgente && e.temFrios ? '🔴 URGENTE  •  🧊 TEM FRIOS — sair agora, caixa da camara.'
        : e.urgente ? '🔴 URGENTE — passar na frente da fila.'
          : e.temFrios ? '🧊 TEM FRIOS — pegar a parte que esta na camara antes de sair.' : '';

      return cartao({
        cor,
        icone: e.urgente ? '🔴' : e.temFrios ? '🧊' : '🚚',
        titulo: [e.endereco, e.bairro].filter(Boolean).join(', ') || 'Sem endereco',
        sub: '#' + (e.senha || '-') + '  ' + (e.horaChegada || '')
          + (e.cliente ? '  •  ' + e.cliente : '') + (e.referencia ? '  •  ' + e.referencia : ''),
        extra: [pag, e.observacao ? '📝 ' + e.observacao : null].filter(Boolean).join('\n'),
        selo: { texto: e.urgente && aberta ? 'URGENTE' : rotulos[e.situacao], cor },
        destaque: aberta && alerta ? { texto: alerta, cor } : null,
        botoes: e.situacao === 'NA_FILA'
          ? [{ texto: 'Saiu para entrega', onclick: () => mudarEntrega(e, 'EM_ROTA') }]
          : e.situacao === 'EM_ROTA'
            ? [{ texto: 'Entregue', onclick: () => mudarEntrega(e, 'ENTREGUE') },
               { texto: 'Deu problema', sec: true, onclick: () => problemaEntrega(e) }]
            : null,
        onclick: () => formEntrega(e)
      });
    });

    return h('div', {}, [
      cabecalho({ titulo: '🚚 Entregas',
        sub: itens.length + ' entrega(s)' + (urgentes ? '  •  🔴 ' + urgentes + ' urgente' : '')
          + (frios ? '  •  🧊 ' + frios + ' com frios' : ''), voltar }),
      h('main', {}, cartoes.length ? cartoes : [vazio('Nenhuma entrega na fila.')]),
      h('button', { class: 'fab', onclick: () => formEntrega(null) }, 'Nova entrega')
    ]);
  });
}

function mudarEntrega(e, situacao) {
  if (situacao === 'EM_ROTA' && e.temFrios
    && !window.confirm('🧊 Esta caixa tem frios\n\nConfira se a parte que estava na camara ja foi '
      + 'para a caixa antes de mandar sair.')) return;
  e.situacao = situacao;
  if (situacao === 'EM_ROTA' && !e.entregador) e.entregador = D.Acesso.nome();
  Dados.gravar('entregas', e, D.Acesso.nome());
  render();
}

function problemaEntrega(e) {
  const motivos = ['Cliente ausente', 'Endereco errado', 'Cliente recusou',
    'Nao pagou / faltou troco', 'Estabelecimento fechado', 'Outro'];
  const escolha = prompt('Por que nao entregou?\n'
    + motivos.map((m, i) => (i + 1) + ' = ' + m).join('\n') + '\n\nDigite o numero:');
  if (!escolha) return;
  const i = parseInt(escolha) - 1;
  if (isNaN(i) || i < 0 || i >= motivos.length) return;
  e.situacao = 'PROBLEMA';
  e.motivoProblema = motivos[i];
  e.detalheProblema = prompt('O que aconteceu? (opcional)') || '';
  e.avisouProblema = false;
  e.mercadoriaConferida = false;
  if (!e.entregador) e.entregador = D.Acesso.nome();
  Dados.gravar('entregas', e, D.Acesso.nome());
  toast(e.temFrios ? 'Registrado. Avise a loja sobre os frios que voltaram.' : 'Registrado.');
  render();
}

function formEntrega(existente) {
  const a = D.Acesso;
  const senhas = Dados.ativos('entregas').filter(e => e.data === D.hoje()).map(e => e.senha || 0);
  const e = existente || Dados.novo({
    cliente: '', telefone: '', endereco: '', bairro: '', referencia: '',
    temFrios: false, urgente: false, observacao: '', data: D.hoje(),
    horaChegada: D.agora(), senha: Math.max(0, ...senhas) + 1, situacao: 'NA_FILA',
    entregador: '', pagamento: 'DINHEIRO', valor: 0, trocoPara: 0, lat: 0, lon: 0, ordem: 0
  });

  const endereco = campo('Endereco', e.endereco);
  const bairro = campo('Bairro', e.bairro);
  const referencia = campo('Ponto de referencia (opcional)', e.referencia);
  const cliente = campo('Cliente (opcional)', e.cliente);
  const telefone = campo('Telefone (opcional)', e.telefone, { type: 'tel' });
  const frios = marcador('🧊  Tem frios (parte esta na camara)', e.temFrios);
  const urgente = marcador('🔴  URGENTE (restaurante, cliente com pressa)', e.urgente);
  const pagamento = lista('Forma de pagamento', [
    { valor: 'DINHEIRO', texto: 'Dinheiro' }, { valor: 'PIX', texto: 'Pix' },
    { valor: 'CARTAO', texto: 'Cartao na entrega' }, { valor: 'JA_PAGO', texto: 'Ja pago na loja' },
    { valor: 'FIADO', texto: 'Anotado / fiado' }], e.pagamento);
  const valor = campo('Valor do pedido', e.valor || '', { type: 'number', inputmode: 'decimal' });
  const troco = campo('Troco para (so no dinheiro)', e.trocoPara || '', { type: 'number', inputmode: 'decimal' });
  const obs = area('Observacao para o entregador', e.observacao);
  const previa = aviso('');

  function atualizarPrevia() {
    const temFrios = frios.input.checked, urg = urgente.input.checked;
    const v = D.lerNumero(valor.input.value), t = D.lerNumero(troco.input.value);
    let txt = urg && temFrios ? '🔴 URGENTE  •  🧊 TEM FRIOS — sair agora, caixa da camara.'
      : urg ? '🔴 URGENTE — passar na frente da fila.'
        : temFrios ? '🧊 TEM FRIOS — pegar a parte da camara antes de sair.' : '';
    if (pagamento.input.value === 'DINHEIRO' && t > v && v > 0) {
      txt += (txt ? '\n' : '') + 'Levar ' + D.moeda(t - v) + ' de troco na mao.';
    }
    previa.textContent = txt || 'Sem observacoes especiais.';
    const cor = urg ? '#D32F2F' : temFrios ? '#0277BD' : '#2E7D32';
    previa.style.background = cor + '22';
    previa.style.color = cor;
    previa.style.border = '1px solid ' + cor + '55';
  }
  [frios.input, urgente.input, pagamento.input, valor.input, troco.input]
    .forEach(i => i.addEventListener('input', atualizarPrevia));
  setTimeout(atualizarPrevia);

  function salvar() {
    if (!endereco.input.value.trim()) return toast('Falta o endereco da entrega.');
    Object.assign(e, {
      endereco: endereco.input.value.trim(), bairro: bairro.input.value.trim(),
      referencia: referencia.input.value.trim(), cliente: cliente.input.value.trim(),
      telefone: telefone.input.value.trim(), temFrios: frios.input.checked,
      urgente: urgente.input.checked, pagamento: pagamento.input.value,
      valor: D.lerNumero(valor.input.value), trocoPara: D.lerNumero(troco.input.value),
      observacao: obs.input.value.trim()
    });
    Dados.gravar('entregas', e, a.nome());
    toast(e.urgente ? 'Entrega urgente: foi para a frente da fila.' : 'Entrega ' + e.senha + ' na fila.');
    ir('entregas');
    render();
  }

  document.getElementById('app').replaceChildren(h('div', {}, [
    cabecalho({ titulo: existente ? '🚚 Entrega ' + e.senha : '🚚 Nova entrega',
      sub: 'Numero da fila: ' + e.senha + ' — chegou as ' + e.horaChegada,
      voltar: () => { ir('entregas'); render(); } }),
    h('main', {}, [endereco.el, bairro.el, referencia.el, cliente.el, telefone.el,
      h('div', { class: 'rotulo-secao' }, 'O papelzinho da caixa'),
      frios.el, urgente.el, previa,
      h('div', { class: 'rotulo-secao' }, 'Pagamento'),
      pagamento.el, valor.el, troco.el, obs.el]),
    barra([
      { texto: 'Salvar', onclick: salvar },
      existente ? { texto: 'Excluir', classe: 'vermelho', onclick: () => confirmar('Excluir entrega',
        'Apagar esta entrega da fila?', () => { Dados.excluir('entregas', e, a.nome()); ir('entregas'); render(); }) } : null
    ])
  ]));
}

// ------------------------------------------------------------------- quebras

export function prejuizo(q) {
  const u = D.UNIDADES[q.unidade] || D.UNIDADES.UND;
  const total = u.fracionada ? (q.quantidade || 0) : (q.quantidade || 0) * Math.max(1, q.fator || 1);
  return total * (q.valorUnitario || 0);
}

const MOTIVOS_QUEBRA = [
  { valor: 'VENCIDO', texto: 'Vencido' },
  { valor: 'ESTRAGADO', texto: 'Estragado / maduro demais' },
  { valor: 'AVARIA', texto: 'Avaria - caiu ou quebrou' },
  { valor: 'EMBALAGEM', texto: 'Embalagem violada ou amassada' },
  { valor: 'TEMPERATURA', texto: 'Falha de refrigeracao' },
  { valor: 'MANUSEIO', texto: 'Manuseio errado' },
  { valor: 'FURTO', texto: 'Furto / consumo interno' },
  { valor: 'OUTRO', texto: 'Outro' }
];

function quebras(registrar) {
  registrar('quebras', () => {
    const a = D.Acesso;
    const itens = Dados.ativos('quebras')
      .filter(q => a.veSetor(q.setor) && a.vePessoa('', q.autor) && D.diasAte(q.data) >= -30)
      .sort((x, y) => y.data.localeCompare(x.data));
    const total = itens.reduce((s, q) => s + prejuizo(q), 0);

    const cartoes = itens.map(q => cartao({
      cor: D.setor(q.setor).cor,
      icone: D.setor(q.setor).icone,
      titulo: q.produto,
      sub: D.data(q.data) + '  •  ' + D.setor(q.setor).nome + '  •  '
        + D.numero(q.quantidade) + ' ' + (D.UNIDADES[q.unidade] || D.UNIDADES.UND).sigla,
      extra: (MOTIVOS_QUEBRA.find(m => m.valor === q.motivo) || {}).texto
        + (q.autor ? '  •  por ' + q.autor : ''),
      selo: a.veValores() ? { texto: D.moeda(prejuizo(q)), cor: '#6D4C41' } : null,
      destaque: q.detalhe ? { texto: q.detalhe, cor: D.setor(q.setor).cor } : null,
      onclick: () => formQuebra(q)
    }));

    return h('div', {}, [
      cabecalho({ titulo: '🗑 Quebras e descarte',
        sub: itens.length + ' registro(s)' + (a.veValores() ? '  •  prejuizo de ' + D.moeda(total) : ''),
        voltar }),
      h('main', {}, cartoes.length ? cartoes : [vazio('Nenhuma quebra registrada.')]),
      h('button', { class: 'fab', onclick: () => formQuebra(null) }, 'Registrar quebra')
    ]);
  });
}

function formQuebra(existente, deProduto) {
  const a = D.Acesso;
  const q = existente || Dados.novo({
    produto: deProduto ? deProduto.nome : '',
    setor: deProduto ? deProduto.setor : (a.dono() ? 'MERCEARIA' : a.meuSetor()),
    data: D.hoje(),
    quantidade: deProduto ? deProduto.quantidade : 1,
    unidade: deProduto ? deProduto.unidade : 'UND',
    fator: deProduto ? deProduto.fator : 1,
    valorUnitario: deProduto ? deProduto.precoUnitario : 0,
    motivo: deProduto && D.diasAte(deProduto.validade) < 0 ? 'VENCIDO' : 'AVARIA',
    detalhe: '', foto: ''
  });

  const produto = campo('Produto', q.produto);
  const setorSel = lista('Setor', opcoesSetor(), q.setor);
  const motivo = lista('Motivo', MOTIVOS_QUEBRA, q.motivo);
  const data = campo('Data', q.data, { type: 'date' });
  const qtd = campo('Quantidade', q.quantidade, { type: 'number', inputmode: 'decimal' });
  const unidade = lista('Unidade', opcoesUnidade(), q.unidade);
  const fator = campo('Unidades por caixa/fardo/palete (1 para avulso)', q.fator || 1, { type: 'number' });
  const valor = campo('Valor de UMA unidade (ou do kg)', q.valorUnitario || '', { type: 'number', inputmode: 'decimal' });
  const detalhe = area('O que aconteceu', q.detalhe);
  const calculo = aviso('', '#6D4C41');

  function calcular() {
    const u = D.UNIDADES[unidade.input.value] || D.UNIDADES.UND;
    const n = D.lerNumero(qtd.input.value);
    const f = Math.max(1, parseInt(fator.input.value) || 1);
    const v = D.lerNumero(valor.input.value);
    const total = u.fracionada ? n : n * f;
    let txt = u.fracionada
      ? `${D.numero(n)} ${u.sigla} x ${D.moeda(v)}/${u.sigla}`
      : `${D.numero(n)} ${u.sigla}${f > 1 ? ' x ' + f + ' und' : ''} = ${D.numero(total)} unidades\n`
        + `${D.numero(total)} x ${D.moeda(v)}`;
    txt += `\n\nPrejuizo: ${D.moeda(total * v)}`;
    calculo.textContent = txt;
  }
  [qtd, fator, valor].forEach(c => c.input.addEventListener('input', calcular));
  unidade.input.addEventListener('change', calcular);
  setTimeout(calcular);

  function salvar() {
    if (!produto.input.value.trim()) return toast('Falta o nome do produto.');
    Object.assign(q, {
      produto: produto.input.value.trim(), setor: setorSel.input.value,
      motivo: motivo.input.value, data: data.input.value || D.hoje(),
      quantidade: D.lerNumero(qtd.input.value),
      unidade: unidade.input.value,
      fator: Math.max(1, parseInt(fator.input.value) || 1),
      valorUnitario: D.lerNumero(valor.input.value),
      detalhe: detalhe.input.value.trim()
    });
    Dados.gravar('quebras', q, a.nome());
    toast('Quebra registrada: ' + D.moeda(prejuizo(q)));
    ir('quebras');
    render();
  }

  document.getElementById('app').replaceChildren(h('div', {}, [
    cabecalho({ titulo: existente ? '🗑 Editar quebra' : '🗑 Registrar quebra',
      sub: 'O prejuizo e calculado sozinho', voltar: () => { ir('quebras'); render(); } }),
    h('main', {}, [produto.el, setorSel.el, motivo.el, data.el,
      h('div', { class: 'rotulo-secao' }, 'Calculadora de prejuizo'),
      qtd.el, unidade.el, fator.el, valor.el, calculo, detalhe.el]),
    barra([
      { texto: 'Salvar', onclick: salvar },
      existente ? { texto: 'Excluir', classe: 'vermelho', onclick: () => confirmar('Excluir',
        'Apagar este registro?', () => { Dados.excluir('quebras', q, a.nome()); ir('quebras'); render(); }) } : null
    ])
  ]));
}

// --------------------------------------------------------------- temperatura

export function leiturasForaDaFaixa() {
  const hoje = D.hoje();
  return Dados.ativos('leituras')
    .filter(l => l.data === hoje && l.registradaAs && l.foraDaFaixa && D.Acesso.veSetor(l.setor)).length;
}

const jaPassou = hhmm => {
  const [h1, m1] = hhmm.split(':').map(Number);
  const agora = new Date();
  return agora.getHours() > h1 || (agora.getHours() === h1 && agora.getMinutes() >= m1);
};

function temperatura(registrar) {
  registrar('temperatura', () => {
    const a = D.Acesso, hoje = D.hoje();
    const equips = Dados.ativos('equipamentos').filter(e => e.ativo && a.veSetor(e.setor));
    const linhas = [];
    equips.forEach(e => (e.horarios || []).forEach(hora => {
      const l = Dados.ativos('leituras').find(x =>
        x.equipamentoId === e.id && x.data === hoje && x.horarioAlvo === hora);
      linhas.push({ e, hora, l });
    }));

    const pendentes = linhas.filter(x => (!x.l || !x.l.registradaAs) && jaPassou(x.hora)).length;
    const fora = linhas.filter(x => x.l && x.l.foraDaFaixa).length;

    const cartoes = linhas.map(({ e, hora, l }) => {
      const registrada = l && l.registradaAs;
      const atrasada = !registrada && jaPassou(hora);
      const cor = registrada ? (l.foraDaFaixa ? '#D32F2F' : '#388E3C') : (atrasada ? '#F57C00' : '#9E9E9E');
      return cartao({
        cor, icone: '🌡',
        titulo: hora + '  ' + e.nome,
        sub: D.setor(e.setor).nome + '  •  faixa ' + D.numero(e.min) + ' a ' + D.numero(e.max) + ' C'
          + (e.responsavel ? '  •  ' + e.responsavel : ''),
        extra: registrada ? 'Conferido as ' + l.registradaAs + ' por ' + (l.funcionario || l.autor) : null,
        selo: { texto: registrada ? D.numero(l.temperatura) + ' C'
          : (atrasada ? 'ATRASADA' : 'pendente'), cor },
        destaque: registrada && l.foraDaFaixa
          ? { texto: '⚠ Fora da faixa. ' + (l.acaoTomada || 'Registre a acao tomada.'), cor: '#D32F2F' }
          : null,
        botoes: [{
          texto: registrada ? 'Corrigir leitura' : 'Registrar temperatura',
          onclick: () => {
            const txt = prompt(e.nome + ' - ' + hora + '\nTemperatura em graus (ex: 3 ou -18):',
              registrada ? D.numero(l.temperatura) : '');
            if (txt === null || txt.trim() === '') return;
            const t = D.lerNumero(txt);
            const foraDaFaixa = t < e.min || t > e.max;
            let acao = '';
            if (foraDaFaixa) {
              acao = prompt('⚠ FORA DA FAIXA (' + D.numero(e.min) + ' a ' + D.numero(e.max)
                + ' C).\nO gestor sera avisado. O que foi feito?') || '';
            }
            const leitura = l || Dados.novo({
              equipamentoId: e.id, equipamento: e.nome, setor: e.setor, data: hoje,
              horarioAlvo: hora, avisouPendente: true, avisouAtraso: false
            });
            Object.assign(leitura, {
              temperatura: t, foraDaFaixa, registradaAs: D.agora(),
              funcionario: a.nome(), acaoTomada: acao
            });
            Dados.gravar('leituras', leitura, a.nome());
            toast(foraDaFaixa ? 'Registrado. Avise a manutencao.' : 'Temperatura registrada.');
            render();
          }
        }]
      });
    });

    return h('div', {}, [
      cabecalho({ titulo: '🌡 Temperatura',
        sub: equips.length + ' equipamento(s)  •  ' + pendentes + ' atrasada(s)'
          + (fora ? '  •  ' + fora + ' FORA DA FAIXA' : ''),
        voltar,
        acao: a.configura(null) ? { texto: '+ Equip.', onclick: formEquipamento } : null }),
      h('main', {}, cartoes.length ? cartoes
        : [vazio('Nenhum equipamento cadastrado.\nCadastre a camara fria, o balcao e os freezers.')])
    ]);
  });
}

function formEquipamento() {
  const a = D.Acesso;
  const e = Dados.novo({
    nome: '', setor: a.dono() ? 'FRIOS' : a.meuSetor(), tipo: 'BALCAO',
    min: 0, max: 4, horarios: ['08:00', '14:00', '20:00'], tolerancia: 60,
    responsavel: '', ativo: true
  });
  const nome = campo('Nome (ex: Camara fria 1, Balcao de frios)');
  const setorSel = lista('Setor', opcoesSetor(), e.setor);
  const min = campo('Temperatura minima aceitavel', 0, { type: 'number', inputmode: 'decimal' });
  const max = campo('Temperatura maxima aceitavel', 4, { type: 'number', inputmode: 'decimal' });
  const manha = campo('Conferencia da manha', '08:00', { type: 'time' });
  const tarde = campo('Conferencia da tarde', '14:00', { type: 'time' });
  const noite = campo('Conferencia da noite', '20:00', { type: 'time' });
  const resp = campo('Responsavel (opcional)');

  function salvar() {
    if (!nome.input.value.trim()) return toast('Falta o nome do equipamento.');
    Object.assign(e, {
      nome: nome.input.value.trim(), setor: setorSel.input.value,
      min: D.lerNumero(min.input.value), max: D.lerNumero(max.input.value),
      horarios: [manha.input.value, tarde.input.value, noite.input.value],
      responsavel: resp.input.value.trim()
    });
    if (e.min > e.max) return toast('A minima nao pode ser maior que a maxima.');
    Dados.gravar('equipamentos', e, a.nome());
    toast('Equipamento salvo.');
    ir('temperatura');
    render();
  }

  document.getElementById('app').replaceChildren(h('div', {}, [
    cabecalho({ titulo: '🌡 Novo equipamento', sub: 'Tres conferencias por dia',
      voltar: () => { ir('temperatura'); render(); } }),
    h('main', {}, [nome.el, setorSel.el, min.el, max.el, manha.el, tarde.el, noite.el, resp.el,
      aviso('Se ninguem registrar a temperatura depois do horario, a conferencia fica '
        + 'ATRASADA e o gestor e avisado. Leitura fora da faixa avisa na hora.', '#0277BD')]),
    barra([{ texto: 'Salvar', onclick: salvar }])
  ]));
}

// ---------------------------------------------------------------- pendencias

export function contarPendencias() {
  const a = D.Acesso, hoje = D.hoje();
  const itens = [];

  rotinasDeHoje().forEach(r => {
    const s = statusRotina(r);
    if (s.chave !== 'FEITA' && s.chave !== 'FEITA_ATRASO') {
      itens.push({ icone: '🕒', titulo: r.horario + '  ' + r.titulo,
        sub: 'Cronograma  •  ' + D.setor(r.setor).nome, selo: s.rotulo, cor: s.cor, destino: 'cronograma' });
    }
  });

  Dados.ativos('checklists').filter(c => c.ativo && a.veSetor(c.setor)).forEach(c => {
    const r = Dados.ativos('respostas').find(x => x.checklistId === c.id && x.data === hoje);
    if (!r || !r.concluido) {
      itens.push({ icone: D.setor(c.setor).icone, titulo: D.setor(c.setor).nome,
        sub: 'Checklist  •  ' + (r ? r.itens.filter(i => i.marcado).length + ' de ' + r.itens.length + ' marcados'
          : c.itens.length + ' itens'),
        selo: r ? 'em andamento' : 'nao iniciado', cor: r ? '#F57C00' : '#757575', destino: 'checklists' });
    }
  });

  Dados.ativos('equipamentos').filter(e => e.ativo && a.veSetor(e.setor)).forEach(e => {
    (e.horarios || []).forEach(hora => {
      if (!jaPassou(hora)) return;
      const l = Dados.ativos('leituras').find(x =>
        x.equipamentoId === e.id && x.data === hoje && x.horarioAlvo === hora);
      if (!l || !l.registradaAs) {
        itens.push({ icone: '🌡', titulo: hora + '  ' + e.nome, sub: 'Temperatura nao conferida',
          selo: 'atrasada', cor: '#D32F2F', destino: 'temperatura' });
      }
    });
  });

  Dados.ativos('entregas').filter(e => e.situacao === 'NA_FILA' && e.data === hoje).forEach(e => {
    itens.push({ icone: e.urgente ? '🔴' : '🚚',
      titulo: [e.endereco, e.bairro].filter(Boolean).join(', '),
      sub: 'Entrega na fila' + (e.temFrios ? '  •  tem frios' : ''),
      selo: e.urgente ? 'URGENTE' : 'na fila', cor: e.urgente ? '#D32F2F' : '#757575',
      destino: 'entregas' });
  });

  return itens;
}

function pendencias(registrar) {
  registrar('pendencias', () => {
    const itens = contarPendencias();
    return h('div', {}, [
      cabecalho({ titulo: '📌 Tarefas em aberto', sub: itens.length + ' pendencia(s) hoje', voltar }),
      h('main', {}, itens.length
        ? itens.map(p => cartao({
          cor: p.cor, icone: p.icone, titulo: p.titulo, sub: p.sub,
          selo: { texto: p.selo, cor: p.cor },
          botoes: [{ texto: 'Abrir', onclick: () => { ir(p.destino); render(); } }]
        }))
        : [vazio('Tudo em dia por aqui. 👏')])
    ]);
  });
}
