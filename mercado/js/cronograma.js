/*
 * Cadastro das tarefas do cronograma.
 *
 * A tarefa tem uma JANELA, nao um instante: "limpar o fatiador entre 15:00 e
 * 16:00". Dentro da janela e hora de fazer; passou do fim sem marcar, fica
 * ATRASADA e o dono e avisado.
 */
import { Dados } from './dados.js?v=202607282211';
import * as D from './dominio.js?v=202607282211';
import { h, cabecalho, cartao, campo, area, lista, barra, vazio, aviso, toast, confirmar } from './ui.js?v=202607282211';
import { fimDaJanela, janelaTexto } from './modulos.js?v=202607282211';

let ir, render;

export function instalarCronograma(api) {
  ir = api.ir;
  render = api.render;
}

export const TIPOS_ROTINA = [
  { valor: 'LIMPEZA', texto: '🧽  Limpeza', icone: '🧽' },
  { valor: 'REPOSICAO', texto: '📥  Reposicao', icone: '📥' },
  { valor: 'TEMPERATURA', texto: '🌡  Aferir temperatura', icone: '🌡' },
  { valor: 'CONFERENCIA', texto: '🔍  Conferencia', icone: '🔍' },
  { valor: 'DESCARTE', texto: '🗑  Descarte / quebras', icone: '🗑' },
  { valor: 'OUTRO', texto: '📌  Outra tarefa', icone: '📌' }
];

const NOMES_DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

const opcoesSetor = () =>
  D.setoresAtivos().map(s => ({ valor: s.chave, texto: s.icone + ' ' + s.nome }));

export function diasTexto(r) {
  const dias = r.dias || [];
  if (dias.length && dias.every(Boolean)) return 'Todos os dias';
  return NOMES_DIAS.filter((_, i) => dias[i]).join(' ') || 'Nenhum dia';
}

/** Todas as tarefas do cronograma, nao so as de hoje. */
export function listaTodasRotinas() {
  const a = D.Acesso;
  const todas = Dados.ativos('rotinas')
    .filter(r => a.veSetor(r.setor))
    .sort((x, y) => (x.horario || '').localeCompare(y.horario || ''));

  document.getElementById('app').replaceChildren(h('div', {}, [
    cabecalho({ titulo: '🕒 Todas as tarefas',
      sub: todas.length + ' tarefa(s) no cronograma',
      voltar: () => { ir('cronograma'); render(); } }),
    h('main', {}, todas.length ? todas.map(r => cartao({
      cor: D.setor(r.setor).cor,
      icone: r.icone || '🕒',
      titulo: janelaTexto(r) + '  •  ' + r.titulo,
      sub: D.setor(r.setor).icone + ' ' + D.setor(r.setor).nome + '  •  ' + diasTexto(r)
        + (r.responsavel ? '  •  ' + r.responsavel : ''),
      extra: r.instrucao,
      selo: r.ativo === false ? { texto: 'desligada', cor: '#9E9E9E' } : null,
      botoes: a.configura(r.setor) ? [{ texto: 'Editar', onclick: () => formRotina(r) }] : null
    })) : [vazio('Nenhuma tarefa cadastrada.')]),
    a.configura(null)
      ? h('button', { class: 'fab', onclick: () => formRotina(null) }, 'Nova tarefa') : null
  ]));
}

/** Cadastro da tarefa: o que, onde, entre que horas e em quais dias. */
export function formRotina(existente) {
  const a = D.Acesso;
  const r = existente || Dados.novo({
    titulo: '', setor: a.dono() ? 'MERCEARIA' : a.meuSetor(), tipo: 'LIMPEZA', icone: '🧽',
    horario: '08:00', horarioFim: '09:00', tolerancia: 60,
    dias: [true, true, true, true, true, true, true],
    responsavel: '', instrucao: '', ativo: true
  });

  const titulo = campo('Tarefa', r.titulo);
  const tipo = lista('Tipo', TIPOS_ROTINA, r.tipo || 'LIMPEZA');
  const setorSel = lista('Setor', opcoesSetor(), r.setor);
  const inicio = campo('Fazer a partir das', r.horario || '08:00', { type: 'time' });
  const fim = campo('Ate as (depois disso fica ATRASADA)', fimDaJanela(r), { type: 'time' });
  const responsavel = campo('Responsavel (opcional)', r.responsavel);
  const instrucao = area('Instrucao para a equipe (opcional)', r.instrucao);
  const explicacao = aviso('', '#2E7D32');

  // Dias da semana como pilulas que ligam e desligam.
  const dias = (r.dias || []).slice();
  while (dias.length < 7) dias.push(true);
  const linhaDias = h('div', { estilo: { display: 'flex', gap: '4px', marginTop: '4px' } },
    NOMES_DIAS.map((nome, i) => {
      const pill = h('div', {
        estilo: { flex: '1', textAlign: 'center', padding: '10px 0', borderRadius: '14px',
                  cursor: 'pointer', fontSize: '13px' }
      }, nome);
      const pintar = () => {
        pill.style.background = dias[i] ? '#2E7D32' : '#fff';
        pill.style.color = dias[i] ? '#fff' : '#6B7A6B';
        pill.style.border = '1px solid ' + (dias[i] ? '#2E7D32' : '#E1E7E0');
      };
      pill.addEventListener('click', () => { dias[i] = !dias[i]; pintar(); atualizar(); });
      pintar();
      return pill;
    }));

  function atualizar() {
    const minutos = diferencaMinutos(inicio.input.value, fim.input.value);
    explicacao.textContent = minutos > 0
      ? `A equipe recebe o aviso as ${inicio.input.value} e tem ate ${fim.input.value} `
        + `(${minutos} min) para marcar. Passou disso, a tarefa fica ATRASADA e o dono e avisado.`
      : 'O horario de fim precisa ser depois do inicio.';
  }
  [inicio, fim].forEach(c => c.input.addEventListener('input', atualizar));
  atualizar();

  function salvar() {
    if (!titulo.input.value.trim()) return toast('Falta o nome da tarefa.');
    if (!dias.some(Boolean)) return toast('Escolha pelo menos um dia da semana.');
    const minutos = diferencaMinutos(inicio.input.value, fim.input.value);
    if (minutos <= 0) return toast('O horario de fim precisa ser depois do inicio.');

    const escolhido = TIPOS_ROTINA.find(t => t.valor === tipo.input.value) || TIPOS_ROTINA[0];
    Object.assign(r, {
      titulo: titulo.input.value.trim(),
      tipo: escolhido.valor,
      icone: escolhido.icone,
      setor: setorSel.input.value,
      horario: inicio.input.value,
      horarioFim: fim.input.value,
      tolerancia: minutos,          // e este numero que o app Android usa
      dias: dias.slice(),
      responsavel: responsavel.input.value.trim(),
      instrucao: instrucao.input.value.trim(),
      ativo: true
    });
    Dados.gravar('rotinas', r, a.nome());
    toast('Tarefa salva no cronograma.');
    ir('cronograma');
    render();
  }

  document.getElementById('app').replaceChildren(h('div', {}, [
    cabecalho({ titulo: existente ? '🕒 Editar tarefa' : '🕒 Nova tarefa',
      sub: 'Ela vira aviso na janela e alerta se passar do fim',
      voltar: () => { ir('cronograma'); render(); } }),
    h('main', {}, [
      titulo.el, tipo.el, setorSel.el,
      h('div', { class: 'rotulo-secao' }, 'Janela de horario'),
      inicio.el, fim.el, explicacao,
      h('div', { class: 'rotulo-secao' }, 'Dias da semana'),
      linhaDias,
      responsavel.el, instrucao.el
    ]),
    barra([
      { texto: 'Salvar', onclick: salvar },
      existente ? { texto: 'Excluir', classe: 'vermelho', onclick: () => confirmar('Excluir tarefa',
        'Remover "' + r.titulo + '" do cronograma?', () => {
          Dados.excluir('rotinas', r, a.nome());
          ir('cronograma');
          render();
        }) } : null
    ])
  ]));
}

function diferencaMinutos(inicio, fim) {
  const [h1, m1] = (inicio || '00:00').split(':').map(Number);
  const [h2, m2] = (fim || '00:00').split(':').map(Number);
  let min = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (min < 0) min += 24 * 60;      // janela que vira a noite
  return min;
}
