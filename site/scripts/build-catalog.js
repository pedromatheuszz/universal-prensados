/**
 * Gera site/src/generated/catalog.json: a cópia do cardápio embutida no site.
 * O site sempre busca o cardápio atualizado em /api/catalog (editado no app de gestão);
 * esta cópia só é usada se a API estiver fora do ar.
 *  - Com DATABASE_URL (build no Netlify ou .env.local): copia o cardápio do banco.
 *  - Sem DATABASE_URL: usa os dados iniciais de db/seed/.
 * Roda automaticamente antes de `npm run dev` e `npm run build`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(SITE, '..');
const SEED = path.join(REPO, 'db/seed');
const IMAGE_MAP_FILE = path.join(SITE, 'public/images/optimized/image-map.json');
const OUT_DIR = path.join(SITE, 'src/generated');

const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

async function fromDatabase() {
  const { loadEnv } = await import('vite');
  Object.assign(process.env, { ...loadEnv('production', REPO, ''), ...process.env });
  if (!process.env.DATABASE_URL) return null;
  try {
    const { getPublicCatalog } = await import('../../server/catalog.js');
    const catalog = await getPublicCatalog((await import('../../server/db.js')).getDb());
    delete catalog.status;
    return catalog;
  } catch (e) {
    console.warn(`! Não foi possível ler o cardápio do banco (${e.message}). Usando db/seed/.`);
    return null;
  }
}

function fromSeed() {
  const productsDir = path.join(SEED, 'products');
  const products = fs.readdirSync(productsDir).filter(f => f.endsWith('.json')).map(f => readJSON(path.join(productsDir, f)))
    .filter(p => p.active !== false)
    .map(p => ({
      id: p.id, name: p.name, category: p.category, price: p.price, desc: p.desc || '', image: p.image || '',
      badge: p.badge || '', hasExtras: p.hasExtras !== false, soldOut: false, order: Number.isFinite(p.order) ? p.order : 9999,
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));
  const delivery = readJSON(path.join(SEED, 'delivery.json'));
  const store = readJSON(path.join(SEED, 'store.json'));
  return {
    products,
    extras: readJSON(path.join(SEED, 'extras.json')).map(({ id, name, label, price }) => ({ id, name, label, price })),
    settings: {
      storeName: store.storeName,
      whatsappPhone: store.whatsappPhone,
      freeShippingThreshold: delivery.freeShippingThreshold,
      hours: store.hours,
      districts: delivery.districts.map(({ name, fee, slug }) => ({ name, fee, slug: slug || name })),
      coupons: readJSON(path.join(SEED, 'coupons.json')).coupons.filter(c => c.active !== false)
        .map(c => ({ code: c.code.toUpperCase(), discountPercent: c.discountPercent, description: c.description || '' })),
    },
  };
}

const catalog = (await fromDatabase()) || fromSeed();
const errors = [];
if (!catalog.products.length) errors.push('nenhum produto ativo');
if (!/^\d{12,13}$/.test(catalog.settings.whatsappPhone || '')) errors.push('WhatsApp da loja inválido');
if (!catalog.settings.districts.length) errors.push('nenhum bairro cadastrado');
if (errors.length) {
  console.error(`\n✗ Cardápio inválido: ${errors.join(', ')}\n`);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
// mapa das imagens otimizadas (nome → arquivo com hash), usado para montar as <picture>
fs.writeFileSync(path.join(OUT_DIR, 'image-map.json'), fs.existsSync(IMAGE_MAP_FILE) ? fs.readFileSync(IMAGE_MAP_FILE) : '{}\n');
console.log(`✓ Catálogo gerado: ${catalog.products.length} produtos, ${catalog.settings.districts.length} bairros, ${catalog.settings.coupons.length} cupons`);
process.exit(0);
