/**
 * Monta as imagens-fonte dos produtos em images-src/products/ a partir das fotos
 * oficiais do delivery da loja (images-src/delivery-hd/, baixadas do pedir.delivery).
 *
 * - Fotos dos produtos: cópia em PNG 600x600 com leve realce de nitidez/cor
 * - Recortes sem fundo (cut_*.png): usados no hero e nas animações
 * - Lanches doces e Combo Família: ilustrações vetoriais (scripts/illustrations.js)
 * - Combo Duplos: montagem com 2 Dog Duplo + batata
 *
 * Depois rode `npm run optimize-images` para gerar AVIF/WebP responsivos.
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { sweetHotdogSVG, comboFamiliaSVG } from './illustrations.js';
import { fileURLToPath } from 'url';

// Caminhos relativos à pasta site/
process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const SRC = 'images-src/delivery-hd';
const OUT = 'images-src/products';
const SIZE = 600;

// id do produto no site → arquivo do delivery
const PHOTOS = {
  dog: 'dog', dog_duplo: 'dog_duplo', dogzao: 'dogzao', dogzao_duplo: 'dogzao_duplo',
  dog_lino: 'dog_lino', dog_linozao: 'dog_linozao', chicken: 'chicken', chickao: 'chickao',
  cheese: 'cheese', egg: 'egg', eggzao: 'eggzao',
  combo_chicken: 'combo_chicken', combo_dogzao: 'combo_dogzao', combo_kids: 'combo_kids',
  familia_foto: 'combo_familia', // foto oficial, usada na seção "Sobre"
  refri_lata: 'refri_lata', refri_600: 'refri_600', refri_2l: 'refri_2l', suco_polpa: 'suco',
  chopp_pilsen: 'chopp', agua: 'agua', batata: 'batata',
};

const CUTOUTS = ['dog', 'dogzao', 'dogzao_duplo', 'chicken', 'dog_duplo'];

const src = (name) => path.join(SRC, `${name}.webp`);

/**
 * Remove o fundo claro/frio de estúdio por preenchimento a partir das bordas.
 * Funciona porque o pão (tons quentes) contrasta com o fundo branco/azulado.
 */
async function cutout(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const bgLike = (i) => {
    const r = data[i * C], g = data[i * C + 1], b = data[i * C + 2];
    return Math.min(r, g, b) > 140 && b - r > -6 && Math.max(r, g, b) - Math.min(r, g, b) < 70;
  };

  const bg = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let head = 0, tail = 0;
  const seed = (i) => { if (!bg[i] && bgLike(i)) { bg[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (head < tail) {
    const i = queue[head++], x = i % W, y = (i / W) | 0;
    if (x > 0) seed(i - 1);
    if (x < W - 1) seed(i + 1);
    if (y > 0) seed(i - W);
    if (y < H - 1) seed(i + W);
  }

  // Encolhe a máscara 2px para eliminar a franja clara do fundo
  let mask = bg;
  for (let pass = 0; pass < 2; pass++) {
    const next = mask.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!mask[i] && (mask[i - 1] || mask[i + 1] || mask[i - W] || mask[i + W])) next[i] = 1;
    }
    mask = next;
  }

  const alpha = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) alpha[i] = mask[i] ? 0 : 255;
  const soft = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } })
    .blur(0.7).extractChannel(0).raw().toBuffer();

  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    rgba[i * 4] = data[i * C];
    rgba[i * 4 + 1] = data[i * C + 1];
    rgba[i * 4 + 2] = data[i * C + 2];
    rgba[i * 4 + 3] = soft[i];
  }
  return sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 0 }).png().toBuffer();
}

async function renderSVG(svg, id) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `${id}.png`));
}

async function comboDuplos() {
  const dd = await sharp(await cutout(src('dog_duplo'))).resize({ width: 330 }).toBuffer();
  const { height: ddH } = await sharp(dd).metadata();
  // batata com bordas esfumadas para fundir no fundo branco
  const fade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="470" height="470">
    <defs><radialGradient id="m"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="470" height="470" fill="url(#m)"/></svg>`);
  const fries = await sharp(src('batata')).resize(470, 470).ensureAlpha()
    .composite([{ input: fade, blend: 'dest-in' }]).png().toBuffer();

  await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: '#ffffff' } })
    .composite([
      { input: fries, left: 65, top: 30 },
      { input: await sharp(dd).rotate(-6, { background: '#0000' }).toBuffer(), left: -5, top: SIZE - ddH - 50 },
      { input: await sharp(dd).rotate(6, { background: '#0000' }).toBuffer(), left: 265, top: SIZE - ddH - 50 },
    ])
    .png()
    .toFile(path.join(OUT, 'combo_duplos.png'));
}

fs.mkdirSync(OUT, { recursive: true });

for (const [id, file] of Object.entries(PHOTOS)) {
  await sharp(src(file)).resize(SIZE, SIZE).modulate({ saturation: 1.08 }).sharpen({ sigma: 0.6 })
    .png().toFile(path.join(OUT, `${id}.png`));
}

for (const id of CUTOUTS) {
  fs.writeFileSync(path.join(OUT, `cut_${id}.png`), await cutout(src(id)));
}

await renderSVG(sweetHotdogSVG('sonho'), 'doce_sonho');
await renderSVG(sweetHotdogSVG('ouro'), 'doce_ouro');
await renderSVG(sweetHotdogSVG('kitkat'), 'doce_kitkat');
await renderSVG(comboFamiliaSVG(), 'combo_familia');
await comboDuplos();

console.log(`✓ Imagens-fonte geradas em ${OUT}`);
