/*
 * Montador de encarte: lista, editor manual (arrastar/redimensionar,
 * cores, fontes, temas, simbolos de kg/g/L/mL/R$) e a tela de IA.
 * Mesma logica de tela do resto do app (registrar/ir/render).
 */
import { Dados, Prefs } from './dados.js?v=202608051921';
import * as D from './dominio.js?v=202608051921';
import { h, cabecalho, cartao, campo, area, lista, marcador, barra, vazio, aviso, toast, confirmar, modal } from './ui.js?v=202608051921';
import { TEMAS_ENCARTE } from './temas-encarte.js?v=202608051921';
import { desenharEncarte, exportarPng, resolverFundoTema } from './encarte-render.js?v=202608051921';
import { gerarImagemIA } from './modelo-gemini.js?v=202608051921';

let ir, voltar, render;

const TAMANHOS = [
  { valor: '1080x1350', texto: 'Post (1080x1350)', largura: 1080, altura: 1350 },
  { valor: '1080x1080', texto: 'Quadrado (1080x1080)', largura: 1080, altura: 1080 },
  { valor: '1240x1754', texto: 'Folha A4', largura: 1240, altura: 1754 }
];

export function instalarEncartes(api) {
  ir = api.ir; voltar = api.voltar; render = api.render;
  telaLista(api.registrar);
  telaEditor(api.registrar);
  telaIA(api.registrar);
}

const novoEncarte = () => Dados.novo({
  titulo: '', modo: 'MANUAL', largura: 1080, altura: 1350,
  fundo: { tipo: 'cor', valor: '#FFFFFF' }, elementos: [],
  imagemFinalUrl: '', promptIA: ''
});

// ------------------------------------------------------------------- lista

function telaLista(registrar) {
  registrar('encartes', () => {
    const a = D.Acesso;
    const itens = Dados.ativos('encartes').sort((x, y) => y.atualizadoEm - x.atualizadoEm);

    const cartoes = itens.map(enc => {
      const c = cartao({
        cor: '#8D5A2B', icone: '🖼',
        titulo: enc.titulo || 'Encarte sem titulo',
        sub: (enc.modo === 'MANUAL' ? 'Montado na mao' : enc.modo === 'IA_LAYOUT'
          ? 'Layout gerado por IA' : 'Imagem gerada por IA') + '  •  ' + D.data((enc.atualizadoEm ? new Date(enc.atualizadoEm) : new Date()).toISOString().slice(0, 10)),
        botoes: [
          { texto: 'Abrir', onclick: () => ir('encarte-editor', { id: enc.id }) },
          { texto: 'Excluir', sec: true, onclick: () => confirmar('Excluir encarte',
            'Apagar "' + (enc.titulo || 'este encarte') + '"?', () => {
              Dados.excluir('encartes', enc, a.nome());
              render();
            }) }
        ],
        onclick: () => ir('encarte-editor', { id: enc.id })
      });
      return c;
    });

    return h('div', {}, [
      cabecalho({ titulo: '🖼 Encartes', sub: itens.length + ' encarte(s)', voltar }),
      h('main', {}, cartoes.length ? cartoes
        : [vazio('Nenhum encarte ainda.\nToque em Novo para montar o primeiro.')]),
      h('button', { class: 'fab', onclick: () => escolherModo() }, 'Novo encarte')
    ]);
  });
}

function escolherModo() {
  modal({
    titulo: 'Novo encarte',
    textoOk: 'Montar na mao',
    conteudo: [
      aviso('Voce pode montar do zero arrastando texto e foto, ou descrever pra IA montar '
        + 'e voce ajustar depois.', '#455A64')
    ],
    aoConfirmar: () => { ir('encarte-editor', { novo: 1 }); }
  });
  // Segundo caminho: um botao extra fora do modal padrao, direto pra tela de IA.
  setTimeout(() => {
    const botoes = document.querySelector('.modal-botoes');
    if (!botoes) return;
    const btIA = h('button', {
      onclick: () => { document.querySelector('.modal-fundo').remove(); ir('encarte-ia'); }
    }, '✨ Gerar com IA');
    botoes.insertBefore(btIA, botoes.firstChild);
  });
}

// ------------------------------------------------------------------ editor

let rascunhoIA = null;
export function abrirEditorComRascunho(enc) {
  rascunhoIA = enc;
}

function telaEditor(registrar) {
  registrar('encarte-editor', params => {
    const a = D.Acesso;
    let enc;
    if (rascunhoIA) { enc = rascunhoIA; rascunhoIA = null; }
    else if (params.id) enc = Dados.ativos('encartes').find(x => x.id === params.id);
    if (!enc) enc = novoEncarte();
    else enc = JSON.parse(JSON.stringify(enc)); // edita uma copia; só grava ao Salvar
    const existente = !!params.id;

    let selecionado = null;
    const ESCALA = Math.min(1, (Math.min(window.innerWidth - 20, 480)) / enc.largura);

    const pagina = h('div', {
      estilo: {
        position: 'relative', width: (enc.largura * ESCALA) + 'px', height: (enc.altura * ESCALA) + 'px',
        margin: '0 auto', overflow: 'hidden', borderRadius: '8px', boxShadow: '0 1px 6px rgba(0,0,0,.25)',
        background: enc.fundo.tipo === 'cor' ? enc.fundo.valor : '#EEE',
        backgroundImage: enc.fundo.tipo === 'imagem' && enc.fundo.valor
          ? 'url(' + resolverFundoTema(enc.fundo.valor) + ')' : '',
        backgroundSize: 'cover'
      }
    });

    const painelProp = h('div', {});
    const tituloCampo = campo('Titulo do encarte', enc.titulo, { placeholder: 'ex: Ofertas de fim de semana' });

    function elDiv(el) {
      const div = h('div', {
        estilo: {
          position: 'absolute', left: (el.x * ESCALA) + 'px', top: (el.y * ESCALA) + 'px',
          width: (el.w * ESCALA) + 'px', height: (el.h * ESCALA) + 'px',
          transform: 'rotate(' + (el.rot || 0) + 'deg)',
          outline: selecionado === el ? '2px dashed #2E7D32' : 'none',
          cursor: 'move', userSelect: 'none', overflow: 'hidden', boxSizing: 'border-box'
        }
      });

      if (el.tipo === 'texto') {
        Object.assign(div.style, {
          color: el.cor || '#1F2A1F',
          fontSize: Math.max(8, el.tamanho * ESCALA) + 'px',
          fontWeight: el.negrito ? '700' : '400',
          fontFamily: el.fonte === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif',
          textAlign: el.alinhamento || 'left', padding: '2px', whiteSpace: 'pre-wrap'
        });
        div.textContent = el.texto || 'Texto';
      } else if (el.tipo === 'imagem') {
        if (el.url) {
          const img = h('img', { src: el.url });
          img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover';
          img.style.borderRadius = el.estilo === 'circulo' ? '50%' : '0';
          div.append(img);
        } else {
          div.style.background = '#DDD';
          div.textContent = 'sem foto';
        }
      } else if (el.tipo === 'preco') {
        const livre = el.estilo === 'livre';
        const corTxt = el.corTexto || (livre ? (el.cor || '#D32F2F') : '#fff');
        const corCifrao = el.corRS || corTxt;
        Object.assign(div.style, {
          background: livre ? 'transparent' : (el.cor || '#D32F2F'),
          color: corTxt, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          borderRadius: el.estilo === 'circulo' ? '50%' : livre ? '0' : '6px',
          fontSize: (10 * ESCALA) + 'px'
        });
        const rs = txt => h('span', { estilo: { color: corCifrao } }, txt);
        div.append(h('div', { estilo: { textAlign: 'center', width: '100%' } }, [
          el.precoDe > 0 ? h('div', { estilo: { textDecoration: 'line-through', fontSize: '.8em' } },
            [rs('De R$ '), D.numero(el.precoDe)]) : null,
          h('b', { estilo: { fontSize: '1.6em', display: 'block' } }, [rs('R$ '), D.numero(el.precoPor || 0)]),
          el.unidade && el.unidade !== 'und' ? h('div', {}, 'o ' + el.unidade) : null,
          el.textoExtra ? h('div', { estilo: { fontWeight: '700' } }, el.textoExtra) : null
        ].filter(Boolean)));
      }

      div.addEventListener('pointerdown', ev => {
        ev.stopPropagation();
        selecionar(el);
        const x0 = ev.clientX, y0 = ev.clientY, ex0 = el.x, ey0 = el.y;
        const mover = e2 => {
          el.x = ex0 + (e2.clientX - x0) / ESCALA;
          el.y = ey0 + (e2.clientY - y0) / ESCALA;
          redesenharPagina();
        };
        const soltar = () => {
          document.removeEventListener('pointermove', mover);
          document.removeEventListener('pointerup', soltar);
        };
        document.addEventListener('pointermove', mover);
        document.addEventListener('pointerup', soltar);
      });

      if (selecionado === el) {
        const alca = h('div', {
          estilo: {
            position: 'absolute', right: '-6px', bottom: '-6px', width: '14px', height: '14px',
            background: '#2E7D32', borderRadius: '50%', cursor: 'nwse-resize'
          }
        });
        alca.addEventListener('pointerdown', ev => {
          ev.stopPropagation();
          const x0 = ev.clientX, y0 = ev.clientY, w0 = el.w, h0 = el.h;
          const mover = e2 => {
            el.w = Math.max(20, w0 + (e2.clientX - x0) / ESCALA);
            el.h = Math.max(20, h0 + (e2.clientY - y0) / ESCALA);
            redesenharPagina();
          };
          const soltar = () => {
            document.removeEventListener('pointermove', mover);
            document.removeEventListener('pointerup', soltar);
          };
          document.addEventListener('pointermove', mover);
          document.addEventListener('pointerup', soltar);
        });
        div.append(alca);
      }
      return div;
    }

    function selecionar(el) {
      selecionado = el;
      redesenhar();
    }

    function redesenharFundo() {
      pagina.style.background = enc.fundo.tipo === 'cor' ? enc.fundo.valor : '#EEE';
      pagina.style.backgroundImage = enc.fundo.tipo === 'imagem' && enc.fundo.valor
        ? 'url(' + resolverFundoTema(enc.fundo.valor) + ')' : '';
    }

    // So a pagina (fundo + blocos): chamada a cada tecla/arraste, sem
    // encostar no painel de propriedades — reconstruir o painel no meio de
    // uma digitacao derruba o foco do campo e come o resto do que a pessoa
    // esta escrevendo.
    function redesenharPagina() {
      redesenharFundo();
      pagina.replaceChildren(...enc.elementos.map(elDiv));
    }

    // Pagina + painel: só quando a SELECAO muda (elemento novo, trocado ou
    // excluido) — ai sim o painel precisa mostrar outros campos.
    function redesenhar() {
      redesenharPagina();
      desenharPainelProp();
    }

    function desenharPainelProp() {
      if (!selecionado) { painelProp.replaceChildren(); return; }
      const el = selecionado;
      const campos = [];

      if (el.tipo === 'texto') {
        const texto = area('Texto', el.texto);
        texto.input.oninput = () => { el.texto = texto.input.value; redesenharPagina(); };
        const cor = campo('Cor', el.cor || '#1F2A1F', { type: 'color' });
        cor.input.oninput = () => { el.cor = cor.input.value; redesenharPagina(); };
        const tam = campo('Tamanho', el.tamanho || 24, { type: 'number' });
        tam.input.oninput = () => { el.tamanho = parseInt(tam.input.value) || 24; redesenharPagina(); };
        const fonte = lista('Fonte', [{ valor: 'system', texto: 'Padrao' },
          { valor: 'serif', texto: 'Elegante (serifa)' }], el.fonte || 'system');
        fonte.input.onchange = () => { el.fonte = fonte.input.value; redesenharPagina(); };
        const alinh = lista('Alinhamento', [{ valor: 'left', texto: 'Esquerda' },
          { valor: 'center', texto: 'Centro' }, { valor: 'right', texto: 'Direita' }],
          el.alinhamento || 'left');
        alinh.input.onchange = () => { el.alinhamento = alinh.input.value; redesenharPagina(); };
        const negrito = marcador('Negrito', el.negrito);
        negrito.input.onchange = () => { el.negrito = negrito.input.checked; redesenharPagina(); };
        const simbolos = h('div', { estilo: { display: 'flex', gap: '6px', margin: '8px 0', flexWrap: 'wrap' } },
          ['kg', 'g', 'L', 'mL', 'R$', 'un'].map(s => h('button', {
            class: 'sec',
            onclick: () => { el.texto = (el.texto || '') + s; texto.input.value = el.texto; redesenharPagina(); }
          }, s)));
        campos.push(texto.el, simbolos, cor.el, tam.el, fonte.el, alinh.el, negrito.el);
      } else if (el.tipo === 'imagem') {
        const formatoImg = lista('Formato', [{ valor: 'retangulo', texto: 'Retangulo' },
          { valor: 'circulo', texto: 'Circulo' }], el.estilo || 'retangulo');
        formatoImg.input.onchange = () => { el.estilo = formatoImg.input.value; redesenharPagina(); };
        campos.push(botaoEscolherFoto(url => { el.url = url; redesenharPagina(); }), formatoImg.el);
      } else if (el.tipo === 'preco') {
        const de = campo('Preco De (opcional)', el.precoDe || '', { type: 'number', inputmode: 'decimal' });
        de.input.oninput = () => { el.precoDe = D.lerNumero(de.input.value); redesenharPagina(); };
        const por = campo('Preco Por', el.precoPor || '', { type: 'number', inputmode: 'decimal' });
        por.input.oninput = () => { el.precoPor = D.lerNumero(por.input.value); redesenharPagina(); };
        const unid = lista('Unidade', [{ valor: 'und', texto: 'unidade' }, { valor: 'kg', texto: 'kg' },
          { valor: 'g', texto: 'g' }, { valor: 'L', texto: 'L' }, { valor: 'mL', texto: 'mL' }], el.unidade || 'und');
        unid.input.onchange = () => { el.unidade = unid.input.value; redesenharPagina(); };
        const estilo = lista('Formato', [{ valor: 'faixa', texto: 'Faixa' },
          { valor: 'circulo', texto: 'Circulo' }, { valor: 'estrela', texto: 'Estourinho' },
          { valor: 'livre', texto: 'Sem fundo (so o texto)' }], el.estilo || 'faixa');
        estilo.input.onchange = () => { el.estilo = estilo.input.value; redesenharPagina(); };
        const extra = campo('Texto extra (opcional)', el.textoExtra || '', { placeholder: 'ex: LEVE 3 PAGUE 2' });
        extra.input.oninput = () => { el.textoExtra = extra.input.value; redesenharPagina(); };
        const cor = campo('Cor do fundo/selo', el.cor || '#D32F2F', { type: 'color' });
        cor.input.oninput = () => { el.cor = cor.input.value; redesenharPagina(); };
        const corTexto = campo('Cor do numero', el.corTexto || '#FFFFFF', { type: 'color' });
        corTexto.input.oninput = () => { el.corTexto = corTexto.input.value; redesenharPagina(); };
        const corRS = campo('Cor do "R$"', el.corRS || el.corTexto || '#FFFFFF', { type: 'color' });
        corRS.input.oninput = () => { el.corRS = corRS.input.value; redesenharPagina(); };
        campos.push(de.el, por.el, unid.el, estilo.el, extra.el, cor.el, corTexto.el, corRS.el);
      }

      campos.push(h('button', {
        class: 'sec', estilo: { marginTop: '10px' },
        onclick: () => {
          enc.elementos = enc.elementos.filter(x => x !== el);
          selecionado = null;
          redesenhar();
        }
      }, 'Excluir este elemento'));

      painelProp.replaceChildren(h('div', { class: 'rotulo-secao' }, 'Elemento selecionado'), ...campos);
    }

    function botaoEscolherFoto(aoEscolher) {
      const input = h('input', { type: 'file', accept: 'image/*', estilo: { display: 'none' } });
      input.onchange = async () => {
        const arquivo = input.files[0];
        if (!arquivo) return;
        // Fica so neste aparelho (dentro do proprio encarte) — nao sobe pra
        // lugar nenhum. Se quiser mandar pra outro aparelho, exporta o PNG.
        const dataUrl = await lerComoDataUrl(arquivo);
        aoEscolher(dataUrl);
      };
      const bt = h('button', { class: 'sec', onclick: () => input.click() }, '📷 Escolher foto');
      return h('div', {}, [bt, input]);
    }

    function novoElemento(tipo) {
      // Um deslocamento por elemento ja existente, senao tudo nasce empilhado
      // exatamente no mesmo lugar e vira dificil pegar o de baixo.
      const desvio = (enc.elementos.length % 6) * 24;
      const base = { tipo, x: enc.largura * 0.1 + desvio, y: enc.altura * 0.1 + desvio,
        w: enc.largura * 0.5, h: 120, rot: 0 };
      if (tipo === 'texto') Object.assign(base, { texto: 'Texto', fonte: 'system', tamanho: 40,
        cor: '#1F2A1F', alinhamento: 'left', negrito: false, h: 60 });
      else if (tipo === 'imagem') Object.assign(base, { url: '', h: base.w });
      else if (tipo === 'preco') Object.assign(base, { estilo: 'faixa', precoDe: 0, precoPor: 0,
        unidade: 'und', textoExtra: '', cor: '#D32F2F', w: 220, h: 220 });
      enc.elementos.push(base);
      selecionar(base);
    }

    function aplicarTema(tema, fundoImagem) {
      enc.fundo = fundoImagem ? { tipo: 'imagem', valor: fundoImagem } : { tipo: 'cor', valor: tema.fundoSugerido };
      enc.elementos.forEach(el => {
        if (el.tipo === 'texto') el.cor = el.cor === '#1F2A1F' ? tema.corPrimaria : el.cor;
        if (el.tipo === 'preco') el.cor = tema.corDestaque;
      });
      redesenhar();
    }

    /**
     * As 3 fotos prontas de um tema (ver web/img/temas/). Guardamos so a
     * chave com o prefixo "tema://" (nao a URL) porque o mesmo encarte pode
     * abrir no Android, que busca essa foto num recurso do app, nao por
     * internet — ver resolverFundoTema em encarte-render.js e no Android.
     */
    function fotosDoTema(tema) {
      const base = tema.chave.toLowerCase();
      return [1, 2, 3].map(n => 'tema://' + base + '_' + n);
    }

    function abrirTemas() {
      const opcoes = TEMAS_ENCARTE.map(t => ({ valor: t.chave, texto: t.nome }));
      const sel = lista('Escolher tema', opcoes, '');
      modal({
        titulo: 'Temas prontos', textoOk: 'Proximo',
        conteudo: [aviso('Aplica cor de destaque — continua tudo editavel depois.'), sel.el],
        aoConfirmar: () => {
          const t = TEMAS_ENCARTE.find(x => x.chave === sel.input.value);
          if (t) escolherFundoDoTema(t);
        }
      });
    }

    /** Depois de escolher o tema: so a cor, ou uma das 3 fotos prontas do tema. */
    function escolherFundoDoTema(tema) {
      let escolhida = null;
      const miniaturas = h('div', {
        estilo: { display: 'flex', gap: '8px', margin: '10px 0', flexWrap: 'wrap' }
      }, fotosDoTema(tema).map(url => {
        const img = h('img', { src: resolverFundoTema(url), estilo: {
          width: '92px', height: '92px', objectFit: 'cover', borderRadius: '8px',
          cursor: 'pointer', border: '3px solid transparent'
        } });
        img.onclick = () => {
          escolhida = url;
          miniaturas.querySelectorAll('img').forEach(i => i.style.border = '3px solid transparent');
          img.style.border = '3px solid #2E7D32';
        };
        img.onerror = () => { img.style.display = 'none'; };
        return img;
      }));

      modal({
        titulo: 'Fundo — ' + tema.nome, textoOk: 'Aplicar',
        conteudo: [
          aviso('Toque numa foto pronta do tema, ou deixe sem marcar pra usar so a cor.'),
          miniaturas
        ],
        aoConfirmar: () => {
          aplicarTema(tema, escolhida);
        }
      });
    }

    function abrirFundo() {
      const tipo = lista('Tipo de fundo', [{ valor: 'cor', texto: 'Cor solida' },
        { valor: 'imagem', texto: 'Foto' }], enc.fundo.tipo);
      const cor = campo('Cor', enc.fundo.tipo === 'cor' ? enc.fundo.valor : '#FFFFFF', { type: 'color' });
      const fotoWrap = botaoEscolherFoto(url => { enc.fundo = { tipo: 'imagem', valor: url }; redesenhar(); });
      modal({
        titulo: 'Fundo do encarte', textoOk: 'Usar esta cor',
        conteudo: [tipo.el, cor.el, h('div', { class: 'sub' }, 'Ou envie uma foto:'), fotoWrap],
        aoConfirmar: () => {
          if (tipo.input.value === 'cor') { enc.fundo = { tipo: 'cor', valor: cor.input.value }; redesenhar(); }
        }
      });
    }

    /**
     * Muda de uma vez todos os elementos do mesmo tipo — "todo preco branco",
     * "todo R$ amarelo", "todo texto preto" — sem precisar abrir um por um.
     * Continua dando pra ajustar um elemento sozinho depois, normalmente.
     */
    function abrirEstiloGeral() {
      const temPreco = enc.elementos.some(e => e.tipo === 'preco');
      const temTexto = enc.elementos.some(e => e.tipo === 'texto');
      if (!temPreco && !temTexto) { toast('Adicione texto ou preço primeiro.'); return; }

      const linhas = [];
      let corTodosPrecos = null, corTodosRS = null, corFundoTodosPrecos = null, corTodosTextos = null;
      if (temPreco) {
        const c1 = campo('Cor do numero em todos os precos', '#FFFFFF', { type: 'color' });
        c1.input.oninput = () => { corTodosPrecos = c1.input.value; };
        const c2 = campo('Cor do "R$" em todos os precos', '#FFEB3B', { type: 'color' });
        c2.input.oninput = () => { corTodosRS = c2.input.value; };
        const c3 = campo('Cor do fundo/selo em todos os precos', '#D32F2F', { type: 'color' });
        c3.input.oninput = () => { corFundoTodosPrecos = c3.input.value; };
        linhas.push(c1.el, c2.el, c3.el);
      }
      if (temTexto) {
        const c4 = campo('Cor de todos os textos', '#1F2A1F', { type: 'color' });
        c4.input.oninput = () => { corTodosTextos = c4.input.value; };
        linhas.push(c4.el);
      }

      modal({
        titulo: 'Estilo geral', textoOk: 'Aplicar a todos',
        conteudo: [aviso('So muda o que voce mexer aqui — o resto continua como esta. '
          + 'Depois ainda da pra ajustar um item sozinho.'), ...linhas],
        aoConfirmar: () => {
          enc.elementos.forEach(e => {
            if (e.tipo === 'preco') {
              if (corTodosPrecos) e.corTexto = corTodosPrecos;
              if (corTodosRS) e.corRS = corTodosRS;
              if (corFundoTodosPrecos) e.cor = corFundoTodosPrecos;
            } else if (e.tipo === 'texto' && corTodosTextos) {
              e.cor = corTodosTextos;
            }
          });
          redesenharPagina();
          toast('Estilo aplicado.');
        }
      });
    }

    function salvar() {
      enc.titulo = tituloCampo.input.value.trim() || 'Encarte sem titulo';
      Dados.gravar('encartes', enc, a.nome());
      toast('Encarte salvo.');
      ir('encartes');
      render();
    }

    async function exportar() {
      toast('Gerando imagem...');
      try {
        const png = await exportarPng(enc);
        const arquivo = new File([await (await fetch(png)).blob()],
          (enc.titulo || 'encarte') + '.png', { type: 'image/png' });
        // No celular, isso abre o menu nativo de compartilhar (WhatsApp, Salvar
        // imagem, AirDrop...) em vez de so baixar um arquivo que some na pasta.
        if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
          await navigator.share({ files: [arquivo], title: enc.titulo || 'Encarte' });
          return;
        }
        const link = h('a', { href: png, download: (enc.titulo || 'encarte') + '.png' });
        link.click();
      } catch (e) {
        if (e && e.name === 'AbortError') return; // usuario cancelou o compartilhar
        toast('Nao consegui gerar o PNG (provavelmente por causa de uma foto externa). '
          + 'Use Imprimir no menu do navegador nesta tela.');
      }
    }

    function verTelaCheia() {
      if (enc.fundo.tipo !== 'imagem' || !enc.fundo.valor) return;
      const fechar = () => overlay.remove();
      const overlay = h('div', {
        estilo: {
          position: 'fixed', inset: '0', background: '#000', zIndex: '999',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        },
        onclick: fechar
      }, [
        h('img', {
          src: resolverFundoTema(enc.fundo.valor),
          estilo: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }
        }),
        h('div', {
          estilo: { position: 'fixed', top: 'calc(env(safe-area-inset-top) + 10px)', right: '16px',
            color: '#fff', fontSize: '28px', lineHeight: '1', padding: '6px 12px' },
          onclick: fechar
        }, '✕')
      ]);
      document.body.appendChild(overlay);
    }

    pagina.addEventListener('pointerdown', () => { selecionado = null; redesenhar(); });
    redesenhar();

    return h('div', {}, [
      cabecalho({ titulo: existente ? '🖼 Editar encarte' : '🖼 Novo encarte',
        sub: 'Toque num item pra editar, arraste pra mover',
        voltar: () => { ir('encartes'); render(); } }),
      h('main', {}, [
        tituloCampo.el,
        h('div', { estilo: { display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '10px 0' } }, [
          h('button', { class: 'sec', onclick: () => novoElemento('texto') }, '+ Texto'),
          h('button', { class: 'sec', onclick: () => novoElemento('imagem') }, '+ Foto'),
          h('button', { class: 'sec', onclick: () => novoElemento('preco') }, '+ Preco'),
          h('button', { class: 'sec', onclick: abrirTemas }, '🎨 Tema'),
          h('button', { class: 'sec', onclick: abrirFundo }, '🖌 Fundo'),
          h('button', { class: 'sec', onclick: abrirEstiloGeral }, '🖍 Estilo geral'),
          enc.fundo.tipo === 'imagem' && enc.fundo.valor
            ? h('button', { class: 'sec', onclick: verTelaCheia }, '🔍 Tela cheia') : null
        ].filter(Boolean)),
        pagina,
        painelProp
      ]),
      barra([
        { texto: 'Salvar', onclick: salvar },
        { texto: 'Exportar / Compartilhar', classe: 'cinza', onclick: exportar },
        existente ? { texto: 'Excluir', classe: 'vermelho', onclick: () => confirmar('Excluir encarte',
          'Apagar este encarte?', () => { Dados.excluir('encartes', enc, a.nome()); ir('encartes'); render(); }) } : null
      ])
    ]);
  });
}

function lerComoDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(arquivo);
  });
}

function medirImagem(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ largura: img.naturalWidth, altura: img.naturalHeight });
    img.onerror = () => reject(new Error('nao consegui medir a imagem gerada'));
    img.src = dataUrl;
  });
}

// --------------------------------------------------------------------- IA

function telaIA(registrar) {
  registrar('encarte-ia', () => {
    const a = D.Acesso;
    const chave = Prefs.get('geminiKey');

    if (!chave) {
      return h('div', {}, [
        cabecalho({ titulo: '✨ Gerar encarte com IA', voltar: () => { ir('encartes'); render(); } }),
        h('main', {}, [
          vazio('Falta configurar a chave da API do Gemini.\nVa em Ajustes para colar a sua chave.'),
          h('button', { onclick: () => ir('ajustes') }, 'Ir para Ajustes')
        ])
      ]);
    }

    const descricao = area('Descreva o encarte',
      'ex: encarte de fim de semana, tom animado, com Nescau 200g de R$8,99 por R$6,99...');
    const listaPrecos = area('Produtos e precos (opcional, um por linha)',
      'Nescau 200g - de 8,99 por 6,99\nDoritos 84g - 7,49');
    const temaSel = lista('Tema (opcional)',
      [{ valor: '', texto: '— deixar a IA escolher —' }]
        .concat(TEMAS_ENCARTE.map(t => ({ valor: t.chave, texto: t.nome }))), '');
    const status = aviso('');
    status.style.display = 'none';

    const fotos = [];
    const listaFotos = h('div', { estilo: { display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '8px 0' } });
    function redesenharFotos() {
      listaFotos.replaceChildren(...fotos.map((f, i) => h('div', {
        estilo: { width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', position: 'relative' }
      }, [
        h('img', { src: f, estilo: { width: '100%', height: '100%', objectFit: 'cover' } }),
        h('div', {
          estilo: { position: 'absolute', top: '0', right: '0', background: '#0009', color: '#fff',
            padding: '2px 5px', cursor: 'pointer', fontSize: '11px' },
          onclick: () => { fotos.splice(i, 1); redesenharFotos(); }
        }, '✕')
      ])));
    }
    const inputFoto = h('input', { type: 'file', accept: 'image/*', multiple: true, estilo: { display: 'none' } });
    inputFoto.onchange = async () => {
      for (const arquivo of Array.from(inputFoto.files)) {
        fotos.push(await lerComoDataUrl(arquivo));
      }
      redesenharFotos();
    };

    async function gerar() {
      const desc = descricao.input.value.trim();
      if (!desc) { toast('Descreva o que voce quer no encarte.'); return; }

      status.style.display = '';
      status.textContent = 'Gerando a imagem...';

      const tema = TEMAS_ENCARTE.find(t => t.chave === temaSel.input.value);
      const prompt = montarPrompt(desc, listaPrecos.input.value.trim(), tema, fotos.length > 0);

      try {
        // Fica so neste aparelho: nao sobe pra lugar nenhum. Quem gerou decide
        // se quer Salvar (entra no encarte sincronizado) ou so Exportar/baixar.
        const dataUrl = await gerarImagemIA(chave, prompt, fotos);
        // O Gemini nao devolve sempre exatamente 1080x1350 (o pedido no prompt
        // e uma sugestao, nao garantia) — medir o tamanho real e usar ele evita
        // que a previa/exportacao cortem pedaco da imagem (fundo em "cover").
        const dims = await medirImagem(dataUrl);
        const enc = novoEncarte();
        enc.modo = 'IA_IMAGEM';
        enc.titulo = desc.slice(0, 40);
        enc.largura = dims.largura;
        enc.altura = dims.altura;
        enc.imagemFinalUrl = dataUrl;
        enc.fundo = { tipo: 'imagem', valor: dataUrl };
        enc.promptIA = prompt;
        abrirEditorComRascunho(enc);
        ir('encarte-editor', { novo: 1 });
      } catch (e) {
        status.textContent = 'Nao consegui gerar: ' + e.message
          + '. Confira a chave em Ajustes ou tente de novo.';
      }
    }

    return h('div', {}, [
      cabecalho({ titulo: '✨ Gerar encarte com IA',
        sub: 'Descreva, anexe fotos e a IA gera uma imagem pronta — sempre da pra ajustar depois',
        voltar: () => { ir('encartes'); render(); } }),
      h('main', {}, [
        descricao.el, listaPrecos.el, temaSel.el,
        h('div', { class: 'rotulo-secao' }, 'Fotos e logo (opcional)'),
        listaFotos,
        h('button', { class: 'sec', onclick: () => inputFoto.click() }, '📷 Adicionar foto'),
        inputFoto,
        status
      ]),
      barra([{ texto: 'Gerar encarte', onclick: gerar }])
    ]);
  });
}

function montarPrompt(descricao, precos, tema, temFotos) {
  const temas = TEMAS_ENCARTE.map(t => t.chave + ' (' + t.nome + ')').join(', ');
  let p = 'Voce e um designer de encartes de mercado brasileiro. ';
  p += 'Pedido do dono: ' + descricao + '\n';
  if (precos) p += 'Produtos e precos:\n' + precos + '\n';
  if (tema) p += 'Use o tema "' + tema.nome + '" (cor primaria ' + tema.corPrimaria
    + ', secundaria ' + tema.corSecundaria + ', destaque ' + tema.corDestaque + ').\n';
  else p += 'Temas disponiveis, escolha o que combinar: ' + temas + '.\n';
  if (temFotos) p += 'Use as imagens anexadas como referencia visual real (fotos de produto '
    + 'e/ou logo da loja) — nao troque marca, formato ou cores do que foi enviado.\n';

  p += 'Use somente as informacoes fornecidas aqui (nome da loja, produtos, precos e o pedido '
    + 'do dono). Nunca invente endereco, telefone, site, redes sociais, CNPJ ou uma data '
    + 'especifica de validade — se precisar indicar validade, use um termo generico como '
    + '"somente hoje" ou "enquanto durarem os estoques", sem dia/mes/ano.\n';

  p += 'Gere uma imagem de encarte de mercado pronta, proporcao vertical, com os precos '
    + 'bem legiveis e grandes, estilo profissional de tabloide de supermercado brasileiro.';
  return p;
}
