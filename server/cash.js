// Controle de caixa: abertura, sangria/suprimento e fechamento com conferência do dinheiro.
// O esperado em dinheiro = abertura + pedidos pagos em dinheiro no período + suprimentos − sangrias.
import { HttpError } from './http.js';

const num = (v) => Math.round(Number(v ?? 0) * 100) / 100;

function amount(v, label = 'Valor') {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1000000) throw new HttpError(422, `${label} inválido`);
  return Math.round(n * 100) / 100;
}

async function sessionSummary(db, s) {
  const until = s.closed_at || new Date();
  const [sales, movements, payments] = await Promise.all([
    db.query(
      `SELECT count(*) FILTER (WHERE status <> 'cancelado')::int AS orders,
              count(*) FILTER (WHERE status = 'cancelado')::int AS cancelled,
              coalesce(sum(total) FILTER (WHERE status <> 'cancelado'), 0) AS revenue
         FROM orders WHERE created_at >= $1 AND created_at < $2`,
      [s.opened_at, until]
    ),
    db.query('SELECT id, kind, amount, description, created_by, created_at FROM cash_movements WHERE session_id = $1 ORDER BY created_at', [s.id]),
    db.query(
      `SELECT payment_method AS method, count(*)::int AS orders, coalesce(sum(total), 0) AS total
         FROM orders WHERE created_at >= $1 AND created_at < $2 AND status <> 'cancelado'
        GROUP BY 1 ORDER BY 1`,
      [s.opened_at, until]
    ),
  ]);

  const byPayment = Object.fromEntries(['pix', 'cartao', 'dinheiro'].map(m => [m, { orders: 0, total: 0 }]));
  for (const p of payments) byPayment[p.method] = { orders: p.orders, total: num(p.total) };
  const supplies = num(movements.filter(m => m.kind === 'suprimento').reduce((t, m) => t + Number(m.amount), 0));
  const withdrawals = num(movements.filter(m => m.kind === 'sangria').reduce((t, m) => t + Number(m.amount), 0));
  const expectedCash = num(Number(s.opening_amount) + byPayment.dinheiro.total + supplies - withdrawals);

  return {
    id: Number(s.id),
    open: !s.closed_at,
    openedAt: new Date(s.opened_at).toISOString(),
    openedBy: s.opened_by,
    openingAmount: num(s.opening_amount),
    closedAt: s.closed_at ? new Date(s.closed_at).toISOString() : null,
    closedBy: s.closed_by,
    countedAmount: s.counted_amount === null ? null : num(s.counted_amount),
    difference: s.counted_amount === null ? null : num(Number(s.counted_amount) - Number(s.expected_amount)),
    notes: s.notes,
    orders: sales[0].orders,
    cancelled: sales[0].cancelled,
    revenue: num(sales[0].revenue),
    byPayment,
    supplies,
    withdrawals,
    expectedCash: s.closed_at ? num(s.expected_amount) : expectedCash,
    movements: movements.map(m => ({
      id: Number(m.id), kind: m.kind, amount: num(m.amount), description: m.description, by: m.created_by, at: new Date(m.created_at).toISOString(),
    })),
  };
}

const openSession = async (db) => (await db.query('SELECT * FROM cash_sessions WHERE closed_at IS NULL'))[0] || null;

export async function cashOverview(db) {
  const current = await openSession(db);
  const recent = await db.query('SELECT * FROM cash_sessions WHERE closed_at IS NOT NULL ORDER BY opened_at DESC LIMIT 15');
  return {
    current: current ? await sessionSummary(db, current) : null,
    history: recent.map(s => ({
      id: Number(s.id),
      openedAt: new Date(s.opened_at).toISOString(),
      closedAt: new Date(s.closed_at).toISOString(),
      openedBy: s.opened_by,
      closedBy: s.closed_by,
      openingAmount: num(s.opening_amount),
      expectedAmount: num(s.expected_amount),
      countedAmount: num(s.counted_amount),
      difference: num(Number(s.counted_amount) - Number(s.expected_amount)),
      notes: s.notes,
    })),
  };
}

export async function openCash(db, body, username) {
  if (await openSession(db)) throw new HttpError(409, 'Já existe um caixa aberto');
  const opening = amount(body?.amount ?? 0, 'Valor de abertura');
  try {
    await db.query('INSERT INTO cash_sessions (opened_by, opening_amount) VALUES ($1, $2)', [username, opening]);
  } catch {
    throw new HttpError(409, 'Já existe um caixa aberto');
  }
  return cashOverview(db);
}

export async function addMovement(db, body, username) {
  const s = await openSession(db);
  if (!s) throw new HttpError(409, 'Abra o caixa primeiro');
  const kind = body?.kind;
  if (!['sangria', 'suprimento'].includes(kind)) throw new HttpError(422, 'Escolha sangria ou suprimento');
  const value = amount(body?.amount, 'Valor');
  if (value <= 0) throw new HttpError(422, 'O valor precisa ser maior que zero');
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 120) : '';
  await db.query('INSERT INTO cash_movements (session_id, kind, amount, description, created_by) VALUES ($1, $2, $3, $4, $5)', [s.id, kind, value, description, username]);
  return cashOverview(db);
}

export async function closeCash(db, body, username) {
  const s = await openSession(db);
  if (!s) throw new HttpError(409, 'Não há caixa aberto');
  const counted = amount(body?.countedAmount, 'Valor contado');
  const summary = await sessionSummary(db, s);
  const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 300) : '';
  await db.query(
    `UPDATE cash_sessions SET closed_at = now(), closed_by = $2, expected_amount = $3, counted_amount = $4, notes = $5
      WHERE id = $1 AND closed_at IS NULL`,
    [s.id, username, summary.expectedCash, counted, notes]
  );
  const [closed] = await db.query('SELECT * FROM cash_sessions WHERE id = $1', [s.id]);
  return { closed: await sessionSummary(db, closed), ...(await cashOverview(db)) };
}
