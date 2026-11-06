// Cardápio e configurações da loja. A fonte é /api/catalog (editado no app de gestão);
// a cópia gerada no build (scripts/build-catalog.js) só é usada se a API não responder.
// Os exports são "live bindings": quem importa enxerga os dados novos após loadLiveCatalog().
import fallback from './generated/catalog.json';
import imageMap from './generated/image-map.json';
import { resolveImage } from '../../shared/images.js';
import { getStoreStatus } from '../../shared/store-hours.js';

export let PRODUCTS = [];
export let PRODUCTS_BY_ID = new Map();
export let SETTINGS = {};
export let EXTRAS = [];
export let EXTRAS_BY_NAME = new Map();
export let STORE_STATUS = { open: true, label: '' };
export let IS_LIVE = false;

let signature = '';

function apply(data, status) {
  PRODUCTS = data.products.map(p => ({ ...p, image: resolveImage(p.image, imageMap) }));
  PRODUCTS_BY_ID = new Map(PRODUCTS.map(p => [p.id, p]));
  SETTINGS = data.settings;
  EXTRAS = data.extras;
  EXTRAS_BY_NAME = new Map(EXTRAS.map(e => [e.name, { name: e.name, price: e.price }]));
  STORE_STATUS = status || getStoreStatus(new Date(), SETTINGS);
}

apply(fallback);
signature = JSON.stringify([fallback.products, fallback.extras, fallback.settings]);

/**
 * Busca o cardápio atual. Em caso de erro, mantém o que já está carregado.
 * Retorna { live, changed }: changed indica que produtos/preços/configurações mudaram.
 */
export async function loadLiveCatalog({ timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('/api/catalog', { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.products) || !data.settings) throw new Error('resposta inválida');
    const next = JSON.stringify([data.products, data.extras, data.settings]);
    const changed = next !== signature;
    signature = next;
    apply(data, data.status);
    IS_LIVE = true;
    return { live: true, changed };
  } catch (error) {
    console.warn('[cardápio] mantendo os dados atuais:', error.message);
    return { live: false, changed: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Situação da loja agora (recalculada pelo relógio, respeitando a pausa vinda da API). */
export function currentStoreStatus() {
  return getStoreStatus(new Date(), { hours: SETTINGS.hours, paused: STORE_STATUS.paused, pauseMessage: STORE_STATUS.paused ? STORE_STATUS.label.replace(/^Pausado • /, '') : '' });
}
