/**
 * Image Optimization Script
 * Converte as imagens-fonte (images-src/products, geradas por build-product-art.js)
 * em AVIF/WebP responsivos e grava o mapa usado pelo build do catálogo.
 * Nunca amplia: só gera larguras menores ou iguais à original.
 * Os arquivos levam um hash do conteúdo no nome (ex.: dog-1a2b3c4d.webp), então
 * podem ser cacheados como imutáveis e uma foto nova nunca fica presa no cache.
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Caminhos relativos à pasta site/
process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const IMAGES_DIR = 'images-src/products';
const OUTPUT_DIR = 'public/images/optimized';
const SIZES = [320, 480, 640, 800];
const WEBP_QUALITY = 80;
const AVIF_QUALITY = 55;

async function optimizeImage(file) {
  const name = path.parse(file).name;
  const source = fs.readFileSync(path.join(IMAGES_DIR, file));
  const basename = `${name}-${crypto.createHash('sha1').update(source).digest('hex').slice(0, 8)}`;
  const image = sharp(source);
  const { width } = await image.metadata();
  const widths = SIZES.filter(w => w < width);

  for (const w of widths) {
    const resized = image.clone().resize(w, null, { withoutEnlargement: true });
    await resized.clone().webp({ quality: WEBP_QUALITY, effort: 6 }).toFile(path.join(OUTPUT_DIR, `${basename}-${w}w.webp`));
    await resized.clone().avif({ quality: AVIF_QUALITY, effort: 6 }).toFile(path.join(OUTPUT_DIR, `${basename}-${w}w.avif`));
  }
  // tamanho original (também entra no srcset)
  await image.clone().webp({ quality: WEBP_QUALITY, effort: 6 }).toFile(path.join(OUTPUT_DIR, `${basename}.webp`));
  await image.clone().avif({ quality: AVIF_QUALITY, effort: 6 }).toFile(path.join(OUTPUT_DIR, `${basename}.avif`));

  console.log(`  ✓ ${file} → ${[...widths, width].join(', ')}w`);
  return [name, { file: basename, width, widths }];
}

async function main() {
  // Limpa versões antigas para não publicar imagens órfãs
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  console.log(`📁 ${files.length} imagens em ${IMAGES_DIR}`);

  const map = Object.fromEntries(await Promise.all(files.map(optimizeImage)));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'image-map.json'), JSON.stringify(map, null, 2) + '\n');
  console.log(`✨ Concluído — mapa em ${OUTPUT_DIR}/image-map.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
