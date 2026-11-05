// Cardápio e configurações vindos do Decap CMS (gerados por scripts/build-catalog.js)
import catalog from './generated/catalog.json';

export const PRODUCTS = catalog.products;
export const SETTINGS = catalog.settings;
export const PRODUCTS_BY_ID = new Map(PRODUCTS.map(p => [p.id, p]));
