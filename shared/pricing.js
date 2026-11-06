// Cálculos do pedido (funções puras) — cobertas por tests/unit.test.js

const round2 = (n) => Math.round(n * 100) / 100;

export function calcSubtotal(cart) {
  return round2(cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0));
}

export function calcDiscount(subtotal, coupon) {
  if (!coupon) return 0;
  return round2((subtotal * coupon.discountPercent) / 100);
}

export function calcDeliveryFee({ isDelivery, subtotal, districtFee, freeShippingThreshold }) {
  if (!isDelivery || subtotal >= freeShippingThreshold) return 0;
  return Number.isFinite(districtFee) ? districtFee : 0;
}

export function calcTotal({ subtotal, discount = 0, fee = 0 }) {
  return Math.max(0, round2(subtotal - discount + fee));
}

export function findCoupon(code, coupons) {
  const normalized = String(code ?? '').trim().toUpperCase();
  if (!normalized) return null;
  return coupons.find(c => c.code === normalized) || null;
}

/**
 * Recalcula o carrinho a partir do catálogo, ignorando preços/nomes salvos no navegador.
 * Itens de produtos que saíram do cardápio e adicionais desconhecidos são descartados.
 */
export function repriceCart(cart, productsById, extrasByName) {
  if (!Array.isArray(cart)) return [];

  return cart.flatMap(item => {
    const product = productsById.get(item?.id);
    const qty = Math.floor(Number(item?.qty));
    if (!product || !(qty > 0)) return [];

    const extras = product.hasExtras && Array.isArray(item.extras)
      ? item.extras
        .map(e => extrasByName.get(e?.name))
        .filter(Boolean)
      : [];
    const removals = product.hasExtras && Array.isArray(item.removals)
      ? item.removals.filter(r => typeof r === 'string')
      : [];

    return [{
      id: product.id,
      name: product.name,
      category: product.category,
      image: product.image,
      basePrice: product.price,
      unitPrice: round2(product.price + extras.reduce((sum, e) => sum + e.price, 0)),
      qty: Math.min(qty, 99),
      extras,
      removals,
      notes: typeof item.notes === 'string' ? item.notes.slice(0, 300) : '',
    }];
  });
}
