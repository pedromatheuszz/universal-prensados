// GET /api/admin/reports?from=AAAA-MM-DD&to=AAAA-MM-DD — relatório de vendas
import { getDb } from '../../server/db.js';
import { handle, json, methodNotAllowed } from '../../server/http.js';
import { requireStaff } from '../../server/auth.js';
import { parseRange, salesReport } from '../../server/reports.js';

export default handle(async (req) => {
  const db = getDb();
  await requireStaff(req, db, 'finance.view');
  if (req.method !== 'GET') return methodNotAllowed(['GET']);
  const range = parseRange(new URL(req.url).searchParams);
  return json(await salesReport(db, range));
});

export const config = { path: '/api/admin/reports' };
