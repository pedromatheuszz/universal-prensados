// GET /api/catalog — cardápio, taxas, cupons e situação da loja (aberta/pausada) para o site
import { getDb } from '../../server/db.js';
import { handle, json, methodNotAllowed } from '../../server/http.js';
import { getPublicCatalog } from '../../server/catalog.js';

export default handle(async (req) => {
  if (req.method !== 'GET') return methodNotAllowed(['GET']);
  // cache curto no navegador e na CDN (s-maxage): mudanças feitas no app aparecem no site em
  // segundos, e uma enxurrada de acessos não vira uma enxurrada de consultas ao banco
  return json(await getPublicCatalog(getDb()), 200, { 'Cache-Control': 'public, max-age=10, s-maxage=10, stale-while-revalidate=30' });
});

export const config = { path: '/api/catalog' };
