// GET /api/track/:token — acompanhamento público do pedido (link enviado ao cliente)
import { getDb } from '../../server/db.js';
import { handle, json, methodNotAllowed } from '../../server/http.js';
import { findByToken } from '../../server/orders.js';

export default handle(async (req, context) => {
  if (req.method !== 'GET') return methodNotAllowed(['GET']);
  const token = context.params?.token || '';
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return json({ error: 'Pedido não encontrado' }, 404);
  const order = await findByToken(getDb(), token);
  return order ? json(order) : json({ error: 'Pedido não encontrado' }, 404);
});

export const config = { path: '/api/track/:token' };
