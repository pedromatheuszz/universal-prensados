// Financeiro: despesas e resultado do mês (faturamento dos pedidos − despesas). Datas de Brasília.
import { HttpError } from './http.js';

const TZ = 'America/Sao_Paulo';
const num = (v) => Math.round(Number(v ?? 0) * 100) / 100;

export const EXPENSE_CATEGORIES = [
  'Insumos', 'Embalagens', 'Funcionários', 'Entregadores', 'Aluguel',
  'Água, luz, gás e internet', 'Taxas e impostos', 'Manutenção', 'Marketing', 'Outros',
];

export function parseMonth(value, today = new Date()) {
  const month = value || new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(today).slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(422, 'Mês deve estar no formato AAAA-MM');
  return month;
}

export async function monthSummary(db, month) {
  const first = `${month}-01`;
  const range = `created_at >= ($1::date)::timestamp AT TIME ZONE '${TZ}'
             AND created_at <  (($1::date + interval '1 month')::date)::timestamp AT TIME ZONE '${TZ}'`;

  const [[sales], expenses, daily, dailyExpenses] = await Promise.all([
    db.query(
      `SELECT count(*) FILTER (WHERE status <> 'cancelado')::int AS orders,
              coalesce(sum(total) FILTER (WHERE status <> 'cancelado'), 0) AS revenue,
              coalesce(sum(discount) FILTER (WHERE status <> 'cancelado'), 0) AS discounts,
              coalesce(sum(delivery_fee) FILTER (WHERE status <> 'cancelado'), 0) AS delivery_fees
         FROM orders WHERE ${range}`,
      [first]
    ),
    db.query(
      `SELECT id, to_char(spent_on, 'YYYY-MM-DD') AS spent_on, category, description, amount, created_by
         FROM expenses WHERE spent_on >= $1::date AND spent_on < ($1::date + interval '1 month')
        ORDER BY spent_on DESC, id DESC`,
      [first]
    ),
    db.query(
      `SELECT to_char((created_at AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS day, coalesce(sum(total), 0) AS revenue
         FROM orders WHERE ${range} AND status <> 'cancelado' GROUP BY 1 ORDER BY 1`,
      [first]
    ),
    db.query(
      `SELECT to_char(spent_on, 'YYYY-MM-DD') AS day, sum(amount) AS total
         FROM expenses WHERE spent_on >= $1::date AND spent_on < ($1::date + interval '1 month') GROUP BY 1`,
      [first]
    ),
  ]);

  const byCategory = {};
  for (const e of expenses) byCategory[e.category] = num((byCategory[e.category] || 0) + Number(e.amount));
  const totalExpenses = num(expenses.reduce((t, e) => t + Number(e.amount), 0));
  const revenue = num(sales.revenue);
  const expenseByDay = Object.fromEntries(dailyExpenses.map(d => [d.day, num(d.total)]));

  return {
    month,
    orders: sales.orders,
    revenue,
    discounts: num(sales.discounts),
    deliveryFees: num(sales.delivery_fees),
    avgTicket: sales.orders ? num(revenue / sales.orders) : 0,
    expenses: totalExpenses,
    result: num(revenue - totalExpenses),
    byCategory: Object.entries(byCategory).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
    daily: [...new Set([...daily.map(d => d.day), ...Object.keys(expenseByDay)])].sort().map(day => ({
      day,
      revenue: num(daily.find(d => d.day === day)?.revenue),
      expenses: expenseByDay[day] || 0,
    })),
    items: expenses.map(e => ({
      id: Number(e.id), date: e.spent_on, category: e.category, description: e.description, amount: num(e.amount), by: e.created_by,
    })),
    categories: EXPENSE_CATEGORIES,
  };
}

export function validateExpense(body) {
  const date = String(body?.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new HttpError(422, 'Data inválida');
  if (!EXPENSE_CATEGORIES.includes(body?.category)) throw new HttpError(422, 'Escolha uma categoria');
  const amount = Number(String(body?.amount ?? '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) throw new HttpError(422, 'Valor inválido');
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 200) : '';
  return { date, category: body.category, amount: num(amount), description };
}

export async function addExpense(db, e, username) {
  const [row] = await db.query(
    'INSERT INTO expenses (spent_on, category, description, amount, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [e.date, e.category, e.description, e.amount, username]
  );
  return Number(row.id);
}
