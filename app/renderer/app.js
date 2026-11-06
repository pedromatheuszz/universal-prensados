// Universal Gestão — inicialização, login, menu, busca rápida, atalhos e pedidos em segundo plano
import { h, $, icon, toast, modal, field, input, time } from './ui.js';
import { get, patch, setUnauthorizedHandler, setConnectionHandler } from './api.js';
import { orderTicketHtml } from './print.js';
import pedidos, { openOrderDetail } from './views/pedidos.js';
import historico from './views/historico.js';
import cardapio from './views/cardapio.js';
import loja from './views/loja.js';
import caixa from './views/caixa.js';
import financeiro from './views/financeiro.js';
import equipe from './views/equipe.js';
import ajustes from './views/ajustes.js';

const VIEWS = [pedidos, historico, cardapio, loja, caixa, financeiro, equipe, ajustes];
const GROUPS = ['Operação', 'Loja', 'Gestão', 'Sistema'];
const POLL_MS = 5000;
const STORE_POLL_MS = 60000;

// Estado compartilhado com as telas
export const state = {
  user: null,
  config: null,
  orders: [],
  store: null,
  current: null,
  lastSync: null,
  listeners: new Set(), // telas interessadas em atualizações do quadro
};

export const can = (permission) => state.user?.permissions.includes(permission) ?? false;
const allowedViews = () => VIEWS.filter(v => !v.permission || can(v.permission));
const pref = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const setPref = (key, value) => { try { localStorage.setItem(key, value); } catch { /* sem armazenamento */ } };

// ---------- Tema ----------

function applyTheme() {
  const theme = pref('gestao-theme', 'dark');
  document.documentElement.dataset.theme = theme;
  window.gestao.setWindowTheme?.(theme);
}
export function setTheme(theme) {
  setPref('gestao-theme', theme);
  applyTheme();
}
const toggleTheme = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');

// ---------- Som ----------

let audio = null;
export function ding({ force = false } = {}) {
  if (!force && !state.config?.sound) return;
  audio = audio || new AudioContext();
  audio.resume();
  const now = audio.currentTime;
  [0, 0.18, 0.36, 0.9, 1.08, 1.26].forEach((offset, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = [880, 1175, 1568][i % 3];
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.4, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.3);
    osc.connect(gain).connect(audio.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.32);
  });
}

// ---------- Impressão ----------

export async function printOrder(order, { silentErrors = false } = {}) {
  const html = orderTicketHtml(order, { storeName: state.store?.settings.storeName, paperWidth: state.config?.paperWidth });
  const result = await window.gestao.printHtml(html);
  if (!result.ok && !silentErrors) toast(`Não foi possível imprimir: ${result.error}`, 'error');
  else if (result.ok && !silentErrors) toast(`Comanda ${order.code} enviada para a impressora`);
  return result.ok;
}

// ---------- Pedidos em segundo plano ----------

let knownIds = null;
let pollTimer = null;
let storeTimer = null;
let syncTimer = null;

async function pollOrders() {
  if (!state.user) return;
  try {
    const { orders } = await get('/api/admin/orders');
    const fresh = knownIds ? orders.filter(o => !knownIds.has(o.id) && o.status === 'novo') : [];
    knownIds = new Set(orders.map(o => o.id));
    state.orders = orders;
    state.lastSync = new Date();
    if (fresh.length) onNewOrders(fresh);
    updateCounters();
    state.listeners.forEach(fn => fn(orders, fresh));
  } catch { /* a barra de status já mostra o problema */ }
}

function onNewOrders(fresh) {
  ding();
  const first = fresh[0];
  const title = fresh.length === 1 ? `Pedido novo ${first.code}` : `${fresh.length} pedidos novos`;
  const body = fresh.length === 1 ? `${first.customerName} • ${first.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}` : 'Abra o quadro de pedidos';
  window.gestao.notify(title, body);
  toast(title, 'info');
  if (state.config?.autoPrint) fresh.forEach(o => printOrder(o, { silentErrors: true }));
}

export const refreshOrders = () => pollOrders();

function updateCounters() {
  const fresh = state.orders.filter(o => o.status === 'novo').length;
  const active = state.orders.filter(o => !['entregue', 'cancelado'].includes(o.status)).length;
  const badge = $('#nav [data-view="pedidos"] .nav__badge');
  if (badge) {
    badge.textContent = String(fresh);
    badge.hidden = fresh === 0;
  }
  document.title = fresh ? `(${fresh}) Universal Gestão` : 'Universal Gestão';
  $('#active-text').replaceChildren(icon('receipt'), `${active} em andamento`);
  updateSync();
}

function updateSync() {
  if (!state.lastSync) return;
  const secs = Math.round((Date.now() - state.lastSync) / 1000);
  $('#sync-text').replaceChildren(icon('refresh'), secs < 10 ? 'Sincronizado agora' : `Sincronizado às ${time(state.lastSync.toISOString())}`);
}

// ---------- Situação da loja ----------

export async function refreshStore() {
  try {
    state.store = await get('/api/admin/store');
    renderStoreCard();
  } catch { /* sem conexão */ }
}

function renderStoreCard() {
  const { settings, status } = state.store;
  const kind = status.paused ? 'warn' : status.open ? 'ok' : 'danger';
  $('#store-dot').className = `dot dot--${kind} ${status.open ? 'dot--live' : ''}`;
  $('#store-title').textContent = status.paused ? 'Pedidos pausados' : status.open ? 'Loja aberta' : 'Loja fechada';
  $('#store-label').textContent = status.label.replace(/^[^•]+• /, '');
  const b = $('#store-pause');
  b.hidden = !can('store.pause');
  b.className = `btn btn--sm btn--block ${settings.paused ? 'btn--ok' : ''}`;
  b.title = settings.paused ? 'Retomar pedidos do site' : 'Pausar pedidos do site';
  b.replaceChildren(icon(settings.paused ? 'play' : 'pause'), h('span', {}, settings.paused ? 'Retomar pedidos' : 'Pausar pedidos'));
}

export async function togglePause() {
  if (state.store?.settings.paused) {
    state.store = await patch('/api/admin/store', { paused: false, pauseMessage: '' });
    renderStoreCard();
    toast('Pedidos pelo site retomados');
    return;
  }
  const msg = input({ placeholder: 'Ex.: Voltamos em 30 minutos', maxlength: 120 });
  modal({
    title: 'Pausar pedidos do site',
    icon: 'pause',
    body: h('div', { class: 'stack' },
      h('p', { class: 'muted', style: { margin: 0 } }, 'O site para de aceitar pedidos até você retomar. Use em caso de movimento alto, falta de produto ou imprevisto.'),
      field('Mensagem para o cliente (opcional)', msg)),
    actions: [
      { label: 'Cancelar' },
      {
        label: 'Pausar pedidos', kind: 'primary', icon: 'pause', submit: true,
        onClick: async () => {
          state.store = await patch('/api/admin/store', { paused: true, pauseMessage: msg.value });
          renderStoreCard();
          toast('Pedidos pelo site pausados');
        },
      },
    ],
  });
}

// ---------- Navegação ----------

function buildNav() {
  const views = allowedViews();
  $('#nav').replaceChildren(...GROUPS.map(group => {
    const items = views.filter(v => v.group === group);
    if (!items.length) return null;
    return h('div', { class: 'nav-group' },
      h('div', { class: 'nav-group__label' }, group),
      items.map(v => h('button', { class: 'nav__item', dataset: { view: v.id }, title: v.label, onclick: () => go(v.id) },
        icon(v.icon, { size: 19 }), h('span', { class: 'nav__label' }, v.label),
        v.id === 'pedidos' ? h('span', { class: 'nav__badge', hidden: true }, '0') : h('span', { class: 'nav__key' }, `Ctrl ${views.indexOf(v) + 1}`))));
  }).filter(Boolean));
}

export function go(id) {
  const view = allowedViews().find(v => v.id === id) || allowedViews()[0];
  state.current?.destroy?.();
  state.listeners.clear();
  document.querySelectorAll('.nav__item').forEach(b => b.classList.toggle('is-active', b.dataset.view === view.id));
  $('#view-title').textContent = view.title || view.label;
  $('#view-subtitle').textContent = view.subtitle || '';
  $('#crumb').replaceChildren(view.group, icon('chevronRight', { size: 13 }), h('b', {}, view.label));
  $('#view-actions').replaceChildren();
  const container = $('#view');
  // recria o elemento para reiniciar a animação de entrada
  const fresh = container.cloneNode(false);
  container.replaceWith(fresh);
  state.current = view;
  view.render(fresh, { actions: $('#view-actions'), setSubtitle: (t) => { $('#view-subtitle').textContent = t; } });
  setPref('gestao-view', view.id);
}

function setCollapsed(collapsed) {
  $('#app').classList.toggle('is-collapsed', collapsed);
  $('#collapse').replaceChildren(icon('sidebar', { size: 16 }));
  $('#collapse').title = collapsed ? 'Expandir menu (Ctrl+B)' : 'Recolher menu (Ctrl+B)';
  setPref('gestao-collapsed', collapsed ? '1' : '0');
}
const toggleCollapsed = () => setCollapsed(!$('#app').classList.contains('is-collapsed'));

// ---------- Busca rápida (Ctrl+K) ----------

let paletteOpen = false;

function openPalette() {
  if (!state.user || paletteOpen) return;
  paletteOpen = true;
  const field = h('input', { placeholder: 'Buscar pedido (nº, cliente, telefone), tela ou ação…', spellcheck: 'false' });
  const list = h('div', { class: 'palette__list', role: 'listbox' });
  let items = [];
  let active = 0;

  const close = () => {
    paletteOpen = false;
    backdrop.remove();
  };

  function entries(q) {
    const query = q.trim().toLowerCase();
    const digits = query.replace(/\D/g, '');
    const views = allowedViews();
    const groups = [];

    if (query) {
      const orders = state.orders.filter(o => o.customerName.toLowerCase().includes(query) || o.code.includes(query) || (digits.length >= 2 && (o.customerPhone.includes(digits) || String(o.id) === digits))).slice(0, 6);
      if (orders.length) {
        groups.push(['Pedidos', orders.map(o => ({ icon: 'receipt', label: `${o.code} · ${o.customerName}`, hint: o.statusLabel, run: () => openOrderDetail(o.id) }))]);
      }
    }
    groups.push(['Ir para', views.filter(v => !query || v.label.toLowerCase().includes(query)).map(v => ({ icon: v.icon, label: v.label, hint: `Ctrl ${views.indexOf(v) + 1}`, run: () => go(v.id) }))]);
    const actions = [
      can('store.pause') && { icon: state.store?.settings.paused ? 'play' : 'pause', label: state.store?.settings.paused ? 'Retomar pedidos do site' : 'Pausar pedidos do site', run: () => togglePause().catch(e => toast(e.message, 'error')) },
      { icon: 'refresh', label: 'Atualizar pedidos', hint: 'F5', run: () => refreshOrders().then(() => toast('Pedidos atualizados')) },
      { icon: document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun', label: 'Alternar tema claro/escuro', run: toggleTheme },
      { icon: 'sidebar', label: 'Recolher/expandir menu', hint: 'Ctrl B', run: toggleCollapsed },
      { icon: 'keyboard', label: 'Atalhos de teclado', hint: 'F1', run: showShortcuts },
      { icon: 'logout', label: 'Sair da conta', run: logout },
    ].filter(Boolean).filter(a => !query || a.label.toLowerCase().includes(query));
    groups.push(['Ações', actions]);
    return groups.filter(([, list]) => list.length);
  }

  function draw() {
    const groups = entries(field.value);
    items = groups.flatMap(([, list]) => list);
    active = Math.min(active, Math.max(0, items.length - 1));
    let i = 0;
    list.replaceChildren(...(items.length ? groups.map(([title, list]) => [
      h('div', { class: 'palette__group' }, title),
      list.map(item => {
        const idx = i++;
        return h('button', {
          class: `palette__item ${idx === active ? 'is-active' : ''}`, role: 'option',
          onmousemove: () => { if (active !== idx) { active = idx; draw(); } },
          onclick: () => { close(); item.run(); },
        }, icon(item.icon), h('span', {}, item.label), item.hint ? h('small', {}, item.hint) : null);
      }),
    ]).flat(2) : [h('div', { class: 'empty' }, 'Nada encontrado')]));
    list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  field.addEventListener('input', () => { active = 0; draw(); });
  field.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, items.length); draw(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % Math.max(1, items.length); draw(); }
    if (e.key === 'Enter' && items[active]) { e.preventDefault(); const item = items[active]; close(); item.run(); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  const backdrop = h('div', { class: 'palette-backdrop', onmousedown: (e) => { if (e.target === backdrop) close(); } },
    h('div', { class: 'palette', role: 'dialog', 'aria-label': 'Busca rápida' },
      h('div', { class: 'palette__input' }, icon('search', { size: 19 }), field, h('kbd', {}, 'Esc')),
      list,
      h('div', { class: 'palette__foot' }, h('span', {}, h('kbd', {}, '↑'), ' ', h('kbd', {}, '↓'), ' navegar'), h('span', {}, h('kbd', {}, 'Enter'), ' abrir'), h('span', {}, h('kbd', {}, 'Esc'), ' fechar'))));
  document.body.append(backdrop);
  draw();
  field.focus();
}

function showShortcuts() {
  const row = (keys, text) => [h('span', {}, text), h('span', {}, keys.map(k => h('kbd', {}, k)))];
  modal({
    title: 'Atalhos de teclado',
    icon: 'keyboard',
    body: h('div', { class: 'shortcuts' },
      row(['Ctrl', 'K'], 'Busca rápida (pedidos, telas e ações)'),
      row(['Ctrl', '1…9'], 'Ir para as telas do menu'),
      row(['F5'], 'Atualizar pedidos agora'),
      row(['Ctrl', 'B'], 'Recolher/expandir o menu'),
      row(['Esc'], 'Fechar janelas'),
      row(['F1'], 'Esta lista')),
    actions: [{ label: 'Fechar', kind: 'primary' }],
  });
}

function setupShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (!state.user) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    if (paletteOpen || document.querySelector('.modal-backdrop')) return;
    if (ctrl && /^[1-9]$/.test(e.key)) {
      const view = allowedViews()[Number(e.key) - 1];
      if (view) { e.preventDefault(); go(view.id); }
    } else if (ctrl && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleCollapsed();
    } else if (e.key === 'F5') {
      e.preventDefault();
      refreshOrders().then(() => toast('Pedidos atualizados'));
    } else if (e.key === 'F1') {
      e.preventDefault();
      showShortcuts();
    }
  });
}

// ---------- Login ----------

function showShell(visible) {
  $('#body').hidden = !visible;
  $('#search-trigger').hidden = !visible;
  $('#crumb').hidden = !visible;
  $('#login-screen').hidden = visible;
}

async function showLogin(message) {
  stopPolling();
  state.user = null;
  showShell(false);
  state.config = await window.gestao.getConfig();
  $('#login-server').textContent = state.config.serverUrl.replace(/^https?:\/\//, '');
  const err = $('#login-error');
  err.hidden = !message;
  err.replaceChildren(icon('alert', { size: 16 }), h('span', {}, message || ''));
  $('#login-pass').value = '';
  $('#login-user').focus();
  setConnection(true);
}

async function enterApp(user) {
  state.user = user;
  state.config = await window.gestao.getConfig();
  showShell(true);
  $('#user-name').textContent = user.displayName;
  $('#user-role').textContent = user.roleLabel;
  $('#user-avatar').textContent = user.displayName.slice(0, 1).toUpperCase();
  $('#server-text').replaceChildren(icon('server'), state.config.serverUrl.replace(/^https?:\/\//, ''));
  buildNav();
  setCollapsed(pref('gestao-collapsed', '0') === '1');
  knownIds = null;
  await Promise.all([pollOrders(), refreshStore()]);
  go(pref('gestao-view', 'pedidos'));
  pollTimer = setInterval(pollOrders, POLL_MS);
  storeTimer = setInterval(refreshStore, STORE_POLL_MS);
  syncTimer = setInterval(updateSync, 5000);
}

function stopPolling() {
  clearInterval(pollTimer);
  clearInterval(storeTimer);
  clearInterval(syncTimer);
  state.current?.destroy?.();
  state.current = null;
}

export async function logout() {
  await window.gestao.logout();
  showLogin();
}

export async function reloadConfig() {
  state.config = await window.gestao.getConfig();
  return state.config;
}

function changeServer() {
  const url = input({ value: state.config.serverUrl, placeholder: 'https://universal-prensados.netlify.app' });
  modal({
    title: 'Endereço do servidor',
    icon: 'server',
    body: field('Endereço do site', url, 'O app usa a API do site. Para testes locais: http://localhost:3000'),
    actions: [
      { label: 'Cancelar' },
      {
        label: 'Salvar', kind: 'primary', submit: true,
        onClick: async () => {
          const res = await window.gestao.setConfig({ serverUrl: url.value });
          if (!res.ok) throw new Error(res.error);
          state.config = res.config;
          $('#login-server').textContent = res.config.serverUrl.replace(/^https?:\/\//, '');
        },
      },
    ],
  });
}

function setupLogin() {
  $('#login-features').replaceChildren(
    ...[['bell', 'Pedidos ao vivo'], ['printer', 'Comanda impressa'], ['wallet', 'Caixa e financeiro']].map(([i, t]) => h('span', {}, icon(i), t)));
  $('#login-server-icon').replaceChildren(icon('server'));
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = $('#login-submit');
    b.disabled = true;
    b.textContent = 'Entrando…';
    try {
      const res = await window.gestao.login($('#login-user').value.trim(), $('#login-pass').value, $('#login-remember').checked);
      if (!res.ok) throw new Error(res.data?.error || 'Não foi possível entrar');
      await enterApp(res.data.user);
    } catch (error) {
      $('#login-error').replaceChildren(icon('alert', { size: 16 }), h('span', {}, error.message));
      $('#login-error').hidden = false;
    } finally {
      b.disabled = false;
      b.textContent = 'Entrar';
    }
  });
  $('#login-change-server').addEventListener('click', changeServer);
}

// ---------- Início ----------

// Sem conexão por mais de 1 minuto: avisa (pedidos novos não estão chegando)
const OFFLINE_ALERT_MS = 60000;
let offlineSince = null;
let offlineAlerted = false;

function setConnection(online, error) {
  $('#conn-dot').className = `dot dot--${online ? 'ok' : 'danger'}`;
  $('#conn-text').textContent = online ? 'Conectado' : 'Sem conexão com o servidor';
  $('#conn-text').title = online ? '' : error || '';
  if (online) {
    if (offlineAlerted && state.user) toast('Conexão restabelecida. Os pedidos voltaram a chegar.');
    offlineSince = null;
    offlineAlerted = false;
    return;
  }
  offlineSince ??= Date.now();
  if (state.user && !offlineAlerted && Date.now() - offlineSince >= OFFLINE_ALERT_MS) {
    offlineAlerted = true;
    window.gestao.notify('Sem conexão com o servidor', 'Os pedidos novos do site não estão chegando. Confira a internet deste computador.');
    toast('Sem conexão há mais de 1 minuto: os pedidos novos não estão chegando.', 'error');
  }
}

async function start() {
  applyTheme();
  setupLogin();
  setupShortcuts();
  setUnauthorizedHandler((msg) => { if (state.user) showLogin(msg || 'Sua sessão expirou. Entre novamente.'); });
  setConnectionHandler(setConnection);
  $('#search-icon').replaceChildren(icon('search', { size: 15 }));
  $('#search-trigger').addEventListener('click', openPalette);
  $('#logout').replaceChildren(icon('logout', { size: 16 }));
  $('#logout').addEventListener('click', logout);
  $('#collapse').addEventListener('click', toggleCollapsed);
  $('#store-pause').addEventListener('click', () => togglePause().catch(err => toast(err.message, 'error')));
  $('#shortcuts-btn').replaceChildren(icon('keyboard', { size: 14 }), 'Atalhos');
  $('#shortcuts-btn').addEventListener('click', showShortcuts);

  const started = Date.now();
  state.config = await window.gestao.getConfig();
  $('#version-text').textContent = `v${state.config.version}`;
  const user = await window.gestao.restoreSession();
  if (user && !user.offline) await enterApp(user);
  else await showLogin(user?.offline ? `${user.error}. Confira a internet e tente de novo.` : '');
  // abertura visível por um instante, sem piscar
  setTimeout(() => $('#splash').classList.add('is-done'), Math.max(0, 700 - (Date.now() - started)));
}

start();
