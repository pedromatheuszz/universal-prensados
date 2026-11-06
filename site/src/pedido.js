// Página pública de acompanhamento do pedido (/pedido/?t=TOKEN)
import { gsap } from 'gsap';
import { formatBRL } from './utils.js';

const POLL_MS = 15000;
const FINAL = ['entregue', 'cancelado'];

const STEPS = {
  delivery: [
    ['novo', 'Recebido', 'A cozinha já viu seu pedido'],
    ['preparando', 'Em preparo', 'Seu lanche está na chapa'],
    ['saiu_entrega', 'Saiu para entrega', 'O motoboy está a caminho'],
    ['entregue', 'Entregue', 'Bom apetite!'],
  ],
  pickup: [
    ['novo', 'Recebido', 'A cozinha já viu seu pedido'],
    ['preparando', 'Em preparo', 'Seu lanche está na chapa'],
    ['pronto', 'Pronto para retirar', 'Pode vir buscar no balcão'],
    ['entregue', 'Retirado', 'Bom apetite!'],
  ],
};

const PAYMENT = { pix: 'Pix', cartao: 'Cartão na entrega', dinheiro: 'Dinheiro' };
const $ = (id) => document.getElementById(id);
const time = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const params = new URLSearchParams(location.search);
let token = params.get('t');
try { token ||= localStorage.getItem('up_last_order'); } catch { /* sem armazenamento */ }

let lastStatus = null;
let timer = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showError(message) {
  $('tracking-loading').classList.add('hidden');
  $('tracking-order').classList.add('hidden');
  $('tracking-error').classList.remove('hidden');
  if (message) $('tracking-error-msg').textContent = message;
}

function render(order) {
  $('tracking-loading').classList.add('hidden');
  $('tracking-error').classList.add('hidden');
  $('tracking-order').classList.remove('hidden');

  $('t-code').textContent = order.code;
  $('t-title').textContent = `Olá, ${order.firstName}!`;
  $('t-subtitle').textContent = order.deliveryType === 'delivery'
    ? `Entrega em ${order.district} • pedido feito às ${time(order.createdAt)}`
    : `Retirada no balcão • pedido feito às ${time(order.createdAt)}`;

  const cancelled = order.status === 'cancelado';
  $('t-cancelled').classList.toggle('hidden', !cancelled);

  // Linha do tempo
  const steps = STEPS[order.deliveryType] || STEPS.delivery;
  const reached = new Map(order.history.map(h => [h.status, h.at]));
  const currentIndex = steps.findIndex(([s]) => s === order.status);
  const list = $('t-steps');
  list.replaceChildren(...steps.map(([status, label, hint], i) => {
    const done = !cancelled && i <= currentIndex;
    const li = el('li', `steps__item${done ? ' is-done' : ''}${!cancelled && i === currentIndex && !FINAL.includes(status) ? ' is-current' : ''}`);
    li.append(el('span', 'steps__dot', done ? '✓' : String(i + 1)));
    const body = el('div', 'steps__body');
    body.append(el('strong', '', label));
    body.append(el('span', '', reached.has(status) ? `${hint} • ${time(reached.get(status))}` : hint));
    li.append(body);
    return li;
  }));
  list.style.setProperty('--progress', cancelled ? 0 : Math.max(0, currentIndex) / (steps.length - 1));

  // Itens
  $('t-items').replaceChildren(...order.items.map(item => {
    const li = el('li');
    li.append(el('strong', '', `${item.qty}x ${item.name}`));
    const details = [...item.extras.map(e => `+ ${e}`), ...item.removals].join(' • ');
    if (details) li.append(el('span', '', details));
    return li;
  }));

  const rows = [['Subtotal', formatBRL(order.subtotal)]];
  if (order.discount > 0) rows.push(['Desconto', `- ${formatBRL(order.discount)}`]);
  if (order.deliveryType === 'delivery') rows.push(['Entrega', order.deliveryFee === 0 ? 'Grátis' : formatBRL(order.deliveryFee)]);
  rows.push(['Total', formatBRL(order.total)], ['Pagamento', PAYMENT[order.paymentMethod] || order.paymentMethod]);
  $('t-totals').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', '', k), el('dd', '', v)]));

  $('t-updated').textContent = FINAL.includes(order.status)
    ? ''
    : `Atualiza sozinho • última verificação às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  // Animação quando o status muda
  if (lastStatus && lastStatus !== order.status && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
    gsap.fromTo('.steps__item.is-current, .steps__item.is-done:last-of-type', { scale: 0.92 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    if ('vibrate' in navigator) navigator.vibrate(120);
  }
  if (!lastStatus) gsap.from('.tracking-card:not(.hidden) > *', { y: 16, autoAlpha: 0, stagger: 0.05, duration: 0.5, ease: 'power3.out' });
  lastStatus = order.status;

  if (FINAL.includes(order.status)) clearInterval(timer);
}

async function load() {
  try {
    const res = await fetch(`/api/track/${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
    if (res.status === 404) return showError();
    if (!res.ok) throw new Error(String(res.status));
    render(await res.json());
  } catch {
    if (!lastStatus) showError('Não conseguimos carregar agora. Tentaremos de novo em instantes.');
  }
}

if (!token) {
  showError('Abra o link de acompanhamento que aparece depois de finalizar o pedido.');
} else {
  load();
  timer = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
}
