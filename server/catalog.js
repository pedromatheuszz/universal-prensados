// Cardápio e configurações da loja guardados no banco (editados pelo app de gestão).
import fs from 'fs';
import path from 'path';
import { HttpError } from './http.js';
import { CATEGORIES, REMOVALS } from '../shared/menu-options.js';
import { DEFAULT_HOURS, normalizeHours, getStoreStatus } from '../shared/store-hours.js';

const num = (v) => Math.round(Number(v ?? 0) * 100) / 100;
const IMAGE_RE = /^(\/images\/[\w\-/]+\/)?[\w-]+\.(png|jpe?g|webp|avif)$/i;
const CATEGORY_IDS = CATEGORIES.map(c => c.id);

// Valores padrão de cada configuração da loja
export const STORE_DEFAULTS = {
  storeName: 'Universal Prensados',
  whatsappPhone: '',
  pixKey: '',
  freeShippingThreshold: 70,
  hours: DEFAULT_HOURS,
  paused: false,
  pauseMessage: '',
};

// ---------- Leitura ----------

const toProduct = (r) => ({
  id: r.id,
  name: r.name,
  category: r.category,
  price: num(r.price),
  desc: r.description,
  image: r.image,
  badge: r.badge,
  hasExtras: r.has_extras,
  active: r.active,
  soldOut: r.sold_out,
  order: r.sort_order,
});

const toExtra = (r) => ({ id: r.id, name: r.name, label: r.label || `+ ${r.name}`, price: num(r.price), active: r.active, order: r.sort_order });
const toDistrict = (r) => ({ id: Number(r.id), name: r.name, slug: r.slug || r.name, fee: num(r.fee), active: r.active, order: r.sort_order });
const toCoupon = (r) => ({ code: r.code, discountPercent: num(r.discount_percent), description: r.description, active: r.active });

export async function getStoreSettings(db) {
  const rows = await db.query('SELECT key, value FROM store_settings');
  const settings = { ...STORE_DEFAULTS };
  for (const { key, value } of rows) if (key in STORE_DEFAULTS) settings[key] = value;
  return settings;
}

/** Catálogo completo (inclusive inativos) — usado pelo app de gestão. */
export async function getFullCatalog(db) {
  const [products, extras, districts, coupons, settings] = await Promise.all([
    db.query('SELECT * FROM products ORDER BY sort_order, name'),
    db.query('SELECT * FROM extras ORDER BY sort_order, name'),
    db.query('SELECT * FROM districts ORDER BY sort_order, name'),
    db.query('SELECT * FROM coupons ORDER BY code'),
    getStoreSettings(db),
  ]);
  return {
    products: products.map(toProduct),
    extras: extras.map(toExtra),
    districts: districts.map(toDistrict),
    coupons: coupons.map(toCoupon),
    settings,
  };
}

/** Dados usados para validar e precificar pedidos no servidor. */
export async function getPricingCatalog(db) {
  const full = await getFullCatalog(db);
  const products = full.products.filter(p => p.active);
  return {
    products: new Map(products.map(p => [p.id, p])),
    extras: new Map(full.extras.filter(e => e.active).map(e => [e.name, { name: e.name, price: e.price }])),
    settings: {
      ...full.settings,
      districts: full.districts.filter(d => d.active),
      coupons: full.coupons.filter(c => c.active),
    },
  };
}

/** Visão pública para o site (sem itens inativos nem a lista de cupons). */
export async function getPublicCatalog(db, now = new Date()) {
  const full = await getFullCatalog(db);
  const s = full.settings;
  return {
    products: full.products.filter(p => p.active).map(({ active, ...p }) => p),
    extras: full.extras.filter(e => e.active).map(({ active, order, ...e }) => e),
    removals: REMOVALS,
    settings: {
      storeName: s.storeName,
      whatsappPhone: s.whatsappPhone,
      pixKey: s.pixKey,
      freeShippingThreshold: s.freeShippingThreshold,
      hours: s.hours,
      districts: full.districts.filter(d => d.active).map(({ name, fee, slug }) => ({ name, fee, slug })),
      // cupons não são listados: o site confere o código digitado em /api/coupons/:code
    },
    status: getStoreStatus(now, s),
  };
}

// ---------- Validação das edições ----------

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
function money(v, label) {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100000) throw new HttpError(422, `${label} inválido`);
  return Math.round(n * 100) / 100;
}
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
// ordem de exibição: inteiro numa faixa que cabe na coluna INT do banco
const int = (v, fallback) => (Number.isInteger(Number(v)) && v !== '' && v !== null && Math.abs(Number(v)) <= 1000000 ? Number(v) : fallback);

export function validateProduct(input, existing = null) {
  const b = input || {};
  const p = {
    id: existing ? existing.id : str(b.id, 40).toLowerCase(),
    name: b.name !== undefined ? str(b.name, 80) : existing?.name,
    category: b.category !== undefined ? b.category : existing?.category,
    price: b.price !== undefined ? money(b.price, 'Preço') : existing?.price,
    desc: b.desc !== undefined ? str(b.desc, 400) : existing?.desc ?? '',
    image: b.image !== undefined ? str(b.image, 200) : existing?.image ?? '',
    badge: b.badge !== undefined ? str(b.badge, 40) : existing?.badge ?? '',
    hasExtras: bool(b.hasExtras, existing?.hasExtras ?? true),
    active: bool(b.active, existing?.active ?? true),
    soldOut: bool(b.soldOut, existing?.soldOut ?? false),
    order: int(b.order, existing?.order ?? 9999),
  };
  if (!/^[a-z0-9_]{2,40}$/.test(p.id)) throw new HttpError(422, 'Código do produto: use de 2 a 40 letras minúsculas, números ou _');
  // só arquivos de imagem do próprio site (nada de endereços externos ou HTML)
  if (p.image && !IMAGE_RE.test(p.image)) throw new HttpError(422, 'Imagem: informe o nome do arquivo, ex.: dogzao.png');
  if (!p.name || p.name.length < 2) throw new HttpError(422, 'Informe o nome do produto');
  if (!CATEGORY_IDS.includes(p.category)) throw new HttpError(422, 'Categoria inválida');
  if (p.price === undefined) throw new HttpError(422, 'Informe o preço');
  return p;
}

export function validateExtra(input, existing = null) {
  const b = input || {};
  const e = {
    id: existing ? existing.id : str(b.id, 40).toLowerCase(),
    name: b.name !== undefined ? str(b.name, 60) : existing?.name,
    label: b.label !== undefined ? str(b.label, 80) : existing?.label ?? '',
    price: b.price !== undefined ? money(b.price, 'Preço') : existing?.price,
    active: bool(b.active, existing?.active ?? true),
    order: int(b.order, existing?.order ?? 0),
  };
  if (!/^[a-z0-9_]{2,40}$/.test(e.id)) throw new HttpError(422, 'Código do adicional inválido');
  if (!e.name) throw new HttpError(422, 'Informe o nome do adicional');
  if (e.price === undefined) throw new HttpError(422, 'Informe o preço');
  return e;
}

export function validateDistrict(input, existing = null) {
  const b = input || {};
  const d = {
    name: b.name !== undefined ? str(b.name, 60) : existing?.name,
    slug: b.slug !== undefined ? str(b.slug, 60).toLowerCase() : existing?.slug ?? '',
    fee: b.fee !== undefined ? money(b.fee, 'Taxa') : existing?.fee,
    active: bool(b.active, existing?.active ?? true),
    order: int(b.order, existing?.order ?? 0),
  };
  if (!d.name) throw new HttpError(422, 'Informe o nome do bairro');
  if (d.fee === undefined) throw new HttpError(422, 'Informe a taxa de entrega');
  if (!d.slug) d.slug = d.name.toLowerCase();
  return d;
}

export function validateCoupon(input, existing = null) {
  const b = input || {};
  const c = {
    code: existing ? existing.code : str(b.code, 30).toUpperCase(),
    discountPercent: b.discountPercent !== undefined ? Number(b.discountPercent) : existing?.discountPercent,
    description: b.description !== undefined ? str(b.description, 200) : existing?.description ?? '',
    active: bool(b.active, existing?.active ?? true),
  };
  if (!/^[A-Z0-9_-]{3,30}$/.test(c.code)) throw new HttpError(422, 'Código do cupom: 3 a 30 letras, números, - ou _');
  if (!(c.discountPercent > 0 && c.discountPercent <= 100)) throw new HttpError(422, 'Desconto deve ser entre 1% e 100%');
  return c;
}

export function validateStoreSettings(input) {
  const b = input || {};
  const out = {};
  if (b.storeName !== undefined) {
    out.storeName = str(b.storeName, 80);
    if (!out.storeName) throw new HttpError(422, 'Informe o nome da loja');
  }
  if (b.whatsappPhone !== undefined) {
    out.whatsappPhone = String(b.whatsappPhone).replace(/\D/g, '');
    if (!/^\d{12,13}$/.test(out.whatsappPhone)) throw new HttpError(422, 'WhatsApp: use 55 + DDD + número');
  }
  if (b.pixKey !== undefined) {
    out.pixKey = str(b.pixKey, 80);
    if (out.pixKey && !/^[\w.@+-]{5,80}$/.test(out.pixKey)) throw new HttpError(422, 'Chave Pix inválida (use telefone, e-mail, CPF/CNPJ ou chave aleatória, sem espaços)');
  }
  if (b.freeShippingThreshold !== undefined) out.freeShippingThreshold = money(b.freeShippingThreshold, 'Valor do frete grátis');
  if (b.hours !== undefined) {
    try {
      out.hours = normalizeHours(b.hours);
    } catch (e) {
      throw new HttpError(422, e.message);
    }
  }
  if (b.paused !== undefined) out.paused = Boolean(b.paused);
  if (b.pauseMessage !== undefined) out.pauseMessage = str(b.pauseMessage, 120);
  return out;
}

// ---------- Escrita ----------

export async function saveStoreSettings(db, values, username) {
  for (const [key, value] of Object.entries(values)) {
    await db.query(
      `INSERT INTO store_settings (key, value, updated_at, updated_by) VALUES ($1, $2, now(), $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [key, JSON.stringify(value), username]
    );
  }
}

export async function upsertProduct(db, p) {
  await db.query(
    `INSERT INTO products (id, name, category, price, description, image, badge, has_extras, active, sold_out, sort_order, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price,
       description = EXCLUDED.description, image = EXCLUDED.image, badge = EXCLUDED.badge, has_extras = EXCLUDED.has_extras,
       active = EXCLUDED.active, sold_out = EXCLUDED.sold_out, sort_order = EXCLUDED.sort_order, updated_at = now()`,
    [p.id, p.name, p.category, p.price, p.desc, p.image, p.badge, p.hasExtras, p.active, p.soldOut, p.order]
  );
}

export async function upsertExtra(db, e) {
  await db.query(
    `INSERT INTO extras (id, name, label, price, active, sort_order) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, label = EXCLUDED.label, price = EXCLUDED.price,
       active = EXCLUDED.active, sort_order = EXCLUDED.sort_order`,
    [e.id, e.name, e.label, e.price, e.active, e.order]
  );
}

export async function upsertCoupon(db, c) {
  await db.query(
    `INSERT INTO coupons (code, discount_percent, description, active) VALUES ($1, $2, $3, $4)
     ON CONFLICT (code) DO UPDATE SET discount_percent = EXCLUDED.discount_percent,
       description = EXCLUDED.description, active = EXCLUDED.active`,
    [c.code, c.discountPercent, c.description, c.active]
  );
}

// ---------- Dados iniciais (db/seed) ----------

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Preenche cardápio e loja a partir de db/seed/ quando as tabelas ainda estão vazias. */
export async function seedCatalog(db, dir = 'db/seed') {
  const [{ n: productCount }] = await db.query('SELECT count(*)::int AS n FROM products');
  if (productCount === 0) {
    const productsDir = path.join(dir, 'products');
    for (const file of fs.readdirSync(productsDir).filter(f => f.endsWith('.json')).sort()) {
      const p = readJson(path.join(productsDir, file));
      await upsertProduct(db, validateProduct({ ...p, active: p.active !== false, soldOut: false }));
    }
  }

  const [{ n: extraCount }] = await db.query('SELECT count(*)::int AS n FROM extras');
  if (extraCount === 0) {
    for (const [i, e] of readJson(path.join(dir, 'extras.json')).entries()) await upsertExtra(db, validateExtra({ ...e, order: i }));
  }

  const delivery = readJson(path.join(dir, 'delivery.json'));
  const [{ n: districtCount }] = await db.query('SELECT count(*)::int AS n FROM districts');
  if (districtCount === 0) {
    for (const [i, d] of delivery.districts.entries()) {
      const v = validateDistrict({ ...d, order: i });
      await db.query('INSERT INTO districts (name, slug, fee, active, sort_order) VALUES ($1, $2, $3, $4, $5)', [v.name, v.slug, v.fee, v.active, v.order]);
    }
  }

  const [{ n: couponCount }] = await db.query('SELECT count(*)::int AS n FROM coupons');
  if (couponCount === 0) {
    for (const c of readJson(path.join(dir, 'coupons.json')).coupons) await upsertCoupon(db, validateCoupon({ ...c, active: c.active !== false }));
  }

  const store = { ...readJson(path.join(dir, 'store.json')), freeShippingThreshold: delivery.freeShippingThreshold };
  for (const [key, value] of Object.entries(validateStoreSettings(store))) {
    await db.query('INSERT INTO store_settings (key, value, updated_by) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING', [key, JSON.stringify(value), 'sistema']);
  }
}
