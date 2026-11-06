// GET /api/coupons/:code — confere um cupom digitado no carrinho.
// A lista de cupons não é publicada: só quem sabe o código consegue usá-lo.
import { getDb } from '../../server/db.js';
import { handle, json, methodNotAllowed } from '../../server/http.js';

export default handle(async (req, context) => {
  if (req.method !== 'GET') return methodNotAllowed(['GET']);
  const code = String(context.params?.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return json({ error: 'Cupom inválido ou expirado' }, 404);
  const [row] = await getDb().query('SELECT code, discount_percent, description FROM coupons WHERE code = $1 AND active', [code]);
  if (!row) return json({ error: 'Cupom inválido ou expirado' }, 404);
  return json({ code: row.code, discountPercent: Number(row.discount_percent), description: row.description });
});

export const config = { path: '/api/coupons/:code' };
