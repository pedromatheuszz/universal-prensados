// Financeiro: resultado do mês (faturamento − despesas), despesas e relatório de vendas
import { h, icon, btn, card, kpi, money, date, toast, modal, field, input, select, confirmDialog, hbars, todayISO, shiftDays, parseMoney, PAYMENT, skeleton, emptyState } from '../ui.js';
import { get, post, del } from '../api.js';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const monthLabel = (m) => { const name = MONTHS[Number(m.slice(5)) - 1]; return `${name[0].toUpperCase()}${name.slice(1)} de ${m.slice(0, 4)}`; };
const shiftMonth = (m, n) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + n, 1)).toISOString().slice(0, 7);
const loadingKpis = () => h('div', { class: 'kpis' }, Array.from({ length: 4 }, () => h('div', { class: 'skeleton', style: { height: '96px', borderRadius: '13px' } })));

function dailyChart(daily, { withExpenses = false } = {}) {
  if (!daily.length) return emptyState('Sem movimento no período', '', 'chart');
  const max = Math.max(1, ...daily.map(d => Math.max(d.revenue, d.expenses || 0)));
  return h('div', {},
    h('div', { class: 'bars' }, daily.map(d => h('div', { class: 'bars__col', title: `${date(`${d.day}T12:00:00Z`)}: ${money(d.revenue)}${withExpenses ? ` • despesas ${money(d.expenses)}` : ''}` },
      h('div', { class: 'bars__pair' },
        h('div', { class: 'bars__bar', style: { height: `${(d.revenue / max) * 100}%` } }),
        withExpenses ? h('div', { class: 'bars__bar bars__bar--alt', style: { height: `${((d.expenses || 0) / max) * 100}%` } }) : null),
      h('span', { class: 'bars__label' }, d.day.slice(8))))),
    withExpenses ? h('div', { class: 'legend' }, h('span', {}, h('i'), 'Faturamento'), h('span', {}, h('i', { class: 'alt' }), 'Despesas')) : null);
}

function expenseForm(categories, done) {
  const f = {
    date: input({ type: 'date', value: todayISO(), max: todayISO() }),
    category: select([['', 'Escolha…'], ...categories.map(c => [c, c])], ''),
    amount: input({ value: '', money: true, placeholder: '0,00', inputmode: 'decimal' }),
    desc: input({ maxlength: 200, placeholder: 'Ex.: Pães da padaria, conta de luz…' }),
  };
  modal({
    title: 'Nova despesa',
    icon: 'arrowDown',
    body: h('div', { class: 'form-grid' }, field('Data', f.date), field('Valor (R$)', f.amount), h('div', { class: 'span-2' }, field('Categoria', f.category)), h('div', { class: 'span-2' }, field('Descrição', f.desc))),
    actions: [{ label: 'Cancelar' }, {
      label: 'Lançar despesa', kind: 'primary', icon: 'check', submit: true,
      onClick: async () => {
        await post('/api/admin/finance/expenses', { date: f.date.value, category: f.category.value, amount: parseMoney(f.amount.value), description: f.desc.value });
        toast('Despesa lançada');
        done();
      },
    }],
  });
}

function renderMonth(container, actions) {
  let month = todayISO().slice(0, 7);
  const body = h('div');
  const label = h('strong', { style: { fontFamily: 'var(--font-display)', fontSize: '15px', minWidth: '170px', textAlign: 'center' } });
  container.append(h('div', { class: 'toolbar' },
    btn('', { icon: 'chevronLeft', size: 'sm', title: 'Mês anterior', onclick: () => { month = shiftMonth(month, -1); load(); } }),
    label,
    btn('', { icon: 'chevronRight', size: 'sm', title: 'Próximo mês', onclick: () => { if (month < todayISO().slice(0, 7)) { month = shiftMonth(month, 1); load(); } } })), body);

  let categories = [];
  actions.append(btn('Despesa', { icon: 'plus', kind: 'primary', size: 'sm', onclick: () => expenseForm(categories, load) }));

  async function load() {
    label.textContent = monthLabel(month);
    body.replaceChildren(loadingKpis(), h('div', { class: 'card' }, skeleton(4, 40)));
    let d;
    try {
      d = await get(`/api/admin/finance?month=${month}`);
    } catch (error) {
      body.replaceChildren(h('div', { class: 'card' }, emptyState('Não foi possível carregar', error.message, 'wifiOff')));
      return;
    }
    categories = d.categories;
    body.replaceChildren(
      h('div', { class: 'kpis' },
        kpi({ label: 'Resultado do mês', value: money(d.result), hint: 'faturamento − despesas', icon: d.result < 0 ? 'arrowDown' : 'trend', tone: 'accent' }),
        kpi({ label: 'Faturamento', value: money(d.revenue), hint: `${d.orders} pedidos • ticket ${money(d.avgTicket)}`, icon: 'receipt', tone: 'ok' }),
        kpi({ label: 'Despesas', value: money(d.expenses), hint: `${d.items.length} lançamento(s)`, icon: 'arrowDown', tone: 'danger' }),
        kpi({ label: 'Descontos dados', value: money(d.discounts), hint: `taxas de entrega: ${money(d.deliveryFees)}`, icon: 'tag' })),
      card({ title: 'Dia a dia', subtitle: 'Faturamento e despesas de cada dia do mês', icon: 'calendar' }, dailyChart(d.daily, { withExpenses: true })),
      h('div', { class: 'grid-2', style: { marginTop: '1rem' } },
        card({ title: 'Despesas por categoria', icon: 'chart' }, hbars(d.byCategory.map(c => ({ label: c.category, value: c.total, display: money(c.total) })))),
        card({ title: 'Lançamentos', icon: 'receipt', flush: true },
          d.items.length ? h('table', { class: 'table' }, h('tbody', {}, d.items.map(e => h('tr', {},
            h('td', { class: 'num faint' }, date(`${e.date}T12:00:00Z`)),
            h('td', {}, h('strong', {}, e.category), e.description ? h('div', { class: 'faint' }, e.description) : null),
            h('td', { class: 'right num neg' }, h('strong', {}, money(e.amount))),
            h('td', { class: 'right' }, btn('', {
              icon: 'trash', kind: 'ghost', size: 'sm', title: 'Excluir',
              onclick: async () => {
                if (!(await confirmDialog(`Excluir a despesa de ${money(e.amount)} (${e.category})?`, { danger: true, confirmLabel: 'Excluir', title: 'Excluir despesa' }))) return;
                try { await del(`/api/admin/finance/expenses/${e.id}`); toast('Despesa excluída'); load(); } catch (err) { toast(err.message, 'error'); }
              },
            })))))) : emptyState('Nenhuma despesa lançada', 'Use o botão "Despesa" para lançar.', 'receipt'))));
  }
  load();
}

function renderSales(container) {
  const today = todayISO();
  const from = input({ type: 'date', value: today, max: today });
  const to = input({ type: 'date', value: today, max: today });
  [from, to].forEach(i => { i.style.width = '150px'; });
  const body = h('div');
  let active = 'Hoje';
  const chips = h('div', { class: 'chips' });
  const ranges = [['Hoje', today, today], ['Ontem', shiftDays(today, -1), shiftDays(today, -1)], ['7 dias', shiftDays(today, -6), today], ['30 dias', shiftDays(today, -29), today], ['Este mês', `${today.slice(0, 7)}-01`, today]];
  const drawChips = () => chips.replaceChildren(...ranges.map(([label, f, t]) =>
    h('button', { class: `chip ${active === label ? 'is-active' : ''}`, onclick: () => { active = label; from.value = f; to.value = t; drawChips(); load(); } }, label)));
  drawChips();
  container.append(h('div', { class: 'toolbar' }, chips, h('div', { class: 'spacer' }), from, h('span', { class: 'faint' }, 'até'), to,
    btn('Ver', { icon: 'search', kind: 'primary', size: 'sm', onclick: () => { active = ''; drawChips(); load(); } })), body);

  async function load() {
    body.replaceChildren(loadingKpis(), h('div', { class: 'card' }, skeleton(4, 40)));
    let r;
    try {
      r = await get(`/api/admin/reports?from=${from.value}&to=${to.value}`);
    } catch (error) {
      body.replaceChildren(h('div', { class: 'card' }, emptyState('Não foi possível carregar', error.message, 'wifiOff')));
      return;
    }
    const s = r.summary;
    body.replaceChildren(
      h('div', { class: 'kpis' },
        kpi({ label: 'Faturamento', value: money(s.revenue), icon: 'trend', tone: 'accent' }),
        kpi({ label: 'Pedidos', value: String(s.orders), hint: s.cancelled ? `${s.cancelled} cancelado(s)` : 'nenhum cancelado', icon: 'receipt' }),
        kpi({ label: 'Ticket médio', value: money(s.avgTicket), icon: 'wallet' }),
        kpi({ label: 'Descontos', value: money(s.discounts), hint: `entregas: ${money(s.deliveryFees)}`, icon: 'tag' })),
      r.daily.length > 1 ? card({ title: 'Faturamento por dia', icon: 'calendar' }, dailyChart(r.daily)) : '',
      h('div', { class: 'grid-2', style: { marginTop: '1rem' } },
        card({ title: 'Mais vendidos', icon: 'flame' }, hbars(r.topProducts.map(p => ({ label: p.name, value: p.qty, display: `${p.qty} un • ${money(p.revenue)}` })))),
        h('div', { class: 'stack' },
          card({ title: 'Formas de pagamento', icon: 'card' }, hbars(r.byPayment.map(p => ({ label: PAYMENT[p.key] || p.key, value: p.revenue, display: `${money(p.revenue)} (${p.orders})` })))),
          card({ title: 'Bairros', icon: 'map' }, hbars(r.byDistrict.map(p => ({ label: p.key, value: p.orders, display: `${p.orders} • ${money(p.revenue)}` })))),
          card({ title: 'Pedidos por horário', icon: 'clock' }, hbars(r.byHour.map(p => ({ label: `${String(p.hour).padStart(2, '0')}h`, value: p.orders })))))));
  }
  load();
}

export default {
  id: 'financeiro',
  label: 'Financeiro',
  subtitle: 'Resultado do mês, despesas e relatórios de vendas.',
  icon: 'chart',
  group: 'Gestão',
  permission: 'finance.view',
  render(container, { actions }) {
    let tab = 'mes';
    const tabs = h('div', { class: 'tabs', style: { marginBottom: '1rem' } });
    const body = h('div');
    container.append(tabs, body);
    function draw() {
      tabs.replaceChildren(...[['mes', 'Resultado do mês', 'wallet'], ['vendas', 'Relatório de vendas', 'chart']].map(([id, label, i]) =>
        h('button', { class: tab === id ? 'is-active' : '', onclick: () => { tab = id; draw(); } }, icon(i, { size: 15 }), label)));
      body.replaceChildren();
      actions.replaceChildren();
      if (tab === 'mes') renderMonth(body, actions);
      else renderSales(body);
    }
    draw();
  },
};
