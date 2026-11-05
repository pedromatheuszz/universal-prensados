/**
 * Image Optimization Script
 * Converts JPG/PNG images to WebP and AVIF formats
 * Generates responsive sizes for srcset
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const IMAGES_DIR = 'images';
const OUTPUT_DIR = 'images/optimized';

// Responsive breakpoints (widths)
const SIZES = [320, 480, 640, 800, 1024, 1280, 1600];

// Quality settings
const WEBP_QUALITY = 80;
const AVIF_QUALITY = 50;
const ORIGINAL_QUALITY = 85;

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function optimizeImage(inputPath, filename) {
  const basename = path.parse(filename).name;
  const results = {
    original: filename,
    webp: {},
    avif: {},
    responsive: {}
  };

  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    console.log(`\n📷 Processando: ${filename} (${metadata.width}x${metadata.height})`);

    // Generate WebP versions for each size
    for (const width of SIZES) {
      if (width <= metadata.width) {
        const webpName = `${basename}-${width}w.webp`;
        const avifName = `${basename}-${width}w.avif`;
        const webpPath = path.join(OUTPUT_DIR, webpName);
        const avifPath = path.join(OUTPUT_DIR, avifName);

        // WebP
        await image
          .clone()
          .resize(width, null, { withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY, effort: 6 })
          .toFile(webpPath);
        
        results.webp[width] = webpName;

        // AVIF (better compression)
        await image
          .clone()
          .resize(width, null, { withoutEnlargement: true })
          .avif({ quality: AVIF_QUALITY, effort: 9 })
          .toFile(avifPath);
        
        results.avif[width] = avifName;
        
        console.log(`  ✓ ${width}w: ${webpName}, ${avifName}`);
      }
    }

    // Also create optimized original size
    const origWebpName = `${basename}.webp`;
    const origAvifName = `${basename}.avif`;
    
    await image
      .clone()
      .webp({ quality: ORIGINAL_QUALITY, effort: 6 })
      .toFile(path.join(OUTPUT_DIR, origWebpName));
    
    await image
      .clone()
      .avif({ quality: AVIF_QUALITY, effort: 9 })
      .toFile(path.join(OUTPUT_DIR, origAvifName));
    
    results.webp.original = origWebpName;
    results.avif.original = origAvifName;

    // Generate responsive sizes info for srcset
    results.responsive = SIZES.filter(w => w <= metadata.width).map(w => `${w}w`);

    console.log(`  ✅ Concluído: ${filename}`);
    return results;

  } catch (error) {
    console.error(`  ❌ Erro ao processar ${filename}:`, error.message);
    return null;
  }
}

async function generatePictureElements(optimizationResults) {
  // Generate a JSON map for use in the application
  const map = {};
  
  for (const result of optimizationResults) {
    if (!result) continue;
    
    const basename = path.parse(result.original).name;
    map[basename] = {
      original: result.original,
      webp: result.webp,
      avif: result.avif,
      responsive: result.responsive
    };
  }
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'image-map.json'),
    JSON.stringify(map, null, 2)
  );
  
  console.log('\n📄 Mapa de imagens salvo em images/optimized/image-map.json');
}

async function main() {
  console.log('🚀 Iniciando otimização de imagens...\n');
  
  await ensureDir(OUTPUT_DIR);
  
  const files = fs.readdirSync(IMAGES_DIR)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  
  console.log(`📁 Encontradas ${files.length} imagens para otimizar\n`);
  
  const results = [];
  
  for (const file of files) {
    const inputPath = path.join(IMAGES_DIR, file);
    const result = await optimizeImage(inputPath, file);
    if (result) results.push(result);
  }
  
  await generatePictureElements(results);
  
  console.log('\n✨ Otimização concluída!');
  console.log(`📂 Imagens otimizadas salvas em: ${OUTPUT_DIR}`);
}

main().catch(console.error);