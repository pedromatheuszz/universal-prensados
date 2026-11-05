/**
 * Monta as imagens-fonte dos produtos em images-src/products/ a partir das fotos
 * oficiais do delivery da loja (images-src/delivery-hd/, baixadas do pedir.delivery).
 *
 * - Fotos dos produtos: cópia em PNG 600x600 com leve realce de nitidez/cor
 * - Recortes sem fundo (cut_*.png): usados no hero e nas animações
 * - Lanches doces: arte recriada com o pão real + recheio de chocolate desenhado
 * - Combo Duplos: montagem com 2 Dog Duplo + batata
 *
 * Depois rode `npm run optimize-images` para gerar AVIF/WebP responsivos.
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC = 'images-src/delivery-hd';
const OUT = 'images-src/products';
const SIZE = 600;

// id do produto no site → arquivo do delivery
const PHOTOS = {
  dog: 'dog', dog_duplo: 'dog_duplo', dogzao: 'dogzao', dogzao_duplo: 'dogzao_duplo',
  dog_lino: 'dog_lino', dog_linozao: 'dog_linozao', chicken: 'chicken', chickao: 'chickao',
  cheese: 'cheese', egg: 'egg', eggzao: 'eggzao',
  combo_chicken: 'combo_chicken', combo_dogzao: 'combo_dogzao', combo_kids: 'combo_kids', combo_familia: 'combo_familia',
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

// Ilustração vetorial do prensado doce (pão prensado com marcas da chapa + recheio de chocolate)
function sweetIllustration({ title, bgInner, accent, cream, choco, chocoLight, wrapper }) {
  const bits = [[150, 318, -18], [215, 330, 12], [282, 322, -8], [350, 334, 20], [420, 320, -14], [470, 332, 8]]
    .map(([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${r})">
      <rect x="-20" y="-15" width="40" height="30" rx="8" fill="${choco}"/>
      <rect x="-14" y="-10" width="16" height="8" rx="3" fill="${chocoLight}" opacity=".8"/></g>`).join('');
  const floating = [[96, 130, -25, 1], [500, 110, 30, 0.9], [520, 250, -15, 0.75], [70, 250, 20, 0.8]]
    .map(([x, y, r, sc]) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${sc})">
      <path d="M-40 -14 L-16 -6 L16 -6 L40 -14 L40 14 L16 6 L-16 6 L-40 14 Z" fill="${wrapper}"/>
      <rect x="-17" y="-12" width="34" height="24" rx="9" fill="${choco}"/>
      <rect x="-11" y="-7" width="12" height="6" rx="3" fill="${chocoLight}" opacity=".8"/></g>`).join('');
  const sparkles = [[200, 90], [400, 70], [550, 400], [50, 400], [300, 150]]
    .map(([x, y]) => `<path transform="translate(${x} ${y})" d="M0 -10 L3 -3 L10 0 L3 3 L0 10 L-3 3 L-10 0 L-3 -3 Z" fill="#fff" opacity=".7"/>`).join('');

  return Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 600 600">
    <defs>
      <radialGradient id="bg" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${bgInner}"/><stop offset="1" stop-color="#060e2a"/></radialGradient>
      <linearGradient id="dome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2b65a"/><stop offset=".6" stop-color="#d98b2e"/><stop offset="1" stop-color="#b96a1c"/></linearGradient>
      <linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7e3bd"/><stop offset="1" stop-color="#e0b77a"/></linearGradient>
      <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#000" flood-opacity=".45"/></filter>
    </defs>
    <rect width="600" height="600" fill="url(#bg)"/>
    ${sparkles}
    ${floating}
    <g filter="url(#shadow)">
      <path d="M92 336 Q92 412 160 414 L440 414 Q508 412 508 336 Z" fill="url(#base)"/>
      <path d="M86 318 Q300 292 514 318 L520 352 Q300 380 80 352 Z" fill="${cream}"/>
      <path d="M84 324 Q140 362 200 330 Q262 366 322 332 Q384 368 444 330 Q492 356 516 322" fill="none" stroke="${choco}" stroke-width="14" stroke-linecap="round"/>
      <path d="M128 350 q10 26 0 44 M244 356 q10 22 0 38 M392 358 q10 24 0 40 M480 346 q10 20 0 34" stroke="${choco}" stroke-width="11" stroke-linecap="round" fill="none"/>
      ${bits}
      <path d="M84 318 Q84 214 300 206 Q516 214 516 318 Q300 300 84 318 Z" fill="url(#dome)"/>
      <path d="M140 262 Q300 222 460 262" stroke="#8c4a12" stroke-width="9" stroke-linecap="round" fill="none" opacity=".45"/>
      <path d="M118 292 Q300 258 482 292" stroke="#8c4a12" stroke-width="9" stroke-linecap="round" fill="none" opacity=".4"/>
      <path d="M150 236 Q300 212 450 236 Q300 226 150 248 Z" fill="url(#sheen)"/>
    </g>
    <text x="300" y="500" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-weight="900" font-size="50" fill="#fff" letter-spacing="1">${title}</text>
    <rect x="240" y="520" width="120" height="7" rx="3.5" fill="${accent}"/>
    <text x="300" y="562" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-weight="700" font-size="20" fill="#fff" opacity=".8" letter-spacing="3">PRENSADO DOCE</text>
  </svg>`);
}

async function sweetArt(id, opts) {
  await sharp(sweetIllustration(opts)).png().toFile(path.join(OUT, `${id}.png`));
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

await sweetArt('doce_sonho', { title: 'SONHO DE VALSA', bgInner: '#5b2a86', accent: '#e8b4ff', cream: '#f6e7d4', choco: '#5a2e14', chocoLight: '#c98a4b', wrapper: '#c0399b' });
await sweetArt('doce_ouro', { title: 'OURO BRANCO', bgInner: '#7a5a12', accent: '#ffd76a', cream: '#fbf3e2', choco: '#f1e4c4', chocoLight: '#b98a3a', wrapper: '#e2b33c' });
await sweetArt('doce_kitkat', { title: 'KIT KAT', bgInner: '#9b1010', accent: '#ff5a5a', cream: '#f6e7d4', choco: '#6b3518', chocoLight: '#d49a5c', wrapper: '#d61f26' });
await comboDuplos();

console.log(`✓ Imagens-fonte geradas em ${OUT}`);
