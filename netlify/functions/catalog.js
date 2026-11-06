// GET /api/catalog — cardápio, taxas, cupons e situação da loja (aberta/pausada) para o site
import { getDb } from '../../server/db.js';
import { handle, json, methodNotAllowed } from '../../server/http.js';
import { getPublicCatalog } from '../../server/catalog.js';

export default handle(async (req) => {
  if (req.method !== 'GET') return methodNotAllowed(['GET']);
  // cache curto: mudanças feitas no app aparecem no site em poucos segundos
  return json(await getPublicCatalog(getDb()), 200, { 'Cache-Control': 'public, max-age=10' });
});

export const config = { path: '/api/catalog' };
