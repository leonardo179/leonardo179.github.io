/*
 * Duas telas que fecham o app:
 *  • Realizados — o outro lado do painel: o que a equipe JA fez hoje;
 *  • Setores — o dono cria, renomeia e desativa os setores da loja.
 */
import { Dados } from './dados.js?v=202607281839';
import * as D from './dominio.js?v=202607281839';
import { h, cabecalho, cartao, campo, lista, barra, vazio, aviso, toast, confirmar } from './ui.js?v=202607281839';
import { rotinasDeHoje, statusRotina } from './modulos.js?v=202607281839';

let ir, voltar, render;

export function instalarTelasExtra(api) {
  ir = api.ir; voltar = api.voltar; render = api.render;
  realizados(api.registrar);
  setores(api.registrar);
}

// ----------------------------------------------------------------- realizados

function realizados(registrar) {
  registrar('realizados', params => {
    const a = D.Acesso;
    const aba = params.aba || 'tarefas';
    const hoje = D.hoje();

    const troca = h('div', { estilo: { display: 'flex', gap: '8px', margin: '4px 0 10px' } }, [
      aba1('Tarefas feitas', aba === 'tarefas', () => { ir('realizados', { aba: 'tarefas' }); render(); }),
      aba1('Checklists', aba === 'checklists', () => { ir('realizados', { aba: 'checklists' }); render(); })
    ]);

    let corpo;
    if (aba === 'checklists') {
      const respostas = Dados.ativos('respostas')
        .filter(r => r.data === hoje && a.veSetor(r.setor) && a.vePessoa(r.funcionario, r.autor))
        .sort((x, y) => y.atualizadoEm - x.atualizadoEm);

      corpo = respostas.length ? respostas.map(r => {
        const marcados = (r.itens || []).filter(i => i.marcado);
        const faltando = (r.itens || []).filter(i => !i.marcado);
        const pct = r.itens.length ? Math.round(marcados.length * 100 / r.itens.length) : 0;
        const obs = (r.itens || []).filter(i => (i.observacao || '').trim())
          .map(i => '• ' + i.texto + ': ' + i.observacao);
        return cartao({
          cor: r.concluido ? (pct === 100 ? '#388E3C' : '#F57C00') : '#9E9E9E',
          icone: D.setor(r.setor).icone,
          titulo: D.setor(r.setor).nome,
          sub: (r.concluido ? '✔ Entregue por ' : 'Em andamento por ') + (r.funcionario || r.autor)
            + ' as ' + new Date(r.atualizadoEm).toTimeString().slice(0, 5),
          extra: marcados.length + ' de ' + r.itens.length + ' itens marcados'
            + (faltando.length ? '\nFaltou: ' + faltando.map(i => i.texto).join('; ') : ''),
          selo: { texto: pct + '%', cor: pct === 100 ? '#388E3C' : '#F57C00' },
          destaque: (obs.length || (r.observacaoGeral || '').trim())
            ? { texto: [(r.observacaoGeral || '').trim() ? '📝 ' + r.observacaoGeral : '', ...obs]
                .filter(Boolean).join('\n'), cor: '#6D4C41' }
            : null
        });
      }) : [vazio('Nenhum checklist marcado hoje ainda.')];

    } else {
      const feitas = [];
      rotinasDeHoje().forEach(r => {
        const e = Dados.ativos('execucoes').find(x => x.rotinaId === r.id && x.data === hoje);
        if (!e || !e.feita) return;
        if (!a.vePessoa(e.funcionario, e.autor)) return;
        feitas.push({ r, e });
      });
      feitas.sort((x, y) => (x.e.concluidaAs || '').localeCompare(y.e.concluidaAs || ''));

      const temperaturas = Dados.ativos('leituras')
        .filter(l => l.data === hoje && l.registradaAs && a.veSetor(l.setor)
          && a.vePessoa(l.funcionario, l.autor));

      corpo = [
        ...feitas.map(({ r, e }) => cartao({
          cor: e.atrasada ? '#F9A825' : '#388E3C',
          icone: r.icone || '🕒',
          titulo: r.horario + '  ' + r.titulo,
          sub: D.setor(r.setor).icone + ' ' + D.setor(r.setor).nome
            + '  •  feita as ' + e.concluidaAs + ' por ' + (e.funcionario || e.autor),
          extra: e.observacao,
          selo: { texto: e.atrasada ? 'com atraso' : 'no prazo',
            cor: e.atrasada ? '#F9A825' : '#388E3C' }
        })),
        ...temperaturas.map(l => cartao({
          cor: l.foraDaFaixa ? '#D32F2F' : '#388E3C',
          icone: '🌡',
          titulo: l.horarioAlvo + '  ' + l.equipamento,
          sub: 'Conferida as ' + l.registradaAs + ' por ' + (l.funcionario || l.autor),
          selo: { texto: D.numero(l.temperatura) + ' C',
            cor: l.foraDaFaixa ? '#D32F2F' : '#388E3C' },
          destaque: l.foraDaFaixa
            ? { texto: '⚠ Fora da faixa. ' + (l.acaoTomada || 'Sem acao registrada.'), cor: '#D32F2F' }
            : null
        }))
      ];
      if (!corpo.length) corpo = [vazio('Nada concluido hoje ainda.')];
    }

    return h('div', {}, [
      cabecalho({ titulo: '✔ Realizado hoje',
        sub: 'O que a equipe ja entregou em ' + D.data(hoje), voltar }),
      h('main', {}, [troca, ...corpo])
    ]);
  });
}

function aba1(texto, ativa, onclick) {
  return h('div', {
    onclick,
    estilo: {
      flex: '1', textAlign: 'center', padding: '10px', borderRadius: '12px', cursor: 'pointer',
      background: ativa ? '#2E7D32' : '#fff', color: ativa ? '#fff' : '#6B7A6B',
      fontWeight: ativa ? '700' : '400', fontSize: '14px'
    }
  }, texto);
}

// -------------------------------------------------------------------- setores

function setores(registrar) {
  registrar('setores', () => {
    const a = D.Acesso;
    if (!a.configuraLoja()) { ir('painel'); return h('div'); }

    const lista = D.setoresAtivos();
    const emUso = chave => contarUso(chave);

    const cartoes = lista.map(s => cartao({
      cor: s.cor,
      icone: s.icone,
      titulo: s.nome,
      sub: 'chave: ' + s.chave,
      extra: emUso(s.chave) + ' registro(s) usam este setor',
      botoes: [
        { texto: 'Editar', onclick: () => formSetor(s) },
        { texto: 'Remover', sec: true, onclick: () => removerSetor(s) }
      ]
    }));

    return h('div', {}, [
      cabecalho({ titulo: '🏷 Setores da loja',
        sub: lista.length + ' setores  •  o nome pode ser mudado quando quiser', voltar }),
      h('main', {}, [
        aviso('Estes sao os setores que aparecem em todo o app: nos checklists, no '
          + 'cronograma, nas validades e no cadastro da equipe. Renomear e seguro — '
          + 'o historico continua ligado ao setor.', '#00897B'),
        ...cartoes
      ]),
      h('button', { class: 'fab', onclick: () => formSetor(null) }, 'Novo setor')
    ]);
  });
}

function contarUso(chave) {
  const listas = ['produtos', 'checklists', 'respostas', 'paletes', 'quebras', 'rotinas',
    'contagens', 'equipamentos', 'rupturas', 'desistencias', 'usuarios', 'funcionarios'];
  let n = 0;
  listas.forEach(l => {
    Dados.ativos(l).forEach(x => {
      if (x.setor === chave) n++;
      else if (Array.isArray(x.setores) && x.setores.includes(chave)) n++;
    });
  });
  return n;
}

/** Garante que a lista de setores exista nos dados antes de mexer nela. */
function materializarSetores(autor) {
  if (Dados.ativos('setores').length) return;
  D.setoresAtivos().forEach((s, i) => {
    Dados.d.setores.push(Dados.novo({
      chave: s.chave, nome: s.nome, icone: s.icone, cor: s.cor, ordem: i, ativo: true, autor
    }));
  });
  Dados.salvar();
}

const CORES = ['#2E7D32', '#43A047', '#0277BD', '#6A1B9A', '#D81B60', '#C62828',
  '#EF6C00', '#F9A825', '#795548', '#00897B', '#455A64', '#8D6E63'];

function formSetor(existente) {
  const a = D.Acesso;
  materializarSetores(a.nome());

  const s = existente
    ? Dados.d.setores.find(x => x.chave === existente.chave && !x.excluido)
    : Dados.novo({ chave: '', nome: '', icone: '🛒', cor: '#2E7D32', ordem: 99, ativo: true });

  const nome = campo('Nome do setor', s.nome);
  const icone = campo('Emoji do setor', s.icone || '🛒');
  const cor = lista('Cor', CORES.map(c => ({ valor: c, texto: c })), s.cor || '#2E7D32');
  const previa = h('div', { class: 'cartao', estilo: { marginTop: '12px' } }, []);

  function atualizarPrevia() {
    previa.replaceChildren(
      h('div', { class: 'faixa', estilo: { background: cor.input.value } }),
      h('div', { class: 'corpo' }, [
        h('div', { class: 'linha' }, [
          h('span', { estilo: { fontSize: '19px' } }, icone.input.value || '🛒'),
          h('div', { class: 'titulo', texto: nome.input.value || 'Nome do setor' })
        ]),
        h('div', { class: 'sub', texto: 'Assim ele aparece nas listas do app' })
      ]));
  }
  [nome, icone].forEach(c => c.input.addEventListener('input', atualizarPrevia));
  cor.input.addEventListener('change', atualizarPrevia);
  atualizarPrevia();

  function salvar() {
    const texto = nome.input.value.trim();
    if (!texto) return toast('Falta o nome do setor.');
    if (!s.chave) {
      // A chave e o que os registros guardam: gerada uma vez, nunca muda.
      const base = texto.toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '').slice(0, 12);
      let chave = base || 'SETOR';
      let n = 2;
      while (Dados.d.setores.some(x => x.chave === chave && !x.excluido)) chave = base + (n++);
      s.chave = chave;
    }
    s.nome = texto;
    s.icone = icone.input.value.trim() || '🛒';
    s.cor = cor.input.value;
    Dados.gravar('setores', s, a.nome());
    toast('Setor salvo.');
    ir('setores');
    render();
  }

  document.getElementById('app').replaceChildren(h('div', {}, [
    cabecalho({ titulo: existente ? '🏷 ' + s.nome : '🏷 Novo setor',
      sub: 'Ele passa a aparecer em todo o app',
      voltar: () => { ir('setores'); render(); } }),
    h('main', {}, [nome.el, icone.el, cor.el, previa]),
    barra([{ texto: 'Salvar', onclick: salvar }])
  ]));
}

function removerSetor(s) {
  const a = D.Acesso;
  materializarSetores(a.nome());
  const usos = contarUso(s.chave);
  const alvo = Dados.d.setores.find(x => x.chave === s.chave && !x.excluido);
  if (!alvo) return;

  confirmar('Remover setor',
    usos
      ? `${s.nome} esta em ${usos} registro(s). Ele some das listas novas, mas o `
        + 'historico continua mostrando o nome. Continuar?'
      : `Remover o setor ${s.nome}?`,
    () => {
      Dados.excluir('setores', alvo, a.nome());
      toast('Setor removido.');
      render();
    });
}
