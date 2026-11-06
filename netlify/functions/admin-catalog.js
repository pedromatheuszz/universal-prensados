// /api/admin/catalog — cardápio completo para o app de gestão
//   GET                                   produtos, adicionais, bairros, cupons e configurações
//   POST   /:resource                     cria (products | extras | districts | coupons)
//   PATCH  /:resource/:id                 altera (marcar esgotado só exige 'stock.toggle')
//   DELETE /:resource/:id                 remove
import { getDb } from '../../server/db.js';
import { handle, json, readJson, methodNotAllowed, HttpError } from '../../server/http.js';
import { requireStaff, audit } from '../../server/auth.js';
import {
  getFullCatalog, validateProduct, validateExtra, validateDistrict, validateCoupon,
  upsertProduct, upsertExtra, upsertCoupon,
} from '../../server/catalog.js';

const RESOURCES = {
  products: { table: 'products', key: 'id', validate: validateProduct, save: upsertProduct, label: 'produto' },
  extras: { table: 'extras', key: 'id', validate: validateExtra, save: upsertExtra, label: 'adicional' },
  coupons: { table: 'coupons', key: 'code', validate: validateCoupon, save: upsertCoupon, label: 'cupom' },
  districts: { table: 'districts', key: 'id', validate: validateDistrict, label: 'bairro' },
};

async function saveDistrict(db, d, id = null) {
  try {
    if (id) {
      await db.query('UPDATE districts SET name = $2, slug = $3, fee = $4, active = $5, sort_order = $6 WHERE id = $1', [id, d.name, d.slug, d.fee, d.active, d.order]);
    } else {
      await db.query('INSERT INTO districts (name, slug, fee, active, sort_order) VALUES ($1, $2, $3, $4, $5)', [d.name, d.slug, d.fee, d.active, d.order]);
    }
  } catch {
    throw new HttpError(409, 'Já existe um bairro com esse nome');
  }
}

export default handle(async (req, context) => {
  const db = getDb();
  const { resource, id } = context.params || {};

  if (!resource) {
    if (req.method !== 'GET') return methodNotAllowed(['GET']);
    await requireStaff(req, db, 'orders.view');
    return json(await getFullCatalog(db));
  }

  const r = RESOURCES[resource];
  if (!r) throw new HttpError(404, 'Rota não encontrada');
  const items = (await getFullCatalog(db))[resource];

  if (!id) {
    if (req.method !== 'POST') return methodNotAllowed(['POST']);
    const user = await requireStaff(req, db, 'catalog.edit');
    const item = r.validate(await readJson(req));
    if (resource === 'districts') {
      await saveDistrict(db, item);
    } else {
      if (items.some(i => String(i[r.key]) === String(item[r.key]))) throw new HttpError(409, `Já existe um ${r.label} com esse código`);
      if (resource === 'extras' && items.some(i => i.name === item.name)) throw new HttpError(409, 'Já existe um adicional com esse nome');
      await r.save(db, item);
    }
    await audit(db, user.username, `${r.label}.criar`, item);
    return json(await getFullCatalog(db), 201);
  }

  const existing = items.find(i => String(i[r.key]) === String(id));
  if (!existing) throw new HttpError(404, 'Item não encontrado');

  if (req.method === 'DELETE') {
    const user = await requireStaff(req, db, 'catalog.edit');
    await db.query(`DELETE FROM ${r.table} WHERE ${r.key} = $1`, [existing[r.key]]);
    await audit(db, user.username, `${r.label}.excluir`, { [r.key]: existing[r.key], name: existing.name });
    return json(await getFullCatalog(db));
  }
  if (req.method !== 'PATCH') return methodNotAllowed(['PATCH', 'DELETE']);

  const body = await readJson(req);
  const onlyStock = resource === 'products' && Object.keys(body).length === 1 && 'soldOut' in body;
  const user = await requireStaff(req, db, onlyStock ? 'stock.toggle' : 'catalog.edit');
  const item = r.validate(body, existing);
  if (resource === 'districts') {
    await saveDistrict(db, item, existing.id);
  } else {
    if (resource === 'extras' && items.some(i => i.name === item.name && i.id !== existing.id)) throw new HttpError(409, 'Já existe um adicional com esse nome');
    await r.save(db, item);
  }
  const action = onlyStock ? (body.soldOut ? 'produto.esgotado' : 'produto.disponivel') : `${r.label}.editar`;
  await audit(db, user.username, action, { [r.key]: existing[r.key], name: item.name, changes: body });
  return json(await getFullCatalog(db));
});

export const config = { path: ['/api/admin/catalog', '/api/admin/catalog/:resource', '/api/admin/catalog/:resource/:id'] };
