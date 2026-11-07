// POST /api/orders — cria um pedido a partir do checkout do site
import { getDb } from '../../server/db.js';
import { handle, json, readJson, clientIpHash, methodNotAllowed, HttpError } from '../../server/http.js';
import { buildOrder, insertOrder, findByClientRef, parseClientRef, countRecentOrdersByIp, orderCode, toStaffOrder } from '../../server/orders.js';
import { getPricingCatalog } from '../../server/catalog.js';

const MAX_ORDERS_PER_10_MIN = 8;

// Mesmo formato para pedido novo e para pedido reenviado (clientRef repetido)
function created(row, order, status = 201) {
  return json({
    id: Number(row.id),
    code: orderCode(row.id),
    trackingToken: row.tracking_token,
    status: row.status,
    order,
  }, status);
}

function replay(row) {
  const { customerName, customerPhone, deliveryType, address, district, paymentMethod, changeFor, items, subtotal, discount, deliveryFee, total, couponCode } = toStaffOrder(row);
  return created(row, { customerName, customerPhone, deliveryType, address, district, paymentMethod, changeFor, items, subtotal, discount, deliveryFee, total, couponCode }, 200);
}

export default handle(async (req, context) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);

  const db = getDb();
  const body = await readJson(req);
  // o navegador reenviou um pedido que já tinha chegado (resposta perdida no caminho)
  const previous = await findByClientRef(db, parseClientRef(body.clientRef));
  if (previous) return replay(previous);

  const order = buildOrder(body, await getPricingCatalog(db));
  const ipHash = clientIpHash(req, context);
  if (await countRecentOrdersByIp(db, ipHash) >= MAX_ORDERS_PER_10_MIN) {
    throw new HttpError(429, 'Muitos pedidos em pouco tempo. Aguarde alguns minutos ou fale com a gente no WhatsApp.');
  }

  const row = await insertOrder(db, order, ipHash);
  if (!row) {
    // duas tentativas do mesmo checkout chegaram juntas: a outra gravou primeiro
    const existing = await findByClientRef(db, order.clientRef);
    if (existing) return replay(existing);
    throw new HttpError(409, 'Não foi possível registrar o pedido. Tente de novo.');
  }
  return created(row, order);
});

export const config = { path: '/api/orders' };
