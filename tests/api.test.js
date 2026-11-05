// @vitest-environment node
/**
 * Testes de integração da API de pedidos contra um Postgres real em memória (PGlite).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { PGlite } from '@electric-sql/pglite';

process.env.SESSION_SECRET = 'teste-'.repeat(8);
execSync('node scripts/build-catalog.js', { stdio: 'pipe' });

const { setDb, migrate } = await import('../server/db.js');
const { hashPassword } = await import('../server/auth.js');
const { buildOrder, canTransition } = await import('../server/orders.js');
const createOrder = (await import('../netlify/functions/orders.js')).default;
const track = (await import('../netlify/functions/track.js')).default;
const session = (await import('../netlify/functions/admin-session.js')).default;
const adminOrders = (await import('../netlify/functions/admin-orders.js')).default;
const reports = (await import('../netlify/functions/admin-reports.js')).default;

let pg;
const db = { query: (text, params) => pg.query(text, params).then(r => r.rows) };

const BASE = 'http://localhost';
const post = (path, body, headers = {}) =>
  new Request(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const ctx = (extra = {}) => ({ ip: '10.0.0.1', params: {}, ...extra });

const validOrder = (overrides = {}) => ({
  customer: { name: 'Maria Teste', phone: '(47) 99999-0000' },
  deliveryType: 'delivery',
  address: { district: 'Itaum', street: 'Rua A', number: '10', cep: '89200-000' },
  payment: { method: 'pix' },
  items: [{ id: 'dogzao', qty: 2, extras: ['Bacon Crocante'], removals: ['Sem milho'], notes: 'bem prensado' }],
  ...overrides,
});

let cookie;

beforeAll(async () => {
  pg = new PGlite();
  setDb(db);
  await migrate(db);
  await db.query('INSERT INTO staff_users (username, password_hash) VALUES ($1, $2)', ['equipe', hashPassword('senha-de-teste-123')]);
});

describe('buildOrder (validação e preços no servidor)', () => {
  it('recalcula preços ignorando valores enviados pelo navegador', () => {
    const order = buildOrder(validOrder({ items: [{ id: 'dogzao', qty: 2, unitPrice: 0.01, extras: [{ name: 'Bacon Crocante', price: 0 }] }] }));
    expect(order.items[0].unitPrice).toBe(20.5); // 17 + 3,50
    expect(order.subtotal).toBe(41);
    expect(order.deliveryFee).toBe(6); // Itaum, abaixo do frete grátis
    expect(order.total).toBe(47);
  });

  it('aplica cupom e frete grátis', () => {
    const order = buildOrder(validOrder({ couponCode: 'bemvindo10', items: [{ id: 'combo_familia', qty: 1 }] }));
    expect(order.couponCode).toBe('BEMVINDO10');
    expect(order.discount).toBe(10.99);
    expect(order.deliveryFee).toBe(0);
    expect(order.total).toBe(98.91);
  });

  it('rejeita dados inválidos com mensagens claras', () => {
    expect(() => buildOrder({})).toThrow(/nome/);
    expect(() => buildOrder(validOrder({ address: { district: 'Bairro Falso', street: 'R', number: '1' } }))).toThrow(/bairro/);
    expect(() => buildOrder(validOrder({ items: [{ id: 'nao_existe', qty: 1 }] }))).toThrow(/não está mais disponível/);
    expect(() => buildOrder(validOrder({ payment: { method: 'bitcoin' } }))).toThrow(/pagamento/);
  });

  it('retirada não exige endereço', () => {
    const order = buildOrder(validOrder({ deliveryType: 'pickup', address: undefined }));
    expect(order.address).toBeNull();
    expect(order.deliveryFee).toBe(0);
  });

  it('só permite transições de status válidas', () => {
    expect(canTransition('novo', 'preparando')).toBe(true);
    expect(canTransition('novo', 'entregue')).toBe(false);
    expect(canTransition('entregue', 'cancelado')).toBe(false);
  });
});

describe('fluxo completo da API', () => {
  let created;

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

  it('rotas da equipe exigem login', async () => {
    const res = await adminOrders(new Request(`${BASE}/api/admin/orders`), ctx());
    expect(res.status).toBe(401);
  });

  it('senha errada é recusada e conta tentativa', async () => {
    const res = await session(post('/api/admin/session', { username: 'equipe', password: 'errada' }), ctx({ ip: '10.0.0.9' }));
    expect(res.status).toBe(401);
  });

  it('login cria cookie de sessão HttpOnly', async () => {
    const res = await session(post('/api/admin/session', { username: 'equipe', password: 'senha-de-teste-123' }), ctx());
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    cookie = setCookie.split(';')[0];
  });

  it('cookie adulterado é recusado', async () => {
    const res = await adminOrders(new Request(`${BASE}/api/admin/orders`, { headers: { cookie: cookie.slice(0, -2) + 'xx' } }), ctx());
    expect(res.status).toBe(401);
  });

  it('lista o pedido no quadro e avança o status', async () => {
    const list = await (await adminOrders(new Request(`${BASE}/api/admin/orders`, { headers: { cookie } }), ctx())).json();
    expect(list.orders.map(o => o.id)).toContain(created.id);

    const patch = (status) => adminOrders(
      new Request(`${BASE}/api/admin/orders/${created.id}`, { method: 'PATCH', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ status }) }),
      ctx({ params: { id: String(created.id) } })
    );

    expect((await patch('entregue')).status).toBe(409); // pulo de etapa
    const res = await patch('preparando');
    expect(res.status).toBe(200);
    expect((await res.json()).order.status).toBe('preparando');
    expect((await patch('saiu_entrega')).status).toBe(200);

    const tracked = await (await track(new Request(`${BASE}/api/track/x`), ctx({ params: { token: created.trackingToken } }))).json();
    expect(tracked.status).toBe('saiu_entrega');
    expect(tracked.history.map(h => h.status)).toEqual(['novo', 'preparando', 'saiu_entrega']);
  });

  it('gera relatório do dia', async () => {
    await createOrder(post('/api/orders', validOrder({ deliveryType: 'pickup', payment: { method: 'dinheiro', changeFor: '50' }, items: [{ id: 'dog', qty: 1 }] })), ctx({ ip: '10.0.0.2' }));
    const res = await reports(new Request(`${BASE}/api/admin/reports`, { headers: { cookie } }), ctx());
    expect(res.status).toBe(200);
    const r = await res.json();
    expect(r.summary.orders).toBe(2);
    expect(r.summary.revenue).toBe(58.5); // 47 + 11,50
    expect(r.topProducts[0]).toMatchObject({ name: '3. Dogzão Especial', qty: 2 });
    expect(r.byPayment.map(p => p.key).sort()).toEqual(['dinheiro', 'pix']);
  });

  it('limita pedidos repetidos do mesmo IP', async () => {
    let last;
    for (let i = 0; i < 9; i++) last = await createOrder(post('/api/orders', validOrder()), ctx({ ip: '10.0.0.50' }));
    expect(last.status).toBe(429);
  });
});
