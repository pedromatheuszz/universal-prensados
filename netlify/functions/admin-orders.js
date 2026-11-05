// GET /api/admin/orders — quadro da cozinha; PATCH /api/admin/orders/:id — muda o status
import { getDb } from '../../server/db.js';
import { handle, json, readJson, methodNotAllowed, HttpError } from '../../server/http.js';
import { requireStaff } from '../../server/auth.js';
import { listBoard, updateStatus } from '../../server/orders.js';

export default handle(async (req, context) => {
  const { username } = requireStaff(req);
  const db = getDb();
  const id = context.params?.id;

  if (!id) {
    if (req.method !== 'GET') return methodNotAllowed(['GET']);
    return json({ orders: await listBoard(db), serverTime: new Date().toISOString() });
  }

  if (req.method !== 'PATCH') return methodNotAllowed(['PATCH']);
  if (!/^\d{1,12}$/.test(id)) throw new HttpError(404, 'Pedido não encontrado');
  const { status } = await readJson(req);
  return json({ order: await updateStatus(db, Number(id), status, username) });
});

export const config = { path: ['/api/admin/orders', '/api/admin/orders/:id'] };
