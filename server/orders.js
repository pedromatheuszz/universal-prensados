// Regras de negócio dos pedidos. Preços, taxas e cupons são sempre recalculados
// no servidor a partir do cardápio do banco — o que o navegador envia não é confiável.
import crypto from 'crypto';
import { REMOVALS } from '../shared/menu-options.js';
import { calcSubtotal, calcDiscount, calcDeliveryFee, calcTotal, findCoupon, repriceCart } from '../shared/pricing.js';
import { getStoreStatus } from '../shared/store-hours.js';
import { HttpError } from './http.js';
import { cleanText } from './text.js';

export const STATUSES = ['novo', 'preparando', 'pronto', 'saiu_entrega', 'entregue', 'cancelado'];

export const STATUS_LABELS = {
  novo: 'Pedido recebido',
  preparando: 'Em preparo',
  pronto: 'Pronto para retirada',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

// Próximos status permitidos a partir de cada status
const TRANSITIONS = {
  novo: ['preparando', 'cancelado'],
  preparando: ['pronto', 'saiu_entrega', 'cancelado'],
  pronto: ['saiu_entrega', 'entregue', 'cancelado'],
  saiu_entrega: ['entregue', 'cancelado'],
  entregue: [],
  cancelado: [],
};

export function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

const PAYMENT_METHODS = ['pix', 'cartao', 'dinheiro'];
const MAX_ITEMS = 40;
const MAX_QTY = 99;

const text = (value, max) => cleanText(value, max);

// Identificador do checkout gerado no navegador: reenviar o mesmo pedido (rede lenta,
// clique duplo) devolve o pedido já criado em vez de criar outro
const CLIENT_REF_RE = /^[A-Za-z0-9_-]{16,64}$/;
export const parseClientRef = (value) => (typeof value === 'string' && CLIENT_REF_RE.test(value) ? value : null);

/**
 * Valida a entrada do checkout e devolve o pedido normalizado com valores calculados.
 * catalog vem de getPricingCatalog(db). Lança HttpError(422) com a lista de problemas
 * encontrados, ou 409 se a loja estiver fechada/pausada.
 */
export function buildOrder(input, { products, settings, extras }, now = new Date()) {
  const errors = [];
  const body = input && typeof input === 'object' ? input : {};

  const store = getStoreStatus(now, settings);
  if (!store.open) throw new HttpError(409, `Não estamos recebendo pedidos agora (${store.label.replace(/^\S+ • /, '')}).`);

  const name = text(body.customer?.name, 80);
  const phone = String(body.customer?.phone ?? '').replace(/\D/g, '').slice(0, 13);
  if (name.length < 2) errors.push('Informe seu nome');
  if (phone.length < 10) errors.push('Informe um telefone com DDD');

  const deliveryType = body.deliveryType === 'pickup' ? 'pickup' : body.deliveryType === 'delivery' ? 'delivery' : null;
  if (!deliveryType) errors.push('Escolha entrega ou retirada');

  let address = null;
  let district = null;
  let districtFee = NaN;
  if (deliveryType === 'delivery') {
    const a = body.address || {};
    address = {
      cep: String(a.cep ?? '').replace(/\D/g, '').slice(0, 8),
      street: text(a.street, 120),
      number: text(a.number, 20),
      compl: text(a.compl, 80),
      ref: text(a.ref, 120),
    };
    const found = settings.districts.find(d => d.name === a.district);
    if (!found) errors.push('Selecione um bairro atendido');
    else { district = found.name; districtFee = found.fee; }
    if (!address.street || !address.number) errors.push('Informe rua e número');
  }

  const paymentMethod = PAYMENT_METHODS.includes(body.payment?.method) ? body.payment.method : null;
  if (!paymentMethod) errors.push('Escolha a forma de pagamento');
  const changeFor = paymentMethod === 'dinheiro' ? text(body.payment?.changeFor, 20) || null : null;

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) errors.push('O carrinho está vazio');
  // nada é descartado em silêncio: o total cobrado precisa bater com o que o cliente escolheu
  if (rawItems.length > MAX_ITEMS) errors.push(`O pedido pode ter no máximo ${MAX_ITEMS} itens diferentes`);
  if (rawItems.some(item => Number(item?.qty) > MAX_QTY)) errors.push(`Máximo de ${MAX_QTY} unidades por item`);
  const cleanItems = rawItems.slice(0, MAX_ITEMS).map(item => ({
    id: item?.id,
    qty: item?.qty,
    // cada adicional vale uma vez por lanche (repetido não é cobrado em dobro)
    extras: [...new Set((Array.isArray(item?.extras) ? item.extras : []).slice(0, 30).map(e => (typeof e === 'string' ? e : e?.name)))]
      .map(name => ({ name })),
    removals: [...new Set((Array.isArray(item?.removals) ? item.removals : []).filter(r => REMOVALS.includes(r)))],
    notes: cleanText(item?.notes, 300, { multiline: true }),
  }));
  const items = repriceCart(cleanItems, products, extras);
  if (cleanItems.length > 0 && items.length !== cleanItems.length) {
    errors.push('Algum item do carrinho não está mais disponível');
  } else if (items.some((item, i) => products.get(item.id)?.hasExtras && item.extras.length !== cleanItems[i].extras.length)) {
    errors.push('Algum adicional escolhido não está mais disponível');
  }
  const soldOut = items.filter(i => products.get(i.id)?.soldOut);
  if (soldOut.length) errors.push(`Esgotado no momento: ${soldOut.map(i => i.name).join(', ')}`);

  if (errors.length) throw new HttpError(422, errors[0], errors);

  const coupon = body.couponCode ? findCoupon(body.couponCode, settings.coupons) : null;
  if (body.couponCode && !coupon) {
    throw new HttpError(422, 'Cupom inválido ou expirado. Remova o cupom para continuar.', { field: 'couponCode' });
  }
  const subtotal = calcSubtotal(items);
  const discount = calcDiscount(subtotal, coupon);
  const fee = calcDeliveryFee({
    isDelivery: deliveryType === 'delivery',
    subtotal,
    districtFee,
    freeShippingThreshold: settings.freeShippingThreshold,
  });

  return {
    customerName: name,
    customerPhone: phone,
    deliveryType,
    address,
    district,
    paymentMethod,
    changeFor,
    items: items.map(({ id, name: itemName, qty, unitPrice, extras: ex, removals, notes }) => ({ id, name: itemName, qty, unitPrice, extras: ex, removals, notes })),
    subtotal,
    discount,
    deliveryFee: fee,
    total: calcTotal({ subtotal, discount, fee }),
    couponCode: coupon?.code ?? null,
    clientRef: parseClientRef(body.clientRef),
  };
}

export const orderCode = (id) => `#${String(id).padStart(4, '0')}`;

const num = (v) => Number(v ?? 0);

// Linha do banco → objeto da API da equipe
export function toStaffOrder(row) {
  return {
    id: Number(row.id),
    code: orderCode(row.id),
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    nextStatuses: TRANSITIONS[row.status] || [],
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryType: row.delivery_type,
    address: row.address,
    district: row.district,
    paymentMethod: row.payment_method,
    changeFor: row.change_for,
    items: row.items,
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    deliveryFee: num(row.delivery_fee),
    total: num(row.total),
    couponCode: row.coupon_code,
    cancelReason: row.cancel_reason || null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// Linha do banco → visão pública do acompanhamento (sem telefone nem endereço completo)
export function toPublicOrder(row, history = []) {
  return {
    code: orderCode(row.id),
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    deliveryType: row.delivery_type,
    district: row.district,
    firstName: String(row.customer_name).split(' ')[0],
    paymentMethod: row.payment_method,
    items: row.items.map(({ name, qty, extras, removals }) => ({ name, qty, extras: extras.map(e => e.name), removals })),
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    deliveryFee: num(row.delivery_fee),
    total: num(row.total),
    createdAt: new Date(row.created_at).toISOString(),
    history: history.map(h => ({ status: h.status, label: STATUS_LABELS[h.status], at: new Date(h.created_at).toISOString() })),
  };
}

// ---------- Consultas ----------

/** Grava o pedido. Devolve null se o mesmo checkout (clientRef) já tinha sido gravado. */
export async function insertOrder(db, order, ipHash) {
  const token = crypto.randomBytes(18).toString('base64url');
  const [row] = await db.query(
    `WITH o AS (
       INSERT INTO orders (tracking_token, customer_name, customer_phone, delivery_type, address, district,
                           payment_method, change_for, items, subtotal, discount, delivery_fee, total, coupon_code,
                           client_ip_hash, client_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (client_ref) DO NOTHING
       RETURNING *
     ), h AS (
       INSERT INTO order_status_history (order_id, status, changed_by) SELECT id, status, 'cliente' FROM o
     )
     SELECT * FROM o`,
    [token, order.customerName, order.customerPhone, order.deliveryType, order.address ? JSON.stringify(order.address) : null,
      order.district, order.paymentMethod, order.changeFor, JSON.stringify(order.items), order.subtotal, order.discount,
      order.deliveryFee, order.total, order.couponCode, ipHash, order.clientRef ?? null]
  );
  return row || null;
}

export async function findByClientRef(db, clientRef) {
  if (!clientRef) return null;
  const [row] = await db.query('SELECT * FROM orders WHERE client_ref = $1', [clientRef]);
  return row || null;
}

export async function countRecentOrdersByIp(db, ipHash, minutes = 10) {
  const [row] = await db.query(
    `SELECT count(*)::int AS n FROM orders WHERE client_ip_hash = $1 AND created_at > now() - ($2::int * interval '1 minute')`,
    [ipHash, minutes]
  );
  return row.n;
}

export async function findByToken(db, token) {
  const [row] = await db.query('SELECT * FROM orders WHERE tracking_token = $1', [token]);
  if (!row) return null;
  const history = await db.query('SELECT status, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at', [row.id]);
  return toPublicOrder(row, history);
}

// Quadro da cozinha: todos os pedidos em andamento + os finalizados nas últimas 12h.
// O limite corta só os finalizados mais antigos (nunca um pedido novo).
export async function listBoard(db) {
  const rows = await db.query(
    `(SELECT * FROM orders WHERE status NOT IN ('entregue', 'cancelado') ORDER BY created_at DESC LIMIT 500)
     UNION ALL
     (SELECT * FROM orders WHERE status IN ('entregue', 'cancelado') AND updated_at > now() - interval '12 hours'
       ORDER BY updated_at DESC LIMIT 150)`
  );
  return rows.map(toStaffOrder).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateStatus(db, id, to, username, cancelReason = null) {
  if (!STATUSES.includes(to)) throw new HttpError(422, 'Status inválido');
  const [current] = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
  if (!current) throw new HttpError(404, 'Pedido não encontrado');
  if (!canTransition(current.status, to)) {
    throw new HttpError(409, `Não é possível mudar de "${STATUS_LABELS[current.status]}" para "${STATUS_LABELS[to]}"`);
  }
  const [row] = await db.query(
    `WITH o AS (
       UPDATE orders SET status = $2, updated_at = now(), cancel_reason = CASE WHEN $2 = 'cancelado' THEN $5 ELSE cancel_reason END
        WHERE id = $1 AND status = $3 RETURNING *
     ), h AS (
       INSERT INTO order_status_history (order_id, status, changed_by) SELECT id, status, $4 FROM o
     )
     SELECT * FROM o`,
    [id, to, current.status, username, cancelReason]
  );
  if (!row) throw new HttpError(409, 'O pedido foi alterado por outra pessoa. Atualize a tela.');
  return toStaffOrder(row);
}

// Detalhe de um pedido com o histórico de quem mudou cada status
export async function getOrderDetail(db, id) {
  const [row] = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
  if (!row) throw new HttpError(404, 'Pedido não encontrado');
  const history = await db.query('SELECT status, changed_by, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at', [id]);
  return {
    ...toStaffOrder(row),
    history: history.map(h => ({ status: h.status, label: STATUS_LABELS[h.status], by: h.changed_by, at: new Date(h.created_at).toISOString() })),
  };
}

const PAGE_SIZE = 50;

/** Busca de pedidos por período (datas de Brasília), texto (código, nome, telefone) e status. */
export async function searchOrders(db, { from, to, q = '', status = '', page = 1 }) {
  const params = [from, to];
  let where = `created_at >= ($1::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'
           AND created_at <  ($2::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'`;
  if (STATUSES.includes(status)) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }
  const term = String(q).trim().slice(0, 60);
  if (term) {
    const digits = term.replace(/\D/g, '');
    params.push(`%${term.toLowerCase()}%`);
    const nameIdx = params.length;
    const conds = [`lower(customer_name) LIKE $${nameIdx}`];
    if (digits) {
      params.push(Number(digits.slice(0, 12)));
      conds.push(`id = $${params.length}`);
      params.push(`%${digits}%`);
      conds.push(`customer_phone LIKE $${params.length}`);
    }
    where += ` AND (${conds.join(' OR ')})`;
  }
  const offset = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * PAGE_SIZE;
  const [{ n }] = await db.query(`SELECT count(*)::int AS n FROM orders WHERE ${where}`, params);
  const rows = await db.query(`SELECT * FROM orders WHERE ${where} ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}`, params);
  return { orders: rows.map(toStaffOrder), total: n, pageSize: PAGE_SIZE };
}
