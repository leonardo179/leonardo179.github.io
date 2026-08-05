/*
 * Um unico caminho de desenho para o encarte: o editor manual usa isto pra
 * mostrar a previa, a lista usa pra miniatura, e a exportacao usa pra gerar
 * o PNG final. A especificacao (fundo + elementos) e sempre a mesma, venha
 * ela de edicao manual ou da IA em modo layout.
 *
 * Aviso sobre exportar: se o encarte tiver foto vinda do Drive, o navegador
 * pode recusar ler os pixels de volta do canvas (CORS) na hora de gerar o
 * PNG. Quando isso acontece, oferecemos "Imprimir" (window.print da propria
 * tela) como alternativa — imprimir nao exige ler pixel nenhum de volta.
 */

const cacheImagens = new Map();

/**
 * "tema://padaria_1" -> caminho de verdade da foto pronta do tema. Guardamos
 * so a chave (nao a URL) no encarte porque o mesmo registro sincronizado
 * abre no Android tambem, que busca essa foto num recurso do app — nao por
 * internet. Qualquer outro valor (URL do Drive, foto enviada) passa direto.
 */
export function resolverFundoTema(valor) {
  return valor && valor.startsWith('tema://') ? 'img/temas/' + valor.slice(7) + '.jpg' : valor;
}

function carregarImagem(url) {
  url = resolverFundoTema(url);
  if (cacheImagens.has(url)) return cacheImagens.get(url);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('nao consegui carregar a imagem'));
    img.src = url;
  });
  cacheImagens.set(url, p);
  return p;
}

function fonteCss(el) {
  const familia = el.fonte === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif';
  return (el.negrito ? 'bold ' : '') + (el.tamanho || 24) + 'px ' + familia;
}

function desenharTexto(ctx, el) {
  ctx.fillStyle = el.cor || '#1F2A1F';
  ctx.font = fonteCss(el);
  ctx.textBaseline = 'top';
  ctx.textAlign = el.alinhamento === 'center' ? 'center' : el.alinhamento === 'right' ? 'right' : 'left';
  const x = ctx.textAlign === 'center' ? el.w / 2 : ctx.textAlign === 'right' ? el.w : 0;

  // Quebra de linha simples: enche a largura do bloco, sem estourar pra fora.
  const palavras = (el.texto || '').split(/\s+/);
  const linhas = [];
  let linha = '';
  palavras.forEach(p => {
    const tentativa = linha ? linha + ' ' + p : p;
    if (ctx.measureText(tentativa).width > el.w && linha) {
      linhas.push(linha);
      linha = p;
    } else {
      linha = tentativa;
    }
  });
  if (linha) linhas.push(linha);

  const alturaLinha = (el.tamanho || 24) * 1.25;
  linhas.forEach((l, i) => ctx.fillText(l, x, i * alturaLinha));
}

/** Desenha tipo "background-size: cover": preenche sem esticar, cortando a sobra. */
function desenharCover(ctx, img, x, y, w, h) {
  const escalaImg = Math.max(w / img.width, h / img.height);
  const lw = img.width * escalaImg, lh = img.height * escalaImg;
  ctx.drawImage(img, x + (w - lw) / 2, y + (h - lh) / 2, lw, lh);
}

async function desenharImagem(ctx, el) {
  if (!el.url) return;
  try {
    const img = await carregarImagem(el.url);
    ctx.save();
    if (el.estilo === 'circulo') {
      ctx.beginPath();
      ctx.ellipse(el.w / 2, el.h / 2, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
      ctx.clip();
    }
    desenharCover(ctx, img, 0, 0, el.w, el.h);
    ctx.restore();
  } catch (e) {
    ctx.fillStyle = '#EEEEEE';
    ctx.fillRect(0, 0, el.w, el.h);
  }
}

/** O "badge" de preco: De/Por riscado, unidade e uma faixa/estourinho atras. */
function desenharPreco(ctx, el) {
  const cor = el.cor || '#D32F2F';
  const livre = el.estilo === 'livre';
  ctx.save();
  if (livre) {
    // Sem fundo: so o texto, na cor escolhida, direto sobre o encarte.
  } else if (el.estilo === 'circulo') {
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.ellipse(el.w / 2, el.h / 2, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (el.estilo === 'estrela') {
    desenharEstrela(ctx, el.w / 2, el.h / 2, Math.min(el.w, el.h) / 2, cor);
  } else {
    ctx.fillStyle = cor;
    ctx.fillRect(0, 0, el.w, el.h);
  }

  // Cor do texto (De/Por/unidade/extra) e cor so do cifrao "R$" podem ser
  // diferentes — e o que permite "todo preco branco, R$ amarelo" de uma vez
  // (ver "Estilo geral" no editor).
  const corTexto = el.corTexto || (livre ? cor : '#FFFFFF');
  const corRS = el.corRS || corTexto;
  ctx.textAlign = 'center';
  const cx = el.w / 2;
  let y = el.h * 0.16;

  /** Escreve "R$ 12,34" com o "R$" numa cor e o numero noutra, centralizado. */
  function fillPreco(prefixo, valor, fonte) {
    ctx.font = fonte;
    const larguraPrefixo = ctx.measureText(prefixo + ' ').width;
    const larguraValor = ctx.measureText(valor).width;
    const total = larguraPrefixo + larguraValor;
    ctx.textAlign = 'left';
    ctx.fillStyle = corRS;
    ctx.fillText(prefixo + ' ', cx - total / 2, y);
    ctx.fillStyle = corTexto;
    ctx.fillText(valor, cx - total / 2 + larguraPrefixo, y);
    ctx.textAlign = 'center';
    return total;
  }

  if (el.precoDe > 0) {
    const fonte = (el.h * 0.12) + 'px system-ui, sans-serif';
    const largura = fillPreco('De R$', el.precoDe.toFixed(2).replace('.', ','), fonte);
    ctx.beginPath();
    ctx.moveTo(cx - largura / 2, y + el.h * 0.06);
    ctx.lineTo(cx + largura / 2, y + el.h * 0.06);
    ctx.strokeStyle = corTexto;
    ctx.stroke();
    y += el.h * 0.2;
  }

  fillPreco('R$', el.precoPor.toFixed(2).replace('.', ','), 'bold ' + (el.h * 0.26) + 'px system-ui, sans-serif');
  y += el.h * 0.3;

  ctx.fillStyle = corTexto;
  if (el.unidade && el.unidade !== 'und') {
    ctx.font = (el.h * 0.1) + 'px system-ui, sans-serif';
    ctx.fillText('o ' + el.unidade, cx, y);
    y += el.h * 0.12;
  }
  if (el.textoExtra) {
    ctx.font = 'bold ' + (el.h * 0.09) + 'px system-ui, sans-serif';
    ctx.fillText(el.textoExtra, cx, y);
  }
  ctx.restore();
}

function desenharEstrela(ctx, cx, cy, raio, cor) {
  const pontas = 8;
  ctx.fillStyle = cor;
  ctx.beginPath();
  for (let i = 0; i < pontas * 2; i++) {
    const r = i % 2 === 0 ? raio : raio * 0.6;
    const ang = (Math.PI / pontas) * i - Math.PI / 2;
    const x = cx + r * Math.cos(ang), y = cy + r * Math.sin(ang);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/** Desenha a especificacao inteira no canvas (que ja precisa existir no DOM). */
export async function desenharEncarte(canvas, encarte) {
  const ctx = canvas.getContext('2d');
  canvas.width = encarte.largura || 1080;
  canvas.height = encarte.altura || 1350;

  if (encarte.fundo && encarte.fundo.tipo === 'imagem' && encarte.fundo.valor) {
    try {
      const img = await carregarImagem(encarte.fundo.valor);
      desenharCover(ctx, img, 0, 0, canvas.width, canvas.height);
    } catch (e) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  } else {
    ctx.fillStyle = (encarte.fundo && encarte.fundo.valor) || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  for (const el of (encarte.elementos || [])) {
    ctx.save();
    const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(((el.rot || 0) * Math.PI) / 180);
    ctx.translate(-el.w / 2, -el.h / 2);
    if (el.tipo === 'imagem') await desenharImagem(ctx, el);
    else if (el.tipo === 'preco') desenharPreco(ctx, el);
    else desenharTexto(ctx, el);
    ctx.restore();
  }
}

/** PNG pronto pra baixar/compartilhar. Pode lancar erro de CORS — ver aviso no topo. */
export async function exportarPng(encarte) {
  const canvas = document.createElement('canvas');
  await desenharEncarte(canvas, encarte);
  return canvas.toDataURL('image/png');
}
