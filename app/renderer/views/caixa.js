// Caixa: abertura, sangria/suprimento, fechamento com conferência e histórico
import { h, icon, btn, card, kpi, money, dateTime, time, toast, modal, field, input, moneyInput, parseMoney, skeleton, emptyState } from '../ui.js';
import { get, post } from '../api.js';
import { state } from '../app.js';

function amountModal({ title, icon: name, label, hint, confirm, withDescription = false, onSubmit }) {
  const value = input({ value: '0,00', money: true, inputmode: 'decimal' });
  const desc = input({ maxlength: 120, placeholder: 'Opcional' });
  modal({
    title,
    icon: name,
    body: h('div', { class: 'stack' }, field(label, value, hint), withDescription ? field('Descrição', desc) : null),
    actions: [{ label: 'Cancelar' }, {
      label: confirm, kind: 'primary', icon: 'check', submit: true,
      onClick: async () => {
        const amount = parseMoney(value.value);
        if (!(amount >= 0)) throw new Error('Valor inválido');
        await onSubmit(amount, desc.value);
      },
    }],
  });
  setTimeout(() => value.select(), 40);
}

export default {
  id: 'caixa',
  label: 'Caixa',
  subtitle: 'Abertura, sangrias, suprimentos e fechamento com conferência do dinheiro.',
  icon: 'wallet',
  group: 'Gestão',
  permission: 'cash.operate',
  render(container, { actions, setSubtitle }) {
    let data = null;

    async function load() {
      try {
        data = await get('/api/admin/cash');
        draw();
      } catch (error) {
        container.replaceChildren(h('div', { class: 'card' }, emptyState('Não foi possível carregar o caixa', error.message, 'wifiOff')));
      }
    }

    // erros aparecem dentro da janela aberta
    const run = (fn) => async (...args) => {
      data = await fn(...args);
      draw();
    };

    const open = () => amountModal({
      title: 'Abrir caixa', icon: 'wallet', label: 'Dinheiro na gaveta (troco inicial)', confirm: 'Abrir caixa',
      onSubmit: run(async (amount) => { const r = await post('/api/admin/cash/open', { amount }); toast('Caixa aberto'); return r; }),
    });

    const movement = (kind) => amountModal({
      title: kind === 'sangria' ? 'Sangria' : 'Suprimento',
      icon: kind === 'sangria' ? 'arrowDown' : 'arrowUp',
      label: 'Valor', hint: kind === 'sangria' ? 'Dinheiro retirado da gaveta (ex.: pagamento de fornecedor, depósito)' : 'Dinheiro colocado na gaveta (ex.: reforço de troco)',
      confirm: 'Registrar',
      withDescription: true,
      onSubmit: run(async (amount, description) => { const r = await post('/api/admin/cash/movement', { kind, amount, description }); toast('Movimento registrado'); return r; }),
    });

    function close() {
      const c = data.current;
      const counted = input({ value: moneyInput(c.expectedCash), money: true, inputmode: 'decimal' });
      const notes = input({ maxlength: 300, placeholder: 'Opcional' });
      const diff = h('div', { class: 'diff num' });
      const update = () => {
        const d = Math.round((parseMoney(counted.value) - c.expectedCash) * 100) / 100;
        diff.className = `diff num ${d < 0 ? 'neg' : d > 0 ? 'pos' : ''}`;
        diff.textContent = Number.isFinite(d) ? (d === 0 ? 'Confere ✓' : `${d > 0 ? 'Sobra' : 'Falta'} ${money(Math.abs(d))}`) : '—';
      };
      counted.addEventListener('input', update);
      update();
      modal({
        title: 'Fechar caixa',
        icon: 'lock',
        body: h('div', { class: 'stack' },
          h('div', { class: 'lines num' },
            h('div', {}, h('span', { class: 'muted' }, 'Abertura'), h('span', {}, money(c.openingAmount))),
            h('div', {}, h('span', { class: 'muted' }, 'Vendas em dinheiro'), h('span', {}, money(c.byPayment.dinheiro.total))),
            h('div', {}, h('span', { class: 'muted' }, 'Suprimentos'), h('span', { class: 'pos' }, `+ ${money(c.supplies)}`)),
            h('div', {}, h('span', { class: 'muted' }, 'Sangrias'), h('span', { class: 'neg' }, `− ${money(c.withdrawals)}`)),
            h('div', { class: 'total' }, h('span', {}, 'Esperado na gaveta'), h('span', {}, money(c.expectedCash)))),
          field('Dinheiro contado na gaveta', counted),
          diff,
          field('Observações', notes)),
        actions: [{ label: 'Cancelar' }, {
          label: 'Fechar caixa', kind: 'primary', icon: 'lock', submit: true,
          onClick: run(async () => {
            const r = await post('/api/admin/cash/close', { countedAmount: parseMoney(counted.value), notes: notes.value });
            toast(`Caixa fechado. ${r.closed.difference === 0 ? 'Valores conferem.' : `Diferença: ${money(r.closed.difference)}`}`);
            return r;
          }),
        }],
      });
    }

    function history() {
      if (!data.history.length) return emptyState('Nenhum caixa fechado ainda', 'Os fechamentos aparecem aqui.', 'history');
      return h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Período'), h('th', {}, 'Responsável'), h('th', { class: 'right' }, 'Esperado'), h('th', { class: 'right' }, 'Contado'), h('th', { class: 'right' }, 'Diferença'))),
        h('tbody', {}, data.history.map(s => h('tr', {},
          h('td', { class: 'num' }, dateTime(s.openedAt), h('div', { class: 'faint' }, `até ${dateTime(s.closedAt)}`)),
          h('td', {}, s.closedBy, s.notes ? h('div', { class: 'faint' }, s.notes) : null),
          h('td', { class: 'right num' }, money(s.expectedAmount)), h('td', { class: 'right num' }, money(s.countedAmount)),
          h('td', { class: 'right num' }, s.difference === 0 ? h('span', { class: 'pill pill--ok' }, icon('check'), 'OK') : h('span', { class: `pill ${s.difference < 0 ? 'pill--danger' : 'pill--warn'}` }, money(s.difference)))))));
    }

    function draw() {
      actions.replaceChildren();
      const c = data.current;
      if (!c) {
        setSubtitle('Abra o caixa no início do expediente informando o troco da gaveta.');
        container.replaceChildren(
          h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '1.2rem', padding: '1.6rem' } },
            h('div', { class: 'empty__icon', style: { width: '64px', height: '64px', background: 'var(--primary-soft)', color: 'var(--primary)', borderStyle: 'solid', borderColor: 'transparent' } }, icon('wallet', { size: 28 })),
            h('div', { style: { flex: 1 } }, h('h2', { style: { fontSize: '18px' } }, 'Caixa fechado'),
              h('p', { class: 'muted', style: { margin: '0.3rem 0 0' } }, 'As vendas do site entram sozinhas pela forma de pagamento. Você só controla o dinheiro da gaveta.')),
            btn('Abrir caixa', { icon: 'play', kind: 'primary', size: 'lg', onclick: open })),
          card({ title: 'Últimos fechamentos', icon: 'history', flush: true }, history()));
        return;
      }

      setSubtitle(`Aberto às ${time(c.openedAt)} de ${new Date(c.openedAt).toLocaleDateString('pt-BR')} por ${c.openedBy}.`);
      actions.append(
        btn('Suprimento', { icon: 'arrowUp', size: 'sm', onclick: () => movement('suprimento') }),
        btn('Sangria', { icon: 'arrowDown', size: 'sm', onclick: () => movement('sangria') }),
        btn('Fechar caixa', { icon: 'lock', kind: 'primary', size: 'sm', onclick: close }));

      container.replaceChildren(
        h('div', { class: 'kpis' },
          kpi({ label: 'Esperado na gaveta', value: money(c.expectedCash), hint: 'abertura + dinheiro + suprimentos − sangrias', icon: 'cash', tone: 'accent' }),
          kpi({ label: 'Vendas do caixa', value: money(c.revenue), hint: `${c.orders} pedido${c.orders === 1 ? '' : 's'}${c.cancelled ? ` • ${c.cancelled} cancelado(s)` : ''}`, icon: 'trend' }),
          kpi({ label: 'Pix', value: money(c.byPayment.pix.total), hint: `${c.byPayment.pix.orders} pedido(s)`, icon: 'pix' }),
          kpi({ label: 'Cartão', value: money(c.byPayment.cartao.total), hint: `${c.byPayment.cartao.orders} pedido(s)`, icon: 'card' }),
          kpi({ label: 'Dinheiro', value: money(c.byPayment.dinheiro.total), hint: `${c.byPayment.dinheiro.orders} pedido(s)`, icon: 'cash' })),
        h('div', { class: 'grid-2' },
          card({ title: 'Movimentos da gaveta', icon: 'wallet', flush: true },
            h('table', { class: 'table' }, h('tbody', {},
              h('tr', {}, h('td', { class: 'num faint', style: { width: '64px' } }, time(c.openedAt)), h('td', {}, h('strong', {}, 'Abertura'), h('div', { class: 'faint' }, c.openedBy)), h('td', { class: 'right num' }, money(c.openingAmount))),
              c.movements.map(m => h('tr', {},
                h('td', { class: 'num faint', style: { width: '64px' } }, time(m.at)),
                h('td', {}, h('strong', {}, m.kind === 'sangria' ? 'Sangria' : 'Suprimento'), h('div', { class: 'faint' }, [m.description, m.by].filter(Boolean).join(' • '))),
                h('td', { class: `right num ${m.kind === 'sangria' ? 'neg' : 'pos'}` }, h('strong', {}, `${m.kind === 'sangria' ? '−' : '+'} ${money(m.amount)}`))))))),
          card({ title: 'Últimos fechamentos', icon: 'history', flush: true }, history())));
    }

    container.append(h('div', { class: 'kpis' }, Array.from({ length: 4 }, () => h('div', { class: 'skeleton', style: { height: '96px', borderRadius: '13px' } }))), h('div', { class: 'card' }, skeleton(5)));
    load();
    // vendas do site entram sozinhas: atualiza junto com o quadro
    state.listeners.add((orders, fresh) => { if (fresh.length && data?.current) load(); });
  },
};
