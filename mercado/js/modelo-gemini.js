/*
 * Descobre, na propria API do Gemini, quais modelos existem para a chave da
 * loja. Sem isto o app fica preso num nome escrito no codigo — e o Google
 * aposenta modelo com frequencia (ex.: "flash-lite 4" vira "5" e o nome
 * antigo passa a dar 404 pra quem ja tem o app instalado, sem update
 * possivel). Mesmo padrao ja usado e validado no RPG De Mesa e no Aprovei
 * Simulado (ver ModelCatalog.java dos dois).
 */

const LIST_URL = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=';
const VALIDADE_MS = 6 * 60 * 60 * 1000; // 6 horas

let cache = { chave: '', quando: 0, modelos: null };

/** "gemini-3.5-flash-lite" -> 3.5 ; "gemini-2.0-flash" -> 2.0 ; sem numero -> 0. */
function versao(nome) {
  const m = /(\d+(\.\d+)?)/.exec(nome);
  return m ? parseFloat(m[1]) : 0;
}

/** Nota pra ordenar a reserva: lite (rapido) > flash > pro (ultimo recurso). */
function pontos(nome) {
  const faixa = nome.includes('lite') ? 3 : nome.includes('flash') ? 2 : 1;
  let p = faixa * 1000000 + versao(nome) * 1000;
  if (!nome.includes('preview') && !nome.includes('exp')) p += 100;
  return p;
}

/** Lista crua de modelos que aceitam generateContent. Nunca lanca: sem rede, devolve []. */
async function buscar(apiKey) {
  const valido = cache.modelos && cache.chave === apiKey
    && Date.now() - cache.quando < VALIDADE_MS;
  if (valido) return cache.modelos;

  try {
    const r = await fetch(LIST_URL + apiKey);
    if (!r.ok) return cache.modelos || [];
    const json = await r.json();
    const achados = (json.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => (m.name || '').replace(/^models\//, ''))
      .filter(Boolean);
    if (achados.length) {
      cache = { chave: apiKey, quando: Date.now(), modelos: achados };
    }
    return achados;
  } catch (e) {
    console.warn('nao deu para listar modelos do Gemini', e);
    return cache.modelos || [];
  }
}

function juntar(primeiro, depois) {
  const set = new Set(primeiro);
  depois.forEach(m => set.add(m));
  return Array.from(set);
}

/**
 * Modelos que geram imagem: so os que tem "image" no nome — o Gemini nao tem
 * outro jeito de marcar isso na listagem publica.
 */
export async function modelosImagem(apiKey, preferidos) {
  const disponiveis = await buscar(apiKey);
  if (!disponiveis.length) return preferidos;

  const ordem = preferidos.filter(p => disponiveis.includes(p));
  const extras = disponiveis.filter(m => !ordem.includes(m)
    && m.startsWith('gemini-') && m.includes('image'));
  extras.sort((a, b) => pontos(b) - pontos(a));
  ordem.push(...extras);
  return ordem.length ? juntar(ordem, preferidos) : preferidos;
}

// ------------------------------------------------------------ chamada Gemini

const MODELOS_IMAGEM_RESERVA = [
  'gemini-2.5-flash-image', 'gemini-2.0-flash-preview-image-generation'
];

async function chamarUmModelo(apiKey, modelo, parts, generationConfig) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + modelo + ':generateContent?key=' + apiKey;
  const corpo = { contents: [{ parts }], generationConfig };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + texto);
  const json = JSON.parse(texto);
  return json.candidates[0].content.parts;
}

/** Tenta cada modelo na ordem; para na primeira resposta ou em erro de chave/pedido. */
async function tentarModelos(apiKey, modelos, parts, generationConfig) {
  let ultimoErro = new Error('nenhum modelo disponivel');
  for (const modelo of modelos) {
    try {
      return await chamarUmModelo(apiKey, modelo, parts, generationConfig);
    } catch (e) {
      ultimoErro = e;
      const msg = String(e.message || e);
      if (msg.includes('400') || msg.includes('401') || msg.includes('403')) break;
    }
  }
  throw ultimoErro;
}

/** "data:image/jpeg;base64,AAAA..." -> { inlineData: { mimeType, data } } pro corpo da API. */
function fotoParaParte(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
  return m ? { inlineData: { mimeType: m[1], data: m[2] } } : null;
}

/**
 * Gera a IMAGEM pronta do encarte, mandando as fotos anexadas (produto/logo)
 * junto do pedido para o modelo usar como referencia visual real. Volta um
 * data-URL (base64) — quem chama sobe isso pro Drive (Sync.chamar) antes de
 * gravar a URL no registro.
 *
 * IMPORTANTE: sem "responseModalities: ['TEXT','IMAGE']" o Gemini responde
 * so texto (ou erro) e nunca devolve a imagem — foi descoberto assim, o app
 * "gerava" e nunca vinha nada.
 */
export async function gerarImagemIA(apiKey, prompt, fotos) {
  const parts = [{ text: prompt }];
  (fotos || []).forEach(f => {
    const parte = fotoParaParte(f);
    if (parte) parts.push(parte);
  });
  const modelos = await modelosImagem(apiKey, MODELOS_IMAGEM_RESERVA);
  const resposta = await tentarModelos(apiKey, modelos, parts, {
    temperature: 0.9,
    responseModalities: ['TEXT', 'IMAGE']
  });
  const imagem = resposta.find(p => p.inlineData || p.inline_data);
  if (!imagem) throw new Error('o modelo nao devolveu uma imagem');
  const dado = imagem.inlineData || imagem.inline_data;
  const mime = dado.mimeType || dado.mime_type || 'image/png';
  return 'data:' + mime + ';base64,' + dado.data;
}
