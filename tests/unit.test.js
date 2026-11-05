/**
 * Testes unitários das funções puras usadas pelo site (src/utils.js e src/pricing.js)
 * e validação do catálogo gerado a partir do CMS.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import { formatBRL, escapeHTML, normalizeStr, createOptimizedPicture, createOptimizedImageTag, getStoreStatus } from '../src/utils.js';
import { calcSubtotal, calcDiscount, calcDeliveryFee, calcTotal, findCoupon, repriceCart } from '../src/pricing.js';

describe('formatBRL', () => {
  it('formata valores em reais', () => {
    expect(formatBRL(10)).toBe('R$ 10,00');
    expect(formatBRL(10.5)).toBe('R$ 10,50');
    expect(formatBRL(1234.56)).toBe('R$ 1.234,56');
    expect(formatBRL(0)).toBe('R$ 0,00');
  });

  it('arredonda para centavos', () => {
    expect(formatBRL(10.999)).toBe('R$ 11,00');
    expect(formatBRL(10.001)).toBe('R$ 10,00');
  });
});

describe('escapeHTML', () => {
  it('neutraliza tags e aspas', () => {
    expect(escapeHTML('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(escapeHTML("O'Neil & Cia")).toBe('O&#39;Neil &amp; Cia');
  });

  it('aceita valores não-string', () => {
    expect(escapeHTML(null)).toBe('');
    expect(escapeHTML(12)).toBe('12');
  });
});

describe('imagens', () => {
  it('gera <picture> responsivo para imagens otimizadas', () => {
    const html = createOptimizedPicture({ key: 'dog', widths: [320, 480], width: 600 }, 'Dog "Tradicional"', 'thumb');
    expect(html).toContain('images/optimized/dog-320w.avif 320w');
    expect(html).toContain('images/optimized/dog.avif 600w');
    expect(html).not.toContain('800w');
    expect(html).toContain('src="images/optimized/dog.webp"');
    expect(html).toContain('alt="Dog &quot;Tradicional&quot;"');
  });

  it('usa o caminho original (escapado) para uploads do CMS', () => {
    const html = createOptimizedPicture({ src: '/images/uploads/a"b.jpg' }, 'x');
    expect(html).toContain('src="/images/uploads/a&quot;b.jpg"');
    expect(html).not.toContain('<picture>');
  });

  it('monta a imagem do modal', () => {
    expect(createOptimizedImageTag({ key: 'agua', widths: [320], width: 600 }).src).toBe('images/optimized/agua.webp');
    expect(createOptimizedImageTag({ src: '/x.jpg' })).toEqual({ src: '/x.jpg', srcsetWebp: '' });
  });
});

describe('cálculos do pedido', () => {
  const cart = [
    { unitPrice: 15, qty: 2 },
    { unitPrice: 10.1, qty: 3 },
  ];

  it('soma o subtotal sem erro de ponto flutuante', () => {
    expect(calcSubtotal(cart)).toBe(60.3);
    expect(calcSubtotal([])).toBe(0);
  });

  it('aplica desconto percentual', () => {
    expect(calcDiscount(100, { discountPercent: 10 })).toBe(10);
    expect(calcDiscount(100, null)).toBe(0);
  });

  it('calcula a taxa de entrega com frete grátis acima do mínimo', () => {
    const base = { isDelivery: true, districtFee: 6, freeShippingThreshold: 70 };
    expect(calcDeliveryFee({ ...base, subtotal: 50 })).toBe(6);
    expect(calcDeliveryFee({ ...base, subtotal: 70 })).toBe(0);
    expect(calcDeliveryFee({ ...base, isDelivery: false, subtotal: 10 })).toBe(0);
  });

  it('nunca retorna total negativo', () => {
    expect(calcTotal({ subtotal: 50, discount: 5, fee: 4 })).toBe(49);
    expect(calcTotal({ subtotal: 10, discount: 20 })).toBe(0);
  });

  it('encontra cupons ignorando maiúsculas e espaços', () => {
    const coupons = [{ code: 'BEMVINDO10', discountPercent: 10 }];
    expect(findCoupon(' bemvindo10 ', coupons)).toEqual(coupons[0]);
    expect(findCoupon('FALSO', coupons)).toBeNull();
    expect(findCoupon('', coupons)).toBeNull();
  });
});

describe('repriceCart', () => {
  const products = new Map([
    ['dog', { id: 'dog', name: 'Dog', category: 'salgados', price: 11.5, image: { key: 'dog' }, hasExtras: true }],
    ['agua', { id: 'agua', name: 'Água', category: 'bebidas', price: 4.5, image: { key: 'agua' }, hasExtras: false }],
  ]);
  const extras = new Map([['Bacon Crocante', { name: 'Bacon Crocante', price: 3.5 }]]);

  it('ignora preços adulterados no localStorage', () => {
    const [item] = repriceCart([{ id: 'dog', qty: 2, unitPrice: 0.01, basePrice: 0.01, name: '<script>', extras: [{ name: 'Bacon Crocante', price: 0 }] }], products, extras);
    expect(item.unitPrice).toBe(15);
    expect(item.name).toBe('Dog');
    expect(item.extras).toEqual([{ name: 'Bacon Crocante', price: 3.5 }]);
  });

  it('descarta produtos inexistentes, adicionais desconhecidos e quantidades inválidas', () => {
    const result = repriceCart([
      { id: 'sumiu', qty: 1 },
      { id: 'dog', qty: 0 },
      { id: 'dog', qty: -3 },
      { id: 'dog', qty: 1, extras: [{ name: 'Caviar', price: 1 }] },
    ], products, extras);
    expect(result).toHaveLength(1);
    expect(result[0].extras).toEqual([]);
  });

  it('não aplica adicionais em produtos sem personalização', () => {
    const [item] = repriceCart([{ id: 'agua', qty: 1, extras: [{ name: 'Bacon Crocante' }] }], products, extras);
    expect(item.unitPrice).toBe(4.5);
  });

  it('tolera dados corrompidos', () => {
    expect(repriceCart(null, products, extras)).toEqual([]);
    expect(repriceCart([null, 'x'], products, extras)).toEqual([]);
  });
});

describe('normalizeStr / bairros', () => {
  it('casa nomes do ViaCEP com os slugs do CMS', () => {
    expect(normalizeStr('João Costa')).toBe(normalizeStr('joao costa'));
    expect(normalizeStr('Fátima')).toBe('fatima');
  });
});

describe('catálogo gerado do CMS', () => {
  execSync('node scripts/build-catalog.js', { stdio: 'pipe' });
  const catalog = JSON.parse(fs.readFileSync('src/generated/catalog.json', 'utf8'));

  it('tem produtos válidos e ordenados', () => {
    expect(catalog.products.length).toBeGreaterThan(0);
    const ids = new Set();
    for (const p of catalog.products) {
      expect(p.id).toMatch(/^[a-z0-9_]+$/);
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.price).toBeGreaterThanOrEqual(0);
      expect(p.image.key || p.image.src).toBeTruthy();
    }
    const orders = catalog.products.map(p => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('usa imagens otimizadas que existem em disco', () => {
    for (const p of catalog.products.filter(p => p.image.key)) {
      expect(fs.existsSync(`public/images/optimized/${p.image.key}.webp`)).toBe(true);
    }
  });

  it('traz configurações de entrega, cupons e WhatsApp', () => {
    expect(catalog.settings.whatsappPhone).toMatch(/^\d{12,13}$/);
    expect(catalog.settings.districts.length).toBeGreaterThan(0);
    expect(catalog.settings.freeShippingThreshold).toBeGreaterThan(0);
  });
});

describe('getStoreStatus (horário de Brasília, UTC-3)', () => {
  // 2026-11-05 é quinta-feira
  it('aberto durante o expediente', () => {
    expect(getStoreStatus(new Date('2026-11-05T23:00:00Z')).open).toBe(true); // 20:00
  });

  it('fechado antes de abrir no mesmo dia', () => {
    expect(getStoreStatus(new Date('2026-11-05T15:00:00Z'))).toEqual({ open: false, label: 'Fechado • Abrimos hoje às 19:00' });
  });

  it('fecha às 23:30', () => {
    expect(getStoreStatus(new Date('2026-11-06T02:29:00Z')).open).toBe(true); // 23:29
    expect(getStoreStatus(new Date('2026-11-06T02:31:00Z')).label).toBe('Fechado • Abrimos amanhã às 19:00');
  });

  it('pula o domingo', () => {
    // sábado 23:45 → próxima abertura é segunda
    expect(getStoreStatus(new Date('2026-11-08T02:45:00Z')).label).toBe('Fechado • Abrimos segunda às 19:00');
  });
});
