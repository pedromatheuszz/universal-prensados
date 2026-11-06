// Tabela de rotas da API para hospedagens que usam uma função só (Vercel).
// No Netlify cada arquivo de netlify/functions é publicado sozinho pelo seu config.path.
import { json } from './http.js';
import { matchPath } from './route-pattern.js';
import * as adminCash from '../netlify/functions/admin-cash.js';
import * as adminCatalog from '../netlify/functions/admin-catalog.js';
import * as adminFinance from '../netlify/functions/admin-finance.js';
import * as adminOrders from '../netlify/functions/admin-orders.js';
import * as adminReports from '../netlify/functions/admin-reports.js';
import * as adminSession from '../netlify/functions/admin-session.js';
import * as adminStaff from '../netlify/functions/admin-staff.js';
import * as adminStore from '../netlify/functions/admin-store.js';
import * as catalog from '../netlify/functions/catalog.js';
import * as coupons from '../netlify/functions/coupons.js';
import * as orders from '../netlify/functions/orders.js';
import * as track from '../netlify/functions/track.js';

const MODULES = [adminCash, adminCatalog, adminFinance, adminOrders, adminReports, adminSession,
  adminStaff, adminStore, catalog, coupons, orders, track];

export async function routeRequest(request, { ip, pathname = new URL(request.url).pathname } = {}) {
  for (const mod of MODULES) {
    const params = matchPath(mod.config.path, pathname);
    if (params) return mod.default(request, { params, ip });
  }
  return json({ error: 'Rota não encontrada' }, 404);
}
