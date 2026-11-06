// /api/admin/store — configurações da loja
//   GET     nome, WhatsApp, frete grátis, horários, pausa e situação atual
//   PATCH   altera configurações (pausar/retomar só exige 'store.pause')
import { getDb } from '../../server/db.js';
import { handle, json, readJson, methodNotAllowed } from '../../server/http.js';
import { requireStaff, audit } from '../../server/auth.js';
import { getStoreSettings, validateStoreSettings, saveStoreSettings } from '../../server/catalog.js';
import { getStoreStatus } from '../../shared/store-hours.js';

const PAUSE_KEYS = ['paused', 'pauseMessage'];

async function view(db) {
  const settings = await getStoreSettings(db);
  return { settings, status: getStoreStatus(new Date(), settings) };
}

export default handle(async (req) => {
  const db = getDb();
  if (req.method === 'GET') {
    await requireStaff(req, db, 'orders.view');
    return json(await view(db));
  }
  if (req.method !== 'PATCH') return methodNotAllowed(['GET', 'PATCH']);

  const body = await readJson(req);
  const onlyPause = Object.keys(body).every(k => PAUSE_KEYS.includes(k));
  const user = await requireStaff(req, db, onlyPause ? 'store.pause' : 'store.edit');
  const values = validateStoreSettings(body);
  await saveStoreSettings(db, values, user.username);
  const action = onlyPause ? (values.paused ? 'loja.pausar' : 'loja.retomar') : 'loja.editar';
  await audit(db, user.username, action, values);
  return json(await view(db));
});

export const config = { path: '/api/admin/store' };
