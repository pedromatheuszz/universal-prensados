// Utilitários de interface: criação de elementos (sempre como texto, nunca HTML cru),
// formatação, avisos, janelas modais, estados vazios/carregando e formulários.
import { icon } from './icons.js';

export { icon };

/** h('div', { class: 'x', onclick }, 'texto', filho...) — atributos on* viram eventos */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'value') el.value = value;
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);

/** Botão com ícone: btn('Salvar', { icon: 'check', kind: 'primary', onclick }) */
export function btn(label, { icon: name, kind = '', size = '', title, onclick, type = 'button', disabled } = {}) {
  const cls = ['btn', kind && `btn--${kind}`, size && `btn--${size}`, !label && 'btn--icon'].filter(Boolean).join(' ');
  return h('button', { type, class: cls, title: title || (label ? undefined : ''), 'aria-label': label ? undefined : title, onclick, disabled },
    name ? icon(name) : null, label ? h('span', {}, label) : null);
}

export const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (v) => BRL.format(Number(v) || 0);
export const time = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const date = (iso) => new Date(iso).toLocaleDateString('pt-BR');
export const dateTime = (iso) => `${date(iso)} ${time(iso)}`;
export const minutesSince = (iso) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
/** 45 → "45 min"; 135 → "2h15" */
export const elapsed = (mins) => (mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`);
export const phone = (p) => String(p || '').replace(/^55(?=\d{10,11}$)/, '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
export const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
export const shiftDays = (iso, days) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export const parseMoney = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.'));
export const moneyInput = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');

export const PAYMENT = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro' };
export const PAYMENT_ICON = { pix: 'pix', cartao: 'card', dinheiro: 'cash' };
export const STATUS = {
  novo: { label: 'Novo', kind: 'primary', icon: 'bell' },
  preparando: { label: 'Em preparo', kind: 'warn', icon: 'flame' },
  pronto: { label: 'Pronto p/ retirada', kind: 'info', icon: 'bag' },
  saiu_entrega: { label: 'Saiu p/ entrega', kind: 'info', icon: 'bike' },
  entregue: { label: 'Entregue', kind: 'ok', icon: 'checkCircle' },
  cancelado: { label: 'Cancelado', kind: 'danger', icon: 'xCircle' },
};
export const statusPill = (s) => h('span', { class: `pill pill--${STATUS[s]?.kind || ''}` }, icon(STATUS[s]?.icon || 'info'), STATUS[s]?.label || s);
export const paymentPill = (m) => h('span', { class: 'pill' }, icon(PAYMENT_ICON[m] || 'wallet'), PAYMENT[m] || m);

// ---------- Estados de carregamento e vazio ----------

export const skeleton = (rows = 4, height = 44) =>
  h('div', { class: 'skeleton-list' }, Array.from({ length: rows }, () => h('div', { class: 'skeleton', style: { height: `${height}px` } })));

export const emptyState = (title, text = '', iconName = 'inbox') =>
  h('div', { class: 'empty' }, h('div', { class: 'empty__icon' }, icon(iconName, { size: 22 })), h('strong', {}, title), text ? h('span', {}, text) : null);

// ---------- Avisos ----------

export function toast(message, kind = 'ok') {
  const name = { ok: 'check', error: 'alert', info: 'bell' }[kind] || 'info';
  const t = h('div', { class: `toast toast--${kind}`, role: kind === 'error' ? 'alert' : 'status' },
    h('span', { class: 'toast__icon' }, icon(name, { size: 16 })), h('span', {}, message));
  document.getElementById('toast-root').append(t);
  setTimeout(() => {
    t.classList.add('is-leaving');
    setTimeout(() => t.remove(), 220);
  }, kind === 'error' ? 6000 : 3500);
}

// ---------- Modal ----------

/**
 * Abre uma janela modal. actions: [{ label, kind, icon, onClick(close, setError) → false mantém aberta, left, submit }]
 * Retorna { close, setError, el }.
 */
export function modal({ title, body, actions = [], wide = false, onClose, icon: titleIcon }) {
  const root = document.getElementById('modal-root');
  const errorText = h('span');
  const errorBox = h('div', { class: 'modal__error', hidden: true, role: 'alert' }, icon('alert', { size: 16 }), errorText);
  let closed = false;
  const previousFocus = document.activeElement;

  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
    previousFocus?.focus?.();
    onClose?.();
  };
  const setError = (msg) => {
    errorText.textContent = msg || '';
    errorBox.hidden = !msg;
  };

  const buttons = actions.map(a => {
    const b = h('button', { type: a.submit ? 'submit' : 'button', class: `btn ${a.kind ? `btn--${a.kind}` : ''} ${a.left ? 'left' : ''}` },
      a.icon ? icon(a.icon) : null, h('span', {}, a.label));
    b.addEventListener('click', async (e) => {
      if (a.submit) return; // tratado pelo submit do formulário
      e.preventDefault();
      await run(a, b);
    });
    return b;
  });

  async function run(a, b) {
    if (!a.onClick) return close();
    setError('');
    b.disabled = true;
    try {
      const keep = await a.onClick(close, setError);
      if (keep !== false) close();
    } catch (err) {
      setError(err.message);
    } finally {
      b.disabled = false;
    }
  }

  const content = h('div', { class: 'modal__body' }, body, errorBox);
  const submitAction = actions.find(a => a.submit);
  const box = submitAction
    ? h('form', { class: `modal ${wide ? 'modal--wide' : ''}`, novalidate: true, onsubmit: (e) => { e.preventDefault(); run(submitAction, buttons[actions.indexOf(submitAction)]); } })
    : h('div', { class: `modal ${wide ? 'modal--wide' : ''}` });
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', typeof title === 'string' ? title : '');
  box.append(
    h('div', { class: 'modal__head' },
      titleIcon ? h('span', { class: 'card__icon' }, icon(titleIcon)) : null,
      h('h2', {}, title),
      h('button', { type: 'button', class: 'btn btn--ghost btn--icon btn--sm modal__close', 'aria-label': 'Fechar (Esc)', title: 'Fechar (Esc)', onclick: close }, icon('x'))),
    content,
    actions.length ? h('div', { class: 'modal__foot' }, buttons) : null,
  );

  const backdrop = h('div', { class: 'modal-backdrop', onmousedown: (e) => { if (e.target === backdrop) close(); } }, box);
  const onKey = (e) => {
    if (e.key === 'Escape' && root.lastElementChild === backdrop) {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', onKey, true);
  root.append(backdrop);
  setTimeout(() => box.querySelector('input:not([type=checkbox]):not(:disabled), select, textarea')?.focus(), 30);
  return { close, setError, el: box };
}

export function confirmDialog(message, { title = 'Confirmar', confirmLabel = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    modal({
      title,
      icon: danger ? 'alert' : 'info',
      body: h('p', { class: 'muted' }, message),
      onClose: () => { if (!answered) resolve(false); },
      actions: [
        { label: 'Cancelar' },
        { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: () => { answered = true; resolve(true); } },
      ],
    });
  });
}

// ---------- Campos de formulário ----------

export const field = (label, input, hint) => h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', {}, hint) : null);
export const input = (attrs = {}) => h('input', { class: `input ${attrs.money ? 'input--money' : ''}`, spellcheck: 'false', ...attrs, money: undefined });
export const searchInput = (attrs = {}) => {
  const el = input({ type: 'search', ...attrs });
  return Object.assign(h('div', { class: 'input-icon' }, icon('search', { size: 16 }), el), { input: el });
};
export const select = (options, value, attrs = {}) => h('select', { class: 'input', ...attrs },
  options.map(o => {
    const [v, label] = Array.isArray(o) ? o : [o, o];
    return h('option', { value: v, selected: String(v) === String(value) }, label);
  }));
export const textarea = (value = '', attrs = {}) => h('textarea', { class: 'input', ...attrs }, value);
export function toggle(checked, onChange, { disabled = false, label = '' } = {}) {
  const box = h('input', { type: 'checkbox', checked, disabled });
  box.addEventListener('change', () => onChange(box.checked, box));
  return h('label', { class: 'switch', onclick: (e) => e.stopPropagation() }, box, h('span', { class: 'switch__track' }), label ? h('span', {}, label) : null);
}

/** Cartão com cabeçalho: card({ title, subtitle, icon, actions }, ...conteúdo) */
export function card({ title, subtitle, icon: name, actions, flush = false, tag = 'div', ...attrs } = {}, ...children) {
  return h(tag, { class: `card ${flush ? 'card--flush' : ''}`, ...attrs },
    title ? h('div', { class: 'card__head', style: flush ? { padding: '1.1rem 1.25rem 0' } : undefined },
      name ? h('span', { class: 'card__icon' }, icon(name)) : null,
      h('div', {}, h('h2', {}, title), subtitle ? h('p', {}, subtitle) : null),
      actions ? h('div', { class: 'row', style: { marginLeft: 'auto' } }, actions) : null) : null,
    children);
}

/** Indicador: kpi({ label, value, hint, icon, tone: 'accent'|'ok'|'warn'|'danger' }) */
export const kpi = ({ label, value, hint, icon: name, tone = '' }) =>
  h('div', { class: `kpi ${tone ? `kpi--${tone}` : ''}` },
    h('span', {}, label), name ? h('div', { class: 'kpi__icon' }, icon(name, { size: 19 })) : null,
    h('strong', {}, value), hint ? h('small', {}, hint) : null);

/** Barras horizontais: rows [{ label, value, display }] */
export function hbars(rows) {
  const max = Math.max(1, ...rows.map(r => r.value));
  if (!rows.length) return emptyState('Sem dados no período', '', 'chart');
  return h('div', {}, rows.map(r => h('div', { class: 'hbar' },
    h('span', {}, r.label),
    h('div', { class: 'hbar__track' }, h('div', { class: 'hbar__fill', style: { width: `${(r.value / max) * 100}%` } })),
    h('strong', { class: 'num' }, r.display ?? r.value))));
}
