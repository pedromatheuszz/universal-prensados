// /api/admin/orders
//   GET                          quadro de pedidos (em andamento + finalizados nas últimas 12h)
//   GET ?from=&to=&q=&status=&page=   busca no histórico
//   GET /:id                     detalhe com histórico de status
//   PATCH /:id { status, cancelReason }
import { getDb } from '../../server/db.js';
import { handle, json, readJson, methodNotAllowed, HttpError } from '../../server/http.js';
import { requireStaff } from '../../server/auth.js';
import { listBoard, updateStatus, getOrderDetail, searchOrders } from '../../server/orders.js';
import { parseRange } from '../../server/reports.js';

export default handle(async (req, context) => {
  const db = getDb();
  const id = context.params?.id;

  if (!id) {
    if (req.method !== 'GET') return methodNotAllowed(['GET']);
    const params = new URL(req.url).searchParams;
    if (params.has('from') || params.has('q')) {
      await requireStaff(req, db, 'orders.history');
      const range = parseRange(params);
      return json(await searchOrders(db, { ...range, q: params.get('q') || '', status: params.get('status') || '', page: params.get('page') || 1 }));
    }
    await requireStaff(req, db, 'orders.view');
    return json({ orders: await listBoard(db), serverTime: new Date().toISOString() });
  }

  if (!/^\d{1,12}$/.test(id)) throw new HttpError(404, 'Pedido não encontrado');

  if (req.method === 'GET') {
    await requireStaff(req, db, 'orders.view');
    return json({ order: await getOrderDetail(db, Number(id)) });
  }
  if (req.method !== 'PATCH') return methodNotAllowed(['GET', 'PATCH']);

  const { status, cancelReason } = await readJson(req);
  const user = await requireStaff(req, db, status === 'cancelado' ? 'orders.cancel' : 'orders.status');
  const reason = typeof cancelReason === 'string' ? cancelReason.trim().slice(0, 200) : '';
  if (status === 'cancelado' && reason.length < 3) throw new HttpError(422, 'Informe o motivo do cancelamento');
  return json({ order: await updateStatus(db, Number(id), status, user.username, reason || null) });
});

export const config = { path: ['/api/admin/orders', '/api/admin/orders/:id'] };
