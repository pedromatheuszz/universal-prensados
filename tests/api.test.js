// @vitest-environment node
/**
 * Testes de integração da API (site + app de gestão) contra um Postgres real em memória (PGlite).
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

process.env.SESSION_SECRET = 'teste-'.repeat(8);

const { setDb, migrate } = await import('../server/db.js');
const { hashPassword } = await import('../server/auth.js');
const { buildOrder, canTransition } = await import('../server/orders.js');
const { getPricingCatalog } = await import('../server/catalog.js');
const fn = async (name) => (await import(`../netlify/functions/${name}.js`)).default;
const createOrder = await fn('orders');
const track = await fn('track');
const catalogApi = await fn('catalog');
const couponsApi = await fn('coupons');
const session = await fn('admin-session');
const adminOrders = await fn('admin-orders');
const reports = await fn('admin-reports');
const adminCatalog = await fn('admin-catalog');
const adminStore = await fn('admin-store');
const adminCash = await fn('admin-cash');
const adminFinance = await fn('admin-finance');
const adminStaff = await fn('admin-staff');

let pg;
const db = { query: (text, params) => pg.query(text, params).then(r => r.rows) };

const BASE = 'http://localhost';
const ctx = (extra = {}) => ({ ip: '10.0.0.1', params: {}, ...extra });
const req = (method, path, { token, body } = {}) => new Request(BASE + path, {
  method,
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const post = (path, body) => req('POST', path, { body });

// Quinta-feira, 05/11/2026, 20:00 em Brasília (dentro do horário padrão 19:00–23:30)
const OPEN_TIME = new Date('2026-11-05T23:00:00Z');
const CLOSED_TIME = new Date('2026-11-05T15:00:00Z');

const validOrder = (overrides = {}) => ({
  customer: { name: 'Maria Teste', phone: '(47) 99999-0000' },
  deliveryType: 'delivery',
  address: { district: 'Itaum', street: 'Rua A', number: '10', cep: '89200-000' },
  payment: { method: 'pix' },
  items: [{ id: 'dogzao', qty: 2, extras: ['Bacon Crocante'], removals: ['Sem milho'], notes: 'bem prensado' }],
  ...overrides,
});

async function login(username, password) {
  const res = await session(post('/api/admin/session', { username, password }), ctx());
  const body = await res.json();
  return { status: res.status, ...body };
}

let catalog;
let owner; // token do dono

beforeAll(async () => {
  pg = new PGlite();
  setDb(db);
  await migrate(db);
  await db.query(
    "INSERT INTO staff_users (username, password_hash, display_name, role) VALUES ($1, $2, 'Dono Teste', 'dono')",
    ['dono', hashPassword('senha-de-teste-123')]
  );
  catalog = await getPricingCatalog(db);
  // nos testes HTTP a loja fica aberta o dia todo (o horário real é testado em buildOrder)
  const allDay = Array(7).fill({ open: '00:00', close: '23:59' });
  await db.query("UPDATE store_settings SET value = $1 WHERE key = 'hours'", [JSON.stringify(allDay)]);
});

describe('dados iniciais (db/seed)', () => {
  it('migrar de novo não duplica o cardápio', async () => {
    const before = (await db.query('SELECT count(*)::int AS n FROM products'))[0].n;
    await migrate(db);
    expect((await db.query('SELECT count(*)::int AS n FROM products'))[0].n).toBe(before);
    expect(before).toBeGreaterThan(10);
  });
});

describe('buildOrder (validação e preços no servidor)', () => {
  const build = (input, now = OPEN_TIME) => buildOrder(input, catalog, now);

  it('recalcula preços ignorando valores enviados pelo navegador', () => {
    const order = build(validOrder({ items: [{ id: 'dogzao', qty: 2, unitPrice: 0.01, extras: [{ name: 'Bacon Crocante', price: 0 }] }] }));
    expect(order.items[0].unitPrice).toBe(20.5); // 17 + 3,50
    expect(order.subtotal).toBe(41);
    expect(order.deliveryFee).toBe(6); // Itaum, abaixo do frete grátis
    expect(order.total).toBe(47);
  });

  it('aplica cupom e frete grátis', () => {
    const order = build(validOrder({ couponCode: 'bemvindo10', items: [{ id: 'combo_familia', qty: 1 }] }));
    expect(order.couponCode).toBe('BEMVINDO10');
    expect(order.discount).toBe(10.99);
    expect(order.deliveryFee).toBe(0);
    expect(order.total).toBe(98.91);
  });

  it('rejeita dados inválidos com mensagens claras', () => {
    expect(() => build({})).toThrow(/nome/);
    expect(() => build(validOrder({ address: { district: 'Bairro Falso', street: 'R', number: '1' } }))).toThrow(/bairro/);
    expect(() => build(validOrder({ items: [{ id: 'nao_existe', qty: 1 }] }))).toThrow(/não está mais disponível/);
    expect(() => build(validOrder({ payment: { method: 'bitcoin' } }))).toThrow(/pagamento/);
  });

  it('recusa pedidos com a loja fechada ou pausada', () => {
    expect(() => build(validOrder(), CLOSED_TIME)).toThrow(/Abrimos hoje às 19:00/);
    const paused = { ...catalog, settings: { ...catalog.settings, paused: true, pauseMessage: 'Falta de gás' } };
    expect(() => buildOrder(validOrder(), paused, OPEN_TIME)).toThrow(/Falta de gás/);
  });

  it('recusa cupom inexistente, itens demais e quantidade acima do limite (nada é descartado em silêncio)', () => {
    expect(() => build(validOrder({ couponCode: 'NAOEXISTE' }))).toThrow(/Cupom inválido/);
    const many = Array.from({ length: 41 }, () => ({ id: 'dog', qty: 1 }));
    expect(() => build(validOrder({ items: many }))).toThrow(/no máximo 40/);
    expect(() => build(validOrder({ items: [{ id: 'dog', qty: 150 }] }))).toThrow(/Máximo de 99/);
    expect(() => build(validOrder({ items: [{ id: 'dogzao', qty: 1, extras: ['Adicional Inexistente'] }] }))).toThrow(/adicional/);
  });

  it('recusa produto esgotado', () => {
    const products = new Map(catalog.products);
    products.set('dogzao', { ...products.get('dogzao'), soldOut: true });
    expect(() => buildOrder(validOrder(), { ...catalog, products }, OPEN_TIME)).toThrow(/Esgotado no momento: 3. Dogzão Especial/);
  });

  it('retirada não exige endereço', () => {
    const order = build(validOrder({ deliveryType: 'pickup', address: undefined }));
    expect(order.address).toBeNull();
    expect(order.deliveryFee).toBe(0);
  });

  it('só permite transições de status válidas', () => {
    expect(canTransition('novo', 'preparando')).toBe(true);
    expect(canTransition('novo', 'entregue')).toBe(false);
    expect(canTransition('entregue', 'cancelado')).toBe(false);
  });
});

describe('site: pedido e acompanhamento', () => {
  let created;

  it('cardápio público traz produtos, adicionais e situação da loja', async () => {
    const res = await catalogApi(new Request(`${BASE}/api/catalog`), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.products.find(p => p.id === 'dogzao')).toMatchObject({ price: 17, soldOut: false });
    expect(body.extras.map(e => e.name)).toContain('Bacon Crocante');
    expect(body.status.open).toBe(true);
    expect(body.settings.hours).toHaveLength(7);
  });

  it('cria o pedido', async () => {
    const res = await createOrder(post('/api/orders', validOrder()), ctx());
    expect(res.status).toBe(201);
    created = await res.json();
    expect(created.code).toMatch(/^#\d{4}$/);
    expect(created.trackingToken.length).toBeGreaterThanOrEqual(20);
    expect(created.order.total).toBe(47);
  });

  it('retorna 422 para pedido inválido', async () => {
    const res = await createOrder(post('/api/orders', { items: [] }), ctx());
    expect(res.status).toBe(422);
    expect((await res.json()).details.length).toBeGreaterThan(1);
  });

  it('acompanhamento público não expõe telefone nem endereço', async () => {
    const res = await track(new Request(`${BASE}/api/track/${created.trackingToken}`), ctx({ params: { token: created.trackingToken } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('novo');
    expect(body.firstName).toBe('Maria');
    expect(JSON.stringify(body)).not.toContain('99999');
    expect(JSON.stringify(body)).not.toContain('Rua A');
    expect(body.history).toHaveLength(1);
  });

  it('token desconhecido dá 404', async () => {
    const token = 'x'.repeat(24);
    const res = await track(new Request(`${BASE}/api/track/${token}`), ctx({ params: { token } }));
    expect(res.status).toBe(404);
  });

  it('limita pedidos repetidos do mesmo IP', async () => {
    let last;
    for (let i = 0; i < 9; i++) last = await createOrder(post('/api/orders', validOrder()), ctx({ ip: '10.0.0.50' }));
    expect(last.status).toBe(429);
  });
});

describe('app de gestão: login e permissões', () => {
  it('rotas da equipe exigem login', async () => {
    const res = await adminOrders(req('GET', '/api/admin/orders'), ctx());
    expect(res.status).toBe(401);
  });

  it('senha errada e usuário inexistente dão a mesma resposta', async () => {
    const wrong = await login('dono', 'errada');
    const ghost = await login('fantasma', 'qualquer-coisa');
    expect(wrong.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(ghost.error).toBe(wrong.error);
  });

  it('GET da sessão devolve um token renovado', async () => {
    const first = await login('dono', 'senha-de-teste-123');
    const res = await session(req('GET', '/api/admin/session', { token: first.token }), ctx());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.user.username).toBe('dono');
    expect(body.token).toMatch(/./);
  });

  it('login devolve token e permissões do papel', async () => {
    const res = await login('dono', 'senha-de-teste-123');
    expect(res.status).toBe(200);
    expect(res.token).toMatch(/\./);
    expect(res.user).toMatchObject({ username: 'dono', role: 'dono' });
    expect(res.user.permissions).toContain('staff.manage');
    owner = res.token;
  });

  it('token adulterado é recusado', async () => {
    const res = await adminOrders(req('GET', '/api/admin/orders', { token: owner.slice(0, -2) + 'xx' }), ctx());
    expect(res.status).toBe(401);
  });

  it('dono cadastra atendente e cozinha; cada papel só faz o que pode', async () => {
    for (const [username, role] of [['ana', 'atendente'], ['zeca', 'cozinha']]) {
      const res = await adminStaff(req('POST', '/api/admin/staff', { token: owner, body: { username, role, displayName: username, password: 'senha-forte-123' } }), ctx());
      expect(res.status).toBe(201);
    }
    const kitchen = (await login('zeca', 'senha-forte-123')).token;
    const attendant = (await login('ana', 'senha-forte-123')).token;

    expect((await adminOrders(req('GET', '/api/admin/orders', { token: kitchen }), ctx())).status).toBe(200);
    expect((await adminFinance(req('GET', '/api/admin/finance', { token: kitchen }), ctx())).status).toBe(403);
    expect((await adminFinance(req('GET', '/api/admin/finance', { token: attendant }), ctx())).status).toBe(403);
    expect((await adminCash(req('GET', '/api/admin/cash', { token: attendant }), ctx())).status).toBe(200);
    expect((await adminCash(req('GET', '/api/admin/cash', { token: kitchen }), ctx())).status).toBe(403);
    // cozinha marca esgotado, mas não muda preço
    const stock = await adminCatalog(req('PATCH', '/api/admin/catalog/products/egg', { token: kitchen, body: { soldOut: true } }), ctx({ params: { resource: 'products', id: 'egg' } }));
    expect(stock.status).toBe(200);
    const price = await adminCatalog(req('PATCH', '/api/admin/catalog/products/egg', { token: kitchen, body: { price: 1 } }), ctx({ params: { resource: 'products', id: 'egg' } }));
    expect(price.status).toBe(403);
    // atendente pausa a loja, mas não muda horários
    expect((await adminStore(req('PATCH', '/api/admin/store', { token: attendant, body: { paused: true } }), ctx())).status).toBe(200);
    expect((await adminStore(req('PATCH', '/api/admin/store', { token: attendant, body: { storeName: 'X' } }), ctx())).status).toBe(403);
    await adminStore(req('PATCH', '/api/admin/store', { token: owner, body: { paused: false } }), ctx());
    await adminCatalog(req('PATCH', '/api/admin/catalog/products/egg', { token: owner, body: { soldOut: false } }), ctx({ params: { resource: 'products', id: 'egg' } }));
  });

  it('desativar usuário derruba a sessão dele', async () => {
    const kitchen = (await login('zeca', 'senha-forte-123')).token;
    await adminStaff(req('PATCH', '/api/admin/staff/zeca', { token: owner, body: { active: false } }), ctx({ params: { username: 'zeca' } }));
    expect((await adminOrders(req('GET', '/api/admin/orders', { token: kitchen }), ctx())).status).toBe(401);
    expect((await login('zeca', 'senha-forte-123')).status).toBe(403);
  });

  it('não deixa a loja sem dono ativo', async () => {
    const res = await adminStaff(req('PATCH', '/api/admin/staff/dono', { token: owner, body: { role: 'atendente' } }), ctx({ params: { username: 'dono' } }));
    expect(res.status).toBe(409);
  });
});

describe('app de gestão: pedidos', () => {
  let order;

  it('lista no quadro, avança o status e registra quem mudou', async () => {
    order = await (await createOrder(post('/api/orders', validOrder()), ctx({ ip: '10.0.0.3' }))).json();
    const list = await (await adminOrders(req('GET', '/api/admin/orders', { token: owner }), ctx())).json();
    expect(list.orders.map(o => o.id)).toContain(order.id);

    const patch = (body) => adminOrders(req('PATCH', `/api/admin/orders/${order.id}`, { token: owner, body }), ctx({ params: { id: String(order.id) } }));
    expect((await patch({ status: 'entregue' })).status).toBe(409); // pulo de etapa
    expect((await patch({ status: 'preparando' })).status).toBe(200);
    expect((await patch({ status: 'saiu_entrega' })).status).toBe(200);

    const detail = await (await adminOrders(req('GET', `/api/admin/orders/${order.id}`, { token: owner }), ctx({ params: { id: String(order.id) } }))).json();
    expect(detail.order.history.map(h => [h.status, h.by])).toEqual([['novo', 'cliente'], ['preparando', 'dono'], ['saiu_entrega', 'dono']]);

    const tracked = await (await track(new Request(`${BASE}/api/track/x`), ctx({ params: { token: order.trackingToken } }))).json();
    expect(tracked.status).toBe('saiu_entrega');
  });

  it('cancelamento exige motivo', async () => {
    const other = await (await createOrder(post('/api/orders', validOrder()), ctx({ ip: '10.0.0.4' }))).json();
    const cancel = (body) => adminOrders(req('PATCH', `/api/admin/orders/${other.id}`, { token: owner, body }), ctx({ params: { id: String(other.id) } }));
    expect((await cancel({ status: 'cancelado' })).status).toBe(422);
    const res = await cancel({ status: 'cancelado', cancelReason: 'Cliente desistiu' });
    expect(res.status).toBe(200);
    expect((await res.json()).order.cancelReason).toBe('Cliente desistiu');
  });

  it('busca no histórico por nome e por código', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const search = async (q) => (await adminOrders(req('GET', `/api/admin/orders?from=${today}&to=${today}&q=${encodeURIComponent(q)}`, { token: owner }), ctx())).json();
    expect((await search('maria')).total).toBeGreaterThan(1);
    const byCode = await search(String(order.id));
    expect(byCode.orders.map(o => o.id)).toContain(order.id);
  });
});

describe('app de gestão: cardápio e loja', () => {
  it('altera preço e o próximo pedido já usa o valor novo', async () => {
    const res = await adminCatalog(req('PATCH', '/api/admin/catalog/products/dog', { token: owner, body: { price: 12 } }), ctx({ params: { resource: 'products', id: 'dog' } }));
    expect(res.status).toBe(200);
    const created = await (await createOrder(post('/api/orders', validOrder({ deliveryType: 'pickup', items: [{ id: 'dog', qty: 1 }] })), ctx({ ip: '10.0.0.5' }))).json();
    expect(created.order.total).toBe(12);
  });

  it('recusa imagem que não seja um arquivo do próprio site', async () => {
    const res = await adminCatalog(req('PATCH', '/api/admin/catalog/products/dog', { token: owner, body: { image: 'https://outro-site.com/x.png' } }), ctx({ params: { resource: 'products', id: 'dog' } }));
    expect(res.status).toBe(422);
  });

  it('cria produto, bairro e cupom e valida os dados', async () => {
    const create = (resource, body) => adminCatalog(req('POST', `/api/admin/catalog/${resource}`, { token: owner, body }), ctx({ params: { resource } }));
    expect((await create('products', { id: 'x_tudo', name: 'X-Tudo', category: 'especiais', price: '25,90' })).status).toBe(201);
    expect((await create('products', { id: 'x_tudo', name: 'X-Tudo', category: 'especiais', price: 1 })).status).toBe(409);
    expect((await create('products', { id: 'ruim', name: 'Ruim', category: 'inexistente', price: 1 })).status).toBe(422);
    expect((await create('districts', { name: 'Vila Nova', fee: 9 })).status).toBe(201);
    expect((await create('coupons', { code: 'natal15', discountPercent: 15 })).status).toBe(201);

    const pub = await (await catalogApi(new Request(`${BASE}/api/catalog`), ctx())).json();
    expect(pub.products.find(p => p.id === 'x_tudo').price).toBe(25.9);
    expect(pub.settings.districts.map(d => d.name)).toContain('Vila Nova');
    expect(pub.settings.coupons).toBeUndefined(); // a lista de cupons não é pública
    const coupon = await couponsApi(new Request(`${BASE}/api/coupons/natal15`), ctx({ params: { code: 'natal15' } }));
    expect(await coupon.json()).toMatchObject({ code: 'NATAL15', discountPercent: 15 });
    expect((await couponsApi(new Request(`${BASE}/api/coupons/NAOEXISTE`), ctx({ params: { code: 'NAOEXISTE' } }))).status).toBe(404);
  });

  it('pausa a loja e o site recusa pedidos', async () => {
    await adminStore(req('PATCH', '/api/admin/store', { token: owner, body: { paused: true, pauseMessage: 'Voltamos às 20h' } }), ctx());
    const res = await createOrder(post('/api/orders', validOrder()), ctx({ ip: '10.0.0.6' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Voltamos às 20h/);
    await adminStore(req('PATCH', '/api/admin/store', { token: owner, body: { paused: false } }), ctx());
  });

  it('valida a grade de horários', async () => {
    const hours = Array(7).fill({ open: '20:00', close: '20:00' });
    const res = await adminStore(req('PATCH', '/api/admin/store', { token: owner, body: { hours } }), ctx());
    expect(res.status).toBe(422);
  });
});

describe('app de gestão: caixa e financeiro', () => {
  it('abre o caixa, registra sangria e fecha conferindo o dinheiro', async () => {
    const cash = (action, body) => adminCash(req('POST', `/api/admin/cash/${action}`, { token: owner, body }), ctx({ params: { action } }));
    expect((await cash('movement', { kind: 'sangria', amount: 10 })).status).toBe(409); // caixa fechado
    expect((await cash('open', { amount: 100 })).status).toBe(200);
    expect((await cash('open', { amount: 100 })).status).toBe(409); // já aberto

    await createOrder(post('/api/orders', validOrder({ deliveryType: 'pickup', payment: { method: 'dinheiro', changeFor: '50' }, items: [{ id: 'dog', qty: 2 }] })), ctx({ ip: '10.0.0.7' }));
    await cash('movement', { kind: 'sangria', amount: 30, description: 'Troco do motoboy' });

    const overview = await (await adminCash(req('GET', '/api/admin/cash', { token: owner }), ctx())).json();
    expect(overview.current.byPayment.dinheiro.total).toBe(24);
    expect(overview.current.expectedCash).toBe(94); // 100 + 24 − 30

    const closed = await (await cash('close', { countedAmount: 90 })).json();
    expect(closed.closed.difference).toBe(-4);
    expect(closed.current).toBeNull();
    expect(closed.history[0].countedAmount).toBe(90);
  });

  it('lança despesa e calcula o resultado do mês', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const add = await adminFinance(req('POST', '/api/admin/finance/expenses', { token: owner, body: { date: today, category: 'Insumos', amount: '50,00', description: 'Pão' } }), ctx());
    expect(add.status).toBe(201);
    expect((await adminFinance(req('POST', '/api/admin/finance/expenses', { token: owner, body: { date: today, category: 'Nada', amount: 5 } }), ctx())).status).toBe(422);

    const month = await (await adminFinance(req('GET', `/api/admin/finance?month=${today.slice(0, 7)}`, { token: owner }), ctx())).json();
    expect(month.expenses).toBe(50);
    expect(month.result).toBe(Math.round((month.revenue - 50) * 100) / 100);
    expect(month.byCategory[0]).toEqual({ category: 'Insumos', total: 50 });
  });

  it('gera relatório de vendas', async () => {
    const res = await reports(req('GET', '/api/admin/reports', { token: owner }), ctx());
    expect(res.status).toBe(200);
    const r = await res.json();
    expect(r.summary.orders).toBeGreaterThan(3);
    expect(r.summary.cancelled).toBe(1);
  });

  it('registra as alterações no histórico da equipe', async () => {
    const { entries } = await (await adminStaff(req('GET', '/api/admin/staff?audit=1', { token: owner }), ctx())).json();
    const actions = entries.map(e => e.action);
    expect(actions).toEqual(expect.arrayContaining(['produto.editar', 'loja.pausar', 'caixa.close', 'despesa.criar', 'equipe.criar']));
  });
});

describe('Função única da Vercel (api/router.js)', () => {
  let router;
  // o setup.js limpa o cache de módulos após cada teste: o router traz um db.js novo,
  // que recebe o mesmo banco em memória
  beforeEach(async () => {
    router = await import('../api/router.js');
    (await import('../server/db.js')).setDb(db);
  });

  it('roteia /api/* reescrito com ?__route= e mantém a query original', async () => {
    const res = await router.GET(new Request(`${BASE}/api/router?__route=catalog&x=1`));
    expect(res.status).toBe(200);
    expect((await res.json()).products.length).toBeGreaterThan(0);
  });

  it('extrai parâmetros da rota e aceita o caminho sem reescrita', async () => {
    const res = await router.GET(new Request(`${BASE}/api/coupons/BEMVINDO10`));
    expect(res.status).toBe(200);
    expect((await res.json()).discountPercent).toBe(10);
  });

  it('repassa corpo e método (login + rota admin protegida)', async () => {
    const login = await router.POST(new Request(`${BASE}/api/router?__route=admin/session`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '10.9.9.9' },
      body: JSON.stringify({ username: 'dono', password: 'senha-de-teste-123' }),
    }));
    expect(login.status).toBe(200);
    const { token } = await login.json();
    const orders = await router.GET(new Request(`${BASE}/api/router?__route=admin/orders`, { headers: { authorization: `Bearer ${token}` } }));
    expect(orders.status).toBe(200);
    expect((await router.GET(new Request(`${BASE}/api/router?__route=admin/orders`))).status).toBe(401);
  });

  it('responde 404 para rota desconhecida e para /api/router direto', async () => {
    expect((await router.GET(new Request(`${BASE}/api/router?__route=nada`))).status).toBe(404);
    expect((await router.GET(new Request(`${BASE}/api/router`))).status).toBe(404);
  });
});
