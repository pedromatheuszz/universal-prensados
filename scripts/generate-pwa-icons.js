/**
 * Gera os ícones do PWA (public/images/icon-*.png) referenciados no manifest.json.
 * Ícone simples com as iniciais sobre a cor da marca; o texto fica dentro da
 * "zona segura" de 80% exigida para ícones maskable.
 */
import sharp from 'sharp';
import fs from 'fs';

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT_DIR = 'public/images';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#d4380d"/>
  <text x="256" y="300" text-anchor="middle" font-family="Poppins, Arial, sans-serif"
        font-size="200" font-weight="900" fill="#fdfbf7">UP</text>
</svg>`;

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`${OUT_DIR}/icon-${size}.png`);
}
console.log(`✓ ${SIZES.length} ícones gerados em ${OUT_DIR}`);
