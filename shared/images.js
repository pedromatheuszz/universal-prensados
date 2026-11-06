// Converte o nome da imagem salvo no cardápio (ex.: "dogzao.png") na imagem usada pelo site.
// imageMap: { nome: { file, width, widths } } gerado por site/scripts/optimize-images.js.

export function resolveImage(image, imageMap = {}) {
  if (typeof image !== 'string' || !image.trim()) return { src: '' };
  const base = image.split('/').pop();
  const key = base.replace(/\.[a-z0-9]+$/i, '');
  const optimized = imageMap[key];
  if (optimized) return { key: optimized.file, widths: optimized.widths, width: optimized.width };
  if (/^(https?:)?\/\//.test(image) || image.startsWith('/')) return { src: image };
  return { src: `/images/uploads/${base}` };
}
