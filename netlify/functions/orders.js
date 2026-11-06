// POST /api/orders — cria um pedido a partir do checkout do site
import { getDb } from '../../server/db.js';
import { handle, json, readJson, clientIpHash, methodNotAllowed, HttpError } from '../../server/http.js';
import { buildOrder, insertOrder, countRecentOrdersByIp, orderCode } from '../../server/orders.js';
import { getPricingCatalog } from '../../server/catalog.js';

const MAX_ORDERS_PER_10_MIN = 8;

export default handle(async (req, context) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);

  const db = getDb();
  const order = buildOrder(await readJson(req), await getPricingCatalog(db));
  const ipHash = clientIpHash(req, context);
  if (await countRecentOrdersByIp(db, ipHash) >= MAX_ORDERS_PER_10_MIN) {
    throw new HttpError(429, 'Muitos pedidos em pouco tempo. Aguarde alguns minutos ou fale com a gente no WhatsApp.');
  }

  const row = await insertOrder(db, order, ipHash);
  return json({
    id: Number(row.id),
    code: orderCode(row.id),
    trackingToken: row.tracking_token,
    status: row.status,
    order,
  }, 201);
});

export const config = { path: '/api/orders' };
