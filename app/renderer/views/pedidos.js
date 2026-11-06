// Quadro de pedidos em tempo real (atualizado a cada 5 s pelo app.js)
import {
  h, icon, btn, money, time, minutesSince, elapsed, phone, PAYMENT, PAYMENT_ICON, STATUS, statusPill, paymentPill,
  toast, modal, field, textarea, searchInput, dateTime, kpi, emptyState,
} from '../ui.js';
import { get, patch } from '../api.js';
import { state, can, refreshOrders, printOrder } from '../app.js';

const LATE_MIN = 25;
const WARN_MIN = 15;
const COLUMNS = [
  { id: 'novo', title: 'Novos', statuses: ['novo'], empty: ['Nenhum pedido novo', 'Os pedidos do site aparecem aqui na hora.'] },
  { id: 'preparando', title: 'Em preparo', statuses: ['preparando'], empty: ['Chapa livre', 'Inicie o preparo de um pedido novo.'] },
  { id: 'expedicao', title: 'Prontos e em entrega', statuses: ['pronto', 'saiu_entrega'], empty: ['Nada esperando', 'Pedidos prontos ou na rua ficam aqui.'] },
  { id: 'finalizados', title: 'Finalizados', statuses: ['entregue', 'cancelado'], empty: ['Nada finalizado', 'Últimas 12 horas.'] },
];

// Próximo passo principal de cada pedido
function primaryAction(order) {
  switch (order.status) {
    case 'novo': return { to: 'preparando', label: 'Iniciar preparo', icon: 'flame' };
    case 'preparando': return order.deliveryType === 'delivery'
      ? { to: 'saiu_entrega', label: 'Saiu para entrega', icon: 'bike' }
      : { to: 'pronto', label: 'Pronto p/ retirada', icon: 'bag' };
    case 'pronto': return { to: 'entregue', label: 'Cliente retirou', icon: 'check' };
    case 'saiu_entrega': return { to: 'entregue', label: 'Entregue', icon: 'check' };
    default: return null;
  }
}

const busy = new Set();

export async function changeStatus(order, to, cancelReason) {
  if (busy.has(order.id)) return;
  busy.add(order.id);
  try {
    await patch(`/api/admin/orders/${order.id}`, { status: to, ...(cancelReason ? { cancelReason } : {}) });
    toast(`${order.code}: ${STATUS[to].label}`);
    await refreshOrders();
  } catch (error) {
    toast(error.message, 'error');
    await refreshOrders();
  } finally {
    busy.delete(order.id);
  }
}

export function cancelOrder(order, after) {
  const reason = textarea('', { placeholder: 'Ex.: Cliente desistiu, endereço fora da área, produto em falta…', maxlength: 200 });
  modal({
    title: `Cancelar pedido ${order.code}`,
    icon: 'xCircle',
    body: h('div', { class: 'stack' },
      h('p', { class: 'muted', style: { margin: 0 } }, `${order.customerName} • ${money(order.total)}. O cliente verá o pedido como cancelado no acompanhamento. Avise pelo WhatsApp.`),
      field('Motivo do cancelamento', reason)),
    actions: [
      { label: 'Voltar' },
      {
        label: 'Cancelar pedido', kind: 'danger', icon: 'xCircle',
        onClick: async () => {
          if (reason.value.trim().length < 3) throw new Error('Informe o motivo');
          await changeStatus(order, 'cancelado', reason.value.trim());
          after?.();
        },
      },
    ],
  });
}

const waLink = (order) => `https://wa.me/55${order.customerPhone.replace(/^55/, '')}`;

function addressLines(order) {
  if (order.deliveryType !== 'delivery' || !order.address) return null;
  const a = order.address;
  return [`${a.street}, ${a.number}${a.compl ? ` — ${a.compl}` : ''}`, `${order.district}${a.cep ? ` • CEP ${a.cep}` : ''}`, a.ref ? `Ref.: ${a.ref}` : null].filter(Boolean);
}

function itemsList(order) {
  return h('ul', { class: 'order__items' }, order.items.map(item => {
    const mods = [...(item.extras || []).map(e => `+ ${e.name}`), ...(item.removals || [])];
    return h('li', {},
      h('div', {}, h('b', {}, `${item.qty}×`), ' ', h('strong', {}, item.name)),
      mods.length ? h('span', {}, mods.join(' • ')) : null,
      item.notes ? h('em', {}, `“${item.notes}”`) : null);
  }));
}

const typeLabel = (order) => h('span', { class: 'order__type' }, icon(order.deliveryType === 'delivery' ? 'bike' : 'bag'), order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada');

/** Janela com todos os dados do pedido e o histórico de quem mudou cada status */
export async function openOrderDetail(id) {
  let order;
  try {
    ({ order } = await get(`/api/admin/orders/${id}`));
  } catch (error) {
    return toast(error.message, 'error');
  }
  const next = primaryAction(order);
  const canCancel = can('orders.cancel') && !['entregue', 'cancelado'].includes(order.status);
  const addr = addressLines(order);
  return modal({
    title: `Pedido ${order.code}`,
    icon: 'receipt',
    wide: true,
    body: h('div', { class: 'detail' },
      h('div', {},
        h('section', {}, h('div', { class: 'row' }, statusPill(order.status), h('span', { class: 'pill' }, icon(order.deliveryType === 'delivery' ? 'bike' : 'bag'), order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'), h('span', { class: 'faint' }, dateTime(order.createdAt)))),
        order.cancelReason ? h('section', {}, h('div', { class: 'banner banner--danger', style: { margin: 0 } }, icon('alert'), `Motivo do cancelamento: ${order.cancelReason}`)) : null,
        h('section', {}, h('h3', {}, 'Itens'), itemsList(order)),
        h('section', {}, h('h3', {}, 'Valores'), h('div', { class: 'lines num' },
          h('div', {}, h('span', { class: 'muted' }, 'Subtotal'), h('span', {}, money(order.subtotal))),
          order.discount ? h('div', {}, h('span', { class: 'muted' }, `Desconto ${order.couponCode ? `(${order.couponCode})` : ''}`), h('span', { class: 'pos' }, `− ${money(order.discount)}`)) : null,
          order.deliveryType === 'delivery' ? h('div', {}, h('span', { class: 'muted' }, 'Taxa de entrega'), h('span', {}, order.deliveryFee ? money(order.deliveryFee) : 'Grátis')) : null,
          h('div', { class: 'total' }, h('span', {}, 'Total'), h('span', {}, money(order.total))),
          h('div', {}, h('span', { class: 'muted' }, 'Pagamento'), h('span', { class: 'row', style: { gap: '0.35rem' } }, paymentPill(order.paymentMethod), order.changeFor ? h('span', { class: 'pill pill--warn' }, `troco p/ ${order.changeFor}`) : null))))),
      h('div', {},
        h('section', {}, h('h3', {}, 'Cliente'), h('div', { class: 'contact' },
          h('strong', { class: 'selectable' }, order.customerName),
          h('a', { href: '#', onclick: (e) => { e.preventDefault(); window.gestao.openExternal(waLink(order)); } }, icon('chat'), `${phone(order.customerPhone)} · abrir WhatsApp`),
          addr ? h('div', { class: 'selectable' }, icon('pin'), h('span', {}, addr.map((l, i) => [i ? h('br') : null, l]))) : null)),
        h('section', {}, h('h3', {}, 'Histórico'), h('ul', { class: 'timeline' }, order.history.map(ev =>
          h('li', {}, h('div', {}, h('strong', {}, ev.label), h('small', {}, `${dateTime(ev.at)} • ${ev.by === 'cliente' ? 'pelo site' : ev.by}`)))))))),
    actions: [
      canCancel ? { label: 'Cancelar pedido', kind: 'danger', icon: 'xCircle', left: true, onClick: (close) => { close(); cancelOrder(order); } } : null,
      { label: 'Imprimir', icon: 'printer', onClick: async () => { await printOrder(order); return false; } },
      next && can('orders.status') ? { label: next.label, kind: 'primary', icon: next.icon, onClick: () => changeStatus(order, next.to) } : null,
    ].filter(Boolean),
  });
}

function timer(order) {
  const done = ['entregue', 'cancelado'].includes(order.status);
  if (done) return h('span', { class: 'timer timer--done' }, time(order.updatedAt));
  const mins = minutesSince(order.createdAt);
  const tone = mins >= LATE_MIN && ['novo', 'preparando'].includes(order.status) ? 'late' : mins >= WARN_MIN ? 'warn' : '';
  return h('span', { class: `timer ${tone ? `timer--${tone}` : ''}`, title: `Feito às ${time(order.createdAt)}` }, icon('clock'), elapsed(mins));
}

function orderCard(order, fresh) {
  const done = ['entregue', 'cancelado'].includes(order.status);
  const late = ['novo', 'preparando'].includes(order.status) && minutesSince(order.createdAt) >= LATE_MIN;
  const next = primaryAction(order);
  const addr = addressLines(order);

  return h('article', {
    class: `order order--${order.status} ${late ? 'is-late' : ''} ${done ? 'order--done' : ''} ${fresh ? 'is-fresh' : ''}`,
    tabindex: 0,
    onclick: () => openOrderDetail(order.id),
    onkeydown: (e) => { if (e.key === 'Enter') openOrderDetail(order.id); },
  },
  h('div', { class: 'order__head' }, h('span', { class: 'order__code' }, order.code), typeLabel(order), timer(order)),
  h('div', { class: 'order__who' }, h('strong', {}, order.customerName), h('span', {}, phone(order.customerPhone))),
  addr && !done ? h('div', { class: 'order__addr' }, icon('pin'), h('span', {}, `${addr[0]} — ${order.district}`)) : null,
  done ? null : itemsList(order),
  h('div', { class: 'order__foot' },
    icon(PAYMENT_ICON[order.paymentMethod]), h('span', {}, PAYMENT[order.paymentMethod]),
    order.changeFor ? h('span', { class: 'pill pill--warn' }, `troco ${order.changeFor}`) : null,
    ['pronto', 'saiu_entrega', 'cancelado'].includes(order.status) ? statusPill(order.status) : null,
    h('span', { class: 'order__total num' }, money(order.total))),
  !done && next && can('orders.status') ? h('div', { class: 'order__actions' },
    h('button', { class: 'btn btn--primary btn--sm', disabled: busy.has(order.id), onclick: (e) => { e.stopPropagation(); changeStatus(order, next.to); } }, icon(next.icon), h('span', {}, next.label)),
    h('button', { class: 'btn btn--sm btn--icon', title: 'Imprimir comanda', 'aria-label': 'Imprimir comanda', onclick: (e) => { e.stopPropagation(); printOrder(order); } }, icon('printer'))) : null);
}

export default {
  id: 'pedidos',
  label: 'Pedidos',
  title: 'Quadro de pedidos',
  subtitle: 'Pedidos do site em tempo real. Clique num pedido para ver tudo.',
  icon: 'receipt',
  group: 'Operação',
  permission: 'orders.view',
  render(container, { actions }) {
    let filter = '';
    let type = 'all';
    const freshIds = new Set();
    const search = searchInput({ placeholder: 'Filtrar por nº, nome ou telefone', oninput: () => { filter = search.input.value.trim().toLowerCase(); draw(); } });
    search.style.width = '300px';
    const chips = h('div', { class: 'chips' });
    const kpis = h('div', { class: 'kpis' });
    const board = h('div', { class: 'board' });
    container.append(kpis, h('div', { class: 'toolbar' }, search, chips), board);
    actions.append(btn('Atualizar', { icon: 'refresh', size: 'sm', title: 'Atualizar (F5)', onclick: () => refreshOrders() }));

    function matches(o) {
      if (type !== 'all' && o.deliveryType !== type) return false;
      if (!filter) return true;
      const digits = filter.replace(/\D/g, '');
      return o.customerName.toLowerCase().includes(filter) || o.code.includes(filter) || (digits && o.customerPhone.includes(digits));
    }

    function drawKpis() {
      const active = state.orders.filter(o => !['entregue', 'cancelado'].includes(o.status));
      const late = active.filter(o => ['novo', 'preparando'].includes(o.status) && minutesSince(o.createdAt) >= LATE_MIN).length;
      const valid = state.orders.filter(o => o.status !== 'cancelado');
      const revenue = valid.reduce((t, o) => t + o.total, 0);
      kpis.replaceChildren(
        kpi({ label: 'Novos', value: String(state.orders.filter(o => o.status === 'novo').length), hint: 'aguardando preparo', icon: 'bell', tone: 'accent' }),
        kpi({ label: 'Em andamento', value: String(active.length), hint: `${active.filter(o => o.deliveryType === 'delivery').length} entregas • ${active.filter(o => o.deliveryType === 'pickup').length} retiradas`, icon: 'flame', tone: 'warn' }),
        kpi({ label: 'Atrasados', value: String(late), hint: `mais de ${LATE_MIN} min sem sair`, icon: 'alert', tone: late ? 'danger' : 'ok' }),
        kpi({ label: 'Vendido (12h)', value: money(revenue), hint: `${valid.length} pedidos • ticket ${money(valid.length ? revenue / valid.length : 0)}`, icon: 'trend' }));
    }

    function drawChips() {
      const count = (t) => state.orders.filter(o => !['entregue', 'cancelado'].includes(o.status) && (t === 'all' || o.deliveryType === t)).length;
      chips.replaceChildren(...[['all', 'Todos', 'receipt'], ['delivery', 'Entrega', 'bike'], ['pickup', 'Retirada', 'bag']].map(([id, label, i]) =>
        h('button', { class: `chip ${type === id ? 'is-active' : ''}`, onclick: () => { type = id; draw(); } }, icon(i), `${label} · ${count(id)}`)));
    }

    function draw() {
      drawKpis();
      drawChips();
      const orders = state.orders.filter(matches);
      board.replaceChildren(...COLUMNS.map(col => {
        let list = orders.filter(o => col.statuses.includes(o.status));
        if (col.id === 'finalizados') list = list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return h('section', { class: `column column--${col.id}` },
          h('header', { class: 'column__head' }, h('span', { class: 'column__dot' }), col.title, h('span', { class: 'count' }, String(list.length))),
          h('div', { class: 'column__body' }, list.length ? list.map(o => orderCard(o, freshIds.has(o.id))) : emptyState(col.empty[0], col.empty[1], col.id === 'novo' ? 'bell' : 'inbox')));
      }));
    }

    state.listeners.add((orders, fresh) => {
      fresh.forEach(o => freshIds.add(o.id));
      setTimeout(() => fresh.forEach(o => freshIds.delete(o.id)), 4000);
      draw();
    });
    draw();
    // atualiza os cronômetros dos cartões
    this.timer = setInterval(draw, 30000);
  },
  destroy() {
    clearInterval(this.timer);
  },
};
