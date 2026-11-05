// Funções puras compartilhadas (sem dependência de DOM) — cobertas por tests/unit.test.js

const RESPONSIVE_WIDTHS = [320, 480, 640, 800, 1024];
const CARD_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';

export function formatBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Escapa texto para uso seguro dentro de templates HTML (conteúdo e atributos)
export function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Minúsculas, sem acentos e sem pontuação/espaços — usado para casar bairros do ViaCEP
export function normalizeStr(str) {
  return String(str ?? '').toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function srcset(key, ext) {
  return RESPONSIVE_WIDTHS.map(w => `images/optimized/${key}-${w}w.${ext} ${w}w`).join(', ');
}

// `image` vem do catálogo: { key } para imagens otimizadas ou { src } para uploads do CMS
export function createOptimizedPicture(image, alt, className = '', fetchPriority = '') {
  const altAttr = escapeHTML(alt);
  const classAttr = escapeHTML(className);
  const priorityAttr = fetchPriority ? ` fetchpriority="${escapeHTML(fetchPriority)}"` : '';

  if (!image?.key) {
    return `<img src="${escapeHTML(image?.src || '')}" alt="${altAttr}" class="${classAttr}"${priorityAttr} loading="lazy">`;
  }

  return `
    <picture>
      <source type="image/avif" srcset="${srcset(image.key, 'avif')}" sizes="${CARD_SIZES}">
      <source type="image/webp" srcset="${srcset(image.key, 'webp')}" sizes="${CARD_SIZES}">
      <img src="images/optimized/${image.key}.webp" alt="${altAttr}" class="${classAttr}"${priorityAttr} loading="lazy" width="400" height="300">
    </picture>
  `;
}

// Imagem única do modal de personalização
export function createOptimizedImageTag(image) {
  if (!image?.key) return { src: image?.src || '', srcsetWebp: '' };
  return {
    src: `images/optimized/${image.key}.webp`,
    srcsetWebp: srcset(image.key, 'webp'),
  };
}
