// /api/admin/finance — resultado do mês e despesas (somente dono)
//   GET ?month=AAAA-MM          faturamento, despesas por categoria, resultado e lançamentos
//   POST /expenses              { date, category, amount, description }
//   DELETE /expenses/:id
import { getDb } from '../../server/db.js';
import { handle, json, readJson, methodNotAllowed, HttpError } from '../../server/http.js';
import { requireStaff, audit } from '../../server/auth.js';
import { parseMonth, monthSummary, validateExpense, addExpense } from '../../server/finance.js';

export default handle(async (req, context) => {
  const db = getDb();
  const user = await requireStaff(req, db, 'finance.view');
  const url = new URL(req.url);
  const id = context.params?.id;

  if (!url.pathname.includes('/expenses')) {
    if (req.method !== 'GET') return methodNotAllowed(['GET']);
    return json(await monthSummary(db, parseMonth(url.searchParams.get('month'))));
  }

  if (!id) {
    if (req.method !== 'POST') return methodNotAllowed(['POST']);
    const expense = validateExpense(await readJson(req));
    const newId = await addExpense(db, expense, user.username);
    await audit(db, user.username, 'despesa.criar', { id: newId, ...expense });
    return json({ id: newId }, 201);
  }

  if (req.method !== 'DELETE') return methodNotAllowed(['DELETE']);
  if (!/^\d{1,12}$/.test(id)) throw new HttpError(404, 'Despesa não encontrada');
  const [row] = await db.query('DELETE FROM expenses WHERE id = $1 RETURNING category, amount', [Number(id)]);
  if (!row) throw new HttpError(404, 'Despesa não encontrada');
  await audit(db, user.username, 'despesa.excluir', { id: Number(id), category: row.category, amount: Number(row.amount) });
  return json({ ok: true });
});

export const config = { path: ['/api/admin/finance', '/api/admin/finance/expenses', '/api/admin/finance/expenses/:id'] };
