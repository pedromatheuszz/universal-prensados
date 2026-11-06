// /api/admin/cash — caixa
//   GET              caixa aberto (com resumo) e últimos fechamentos
//   POST /open       { amount }                                 abre o caixa
//   POST /movement   { kind: sangria|suprimento, amount, description }
//   POST /close      { countedAmount, notes }                   fecha e confere o dinheiro
import { getDb } from '../../server/db.js';
import { handle, json, readJson, methodNotAllowed, HttpError } from '../../server/http.js';
import { requireStaff, audit } from '../../server/auth.js';
import { cashOverview, openCash, addMovement, closeCash } from '../../server/cash.js';

const ACTIONS = { open: openCash, movement: addMovement, close: closeCash };

export default handle(async (req, context) => {
  const db = getDb();
  const user = await requireStaff(req, db, 'cash.operate');
  const action = context.params?.action;

  if (!action) {
    if (req.method !== 'GET') return methodNotAllowed(['GET']);
    return json(await cashOverview(db));
  }
  if (!ACTIONS[action]) throw new HttpError(404, 'Rota não encontrada');
  if (req.method !== 'POST') return methodNotAllowed(['POST']);

  const body = await readJson(req);
  const result = await ACTIONS[action](db, body, user.username);
  // só os campos conhecidos vão para o registro (nada de corpo arbitrário)
  const { amount, kind, description, countedAmount, notes } = body || {};
  await audit(db, user.username, `caixa.${action}`, { amount, kind, description, countedAmount, notes });
  return json(result);
});

export const config = { path: ['/api/admin/cash', '/api/admin/cash/:action'] };
