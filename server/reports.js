// Relatórios de vendas (datas no horário de Brasília). Pedidos cancelados ficam fora do faturamento.
import { HttpError } from './http.js';

const TZ = 'America/Sao_Paulo';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

export function parseRange(searchParams, today = new Date()) {
  const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD
  const to = searchParams.get('to') || fmt(today);
  const from = searchParams.get('from') || to;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new HttpError(422, 'Datas devem estar no formato AAAA-MM-DD');
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (Number.isNaN(days) || days < 0) throw new HttpError(422, 'Período inválido');
  if (days > MAX_DAYS) throw new HttpError(422, 'Período máximo de 1 ano');
  return { from, to };
}

export async function salesReport(db, { from, to }) {
  // intervalo [from 00:00, to+1 00:00) no fuso de Brasília
  const range = `created_at >= ($1::date)::timestamp AT TIME ZONE '${TZ}'
             AND created_at <  ($2::date + 1)::timestamp AT TIME ZONE '${TZ}'`;
  const params = [from, to];

  const [summary] = await db.query(
    `SELECT count(*) FILTER (WHERE status <> 'cancelado')::int AS orders,
            count(*) FILTER (WHERE status = 'cancelado')::int AS cancelled,
            coalesce(sum(total) FILTER (WHERE status <> 'cancelado'), 0) AS revenue,
            coalesce(avg(total) FILTER (WHERE status <> 'cancelado'), 0) AS avg_ticket,
            coalesce(sum(discount) FILTER (WHERE status <> 'cancelado'), 0) AS discounts,
            coalesce(sum(delivery_fee) FILTER (WHERE status <> 'cancelado'), 0) AS delivery_fees
       FROM orders WHERE ${range}`,
    params
  );

  const daily = await db.query(
    `SELECT to_char((created_at AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS day,
            count(*)::int AS orders, coalesce(sum(total), 0) AS revenue
       FROM orders WHERE ${range} AND status <> 'cancelado'
      GROUP BY 1 ORDER BY 1`,
    params
  );

  const products = await db.query(
    `SELECT item->>'name' AS name, sum((item->>'qty')::int)::int AS qty,
            sum((item->>'qty')::int * (item->>'unitPrice')::numeric) AS revenue
       FROM orders, jsonb_array_elements(items) AS item
      WHERE ${range} AND status <> 'cancelado'
      GROUP BY 1 ORDER BY qty DESC, revenue DESC LIMIT 10`,
    params
  );

  const byPayment = await db.query(
    `SELECT payment_method AS key, count(*)::int AS orders, coalesce(sum(total), 0) AS revenue
       FROM orders WHERE ${range} AND status <> 'cancelado' GROUP BY 1 ORDER BY revenue DESC`,
    params
  );

  const byDistrict = await db.query(
    `SELECT coalesce(district, 'Retirada no balcão') AS key, count(*)::int AS orders, coalesce(sum(total), 0) AS revenue
       FROM orders WHERE ${range} AND status <> 'cancelado' GROUP BY 1 ORDER BY orders DESC LIMIT 12`,
    params
  );

  const byHour = await db.query(
    `SELECT extract(hour FROM created_at AT TIME ZONE '${TZ}')::int AS hour, count(*)::int AS orders
       FROM orders WHERE ${range} AND status <> 'cancelado' GROUP BY 1 ORDER BY 1`,
    params
  );

  const n = (v) => Math.round(Number(v ?? 0) * 100) / 100;
  return {
    from,
    to,
    summary: {
      orders: summary.orders,
      cancelled: summary.cancelled,
      revenue: n(summary.revenue),
      avgTicket: n(summary.avg_ticket),
      discounts: n(summary.discounts),
      deliveryFees: n(summary.delivery_fees),
    },
    daily: daily.map(d => ({ day: d.day, orders: d.orders, revenue: n(d.revenue) })),
    topProducts: products.map(p => ({ name: p.name, qty: p.qty, revenue: n(p.revenue) })),
    byPayment: byPayment.map(r => ({ key: r.key, orders: r.orders, revenue: n(r.revenue) })),
    byDistrict: byDistrict.map(r => ({ key: r.key, orders: r.orders, revenue: n(r.revenue) })),
    byHour: byHour.map(r => ({ hour: r.hour, orders: r.orders })),
  };
}
