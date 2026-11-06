// Funções puras compartilhadas (sem dependência de DOM) — cobertas por tests/unit.test.js

const CARD_SIZES = '(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 300px';

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

// Larguras geradas por scripts/optimize-images.js: `${key}-${w}w.ext` e o original `${key}.ext`
export function srcset(image, ext) {
  const entries = (image.widths || []).map(w => `images/optimized/${image.key}-${w}w.${ext} ${w}w`);
  if (image.width) entries.push(`images/optimized/${image.key}.${ext} ${image.width}w`);
  return entries.join(', ');
}

// `image` vem do catálogo: { key } para imagens otimizadas ou { src } para uploads do CMS
export function createOptimizedPicture(image, alt, className = '', fetchPriority = '', sizes = CARD_SIZES) {
  const altAttr = escapeHTML(alt);
  const classAttr = escapeHTML(className);
  const priorityAttr = fetchPriority ? ` fetchpriority="${escapeHTML(fetchPriority)}"` : '';

  if (!image?.key) {
    return `<img src="${escapeHTML(image?.src || '')}" alt="${altAttr}" class="${classAttr}"${priorityAttr} loading="lazy" decoding="async">`;
  }

  return `
    <picture>
      <source type="image/avif" srcset="${srcset(image, 'avif')}" sizes="${sizes}">
      <source type="image/webp" srcset="${srcset(image, 'webp')}" sizes="${sizes}">
      <img src="images/optimized/${image.key}.webp" alt="${altAttr}" class="${classAttr}"${priorityAttr} loading="${fetchPriority === 'high' ? 'eager' : 'lazy'}" decoding="async" width="600" height="600">
    </picture>
  `;
}

// Imagem única do modal de personalização
export function createOptimizedImageTag(image) {
  if (!image?.key) return { src: image?.src || '', srcsetWebp: '' };
  return {
    src: `images/optimized/${image.key}.webp`,
    srcsetWebp: srcset(image, 'webp'),
  };
}
