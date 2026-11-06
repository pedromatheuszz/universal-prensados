// Histórico de pedidos: busca por período, cliente, código e status; exporta CSV
import { h, icon, btn, money, dateTime, phone, PAYMENT, STATUS, statusPill, paymentPill, toast, input, searchInput, select, todayISO, shiftDays, skeleton, emptyState } from '../ui.js';
import { get } from '../api.js';
import { openOrderDetail } from './pedidos.js';

function toCsv(orders) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Pedido', 'Data', 'Cliente', 'Telefone', 'Tipo', 'Bairro', 'Pagamento', 'Subtotal', 'Desconto', 'Entrega', 'Total', 'Status', 'Itens'];
  const rows = orders.map(o => [
    o.code, dateTime(o.createdAt), o.customerName, o.customerPhone, o.deliveryType === 'delivery' ? 'Entrega' : 'Retirada',
    o.district || '', PAYMENT[o.paymentMethod], o.subtotal, o.discount, o.deliveryFee, o.total, STATUS[o.status].label,
    o.items.map(i => `${i.qty}x ${i.name}`).join(' | '),
  ].map((v) => (typeof v === 'number' ? String(v).replace('.', ',') : v)).map(cell).join(';'));
  return '﻿' + [head.map(cell).join(';'), ...rows].join('\r\n');
}

export default {
  id: 'historico',
  label: 'Histórico',
  title: 'Histórico de pedidos',
  subtitle: 'Encontre qualquer pedido por período, cliente, telefone ou número.',
  icon: 'history',
  group: 'Operação',
  permission: 'orders.history',
  render(container, { actions }) {
    const today = todayISO();
    const from = input({ type: 'date', value: shiftDays(today, -6), max: today });
    const to = input({ type: 'date', value: today, max: today });
    const q = searchInput({ placeholder: 'Nome, telefone ou nº do pedido' });
    const status = select([['', 'Todos os status'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])], '');
    const info = h('span', { class: 'muted' });
    const tableWrap = h('div', { class: 'card card--flush' });
    const pager = h('div', { class: 'row', style: { marginTop: '1rem', justifyContent: 'center' } });
    let page = 1;
    let last = null;

    [from, to].forEach(i => { i.style.width = '150px'; });
    q.style.width = '270px';
    status.style.width = '190px';
    const quick = (label, f) => h('button', { type: 'button', class: 'chip', onclick: () => { from.value = f; to.value = today; page = 1; load(); } }, label);
    const form = h('form', { class: 'toolbar', onsubmit: (e) => { e.preventDefault(); page = 1; load(); } },
      h('div', { class: 'chips' }, quick('Hoje', today), quick('7 dias', shiftDays(today, -6)), quick('30 dias', shiftDays(today, -29))),
      from, h('span', { class: 'faint' }, 'até'), to, q, status,
      h('button', { class: 'btn btn--primary' }, icon('search'), h('span', {}, 'Buscar')), h('div', { class: 'spacer' }), info);
    container.append(form, tableWrap, pager);

    actions.append(btn('Exportar CSV', {
      icon: 'download', size: 'sm',
      onclick: async () => {
        if (!last?.total) return toast('Nada para exportar', 'error');
        const all = [];
        for (let p = 1; p <= Math.ceil(last.total / last.pageSize); p++) all.push(...(await get(url(p))).orders);
        const a = h('a', { href: URL.createObjectURL(new Blob([toCsv(all)], { type: 'text/csv;charset=utf-8' })), download: `pedidos_${from.value}_a_${to.value}.csv` });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      },
    }));

    const url = (p) => `/api/admin/orders?${new URLSearchParams({ from: from.value, to: to.value, q: q.input.value, status: status.value, page: String(p) })}`;

    async function load() {
      tableWrap.replaceChildren(h('div', { style: { padding: '1rem' } }, skeleton(6)));
      try {
        last = await get(url(page));
      } catch (error) {
        tableWrap.replaceChildren(emptyState('Não foi possível buscar', error.message, 'wifiOff'));
        return;
      }
      const totalValue = last.orders.filter(o => o.status !== 'cancelado').reduce((t, o) => t + o.total, 0);
      info.textContent = last.total === 1 ? '1 pedido encontrado' : `${last.total} pedidos encontrados`;
      if (!last.orders.length) {
        tableWrap.replaceChildren(emptyState('Nenhum pedido encontrado', 'Tente outro período ou outra busca.', 'search'));
        pager.replaceChildren();
        return;
      }
      tableWrap.replaceChildren(h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, ['Pedido', 'Data', 'Cliente', 'Tipo', 'Pagamento', 'Status'].map(t => h('th', {}, t)), h('th', { class: 'right' }, 'Total'))),
        h('tbody', {}, last.orders.map(o => h('tr', { class: 'clickable', onclick: () => openOrderDetail(o.id) },
          h('td', {}, h('strong', { class: 'price' }, o.code)),
          h('td', { class: 'num muted' }, dateTime(o.createdAt)),
          h('td', {}, h('strong', {}, o.customerName), h('div', { class: 'faint' }, phone(o.customerPhone))),
          h('td', {}, h('span', { class: 'order__type' }, icon(o.deliveryType === 'delivery' ? 'bike' : 'bag'), o.deliveryType === 'delivery' ? o.district : 'Retirada')),
          h('td', {}, paymentPill(o.paymentMethod)),
          h('td', {}, statusPill(o.status)),
          h('td', { class: 'right num' }, h('strong', { class: 'price' }, money(o.total)))))),
        h('tfoot', {}, h('tr', {}, h('td', { colspan: 6, class: 'muted' }, 'Total desta página (sem cancelados)'), h('td', { class: 'right num' }, h('strong', { class: 'price' }, money(totalValue)))))));

      const pages = Math.ceil(last.total / last.pageSize);
      pager.replaceChildren(...(pages > 1 ? [
        btn('Anterior', { icon: 'chevronLeft', size: 'sm', disabled: page <= 1, onclick: () => { page--; load(); } }),
        h('span', { class: 'muted' }, `Página ${page} de ${pages}`),
        btn('Próxima', { icon: 'chevronRight', size: 'sm', disabled: page >= pages, onclick: () => { page++; load(); } }),
      ] : []));
    }

    load();
  },
};
