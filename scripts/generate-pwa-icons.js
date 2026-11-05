/**
 * Gera os ícones do PWA (public/images/icon-*.png) referenciados no manifest.json.
 * Usa o logo oficial da loja.
 */
import sharp from 'sharp';
import fs from 'fs';

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT_DIR = 'public/images';

const LOGO = 'images-src/delivery-hd/_logo.webp';

// Logo oficial (globo laranja) centralizado na área segura de 80% dos ícones maskable
async function icon(size) {
  const logo = await sharp(LOGO).resize(Math.round(size * 0.8)).toBuffer();
  const offset = Math.round(size * 0.1);
  return sharp({ create: { width: size, height: size, channels: 3, background: '#000000' } })
    .composite([{ input: logo, left: offset, top: offset }])
    .png();
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  await (await icon(size)).toFile(`${OUT_DIR}/icon-${size}.png`);
}
console.log(`✓ ${SIZES.length} ícones gerados em ${OUT_DIR}`);
