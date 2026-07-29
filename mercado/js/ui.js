/* Pecinhas de tela reaproveitadas por todos os modulos. */

export function h(tag, attrs = {}, filhos = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === null || v === undefined || v === false) return;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'texto') el.textContent = v;
    else if (k === 'estilo') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  });
  (Array.isArray(filhos) ? filhos : [filhos]).forEach(f => {
    if (f === null || f === undefined || f === false) return;
    el.append(f.nodeType ? f : document.createTextNode(String(f)));
  });
  return el;
}

/** Cabecalho verde com botao voltar, subtitulo e acao opcional no canto. */
export function cabecalho({ titulo, sub, voltar, acao }) {
  const filhos = [];
  if (voltar) filhos.push(h('div', { class: 'voltar', onclick: voltar }, '←'));
  filhos.push(h('div', { estilo: { flex: '1', minWidth: 0 } }, [
    h('h1', { texto: titulo }),
    sub ? h('div', { class: 'sub', id: 'subCabecalho', texto: sub }) : null
  ]));
  if (acao) filhos.push(h('div', { class: 'acao', onclick: acao.onclick, texto: acao.texto }));
  return h('header', {}, filhos);
}

export function subtitulo(texto) {
  const el = document.getElementById('subCabecalho');
  if (el) el.textContent = texto;
}

/** Cartao padrao das listas: faixa colorida + titulo + textos + botoes. */
export function cartao({ cor, icone, titulo, sub, extra, selo, destaque, botoes, onclick }) {
  const corpo = [];
  corpo.push(h('div', { class: 'linha' }, [
    icone ? h('span', { estilo: { fontSize: '19px' } }, icone) : null,
    h('div', { class: 'titulo', texto: titulo }),
    selo ? h('span', {
      class: 'selo',
      estilo: { position: 'static', background: selo.cor }
    }, selo.texto) : null
  ]));
  if (sub) corpo.push(h('div', { class: 'sub', texto: sub }));
  if (extra) corpo.push(h('div', { class: 'extra', texto: extra }));
  if (destaque) {
    corpo.push(h('div', {
      class: 'destaque', texto: destaque.texto,
      estilo: {
        background: destaque.cor + '22', color: destaque.cor,
        border: '1px solid ' + destaque.cor + '55'
      }
    }));
  }
  if (botoes && botoes.length) {
    corpo.push(h('div', { class: 'botoes' }, botoes.filter(Boolean).map(b =>
      h('button', {
        class: b.sec ? 'sec' : '',
        onclick: e => { e.stopPropagation(); b.onclick(); },
        texto: b.texto
      }))));
  }
  return h('div', { class: 'cartao', onclick }, [
    h('div', { class: 'faixa', estilo: { background: cor || '#2E7D32' } }),
    h('div', { class: 'corpo' }, corpo)
  ]);
}

export function campo(rotulo, valor = '', opcoes = {}) {
  const input = h('input', Object.assign({ value: valor }, opcoes));
  return { el: h('div', {}, [h('label', { texto: rotulo }), input]), input };
}

export function area(rotulo, valor = '') {
  const el = h('textarea', {});
  el.value = valor || '';
  return { el: h('div', {}, [h('label', { texto: rotulo }), el]), input: el };
}

export function lista(rotulo, opcoes, selecionado) {
  const sel = h('select', {});
  opcoes.forEach(o => {
    const op = h('option', { value: o.valor }, o.texto);
    if (o.valor === selecionado) op.selected = true;
    sel.append(op);
  });
  return { el: h('div', {}, [h('label', { texto: rotulo }), sel]), input: sel };
}

export function marcador(rotulo, marcado) {
  const input = h('input', { type: 'checkbox' });
  input.checked = !!marcado;
  return { el: h('label', { class: 'marcador' }, [input, h('span', { texto: rotulo })]), input };
}

export function barra(botoes) {
  return h('div', { class: 'barra' }, botoes.filter(Boolean).map(b =>
    h('button', { class: b.classe || '', onclick: b.onclick, texto: b.texto })));
}

export function vazio(texto) {
  return h('div', { class: 'vazio', texto });
}

export function aviso(texto, cor = '#2E7D32') {
  return h('div', {
    class: 'aviso', texto,
    estilo: { background: cor + '22', color: cor, border: '1px solid ' + cor + '55' }
  });
}

export function toast(msg) {
  const t = h('div', { class: 'toast', texto: msg });
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

export function confirmar(titulo, texto, aoConfirmar) {
  if (window.confirm(titulo + '\n\n' + texto)) aoConfirmar();
}

/**
 * Janela de formulario dentro da propria tela. Existe porque prompt() do
 * navegador so aceita uma pergunta por vez — e formulario de varios campos
 * virava uma fila de perguntas, sem dar para ver o total nem voltar atras.
 */
export function modal({ titulo, conteudo, aoConfirmar, textoOk = 'Salvar' }) {
  const fundo = h('div', { class: 'modal-fundo' });
  const caixa = h('div', { class: 'modal-caixa' }, [
    h('h3', { texto: titulo }),
    h('div', { class: 'modal-corpo' }, conteudo),
    h('div', { class: 'modal-botoes' }, [
      h('button', { class: 'cinza', onclick: () => fundo.remove() }, 'Cancelar'),
      h('button', { onclick: () => { if (aoConfirmar() !== false) fundo.remove(); } }, textoOk)
    ])
  ]);
  fundo.append(caixa);
  fundo.onclick = e => { if (e.target === fundo) fundo.remove(); };
  document.body.append(fundo);
  return fundo;
}
