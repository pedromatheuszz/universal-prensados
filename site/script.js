/* =========================================================
   UNIVERSAL PRENSADOS — INTERACTIVE CLIENT LOGIC
   - Three.js 3D Hero Scene with Ambient Particles & Lights
   - 3D Physics Tilt Effect on Cards
   - Complete Light / Dark Theme Engine with LocalStorage
   - Full Interactive Delivery System (Cart Drawer, Customizer,
     Joinville Neighborhoods Delivery Fees, Pix & WhatsApp Order)
   ========================================================= */

import { PRODUCTS, PRODUCTS_BY_ID, SETTINGS, EXTRAS, EXTRAS_BY_NAME, loadLiveCatalog, currentStoreStatus } from "./src/catalog.js";
import { formatBRL, escapeHTML, normalizeStr, createOptimizedPicture, createOptimizedImageTag } from "./src/utils.js";
import { calcSubtotal, calcDiscount, calcDeliveryFee, calcTotal, findCoupon, repriceCart } from "../shared/pricing.js";
import { REMOVALS } from "../shared/menu-options.js";
import { WEEKDAYS } from "../shared/store-hours.js";
import { initAnimations, revealProducts, filterProducts, flyToCart, revealCartItems } from "./src/animations.js";
import { initAnalytics, trackAddToCart, trackBeginCheckout, trackPurchase, trackApplyCoupon, trackViewItem, trackSearch } from "./analytics.js";

// Initialize Analytics
initAnalytics();

// --- 2. GLOBAL STATE ---
let cart = [];
let appliedCoupon = null; // { code: 'BEMVINDO10', discountPercent: 10 }
let currentCustomizingItem = null;
let currentModalQty = 1;
// Adicionais válidos (nome → { name, price }), lidos do modal no carregamento
let extrasByName = new Map();

// --- 2b. STATUS DA LOJA (aberto / fechado) ---
function updateStoreStatus() {
  const badge = document.getElementById('store-status');
  const text = document.getElementById('store-status-text');
  if (!badge || !text) return;
  const status = currentStoreStatus();
  badge.classList.toggle('is-closed', !status.open);
  text.textContent = status.label;
}

// Texto do horário de funcionamento a partir da grade do app de gestão (dias seguidos iguais são agrupados)
function renderBusinessHours() {
  const el = document.getElementById('business-hours');
  if (!el || !Array.isArray(SETTINGS.hours)) return;
  const cap = (d) => d[0].toUpperCase() + d.slice(1);
  const key = (h) => (h ? `${h.open} às ${h.close}` : '');
  const order = [1, 2, 3, 4, 5, 6, 0]; // segunda a domingo
  const groups = [];
  for (const d of order) {
    const last = groups[groups.length - 1];
    if (last && last.key === key(SETTINGS.hours[d])) last.days.push(d);
    else groups.push({ key: key(SETTINGS.hours[d]), days: [d] });
  }
  el.innerHTML = groups.map(g => {
    const days = g.days.length > 1 ? `${cap(WEEKDAYS[g.days[0]])} a ${WEEKDAYS[g.days[g.days.length - 1]]}` : cap(WEEKDAYS[g.days[0]]);
    return g.key ? `${escapeHTML(days)}: ${escapeHTML(g.key)}` : `<span class="text-muted">${escapeHTML(days)}: Fechado</span>`;
  }).join('<br>');
}

// Bloqueia o pedido com a loja fechada ou pausada (o servidor também recusa)
function ensureStoreOpen() {
  const status = currentStoreStatus();
  if (status.open) return true;
  showToast(`${status.label}. Você pode montar o carrinho, mas o pedido só é aceito com a loja aberta.`, '⏰');
  return false;
}

// --- 3. TOAST NOTIFICATION UTILITY ---
function showToast(message, icon = '✓') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  const iconEl = document.createElement('span');
  iconEl.textContent = icon;
  const messageEl = document.createElement('span');
  messageEl.textContent = message;
  toast.append(iconEl, ' ', messageEl);
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// --- 4. LIGHT / DARK THEME ENGINE ---
function initThemeEngine() {
  const toggleBtn = document.getElementById('theme-toggle');
  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (metaColorScheme) metaColorScheme.content = theme;
    localStorage.setItem('color-scheme', theme);
  }

  // Initial load sync
  const saved = localStorage.getItem('color-scheme');
  if (saved) {
    applyTheme(saved);
  } else {
    applyTheme(getTheme());
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = getTheme();
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      showToast(`Modo ${next === 'dark' ? 'Escuro' : 'Claro'} ativado!`, next === 'dark' ? '🌙' : '☀️');
    });
  }

  // Listen to OS system color changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('color-scheme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

// --- 7. RENDER MENU PRODUCTS ---
// Os cards são criados uma única vez; trocar de categoria só esconde/mostra (animado com Flip)
function productCardHTML(product) {
  const hot = /mais|top|campeão/i.test(product.badge);
  if (product.soldOut) {
    return `
    <div class="product-card__thumb-wrapper">
      ${createOptimizedPicture(product.image, product.name, 'product-card__thumb')}
      <span class="product-card__badge product-card__badge--soldout">Esgotado</span>
    </div>
    <div class="product-card__body">
      <h3 class="product-card__title">${escapeHTML(product.name)}</h3>
      <p class="product-card__desc">${escapeHTML(product.desc)}</p>
      <div class="product-card__footer">
        <span class="product-card__price">${formatBRL(product.price)}</span>
        <button type="button" class="btn--add-cart" disabled aria-label="${escapeHTML(product.name)} está esgotado">Esgotado</button>
      </div>
    </div>
  `;
  }
  return `
    <div class="product-card__thumb-wrapper">
      ${createOptimizedPicture(product.image, product.name, 'product-card__thumb')}
      ${product.badge ? `<span class="product-card__badge ${hot ? 'product-card__badge--hot' : ''}">${escapeHTML(product.badge)}</span>` : ''}
    </div>
    <div class="product-card__body">
      <h3 class="product-card__title">${escapeHTML(product.name)}</h3>
      <p class="product-card__desc">${escapeHTML(product.desc)}</p>
      <div class="product-card__footer">
        <span class="product-card__price">${formatBRL(product.price)}</span>
        <button type="button" class="btn--add-cart" data-action="open-modal" data-id="${escapeHTML(product.id)}" aria-label="Adicionar ${escapeHTML(product.name)} ao pedido">
          <span class="btn--add-cart__plus" aria-hidden="true">+</span> Adicionar
        </button>
      </div>
    </div>
  `;
}

function renderProducts(filterCategory = 'todos') {
  const container = document.getElementById('products-container');
  if (!container) return;

  let cards = [...container.querySelectorAll('.product-card')];
  if (cards.length === 0) {
    cards = PRODUCTS.map(product => {
      const card = document.createElement('article');
      card.className = product.soldOut ? 'product-card product-card--soldout' : 'product-card';
      card.dataset.id = product.id;
      card.dataset.category = product.category;
      card.innerHTML = productCardHTML(product);
      return card;
    });
    container.append(...cards);

    // O card inteiro abre a personalização; o botão garante acesso pelo teclado
    container.addEventListener('click', (e) => {
      const card = e.target.closest('.product-card');
      if (card) openCustomizerModal(card.dataset.id);
    });

    cards.forEach(card => { card.hidden = filterCategory !== 'todos' && card.dataset.category !== filterCategory; });
    revealProducts(cards.filter(c => !c.hidden));
    return;
  }

  filterProducts(cards, card => filterCategory === 'todos' || card.dataset.category === filterCategory);
}

// --- 8. CUSTOMIZATION MODAL (Lanche Customizer) ---
function renderMenuOptions() {
  const extrasEl = document.getElementById('extras-options');
  const removalsEl = document.getElementById('removal-options');
  if (extrasEl) {
    extrasEl.innerHTML = EXTRAS.map(e => `
      <label class="custom-option-card">
        <input type="checkbox" name="extra" value="${escapeHTML(e.id)}" data-name="${escapeHTML(e.name)}" data-price="${e.price}">
        <span class="opt-name">${escapeHTML(e.label)}</span>
        <span class="opt-price">+ ${formatBRL(e.price)}</span>
      </label>`).join('');
  }
  if (removalsEl) {
    removalsEl.innerHTML = REMOVALS.map(r => `
      <label class="custom-option-card">
        <input type="checkbox" name="removal" value="${escapeHTML(r)}">
        <span class="opt-name">${escapeHTML(r)}</span>
      </label>`).join('');
  }
}

function openCustomizerModal(productId) {
  const product = PRODUCTS_BY_ID.get(productId);
  if (!product) return;
  if (product.soldOut) {
    showToast(`${product.name} está esgotado no momento.`, '😕');
    return;
  }

  // Analytics: Track View Item
  trackViewItem(product);

  currentCustomizingItem = product;
  currentModalQty = 1;

  const modalBackdrop = document.getElementById('custom-modal-backdrop');
  const imgEl = document.getElementById('modal-item-img');
  const titleEl = document.getElementById('modal-item-title');
  const descEl = document.getElementById('modal-item-desc');
  const priceEl = document.getElementById('modal-item-price');
  const categoryEl = document.getElementById('modal-item-category');
  const notesEl = document.getElementById('modal-item-notes');
  const qtyEl = document.getElementById('modal-qty-val');

  // Use optimized image for modal
  const optimizedImg = createOptimizedImageTag(product.image);
  imgEl.src = optimizedImg.src;
  imgEl.srcset = optimizedImg.srcsetWebp;
  imgEl.alt = product.name;
  titleEl.textContent = product.name;
  descEl.textContent = product.desc;
  priceEl.textContent = formatBRL(product.price);
  categoryEl.textContent = product.category.toUpperCase();
  notesEl.value = '';
  qtyEl.textContent = '1';

  // Uncheck all extras & removals
  document.querySelectorAll('#custom-modal input[type="checkbox"]').forEach(cb => cb.checked = false);

  // Hide or show sections depending on hasExtras
  const extrasSection = document.getElementById('section-extras');
  const removalsSection = document.getElementById('section-removals');
  if (product.hasExtras) {
    extrasSection.classList.remove('hidden');
    removalsSection.classList.remove('hidden');
  } else {
    extrasSection.classList.add('hidden');
    removalsSection.classList.add('hidden');
  }

  updateModalTotal();
  modalBackdrop.classList.add('active');
  modalBackdrop.setAttribute('aria-hidden', 'false');
}

function closeCustomizerModal() {
  const modalBackdrop = document.getElementById('custom-modal-backdrop');
  if (modalBackdrop) {
    modalBackdrop.classList.remove('active');
    modalBackdrop.setAttribute('aria-hidden', 'true');
  }
}

function updateModalTotal() {
  if (!currentCustomizingItem) return;

  let total = currentCustomizingItem.price;

  // Add checked extras
  document.querySelectorAll('#custom-modal input[name="extra"]:checked').forEach(cb => {
    total += parseFloat(cb.dataset.price || 0);
  });

  const totalCalculated = total * currentModalQty;
  document.getElementById('modal-total-calc').textContent = formatBRL(totalCalculated);
}

// --- 9. CART SYSTEM ---
function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('up_cart');
    // Preços e nomes sempre vêm do catálogo atual, nunca do que ficou salvo no navegador
    cart = saved ? repriceCart(JSON.parse(saved), PRODUCTS_BY_ID, extrasByName) : [];
  } catch (e) {
    cart = [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem('up_cart', JSON.stringify(cart));
  } catch (e) {
    // Armazenamento indisponível (modo privado); o carrinho segue só na memória
  }
}

function addToCart(item, extras = [], removals = [], notes = '', qty = 1) {
  const [cartItem] = repriceCart([{ id: item.id, qty, extras, removals, notes }], PRODUCTS_BY_ID, extrasByName);
  if (!cartItem) return;
  const { unitPrice } = cartItem;

  cart.push(cartItem);

  saveCartToStorage();
  updateCartUI();
  showToast(`${qty}x ${item.name} adicionado ao seu carrinho!`, '🌭');

  // Analytics: Track Add to Cart
  trackAddToCart({ ...item, unitPrice }, qty);
}

function updateCartItemQty(index, delta) {
  if (!cart[index]) return;

  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
    showToast('Item removido do carrinho.', '🗑️');
  }
  saveCartToStorage();
  updateCartUI();
}

function removeCartItem(index) {
  if (!cart[index]) return;
  cart.splice(index, 1);
  saveCartToStorage();
  updateCartUI();
  showToast('Item removido do carrinho.', '🗑️');
}

function getCartSubtotal() {
  return calcSubtotal(cart);
}

function getCartDiscount() {
  return calcDiscount(getCartSubtotal(), appliedCoupon);
}

function getCartTotal() {
  return calcTotal({ subtotal: getCartSubtotal(), discount: getCartDiscount() });
}

// Taxa do bairro selecionado no checkout (grátis acima do valor mínimo)
function getDeliveryFee(isDelivery) {
  const districtSelect = document.getElementById('order-district');
  const selectedOption = districtSelect ? districtSelect.options[districtSelect.selectedIndex] : null;
  return calcDeliveryFee({
    isDelivery,
    subtotal: getCartSubtotal(),
    districtFee: selectedOption?.dataset.fee ? parseFloat(selectedOption.dataset.fee) : NaN,
    freeShippingThreshold: SETTINGS.freeShippingThreshold,
  });
}

function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = getCartSubtotal();
  const discount = getCartDiscount();
  const total = getCartTotal();

  // Badges in header and buttons
  const badgeEl = document.getElementById('cart-count');
  const quickTotalEl = document.getElementById('cart-quick-total');
  const itemsCountEl = document.getElementById('cart-items-count');

  if (badgeEl) badgeEl.textContent = totalItems;
  if (quickTotalEl) quickTotalEl.textContent = formatBRL(subtotal);
  if (itemsCountEl) itemsCountEl.textContent = totalItems;

  // Mobile Bottom Bar
  const mobileBar = document.getElementById('mobile-cart-bar');
  const mobileCount = document.getElementById('mobile-cart-count');
  const mobilePrice = document.getElementById('mobile-cart-price');
  if (mobileBar) {
    if (totalItems > 0) {
      mobileBar.classList.add('active');
      mobileCount.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;
      mobilePrice.textContent = formatBRL(total);
    } else {
      mobileBar.classList.remove('active');
    }
  }

  // Free shipping progress bar (valor mínimo definido no CMS)
  const freeShippingThreshold = SETTINGS.freeShippingThreshold;
  const progressBar = document.getElementById('free-shipping-progress');
  const progressText = document.getElementById('free-shipping-text');
  if (progressBar && progressText) {
    const percent = Math.min(100, (subtotal / freeShippingThreshold) * 100);
    progressBar.style.inlineSize = `${percent}%`;

    if (subtotal >= freeShippingThreshold) {
      progressText.innerHTML = `🎉 Parabéns! Você ganhou <strong>Entrega Grátis!</strong>`;
    } else {
      const diff = freeShippingThreshold - subtotal;
      progressText.innerHTML = `Faltam ${formatBRL(diff)} para <strong>Entrega Grátis!</strong>`;
    }
  }

  // Render items inside drawer
  const listContainer = document.getElementById('cart-items-list');
  const cartFooter = document.getElementById('cart-footer');

  if (listContainer) {
    if (cart.length === 0) {
      listContainer.innerHTML = `
        <div class="cart-empty-state">
          <span class="cart-empty-state__icon">🛒</span>
          <h4>Seu carrinho está vazio</h4>
          <p>Que tal escolher um Dogzão Especial ou um combo para hoje?</p>
          <a href="#cardapio" class="btn btn--outline" data-action="close-cart">Explorar Cardápio</a>
        </div>
      `;
      if (cartFooter) cartFooter.style.display = 'none';
    } else {
      if (cartFooter) cartFooter.style.display = 'flex';
      listContainer.innerHTML = '';

      cart.forEach((item, index) => {
        const itemCard = document.createElement('div');
        itemCard.className = 'cart-item-card';

        let detailsArr = [];
        if (item.extras && item.extras.length > 0) {
          detailsArr.push(`+ ${item.extras.map(e => e.name).join(', ')}`);
        }
        if (item.removals && item.removals.length > 0) {
          detailsArr.push(`${item.removals.join(', ')}`);
        }
        if (item.notes) {
          detailsArr.push(`Obs: "${item.notes}"`);
        }

        const detailsText = detailsArr.length > 0
          ? `<div class="cart-item-card__details">${escapeHTML(detailsArr.join(' • '))}</div>`
          : '';

        itemCard.innerHTML = `
          ${createOptimizedPicture(item.image, item.name, 'cart-item-card__img')}
          <div class="cart-item-card__info">
            <h4 class="cart-item-card__title">${escapeHTML(item.name)}</h4>
            ${detailsText}
            <div class="cart-item-card__bottom">
              <span class="cart-item-card__price">${formatBRL(item.unitPrice * item.qty)}</span>
              <div class="cart-item-qty-actions">
                <button type="button" class="cart-qty-btn" data-action="qty" data-index="${index}" data-delta="-1" aria-label="Diminuir quantidade">−</button>
                <span class="cart-item-qty">${item.qty}</span>
                <button type="button" class="cart-qty-btn" data-action="qty" data-index="${index}" data-delta="1" aria-label="Aumentar quantidade">+</button>
                <button type="button" class="cart-item-remove-btn" data-action="remove" data-index="${index}" title="Remover item" aria-label="Remover item">✕</button>
              </div>
            </div>
          </div>
        `;
        listContainer.appendChild(itemCard);
      });
    }
  }

  // Summary lines
  const subtotalValEl = document.getElementById('cart-subtotal-val');
  const totalValEl = document.getElementById('cart-total-val');
  const discountRow = document.getElementById('discount-row');
  const discountLabel = document.getElementById('discount-label');
  const discountVal = document.getElementById('discount-val');

  if (subtotalValEl) subtotalValEl.textContent = formatBRL(subtotal);
  if (totalValEl) totalValEl.textContent = formatBRL(total);

  if (discountRow) {
    if (appliedCoupon && discount > 0) {
      discountRow.classList.remove('hidden');
      discountLabel.textContent = `${appliedCoupon.discountPercent}%`;
      discountVal.textContent = `- ${formatBRL(discount)}`;
    } else {
      discountRow.classList.add('hidden');
    }
  }
}

function openCart() {
  document.getElementById('cart-drawer').classList.add('active');
  document.getElementById('cart-overlay').classList.add('active');
  revealCartItems();
}

function closeCart() {
  document.getElementById('cart-drawer').classList.remove('active');
  document.getElementById('cart-overlay').classList.remove('active');
}

// --- 10. CHECKOUT MODAL & ORDER PROCESSING ---
function openCheckoutModal() {
  if (cart.length === 0) {
    showToast('Adicione pelo menos um item para continuar.', '⚠️');
    return;
  }
  if (!ensureStoreOpen()) return;
  
  // Analytics: Track Begin Checkout
  trackBeginCheckout([...cart]);
  
  closeCart();
  updateCheckoutSummary();
  const checkoutBackdrop = document.getElementById('checkout-modal-backdrop');
  checkoutBackdrop.classList.add('active');
  checkoutBackdrop.setAttribute('aria-hidden', 'false');
}

function closeCheckoutModal() {
  const checkoutBackdrop = document.getElementById('checkout-modal-backdrop');
  if (checkoutBackdrop) {
    checkoutBackdrop.classList.remove('active');
    checkoutBackdrop.setAttribute('aria-hidden', 'true');
  }
}

function updateCheckoutSummary() {
  const subtotal = getCartSubtotal();
  const discount = getCartDiscount();
  
  // Delivery Fee
  const isDelivery = document.querySelector('input[name="delivery_type"]:checked')?.value === 'delivery';
  const fee = getDeliveryFee(isDelivery);
  const finalTotal = calcTotal({ subtotal, discount, fee });

  const subtotalEl = document.getElementById('checkout-subtotal');
  const feeEl = document.getElementById('checkout-fee');
  const totalEl = document.getElementById('checkout-total');
  const discountRow = document.getElementById('checkout-discount-row');
  const discountEl = document.getElementById('checkout-discount');

  if (subtotalEl) subtotalEl.textContent = formatBRL(subtotal);
  if (feeEl) {
    feeEl.textContent = fee === 0 ? (isDelivery ? 'GRÁTIS 🎉' : 'R$ 0,00 (Retirada)') : formatBRL(fee);
  }
  if (totalEl) totalEl.textContent = formatBRL(finalTotal);

  if (discountRow) {
    if (appliedCoupon && discount > 0) {
      discountRow.classList.remove('hidden');
      discountEl.textContent = `- ${formatBRL(discount)}`;
    } else {
      discountRow.classList.add('hidden');
    }
  }
}

// Envia o pedido para a API (aparece no app de gestão). Se a API estiver fora do ar,
// o pedido segue só pelo WhatsApp como antes — nenhum pedido se perde.
async function submitOrderToApi(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data };
    // 4xx de validação: o cliente precisa corrigir algo
    if (res.status === 409 || res.status === 422 || res.status === 429) return { ok: false, userError: data.error || 'Confira os dados do pedido.' };
    return { ok: false };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

function buildWhatsAppMessage({ code, trackingUrl, name, phone, deliveryType, address, items, totals, paymentText, couponCode }) {
  let msg = `🌭 *NOVO PEDIDO ONLINE - UNIVERSAL PRENSADOS*\n`;
  msg += `*Pedido:* ${code}\n`;
  msg += `--------------------------------------\n`;
  msg += `👤 *Cliente:* ${name}\n`;
  msg += `📱 *WhatsApp:* ${phone}\n`;
  msg += `🛵 *Tipo:* ${deliveryType === 'delivery' ? 'Entrega em Casa' : 'Retirada no Balcão (Jarivatuba)'}\n`;

  if (deliveryType === 'delivery') {
    msg += `📍 *Endereço:* ${address.street}, nº ${address.number}\n`;
    msg += `📍 *Bairro:* ${address.district} - Joinville/SC\n`;
    if (address.compl) msg += `🏢 *Compl:* ${address.compl}\n`;
    if (address.ref) msg += `🔍 *Ref:* ${address.ref}\n`;
  }
  msg += `--------------------------------------\n`;
  msg += `📋 *ITENS DO PEDIDO:*\n\n`;

  items.forEach((item, i) => {
    msg += `${i + 1}. *${item.qty}x ${item.name}* — ${formatBRL(item.unitPrice * item.qty)}\n`;
    if (item.extras?.length) msg += `   └ Adicionais: ${item.extras.map(e => e.name).join(', ')}\n`;
    if (item.removals?.length) msg += `   └ Retirar: ${item.removals.join(', ')}\n`;
    if (item.notes) msg += `   └ Observação: "${item.notes}"\n`;
    msg += `\n`;
  });

  msg += `--------------------------------------\n`;
  msg += `💵 *Subtotal:* ${formatBRL(totals.subtotal)}\n`;
  if (totals.discount > 0) msg += `🎉 *Desconto Cupom (${couponCode}):* -${formatBRL(totals.discount)}\n`;
  if (deliveryType === 'delivery') msg += `🛵 *Taxa de Entrega:* ${totals.deliveryFee === 0 ? 'GRÁTIS' : formatBRL(totals.deliveryFee)}\n`;
  msg += `💰 *TOTAL A PAGAR: ${formatBRL(totals.total)}*\n`;
  msg += `💳 *Forma de Pagamento:* ${paymentText}\n`;
  msg += `--------------------------------------\n`;
  if (trackingUrl) msg += `📍 Acompanhe: ${trackingUrl}\n`;
  msg += `Aguardando confirmação do pedido! Muito obrigado!`;
  return msg;
}

async function processOrder(e) {
  e.preventDefault();

  if (cart.length === 0) {
    showToast('Seu carrinho está vazio!', '⚠️');
    return;
  }
  if (!ensureStoreOpen()) return;

  const name = document.getElementById('order-name').value.trim();
  const phone = document.getElementById('order-phone').value.trim();
  const deliveryType = document.querySelector('input[name="delivery_type"]:checked').value === 'delivery' ? 'delivery' : 'pickup';
  const paymentMethod = document.querySelector('input[name="payment_method"]:checked').value;
  const changeFor = paymentMethod === 'dinheiro' ? document.getElementById('order-change').value.trim() : '';

  const address = { district: '', street: '', number: '', compl: '', ref: '', cep: '' };
  if (deliveryType === 'delivery') {
    address.district = document.getElementById('order-district').value;
    address.street = document.getElementById('order-street').value.trim();
    address.number = document.getElementById('order-number').value.trim();
    address.compl = document.getElementById('order-compl').value.trim();
    address.ref = document.getElementById('order-ref').value.trim();
    address.cep = document.getElementById('order-cep').value.trim();

    if (!address.district || !address.street || !address.number) {
      showToast('Por favor, preencha o endereço completo de entrega.', '⚠️');
      return;
    }
  }

  if (!name || !phone) {
    showToast('Por favor, informe seu nome e telefone.', '⚠️');
    return;
  }

  // Carrinho repreçado pelo catálogo antes de fechar o pedido
  cart = repriceCart(cart, PRODUCTS_BY_ID, extrasByName);
  if (cart.length === 0) {
    saveCartToStorage();
    updateCartUI();
    showToast('Os itens do carrinho não estão mais disponíveis.', '⚠️');
    return;
  }

  const submitBtn = document.getElementById('submit-order-btn');
  const submitLabel = submitBtn?.innerHTML;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando pedido...';
  }

  // Abre a aba do WhatsApp já no clique (depois de um await o navegador bloquearia o pop-up)
  const waWindow = window.open('', '_blank');

  const result = await submitOrderToApi({
    customer: { name, phone },
    deliveryType,
    address: deliveryType === 'delivery' ? address : null,
    payment: { method: paymentMethod, changeFor },
    couponCode: appliedCoupon?.code || null,
    items: cart.map(item => ({ id: item.id, qty: item.qty, extras: item.extras.map(x => x.name), removals: item.removals, notes: item.notes })),
  });

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = submitLabel;
  }

  if (result.userError) {
    waWindow?.close();
    showToast(result.userError, '⚠️');
    return;
  }

  // Valores oficiais: os do servidor; sem API, os calculados aqui
  let code;
  let trackingUrl = '';
  let items;
  let totals;
  let couponCode;
  if (result.ok) {
    const { order } = result.data;
    code = result.data.code;
    trackingUrl = `${location.origin}/pedido/?t=${encodeURIComponent(result.data.trackingToken)}`;
    items = order.items;
    totals = { subtotal: order.subtotal, discount: order.discount, deliveryFee: order.deliveryFee, total: order.total };
    couponCode = order.couponCode;
    try { localStorage.setItem('up_last_order', result.data.trackingToken); } catch { /* sem armazenamento */ }
  } else {
    code = `#UP-${Math.floor(1000 + Math.random() * 9000)}`;
    items = cart;
    const subtotal = getCartSubtotal();
    const discount = getCartDiscount();
    const fee = getDeliveryFee(deliveryType === 'delivery');
    totals = { subtotal, discount, deliveryFee: fee, total: calcTotal({ subtotal, discount, fee }) };
    couponCode = appliedCoupon?.code;
  }

  const paymentText = paymentMethod === 'pix'
    ? '⚡ Pix (Chave: 47996366274)'
    : paymentMethod === 'cartao'
      ? '💳 Cartão na Entrega (Maquininha)'
      : `💵 Dinheiro ${changeFor ? `(Troco para: ${changeFor})` : '(Sem troco)'}`;

  const msg = buildWhatsAppMessage({ code, trackingUrl, name, phone, deliveryType, address, items, totals, paymentText, couponCode });
  const whatsappUrl = `https://wa.me/${SETTINGS.whatsappPhone}?text=${encodeURIComponent(msg)}`;
  if (waWindow) waWindow.location.href = whatsappUrl;

  trackPurchase({
    orderId: code,
    items: [...cart],
    subtotal: totals.subtotal,
    discount: totals.discount,
    deliveryFee: totals.deliveryFee,
    total: totals.total,
    paymentMethod,
    deliveryType,
  });

  // Modal de sucesso
  closeCheckoutModal();
  document.getElementById('success-order-id').textContent = code;
  document.getElementById('success-order-dest').textContent = deliveryType === 'delivery'
    ? `${address.street}, ${address.number} - ${address.district}`
    : 'Retirada no Balcão (R. Monsenhor Gercino, 4486)';
  document.getElementById('success-order-total').textContent = formatBRL(totals.total);
  document.getElementById('success-whatsapp-link').href = whatsappUrl;
  document.getElementById('success-order-msg').textContent = result.ok
    ? 'Seu pedido foi registrado e já apareceu no painel da nossa cozinha. Envie também pelo WhatsApp para confirmar.'
    : 'Envie o pedido pelo WhatsApp para a nossa equipe confirmar.';
  const trackLink = document.getElementById('success-track-link');
  trackLink.classList.toggle('hidden', !result.ok);
  if (result.ok) trackLink.href = trackingUrl;

  const successModal = document.getElementById('success-modal-backdrop');
  successModal.classList.add('active');
  successModal.setAttribute('aria-hidden', 'false');

  cart = [];
  appliedCoupon = null;
  saveCartToStorage();
  updateCartUI();
}

// --- 11. INITIALIZATION & DOM EVENTS ---
document.addEventListener('DOMContentLoaded', async () => {
  // Load Theme
  initThemeEngine();

  // Cardápio, preços, bairros e situação da loja atualizados pelo app de gestão
  await loadLiveCatalog({ timeoutMs: 2500 });
  renderBusinessHours();

  // Status de funcionamento (aberto/fechado) no hero
  updateStoreStatus();
  setInterval(updateStoreStatus, 60 * 1000);
  const statProducts = document.getElementById('stat-products');
  if (statProducts) {
    statProducts.dataset.count = String(PRODUCTS.length);
    statProducts.textContent = String(PRODUCTS.length);
  }

  // Adicionais (do banco, via /api/catalog) e remoções (shared/menu-options.js) do modal
  renderMenuOptions();
  extrasByName = EXTRAS_BY_NAME;

  // Bairros e taxas cadastrados no app de gestão
  const districtSelectEl = document.getElementById('order-district');
  if (districtSelectEl) {
    SETTINGS.districts.forEach(d => {
      const option = document.createElement('option');
      option.value = d.name;
      option.dataset.fee = String(d.fee);
      option.textContent = `${d.name} (Taxa: ${formatBRL(d.fee)})`;
      districtSelectEl.appendChild(option);
    });
  }

  // Load Saved Cart
  loadCartFromStorage();

  // Ações dos itens do carrinho (delegação — os itens são re-renderizados a cada mudança)
  document.getElementById('cart-items-list')?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const index = Number(target.dataset.index);
    if (target.dataset.action === 'qty') updateCartItemQty(index, Number(target.dataset.delta));
    else if (target.dataset.action === 'remove') removeCartItem(index);
    else if (target.dataset.action === 'close-cart') closeCart();
  });

  // Render initial menu
  renderProducts('todos');

  // Animações GSAP (hero, faixa, revelações ao rolar, efeitos de ponteiro)
  initAnimations();

  // Mobile menu hamburger toggle
  const menuToggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('nav');
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', open);
    });

    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Menu Category Filter Tabs
  document.querySelectorAll('.menu-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.menu-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const category = btn.dataset.category;
      
      // Analytics: Track Category Filter (Search)
      if (category !== 'todos') {
        trackSearch(`category:${category}`);
      }
      
      renderProducts(category);
    });
  });

  // Direct Add Button on Hero Featured Card
  document.querySelectorAll('.add-to-cart-direct').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      openCustomizerModal(itemId);
    });
  });

  // Customization Modal Events
  const customModalClose = document.getElementById('custom-modal-close');
  if (customModalClose) {
    customModalClose.addEventListener('click', closeCustomizerModal);
  }

  // Checkbox change updates total in customizer
  document.querySelectorAll('#custom-modal input[name="extra"]').forEach(cb => {
    cb.addEventListener('change', updateModalTotal);
  });

  // Quantity in modal
  const minusBtn = document.getElementById('modal-qty-minus');
  const plusBtn = document.getElementById('modal-qty-plus');
  const qtyValEl = document.getElementById('modal-qty-val');

  if (minusBtn) {
    minusBtn.addEventListener('click', () => {
      if (currentModalQty > 1) {
        currentModalQty--;
        qtyValEl.textContent = currentModalQty;
        updateModalTotal();
      }
    });
  }

  if (plusBtn) {
    plusBtn.addEventListener('click', () => {
      currentModalQty++;
      qtyValEl.textContent = currentModalQty;
      updateModalTotal();
    });
  }

  // Confirm Add to Cart
  const confirmAddBtn = document.getElementById('modal-confirm-add-btn');
  if (confirmAddBtn) {
    confirmAddBtn.addEventListener('click', () => {
      if (!currentCustomizingItem) return;

      const extras = [];
      document.querySelectorAll('#custom-modal input[name="extra"]:checked').forEach(cb => {
        extras.push({
          name: cb.dataset.name,
          price: parseFloat(cb.dataset.price)
        });
      });

      const removals = [];
      document.querySelectorAll('#custom-modal input[name="removal"]:checked').forEach(cb => {
        removals.push(cb.value);
      });

      const notes = document.getElementById('modal-item-notes').value.trim();

      addToCart(currentCustomizingItem, extras, removals, notes, currentModalQty);
      flyToCart(document.getElementById('modal-item-img'));
      closeCustomizerModal();
    });
  }

  // Cart Open & Close Triggers
  document.getElementById('cart-open-btn')?.addEventListener('click', openCart);
  document.getElementById('mobile-cart-open')?.addEventListener('click', openCart);
  document.getElementById('cart-close-btn')?.addEventListener('click', closeCart);
  document.getElementById('cart-overlay')?.addEventListener('click', closeCart);

  // Header "Fazer Pedido" scroll to menu
  document.getElementById('header-order-btn')?.addEventListener('click', () => {
    document.getElementById('cardapio')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Coupon Copy Button in Banner
  const copyCouponBtn = document.getElementById('copy-coupon-btn');
  if (copyCouponBtn) {
    copyCouponBtn.addEventListener('click', () => {
      const code = copyCouponBtn.dataset.code;
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Cupom ${code} copiado com sucesso!`, '📋');
        copyCouponBtn.textContent = 'Copiado! ✓';
        setTimeout(() => {
          copyCouponBtn.textContent = 'Copiar Cupom';
        }, 2000);
      });
    });
  }

  // Apply Coupon in Cart Drawer
  const applyCouponBtn = document.getElementById('cart-coupon-apply');
  const couponInput = document.getElementById('cart-coupon-input');
  const couponMsg = document.getElementById('coupon-feedback-msg');

  if (applyCouponBtn && couponInput) {
    applyCouponBtn.addEventListener('click', () => {
      const code = couponInput.value.trim().toUpperCase();
      const coupon = findCoupon(code, SETTINGS.coupons);
      if (coupon) {
        appliedCoupon = { code: coupon.code, discountPercent: coupon.discountPercent };
        couponMsg.className = 'coupon-feedback success';
        couponMsg.textContent = `Cupom aplicado! ${coupon.discountPercent}% de desconto.`;
        updateCartUI();
        showToast(`Desconto de ${coupon.discountPercent}% aplicado no pedido!`, '🎉');

        // Analytics: Track Coupon Application
        trackApplyCoupon(coupon.code, getCartDiscount());
      } else if (!code) {
        couponMsg.className = 'coupon-feedback error';
        couponMsg.textContent = 'Digite um cupom válido.';
      } else {
        couponMsg.className = 'coupon-feedback error';
        couponMsg.textContent = 'Cupom inválido ou expirado.';
      }
    });
  }

  // Checkout Open Trigger
  document.getElementById('proceed-to-checkout-btn')?.addEventListener('click', openCheckoutModal);
  document.getElementById('checkout-modal-close')?.addEventListener('click', closeCheckoutModal);

  // Delivery type radio toggle
  document.querySelectorAll('input[name="delivery_type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const addressGroup = document.getElementById('address-step-group');
      const isDelivery = e.target.value === 'delivery';

      document.querySelectorAll('.delivery-type-card').forEach(c => c.classList.remove('active'));
      e.target.closest('.delivery-type-card').classList.add('active');

      if (isDelivery) {
        addressGroup.classList.remove('hidden');
        document.getElementById('order-cep').setAttribute('required', 'true');
        document.getElementById('order-district').setAttribute('required', 'true');
        document.getElementById('order-street').setAttribute('required', 'true');
        document.getElementById('order-number').setAttribute('required', 'true');
      } else {
        addressGroup.classList.add('hidden');
        // sem isso o CEP escondido bloqueava o envio de pedidos para retirada
        document.getElementById('order-cep').removeAttribute('required');
        document.getElementById('order-district').removeAttribute('required');
        document.getElementById('order-street').removeAttribute('required');
        document.getElementById('order-number').removeAttribute('required');
      }
      updateCheckoutSummary();
    });
  });

  // District selector change updates delivery fee
  document.getElementById('order-district')?.addEventListener('change', updateCheckoutSummary);

  // --- VIACEP INTEGRATION FOR ADDRESS AUTOCOMPLETE ---
  const cepInput = document.getElementById('order-cep');
  const cepLoading = document.getElementById('cep-loading');
  const cepStatus = document.getElementById('cep-status');
  const districtSelect = document.getElementById('order-district');
  const streetInput = document.getElementById('order-street');

  // Bairros do CMS indexados pelo slug normalizado (ex.: "joao costa" → "joaocosta")
  const JOINVILLE_DISTRICTS = Object.fromEntries(
    SETTINGS.districts.map(d => [normalizeStr(d.slug), d.name])
  );

  // Format CEP input (99999-999)
  function formatCEP(value) {
    const digits = value.replace(/\D/g, '');
    if (digits.length > 5) {
      return digits.slice(0, 5) + '-' + digits.slice(5, 8);
    }
    return digits;
  }

  // Validate CEP format
  function isValidCEP(cep) {
    return /^\d{5}-?\d{3}$/.test(cep);
  }

  // Find matching district from ViaCEP response
  function findMatchingDistrict(bairro, localidade, uf) {
    if (uf !== 'SC' || localidade?.toLowerCase() !== 'joinville') {
      return null;
    }
    const normalizedBairro = normalizeStr(bairro);
    return JOINVILLE_DISTRICTS[normalizedBairro] || null;
  }

  // Fetch address from ViaCEP
  async function fetchCEP(cep) {
    const cleanCEP = cep.replace('-', '');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      if (!response.ok) throw new Error('Erro na requisição');
      const data = await response.json();
      if (data.erro) throw new Error('CEP não encontrado');
      return data;
    } catch (error) {
      console.error('[ViaCEP] Erro:', error.message);
      return null;
    }
  }

  // Update form fields with ViaCEP data
  function fillAddressFields(data) {
    if (!data) return;

    // Enable fields
    districtSelect.disabled = false;
    streetInput.disabled = false;

    // Fill street
    if (data.logradouro) {
      streetInput.value = data.logradouro;
    }

    // Find and select matching district
    const matchedDistrict = findMatchingDistrict(data.bairro, data.localidade, data.uf);
    if (matchedDistrict) {
      // Find the option with matching value
      const option = [...districtSelect.options].find(o => o.value === matchedDistrict);
      if (option) {
        districtSelect.value = matchedDistrict;
        // Trigger change to update delivery fee
        districtSelect.dispatchEvent(new Event('change'));
      }
      cepStatus.textContent = `✓ Endereço encontrado: ${data.bairro}, ${data.localidade}/${data.uf}`;
      cepStatus.style.color = 'var(--color-success)';
    } else {
      cepStatus.textContent = `⚠ CEP válido, mas bairro não está em nossa área de entrega (${data.bairro}, ${data.localidade}/${data.uf})`;
      cepStatus.style.color = 'var(--color-secondary)';
    }

    // Focus next field
    streetInput.focus();
  }

  // CEP input event handler
  if (cepInput) {
    let cepDebounceTimer;

    cepInput.addEventListener('input', (e) => {
      const formatted = formatCEP(e.target.value);
      e.target.value = formatted;

      clearTimeout(cepDebounceTimer);
      
      if (isValidCEP(formatted)) {
        cepLoading.classList.add('active');
        cepStatus.textContent = 'Buscando endereço...';
        cepStatus.style.color = 'var(--text-muted)';

        cepDebounceTimer = setTimeout(async () => {
          const data = await fetchCEP(formatted);
          cepLoading.classList.remove('active');
          
          if (data) {
            fillAddressFields(data);
          } else {
            cepStatus.textContent = '✗ CEP não encontrado ou fora de Joinville/SC';
            cepStatus.style.color = '#ef4444';
            districtSelect.disabled = false;
            streetInput.disabled = false;
          }
        }, 300);
      } else {
        cepStatus.textContent = '';
        districtSelect.disabled = true;
        streetInput.disabled = true;
        districtSelect.value = '';
        streetInput.value = '';
      }
    });

    // Handle paste
    cepInput.addEventListener('paste', (e) => {
      setTimeout(() => {
        const formatted = formatCEP(cepInput.value);
        cepInput.value = formatted;
        if (isValidCEP(formatted)) {
          cepInput.dispatchEvent(new Event('input'));
        }
      }, 0);
    });
  }

  // Payment method radio toggle
  document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const method = e.target.value;
      document.querySelectorAll('.payment-option-card').forEach(c => c.classList.remove('active'));
      e.target.closest('.payment-option-card').classList.add('active');

      const pixBox = document.getElementById('pix-box');
      const cashBox = document.getElementById('cash-box');

      if (method === 'pix') {
        pixBox.classList.remove('hidden');
        cashBox.classList.add('hidden');
      } else if (method === 'dinheiro') {
        pixBox.classList.add('hidden');
        cashBox.classList.remove('hidden');
      } else {
        pixBox.classList.add('hidden');
        cashBox.classList.add('hidden');
      }
    });
  });

  // Copy Pix Key Button
  document.getElementById('copy-pix-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText('47996366274').then(() => {
      showToast('Chave Pix copiada com sucesso!', '⚡');
    });
  });

  // Checkout Form Submission
  document.getElementById('checkout-form')?.addEventListener('submit', processOrder);

  // Success Modal Close
  document.getElementById('success-close-btn')?.addEventListener('click', () => {
    document.getElementById('success-modal-backdrop').classList.remove('active');
  });

  // Close modals on clicking backdrop
  ['custom-modal-backdrop', 'checkout-modal-backdrop', 'success-modal-backdrop'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          el.classList.remove('active');
          el.setAttribute('aria-hidden', 'true');
        }
      });
    }
  });

  // Initial cart UI update
  updateCartUI();
});




