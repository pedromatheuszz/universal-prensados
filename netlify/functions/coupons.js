// GET /api/coupons/:code — o site confere só o código digitado (a lista de cupons não é pública).
// Códigos errados contam como tentativa: muitos erros seguidos do mesmo IP bloqueiam por 10 minutos,
// para ninguém descobrir cupons testando nomes em sequência.
import { getDb } from '../../server/db.js';
import { handle, json, methodNotAllowed, clientIpHash } from '../../server/http.js';
import { countEvents, addEvent } from '../../server/rate-limit.js';

const WINDOW_MIN = 10;
const MAX_MISSES = 20;
const INVALID = 'Cupom inválido ou expirado';

export default handle(async (req, context) => {
  if (req.method !== 'GET') return methodNotAllowed(['GET']);
  const db = getDb();
  const ipHash = clientIpHash(req, context);
  if (await countEvents(db, 'coupon-miss', ipHash, WINDOW_MIN) >= MAX_MISSES) {
    return json({ error: 'Muitas tentativas de cupom. Aguarde alguns minutos.' }, 429);
  }

  const code = String(context.params?.code || '').trim().toUpperCase();
  const [row] = /^[A-Z0-9_-]{3,30}$/.test(code)
    ? await db.query('SELECT code, discount_percent, description FROM coupons WHERE code = $1 AND active', [code])
    : [];
  if (!row) {
    await addEvent(db, 'coupon-miss', ipHash);
    return json({ error: INVALID }, 404);
  }
  return json({ code: row.code, discountPercent: Number(row.discount_percent), description: row.description });
});

export const config = { path: '/api/coupons/:code' };
