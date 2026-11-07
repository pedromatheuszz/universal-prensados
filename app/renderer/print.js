// Comanda para impressora térmica (80 ou 58 mm). O HTML é montado com texto escapado.
import { PAYMENT, phone } from './ui.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function orderTicketHtml(order, { storeName = 'Universal Prensados', paperWidth = 80 } = {}) {
  const created = new Date(order.createdAt);
  const a = order.address || {};
  const items = order.items.map(item => `
    <div class="item">
      <div class="line"><b>${esc(item.qty)}x ${esc(item.name)}</b><span>${brl(item.unitPrice * item.qty)}</span></div>
      ${(item.extras || []).map(e => `<div class="sub">+ ${esc(e.name)}</div>`).join('')}
      ${(item.removals || []).map(r => `<div class="sub">${esc(r)}</div>`).join('')}
      ${item.notes ? `<div class="obs">OBS: ${esc(item.notes)}</div>` : ''}
    </div>`).join('');

  // CSP sem scripts: mesmo se algum texto escapasse do esc(), nada executaria na janela de impressão
  return `<!doctype html><html><head><meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <style>
    @page { margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 3mm 3mm 6mm; width: ${paperWidth}mm; font: 12px/1.35 'Consolas', 'Courier New', monospace; color: #000; }
    h1 { font-size: 15px; text-align: center; margin: 0 0 2px; }
    .center { text-align: center; }
    .code { font-size: 22px; font-weight: 800; text-align: center; margin: 4px 0; }
    .type { text-align: center; font-weight: 800; font-size: 14px; border: 2px solid #000; padding: 2px; margin: 4px 0; }
    hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
    .line { display: flex; justify-content: space-between; gap: 6px; }
    .item { margin-bottom: 5px; }
    .sub { padding-left: 10px; }
    .obs { padding-left: 10px; font-weight: 800; }
    .total { font-size: 15px; font-weight: 800; }
  </style></head><body>
    <h1>${esc(storeName)}</h1>
    <div class="center">${created.toLocaleDateString('pt-BR')} ${created.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
    <div class="code">PEDIDO ${esc(order.code)}</div>
    <div class="type">${order.deliveryType === 'delivery' ? 'ENTREGA' : 'RETIRADA NO BALCÃO'}</div>
    <div><b>${esc(order.customerName)}</b></div>
    <div>${esc(phone(order.customerPhone))}</div>
    ${order.deliveryType === 'delivery' ? `
      <div>${esc(a.street)}, ${esc(a.number)}${a.compl ? ` - ${esc(a.compl)}` : ''}</div>
      <div>${esc(order.district)}${a.cep ? ` - CEP ${esc(a.cep)}` : ''}</div>
      ${a.ref ? `<div>Ref.: ${esc(a.ref)}</div>` : ''}` : ''}
    <hr>
    ${items}
    <hr>
    <div class="line"><span>Subtotal</span><span>${brl(order.subtotal)}</span></div>
    ${order.discount ? `<div class="line"><span>Desconto${order.couponCode ? ` (${esc(order.couponCode)})` : ''}</span><span>- ${brl(order.discount)}</span></div>` : ''}
    ${order.deliveryType === 'delivery' ? `<div class="line"><span>Entrega</span><span>${order.deliveryFee ? brl(order.deliveryFee) : 'Grátis'}</span></div>` : ''}
    <div class="line total"><span>TOTAL</span><span>${brl(order.total)}</span></div>
    <hr>
    <div><b>Pagamento:</b> ${esc(PAYMENT[order.paymentMethod] || order.paymentMethod)}</div>
    ${order.changeFor ? `<div><b>Troco para:</b> ${esc(order.changeFor)}</div>` : ''}
    <hr>
    <div class="center">Pedido feito pelo site</div>
  </body></html>`;
}
