/**
 * Analytics Module for Universal Prensados
 * Supports Plausible Analytics and Google Analytics 4 (GA4)
 * Provides custom event tracking for e-commerce interactions
 */

// Configuration - Set your analytics IDs here or via environment variables
const ANALYTICS_CONFIG = {
  plausible: {
    enabled: false, // Set to true and add domain to enable
    domain: 'universalprensados.com.br', // Your Plausible domain
    apiHost: 'https://plausible.io', // Or self-hosted URL
  },
  ga4: {
    enabled: false, // Set to true and add measurement ID to enable
    measurementId: 'G-XXXXXXXXXX', // Your GA4 Measurement ID
  },
  debug: false, // Set to true for console logging
};

/**
 * Initialize Analytics
 * Call this once on app startup
 */
export function initAnalytics() {
  if (ANALYTICS_CONFIG.plausible.enabled) {
    initPlausible();
  }
  
  if (ANALYTICS_CONFIG.ga4.enabled) {
    initGA4();
  }
  
  log('Analytics initialized', { plausible: ANALYTICS_CONFIG.plausible.enabled, ga4: ANALYTICS_CONFIG.ga4.enabled });
}

/**
 * Initialize Plausible Analytics
 */
function initPlausible() {
  const { domain, apiHost } = ANALYTICS_CONFIG.plausible;
  
  // Create script element
  const script = document.createElement('script');
  script.defer = true;
  script.dataset.domain = domain;
  script.dataset.api = `${apiHost}/api/event`;
  script.src = `${apiHost}/js/script.js`;
  
  document.head.appendChild(script);
  
  // Plausible global event handler
  window.plausible = window.plausible || function() {
    (window.plausible.q = window.plausible.q || []).push(arguments);
  };
  
  log('Plausible Analytics loaded', { domain });
}

/**
 * Initialize Google Analytics 4
 */
function initGA4() {
  const { measurementId } = ANALYTICS_CONFIG.ga4;
  
  // Load gtag script
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script1);
  
  // Initialize dataLayer and gtag
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: true,
    cookie_flags: 'SameSite=Lax;Secure',
  });
  
  log('GA4 initialized', { measurementId });
}

/**
 * Track custom event
 * Works with both Plausible and GA4
 * @param {string} eventName - Event name (e.g., 'add_to_cart', 'begin_checkout')
 * @param {Object} params - Event parameters
 */
export function trackEvent(eventName, params = {}) {
  log(`Tracking event: ${eventName}`, params);
  
  // Plausible
  if (ANALYTICS_CONFIG.plausible.enabled && window.plausible) {
    window.plausible(eventName, { props: params });
  }
  
  // GA4
  if (ANALYTICS_CONFIG.ga4.enabled && window.gtag) {
    // Map common e-commerce events to GA4 recommended events
    const ga4EventName = mapToGA4Event(eventName);
    window.gtag('event', ga4EventName, params);
  }
}

/**
 * Map custom event names to GA4 recommended events
 */
function mapToGA4Event(eventName) {
  const eventMap = {
    'add_to_cart': 'add_to_cart',
    'remove_from_cart': 'remove_from_cart',
    'view_cart': 'view_cart',
    'begin_checkout': 'begin_checkout',
    'add_payment_info': 'add_payment_info',
    'add_shipping_info': 'add_shipping_info',
    'purchase': 'purchase',
    'view_item': 'view_item',
    'view_item_list': 'view_item_list',
    'select_item': 'select_item',
    'apply_coupon': 'apply_coupon',
    'search': 'search',
    'share': 'share',
    'login': 'login',
    'sign_up': 'sign_up',
  };
  
  return eventMap[eventName] || eventName;
}

/**
 * Track e-commerce item for GA4
 * @param {Object} item - Product item
 * @param {number} quantity - Quantity
 */
function formatGA4Item(item, quantity = 1) {
  return {
    item_id: item.id,
    item_name: item.name,
    affiliation: 'Universal Prensados',
    value: item.unitPrice * quantity,
    quantity: quantity,
    currency: 'BRL',
    item_category: item.category,
    item_variant: item.extras?.map(e => e.name).join(', ') || 'standard',
  };
}

/**
 * Track Add to Cart event
 * @param {Object} item - Product item from cart
 * @param {number} quantity - Quantity added
 */
export function trackAddToCart(item, quantity = 1) {
  const params = {
    currency: 'BRL',
    value: item.unitPrice * quantity,
    items: [formatGA4Item(item, quantity)],
  };
  
  trackEvent('add_to_cart', params);
}

/**
 * Track Begin Checkout event
 * @param {Array} cartItems - Array of cart items
 */
export function trackBeginCheckout(cartItems) {
  const items = cartItems.map(item => formatGA4Item(item, item.qty));
  const value = items.reduce((sum, item) => sum + item.value, 0);
  
  const params = {
    currency: 'BRL',
    value: value,
    items: items,
  };
  
  trackEvent('begin_checkout', params);
}

/**
 * Track Purchase event
 * @param {Object} orderData - Order data from checkout
 */
export function trackPurchase(orderData) {
  const { orderId, items, subtotal, discount, deliveryFee, total, paymentMethod, deliveryType } = orderData;
  
  const ga4Items = items.map(item => formatGA4Item(item, item.qty));
  
  const params = {
    transaction_id: orderId,
    currency: 'BRL',
    value: total,
    items: ga4Items,
    affiliation: 'Universal Prensados',
    shipping: deliveryFee || 0,
    discount: discount || 0,
    payment_type: paymentMethod,
    delivery_type: deliveryType,
  };
  
  trackEvent('purchase', params);
  
  log('Purchase tracked', params);
}

/**
 * Track Apply Coupon event
 * @param {string} couponCode - Coupon code
 * @param {number} discountAmount - Discount amount
 */
export function trackApplyCoupon(couponCode, discountAmount) {
  trackEvent('apply_coupon', {
    coupon: couponCode,
    value: discountAmount,
    currency: 'BRL',
  });
}

/**
 * Track View Item event (when opening product modal)
 * @param {Object} product - Product data
 */
export function trackViewItem(product) {
  trackEvent('view_item', {
    currency: 'BRL',
    value: product.price,
    items: [{
      item_id: product.id,
      item_name: product.name,
      price: product.price,
      item_category: product.category,
      currency: 'BRL',
    }],
  });
}

/**
 * Track Search event (when filtering menu categories)
 * @param {string} searchTerm - Category/search term
 */
export function trackSearch(searchTerm) {
  trackEvent('search', {
    search_term: searchTerm,
  });
}

/**
 * Debug logging
 */
function log(...args) {
  if (ANALYTICS_CONFIG.debug) {
    console.log('[Analytics]', ...args);
  }
}

/**
 * Enable/disable analytics at runtime (for user consent)
 * @param {boolean} enabled - Whether analytics should be enabled
 */
export function setAnalyticsEnabled(enabled) {
  ANALYTICS_CONFIG.plausible.enabled = enabled && ANALYTICS_CONFIG.plausible.domain !== 'universalprensados.com.br';
  ANALYTICS_CONFIG.ga4.enabled = enabled && ANALYTICS_CONFIG.ga4.measurementId !== 'G-XXXXXXXXXX';
  
  log('Analytics enabled state changed', { enabled: ANALYTICS_CONFIG.plausible.enabled || ANALYTICS_CONFIG.ga4.enabled });
}

export default {
  init: initAnalytics,
  trackEvent,
  trackAddToCart,
  trackBeginCheckout,
  trackPurchase,
  trackApplyCoupon,
  trackViewItem,
  trackSearch,
  setAnalyticsEnabled,
};