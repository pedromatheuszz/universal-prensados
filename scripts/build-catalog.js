/**
 * Gera src/generated/catalog.json a partir dos arquivos editados no Decap CMS
 * (public/data/products/*.json e public/data/settings/*.json).
 * Roda automaticamente antes de `npm run dev` e `npm run build`.
 * Dados inválidos interrompem o build para não publicar um cardápio quebrado.
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = 'public/data';
const IMAGE_MAP_FILE = 'public/images/optimized/image-map.json';
const OUT_FILE = 'src/generated/catalog.json';
const CATEGORIES = ['salgados', 'especiais', 'combos', 'doces', 'bebidas'];

const errors = [];

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push(`${file}: JSON inválido (${e.message})`);
    return null;
  }
}

function isMoney(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

const optimizedImages = new Set(
  fs.existsSync(IMAGE_MAP_FILE) ? Object.keys(readJSON(IMAGE_MAP_FILE) || {}) : []
);

// Imagens com versões responsivas geradas viram { key }; uploads do CMS ficam com o caminho original.
function resolveImage(image, file) {
  if (typeof image !== 'string' || !image.trim()) {
    errors.push(`${file}: campo "image" ausente`);
    return { src: '' };
  }
  const key = path.basename(image).replace(/\.[a-z0-9]+$/i, '');
  if (optimizedImages.has(key)) return { key };
  if (/^(https?:)?\/\//.test(image) || image.startsWith('/')) return { src: image };
  return { src: `/images/uploads/${path.basename(image)}` };
}

// --- Produtos ---
const productsDir = path.join(DATA_DIR, 'products');
const products = [];
const seenIds = new Set();

for (const name of fs.readdirSync(productsDir).filter(f => f.endsWith('.json')).sort()) {
  const file = path.join(productsDir, name);
  const p = readJSON(file);
  if (!p) continue;

  if (!/^[a-z0-9_]+$/.test(p.id || '')) errors.push(`${file}: "id" inválido`);
  if (seenIds.has(p.id)) errors.push(`${file}: "id" duplicado (${p.id})`);
  seenIds.add(p.id);
  if (!p.name) errors.push(`${file}: "name" ausente`);
  if (!CATEGORIES.includes(p.category)) errors.push(`${file}: categoria "${p.category}" inválida`);
  if (!isMoney(p.price)) errors.push(`${file}: "price" inválido`);
  if (p.active === false) continue;

  products.push({
    id: p.id,
    name: String(p.name || ''),
    category: p.category,
    price: p.price,
    desc: String(p.desc || ''),
    image: resolveImage(p.image, file),
    badge: String(p.badge || ''),
    hasExtras: p.hasExtras !== false,
    order: Number.isFinite(p.order) ? p.order : 9999,
  });
}

products.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));

// --- Configurações ---
const settingsDir = path.join(DATA_DIR, 'settings');
const general = readJSON(path.join(settingsDir, 'general.json')) || {};
const delivery = readJSON(path.join(settingsDir, 'delivery.json')) || {};
const couponsFile = readJSON(path.join(settingsDir, 'coupons.json')) || {};

const whatsappPhone = String(general.whatsappPhone || '').replace(/\D/g, '');
if (!/^\d{12,13}$/.test(whatsappPhone)) errors.push('general.json: "whatsappPhone" inválido (use 55 + DDD + número)');

if (!isMoney(delivery.freeShippingThreshold)) errors.push('delivery.json: "freeShippingThreshold" inválido');
const districts = (delivery.districts || []).map((d, i) => {
  if (!d.name || !isMoney(d.fee)) errors.push(`delivery.json: bairro #${i + 1} inválido`);
  return { name: String(d.name || ''), fee: d.fee, slug: String(d.slug || d.name || '') };
});
if (districts.length === 0) errors.push('delivery.json: nenhum bairro cadastrado');

const coupons = (couponsFile.coupons || [])
  .filter(c => c.active !== false)
  .map((c, i) => {
    const pct = c.discountPercent;
    if (!c.code || !(typeof pct === 'number' && pct > 0 && pct <= 100)) errors.push(`coupons.json: cupom #${i + 1} inválido`);
    return { code: String(c.code || '').trim().toUpperCase(), discountPercent: pct, description: String(c.description || '') };
  });

if (errors.length) {
  console.error('\n✗ Erros nos dados do CMS:\n  - ' + errors.join('\n  - ') + '\n');
  process.exit(1);
}

const catalog = {
  products,
  settings: {
    storeName: String(general.storeName || 'Universal Prensados'),
    whatsappPhone,
    freeShippingThreshold: delivery.freeShippingThreshold,
    districts,
    coupons,
  },
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(catalog, null, 2) + '\n');
console.log(`✓ Catálogo gerado: ${products.length} produtos, ${districts.length} bairros, ${coupons.length} cupons`);
