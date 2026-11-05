// Painel da equipe: quadro de pedidos em tempo real (polling) + relatórios
import { gsap } from 'gsap';
import { formatBRL } from './utils.js';

const POLL_MS = 5000;
const LATE_MIN = 25;
const $ = (id) => document.getElementById(id);
const motionOK = () => window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

const PAYMENT = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro' };
const COLUMN_OF = { novo: 'novo', preparando: 'preparando', pronto: 'expedicao', saiu_entrega: 'expedicao', entregue: 'finalizados', cancelado: 'finalizados' };

// Próxima ação principal de cada status, conforme entrega ou retirada
function primaryAction(order) {
  switch (order.status) {
    case 'novo': return { to: 'preparando', label: '🔥 Iniciar preparo' };
    case 'preparando': return order.deliveryType === 'delivery'
      ? { to: 'saiu_entrega', label: '🛵 Saiu para entrega' }
      : { to: 'pronto', label: '✅ Pronto para retirada' };
    case 'pronto': return { to: 'entregue', label: '🙌 Retirado' };
    case 'saiu_entrega': return { to: 'entregue', label: '🏁 Entregue' };
    default: return null;
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function toast(message, icon = '✓') {
  const t = el('div', 'toast');
  t.append(el('span', '', icon), ' ', el('span', '', message));
  $('toast-container').append(t);
  setTimeout(() => t.remove(), 3500);
}

// ---------- API ----------

class Unauthorized extends Error {}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Unauthorized(data.error);
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

// ---------- Som de novo pedido ----------

let audio = null;
let soundOn = false;

function setSound(on) {
  soundOn = on;
  if (on && !audio) audio = new AudioContext();
  audio?.resume();
  const btn = $('sound-toggle');
  btn.textContent = on ? '🔔 Som ligado' : '🔕 Ativar som';
  btn.setAttribute('aria-pressed', String(on));
  try { localStorage.setItem('up_panel_sound', on ? '1' : '0'); } catch { /* sem armazenamento */ }
}

function ding() {
  if (!soundOn || !audio) return;
  const now = audio.currentTime;
  [0, 0.18, 0.36].forEach((offset, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = [880, 1175, 1568][i];
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.3);
    osc.connect(gain).connect(audio.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.32);
  });
}

// ---------- Quadro de pedidos ----------

let knownIds = null;
let unseen = 0;
let pollTimer = null;
const busy = new Set();

function minutesSince(iso) {
  return Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
}

function orderCard(order) {
  const card = el('article', `order-card order-card--${order.status}`);
  card.dataset.id = order.id;
  const late = ['novo', 'preparando'].includes(order.status) && minutesSince(order.createdAt) >= LATE_MIN;
  if (late) card.classList.add('is-late');

  const head = el('header', 'order-card__head');
  head.append(el('strong', 'order-card__code', order.code));
  head.append(el('span', `pill pill--${order.deliveryType}`, order.deliveryType === 'delivery' ? '🛵 Entrega' : '🏪 Retirada'));
  const mins = minutesSince(order.createdAt);
  head.append(el('span', 'order-card__time', `${new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • ${mins} min`));
  card.append(head);

  const who = el('div', 'order-card__who');
  who.append(el('strong', '', order.customerName));
  const phone = el('a', '', order.customerPhone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3'));
  phone.href = `https://wa.me/55${order.customerPhone.replace(/^55/, '')}`;
  phone.target = '_blank';
  phone.rel = 'noopener';
  who.append(phone);
  card.append(who);

  if (order.deliveryType === 'delivery' && order.address) {
    const a = order.address;
    const addr = el('p', 'order-card__addr', `📍 ${a.street}, ${a.number} — ${order.district}`);
    if (a.compl || a.ref) addr.append(el('span', '', [a.compl, a.ref].filter(Boolean).join(' • ')));
    card.append(addr);
  }

  const items = el('ul', 'order-card__items');
  order.items.forEach(item => {
    const li = el('li');
    li.append(el('strong', '', `${item.qty}x ${item.name}`));
    const extra = [...(item.extras || []).map(e => `+ ${e.name}`), ...(item.removals || [])].join(' • ');
    if (extra) li.append(el('span', '', extra));
    if (item.notes) li.append(el('em', '', `“${item.notes}”`));
    items.append(li);
  });
  card.append(items);

  const pay = el('p', 'order-card__pay');
  pay.append(el('strong', '', formatBRL(order.total)));
  pay.append(` • ${PAYMENT[order.paymentMethod] || order.paymentMethod}`);
  if (order.changeFor) pay.append(` (troco p/ ${order.changeFor})`);
  if (order.couponCode) pay.append(` • cupom ${order.couponCode}`);
  card.append(pay);

  const actions = el('div', 'order-card__actions');
  const primary = primaryAction(order);
  if (primary && order.nextStatuses.includes(primary.to)) {
    const btn = el('button', 'btn btn--primary btn--sm', primary.label);
    btn.type = 'button';
    btn.dataset.to = primary.to;
    actions.append(btn);
  }
  if (order.nextStatuses.includes('cancelado')) {
    const cancel = el('button', 'btn btn--outline btn--sm order-card__cancel', 'Cancelar');
    cancel.type = 'button';
    cancel.dataset.to = 'cancelado';
    actions.append(cancel);
  }
  if (!actions.childElementCount) actions.append(el('span', 'order-card__final', order.statusLabel));
  card.append(actions);
  return card;
}

function renderBoard(orders) {
  const columns = { novo: [], preparando: [], expedicao: [], finalizados: [] };
  orders.forEach(o => columns[COLUMN_OF[o.status]].push(o));
  columns.finalizados.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const fresh = [];
  for (const [col, list] of Object.entries(columns)) {
    const container = document.querySelector(`[data-list="${col}"]`);
    container.replaceChildren(...(list.length ? list.map(orderCard) : [el('p', 'board__empty', 'Nenhum pedido')]));
    document.querySelector(`[data-count="${col}"]`).textContent = list.length;
  }

  // Novos pedidos desde a última atualização
  const ids = new Set(orders.map(o => o.id));
  if (knownIds) {
    orders.filter(o => !knownIds.has(o.id) && o.status === 'novo').forEach(o => fresh.push(o));
  }
  knownIds = ids;

  if (fresh.length) {
    ding();
    unseen += fresh.length;
    updateUnseen();
    toast(`${fresh.length} novo${fresh.length > 1 ? 's' : ''} pedido${fresh.length > 1 ? 's' : ''}!`, '🔔');
    if (motionOK()) {
      fresh.forEach(o => gsap.fromTo(`.order-card[data-id="${o.id}"]`, { scale: 0.9, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.6, ease: 'back.out(1.8)' }));
    }
  }
}

function updateUnseen() {
  const badge = $('new-count');
  badge.textContent = unseen;
  badge.classList.toggle('hidden', unseen === 0);
  document.title = unseen ? `(${unseen}) Novo pedido! | Painel` : 'Painel da Cozinha | Universal Prensados';
}

function setSync(ok) {
  const s = $('sync-status');
  s.classList.toggle('is-ok', ok);
  s.classList.toggle('is-error', !ok);
  s.title = ok ? `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}` : 'Sem conexão — tentando de novo';
}

async function refreshBoard() {
  try {
    const { orders } = await api('/api/admin/orders');
    renderBoard(orders);
    setSync(true);
  } catch (error) {
    if (error instanceof Unauthorized) return showLogin();
    setSync(false);
  }
}

$('tab-orders').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-to]');
  if (!btn) return;
  const card = btn.closest('.order-card');
  const id = card.dataset.id;
  const to = btn.dataset.to;
  if (busy.has(id)) return;
  if (to === 'cancelado' && !confirm(`Cancelar o pedido ${card.querySelector('.order-card__code').textContent}?`)) return;

  busy.add(id);
  card.classList.add('is-busy');
  try {
    await api(`/api/admin/orders/${id}`, { method: 'PATCH', body: { status: to } });
    if (motionOK()) await gsap.to(card, { x: 24, autoAlpha: 0, duration: 0.25, ease: 'power2.in' });
    await refreshBoard();
  } catch (error) {
    if (error instanceof Unauthorized) return showLogin();
    toast(error.message, '⚠️');
    card.classList.remove('is-busy');
    refreshBoard();
  } finally {
    busy.delete(id);
  }
});

// ---------- Relatórios ----------

const tooltip = $('chart-tooltip');
const spDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
const shortDay = (iso) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };

function niceMax(value) {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function showTip(target, title, value) {
  tooltip.replaceChildren(el('strong', '', value), el('span', '', title));
  tooltip.classList.remove('hidden');
  const r = target.getBoundingClientRect();
  const t = tooltip.getBoundingClientRect();
  tooltip.style.left = `${Math.min(window.innerWidth - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2))}px`;
  tooltip.style.top = `${Math.max(8, r.top - t.height - 8)}px`;
}
const hideTip = () => tooltip.classList.add('hidden');

// Gráfico de colunas (uma série): colunas finas, topo arredondado, hover/foco por coluna
function columnChart(container, data, { format, tickFormat = format, label = (d) => d.label }) {
  // desenha na largura real do card para o texto não encolher em cards estreitos
  const W = Math.max(300, Math.round(container.clientWidth || 640)), H = 220, padL = 56, padR = 12, padT = 24, padB = 28;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart__svg');
  svg.setAttribute('role', 'img');

  const max = niceMax(Math.max(0, ...data.map(d => d.value)));
  const innerH = H - padT - padB;
  const band = (W - padL - padR) / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.62);
  const y = (v) => padT + innerH - (v / max) * innerH;

  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', padL); line.setAttribute('x2', W - padR);
    line.setAttribute('y1', y(v)); line.setAttribute('y2', y(v));
    line.setAttribute('class', 'chart__grid');
    svg.append(line);
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', padL - 8); t.setAttribute('y', y(v) + 4);
    t.setAttribute('class', 'chart__tick'); t.setAttribute('text-anchor', 'end');
    t.textContent = tickFormat(v);
    svg.append(t);
  }

  const labelEvery = Math.ceil(data.length / 12);
  const maxIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  data.forEach((d, i) => {
    const cx = padL + band * i + band / 2;
    const top = y(d.value);
    const h = padT + innerH - top;
    if (h > 0) {
      const r = Math.min(4, h, barW / 2);
      const x0 = cx - barW / 2, x1 = cx + barW / 2, base = padT + innerH;
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', `M${x0} ${base} V${top + r} Q${x0} ${top} ${x0 + r} ${top} H${x1 - r} Q${x1} ${top} ${x1} ${top + r} V${base} Z`);
      path.setAttribute('class', 'chart__bar');
      svg.append(path);
    }
    if (i % labelEvery === 0) {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', cx); t.setAttribute('y', H - 8);
      t.setAttribute('class', 'chart__tick'); t.setAttribute('text-anchor', 'middle');
      t.textContent = label(d);
      svg.append(t);
    }
    if (i === maxIndex && d.value > 0) {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', cx); t.setAttribute('y', top - 6);
      t.setAttribute('class', 'chart__value'); t.setAttribute('text-anchor', 'middle');
      t.textContent = format(d.value);
      svg.append(t);
    }
    // área de toque maior que a coluna
    const hit = document.createElementNS(svgNS, 'rect');
    hit.setAttribute('x', padL + band * i); hit.setAttribute('y', padT);
    hit.setAttribute('width', band); hit.setAttribute('height', innerH);
    hit.setAttribute('class', 'chart__hit'); hit.setAttribute('tabindex', '0');
    hit.setAttribute('aria-label', `${d.title}: ${format(d.value)}`);
    const show = () => showTip(hit, d.title, format(d.value));
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('focus', show);
    hit.addEventListener('pointerleave', hideTip);
    hit.addEventListener('blur', hideTip);
    svg.append(hit);
  });

  container.replaceChildren(svg);
}

// Lista de barras horizontais (ranking de uma série)
function barList(container, rows, { format, sub }) {
  if (!rows.length) { container.replaceChildren(el('p', 'board__empty', 'Sem dados no período')); return; }
  const max = Math.max(...rows.map(r => r.value)) || 1;
  container.replaceChildren(...rows.map(r => {
    const row = el('div', 'barlist__row');
    row.append(el('span', 'barlist__name', r.label));
    const track = el('span', 'barlist__track');
    const bar = el('span', 'barlist__bar');
    bar.style.inlineSize = `${(r.value / max) * 100}%`;
    track.append(bar);
    row.append(track);
    const val = el('span', 'barlist__value', format(r.value));
    if (sub) val.append(el('small', '', sub(r)));
    row.append(val);
    return row;
  }));
}

function eachDay(from, to) {
  const days = [];
  for (let d = new Date(`${from}T12:00:00Z`); spDate(d) <= to; d = new Date(d.getTime() + 86400000)) days.push(spDate(d));
  return days;
}

let rangeDays = 0;

async function loadReports(from, to) {
  const body = $('reports-body');
  body.classList.add('is-loading');
  try {
    const r = await api(`/api/admin/reports?from=${from}&to=${to}`);
    $('r-revenue').textContent = formatBRL(r.summary.revenue);
    $('r-orders').textContent = r.summary.orders.toLocaleString('pt-BR');
    $('r-avg').textContent = formatBRL(r.summary.avgTicket);
    $('r-cancelled').textContent = r.summary.cancelled.toLocaleString('pt-BR');

    const byDay = new Map(r.daily.map(d => [d.day, d]));
    const days = eachDay(from, to).map(day => ({
      label: shortDay(day),
      title: new Date(`${day}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      value: byDay.get(day)?.revenue || 0,
      orders: byDay.get(day)?.orders || 0,
    }));
    const brlShort = (v) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(v)}`);
    $('r-timeline-title').textContent = days.length === 1 ? 'Faturamento do dia' : 'Faturamento por dia';
    columnChart($('r-timeline'), days, { format: formatBRL, tickFormat: brlShort });

    const table = el('table', 'data-table');
    const head = el('tr');
    ['Dia', 'Pedidos', 'Faturamento'].forEach(h => head.append(el('th', '', h)));
    table.append(head);
    days.forEach(d => {
      const tr = el('tr');
      tr.append(el('td', '', d.title), el('td', '', String(d.orders)), el('td', '', formatBRL(d.value)));
      table.append(tr);
    });
    $('r-timeline-table').replaceChildren(table);

    const hours = new Map(r.byHour.map(h => [h.hour, h.orders]));
    const hourData = Array.from({ length: 24 }, (_, h) => ({ label: `${h}h`, title: `${h}h às ${h + 1}h`, value: hours.get(h) || 0 }))
      .filter((d, h) => h >= 17 || d.value > 0);
    columnChart($('r-hours'), hourData, { format: (v) => `${Math.round(v)} pedido${Math.round(v) === 1 ? '' : 's'}`, tickFormat: (v) => String(Math.round(v)) });

    barList($('r-products'), r.topProducts.map(p => ({ label: p.name, value: p.qty, revenue: p.revenue })), {
      format: (v) => `${v} un.`, sub: (row) => formatBRL(row.revenue),
    });
    barList($('r-payment'), r.byPayment.map(p => ({ label: PAYMENT[p.key] || p.key, value: p.revenue, orders: p.orders })), {
      format: formatBRL, sub: (row) => `${row.orders} pedidos`,
    });
    barList($('r-district'), r.byDistrict.map(p => ({ label: p.key, value: p.orders, revenue: p.revenue })), {
      format: (v) => `${v}`, sub: (row) => formatBRL(row.revenue),
    });
  } catch (error) {
    if (error instanceof Unauthorized) return showLogin();
    toast(error.message, '⚠️');
  } finally {
    body.classList.remove('is-loading');
  }
}

function presetRange(days) {
  rangeDays = days;
  const to = spDate(new Date());
  const from = spDate(new Date(Date.now() - days * 86400000));
  $('range-from').value = from;
  $('range-to').value = to;
  document.querySelectorAll('[data-range]').forEach(c => c.classList.toggle('is-active', Number(c.dataset.range) === days));
  loadReports(from, to);
}

document.querySelectorAll('[data-range]').forEach(chip => chip.addEventListener('click', () => presetRange(Number(chip.dataset.range))));
['range-from', 'range-to'].forEach(id => $(id).addEventListener('change', () => {
  const from = $('range-from').value, to = $('range-to').value;
  if (!from || !to || from > to) return;
  document.querySelectorAll('[data-range]').forEach(c => c.classList.remove('is-active'));
  loadReports(from, to);
}));

// ---------- Abas, login e inicialização ----------

function showTab(tab) {
  document.querySelectorAll('.panel__tab').forEach(t => {
    const active = t.dataset.tab === tab;
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', String(active));
  });
  $('tab-orders').classList.toggle('hidden', tab !== 'orders');
  $('tab-reports').classList.toggle('hidden', tab !== 'reports');
  if (tab === 'orders') { unseen = 0; updateUnseen(); }
  if (tab === 'reports') presetRange(rangeDays);
}

document.querySelectorAll('.panel__tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

function showLogin() {
  clearInterval(pollTimer);
  knownIds = null;
  $('panel-view').classList.add('hidden');
  $('login-view').classList.remove('hidden');
  $('login-user').focus();
}

function showPanel(username) {
  $('login-view').classList.add('hidden');
  $('panel-view').classList.remove('hidden');
  $('panel-user').textContent = username;
  refreshBoard();
  clearInterval(pollTimer);
  pollTimer = setInterval(refreshBoard, POLL_MS);
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = $('login-error');
  const submit = $('login-submit');
  error.classList.add('hidden');
  submit.disabled = true;
  try {
    const { username } = await api('/api/admin/session', {
      method: 'POST',
      body: { username: $('login-user').value, password: $('login-pass').value },
    });
    $('login-pass').value = '';
    showPanel(username);
  } catch (err) {
    error.textContent = err.message || 'Não foi possível entrar';
    error.classList.remove('hidden');
    if (motionOK()) gsap.fromTo('.login__card', { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
  } finally {
    submit.disabled = false;
  }
});

$('logout-btn').addEventListener('click', async () => {
  await api('/api/admin/session', { method: 'DELETE' }).catch(() => {});
  showLogin();
});

$('sound-toggle').addEventListener('click', () => setSound(!soundOn));
try { if (localStorage.getItem('up_panel_sound') === '1') $('sound-toggle').classList.add('is-suggested'); } catch { /* sem armazenamento */ }

api('/api/admin/session').then(({ username }) => showPanel(username)).catch(() => showLogin());
