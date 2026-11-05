/**
 * Ilustrações vetoriais (SVG 600x600) dos produtos sem foto oficial.
 * Hot dogs desenhados no estilo da casa: pão macio, recheio generoso e
 * marcas da prensa. Renderizadas em PNG por scripts/build-product-art.js.
 */

// Pseudo-aleatório com semente: a arte sai sempre igual (hash estável do arquivo)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const DEFS = `
  <defs>
    <linearGradient id="bunTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6c06a"/><stop offset=".55" stop-color="#e09a3e"/><stop offset="1" stop-color="#c47a26"/>
    </linearGradient>
    <linearGradient id="bunFront" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f3c47a"/><stop offset=".35" stop-color="#e6a54d"/><stop offset="1" stop-color="#b8701f"/>
    </linearGradient>
    <linearGradient id="crumb" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbe9c4"/><stop offset="1" stop-color="#efcf93"/>
    </linearGradient>
    <linearGradient id="sausage" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d4643a"/><stop offset=".5" stop-color="#b44a25"/><stop offset="1" stop-color="#7f2b14"/>
    </linearGradient>
    <linearGradient id="choc" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7a4022"/><stop offset="1" stop-color="#3f1d0c"/>
    </linearGradient>
    <linearGradient id="whiteChoc" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff8ea"/><stop offset="1" stop-color="#e9d6b2"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff0a8"/><stop offset=".5" stop-color="#e2b33c"/><stop offset="1" stop-color="#a87a12"/>
    </linearGradient>
    <linearGradient id="cola" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#1a0904"/><stop offset=".45" stop-color="#4a1d0c"/><stop offset="1" stop-color="#140703"/>
    </linearGradient>
    <linearGradient id="fry" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffd76a"/><stop offset="1" stop-color="#eaa933"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
  </defs>`;

function background(inner, outer = '#060e2a') {
  return `
    <radialGradient id="bg" cx="50%" cy="45%" r="72%">
      <stop offset="0" stop-color="${inner}"/><stop offset="1" stop-color="${outer}"/>
    </radialGradient>
    <rect width="600" height="600" fill="url(#bg)"/>`;
}

function sparkles(points, color = '#fff') {
  return points.map(([x, y, s = 1]) =>
    `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -11 L3 -3 L11 0 L3 3 L0 11 L-3 3 L-11 0 L-3 -3 Z" fill="${color}" opacity=".75"/>`
  ).join('');
}

// ---------- Coberturas ----------

function zigzag(color, width, y, amp, from = -195, to = 195, step = 26) {
  let d = `M${from} ${y}`;
  for (let x = from + step / 2, up = true; x <= to; x += step / 2, up = !up) d += ` L${x} ${y + (up ? -amp : amp)}`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function batataPalha(rand, count = 70) {
  return Array.from({ length: count }, () => {
    const x = -190 + rand() * 380, y = -62 + rand() * 22, len = 14 + rand() * 18, a = rand() * Math.PI;
    const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 4;
    return `<line x1="${(x - dx).toFixed(1)}" y1="${(y - dy).toFixed(1)}" x2="${(x + dx).toFixed(1)}" y2="${(y + dy).toFixed(1)}" stroke="${rand() > 0.5 ? '#f7c255' : '#e9a63a'}" stroke-width="3.2" stroke-linecap="round"/>`;
  }).join('');
}

function milho(rand, count = 16) {
  return Array.from({ length: count }, () =>
    `<ellipse cx="${(-180 + rand() * 360).toFixed(1)}" cy="${(-50 + rand() * 18).toFixed(1)}" rx="6" ry="7.5" fill="#facc15" stroke="#e0a800" stroke-width="1"/>`
  ).join('');
}

function bacon(rand, count = 9) {
  return Array.from({ length: count }, (_, i) => {
    const x = -175 + i * 44 + rand() * 10, y = -60 + rand() * 10, r = -25 + rand() * 50;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${r.toFixed(1)})">
      <path d="M-16 -5 Q-8 -11 0 -5 T16 -5 L16 5 Q8 11 0 5 T-16 5 Z" fill="#8f2a17"/>
      <path d="M-13 0 Q-6 -5 0 0 T13 0" stroke="#f0b49a" stroke-width="2.5" fill="none"/></g>`;
  }).join('');
}

function calabresa(rand, count = 7) {
  return Array.from({ length: count }, (_, i) => {
    const x = -160 + i * 54 + rand() * 8, y = -48 + rand() * 6;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <ellipse rx="15" ry="11" fill="#b8322a"/><ellipse rx="11" ry="8" fill="#d9574a"/>
      <circle cx="-4" cy="-2" r="1.8" fill="#f7d3c8"/><circle cx="4" cy="2" r="1.6" fill="#f7d3c8"/><circle cx="3" cy="-3" r="1.4" fill="#f7d3c8"/></g>`;
  }).join('');
}

// ---------- Recheios ----------

function savoryFilling({ seed = 1, double = false, bacon: withBacon = false }) {
  const rand = rng(seed);
  const sausage = (y) => `
    <rect x="-208" y="${y}" width="416" height="38" rx="19" fill="url(#sausage)"/>
    <rect x="-190" y="${y + 7}" width="360" height="7" rx="3.5" fill="#f19b72" opacity=".55"/>`;
  return `
    ${double ? sausage(-40) : ''}
    ${sausage(double ? -54 : -46)}
    ${zigzag('#fff4d6', 9, -50, 7)}
    ${zigzag('#d62828', 7, -56, 6, -185, 190, 34)}
    ${milho(rand)}
    ${withBacon ? calabresa(rand) + bacon(rand) : ''}
    ${batataPalha(rand)}`;
}

function sweetCream(color = '#fbf1e1') {
  return `<path d="M-212 -14 Q-196 -78 -130 -74 Q-80 -100 -14 -80 Q50 -104 112 -80 Q176 -98 212 -18 Q0 6 -212 -14 Z" fill="${color}"/>
    <path d="M-170 -70 Q-120 -86 -60 -80" stroke="#fff" stroke-opacity=".7" stroke-width="6" fill="none" stroke-linecap="round"/>`;
}

// Escorridos de calda sobre a borda do pão da frente
function drips(color, xs) {
  return xs.map(([x, len]) => `<path d="M${x - 9} -6 Q${x - 9} ${len} ${x} ${len + 8} Q${x + 9} ${len} ${x + 9} -6 Z" fill="${color}"/>`).join('') +
    `<path d="M-205 -6 Q0 22 205 -6 L205 4 Q0 30 -205 4 Z" fill="${color}"/>`;
}

function bonbon(x, y, { coat, nut, wrapper, r = 27 }) {
  const k = r / 22;
  return `<g transform="translate(${x} ${y}) scale(${k.toFixed(3)})">
    ${wrapper ? `<path d="M-40 -14 L-18 -4 L-18 4 L-40 14 Z M40 -14 L18 -4 L18 4 L40 14 Z" fill="${wrapper}"/>` : ''}
    <circle r="22" fill="${coat}"/>
    <path d="M-20 4 Q0 14 20 4" stroke="#000" stroke-opacity=".18" stroke-width="3" fill="none"/>
    <ellipse cx="-7" cy="-9" rx="9" ry="5" fill="#fff" opacity=".4"/>
    ${nut ? `<path d="M-7 -3 q7 -11 14 0 q-7 7 -14 0 Z" fill="${nut}"/>` : ''}
  </g>`;
}

function kitkatBar(x, y, rot, scale = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">
    <rect x="-46" y="-14" width="92" height="28" rx="7" fill="url(#choc)"/>
    <line x1="0" y1="-14" x2="0" y2="14" stroke="#2c1206" stroke-width="3.5"/>
    <rect x="-41" y="-10" width="36" height="6" rx="3" fill="#a5643a" opacity=".85"/>
    <rect x="5" y="-10" width="36" height="6" rx="3" fill="#a5643a" opacity=".85"/>
  </g>`;
}

const SONHO = { coat: 'url(#choc)', nut: '#e6b980' };
const OURO = { coat: 'url(#whiteChoc)', nut: '#c9934a' };

const SWEETS = {
  sonho: {
    bg: '#5b2a86',
    filling: () => `
      ${sweetCream()}
      ${zigzag('#4a2210', 9, -66, 9)}
      ${[-155, -78, 0, 78, 155].map((x, i) => bonbon(x, -88 - (i % 2) * 10, { ...SONHO, wrapper: i % 2 ? null : '#c0399b' })).join('')}
      ${zigzag('#5a2b12', 5, -96, 7, -175, 180, 30)}`,
    topping: () => drips('#4a2210', [[-150, 30], [-70, 44], [20, 34], [110, 48], [175, 26]]),
    floating: () => [[90, 140, '#c0399b'], [510, 120, '#8e44ad'], [520, 485, '#c0399b'], [80, 475, '#8e44ad']]
      .map(([x, y, w]) => bonbon(x, y, { ...SONHO, wrapper: w, r: 22 })).join(''),
  },
  ouro: {
    bg: '#7a5a12',
    filling: () => `
      ${sweetCream('#fffaf0')}
      ${zigzag('#f3e3c0', 10, -64, 9)}
      ${[-155, -78, 0, 78, 155].map((x, i) => bonbon(x, -88 - (i % 2) * 10, { ...OURO, wrapper: i % 2 ? null : 'url(#gold)' })).join('')}
      ${zigzag('#7a4022', 5, -96, 7, -175, 180, 30)}`,
    topping: () => drips('#f6ead2', [[-150, 30], [-70, 44], [20, 34], [110, 48], [175, 26]]),
    floating: () => [[90, 140], [510, 120], [520, 485], [80, 475]]
      .map(([x, y]) => bonbon(x, y, { ...OURO, wrapper: 'url(#gold)', r: 22 })).join(''),
  },
  kitkat: {
    bg: '#9b1010',
    filling: () => `
      ${sweetCream()}
      ${zigzag('#4a2210', 9, -66, 9)}
      ${kitkatBar(-150, -100, -62)}${kitkatBar(-80, -96, 70)}${kitkatBar(-10, -104, -58)}${kitkatBar(64, -98, 64)}${kitkatBar(140, -100, -66)}
      ${zigzag('#fff4e2', 4, -84, 6, -175, 180, 30)}`,
    topping: () => drips('#4a2210', [[-150, 30], [-70, 44], [20, 34], [110, 48], [175, 26]]),
    floating: () => `
      <g transform="translate(95 140) rotate(-24)"><rect x="-46" y="-28" width="92" height="56" rx="8" fill="#d61f26"/><rect x="-46" y="-28" width="92" height="16" rx="7" fill="#ff4b52"/>${kitkatBar(0, 34, 0, 0.9)}</g>
      ${kitkatBar(505, 125, 25)}${kitkatBar(520, 475, -20)}${kitkatBar(85, 480, 18)}`,
  },
};

// ---------- Hot dog ----------

function hotdog(filling, { x = 300, y = 330, scale = 1, rot = 0, topping = '', backH = 76 } = {}) {
  return `
  <g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">
    <ellipse cx="0" cy="96" rx="215" ry="20" fill="#000" opacity=".45" filter="url(#soft)"/>
    <path d="M-212 -12 C-216 -${backH} -150 -${backH + 16} 0 -${backH + 16} C150 -${backH + 16} 216 -${backH} 212 -12 Z" fill="url(#bunTop)"/>
    <path d="M-150 -${backH + 8} C-60 -${backH + 20} 60 -${backH + 20} 150 -${backH + 8} C60 -${backH + 12} -60 -${backH + 12} -150 -${backH + 8} Z" fill="url(#sheen)"/>
    <path d="M-198 -16 C-198 -54 -140 -64 0 -64 C140 -64 198 -54 198 -16 Z" fill="url(#crumb)"/>
    ${filling}
    <path d="M-224 -8 C-228 56 -172 82 0 82 C172 82 228 56 224 -8 C150 16 -150 16 -224 -8 Z" fill="url(#bunFront)"/>
    <path d="M-200 6 C-120 24 120 24 200 6" stroke="#fff" stroke-opacity=".35" stroke-width="6" fill="none" stroke-linecap="round"/>
    <g stroke="#8c4a12" stroke-opacity=".35" stroke-width="7" stroke-linecap="round">
      <path d="M-150 30 L-120 64"/><path d="M-70 34 L-40 70"/><path d="M10 34 L40 70"/><path d="M90 32 L120 66"/><path d="M160 26 L184 54"/>
    </g>
    ${topping}
  </g>`;
}

function wrap(body, bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">${DEFS}${background(bg)}${body}</svg>`;
}

export function sweetHotdogSVG(flavor) {
  const f = SWEETS[flavor];
  return wrap(`
    ${sparkles([[200, 90], [400, 70, 0.8], [560, 320, 0.9], [40, 330, 0.8], [300, 520, 0.7], [180, 540, 0.6]])}
    ${f.floating()}
    ${hotdog(f.filling(), { y: 350, scale: 1.18, rot: -4, topping: f.topping(), backH: 108 })}`, f.bg);
}

// ---------- Combo Família: 2 Dogs Duplos + 2 Dogzões + batata 600g + refri 2L ----------

function friesBox(x, y, scale = 1) {
  const fries = [[-62, -70, -14], [-38, -92, -6], [-14, -100, 3], [10, -96, -3], [34, -90, 8], [58, -74, 15], [-50, -56, 8], [44, -58, -10], [0, -78, 0]]
    .map(([fx, fy, r]) => `<rect x="${fx - 9}" y="${fy}" width="18" height="96" rx="5" transform="rotate(${r} ${fx} ${fy + 48})" fill="url(#fry)" stroke="#d48f1f" stroke-width="1.5"/>`).join('');
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="0" cy="96" rx="100" ry="14" fill="#000" opacity=".4" filter="url(#soft)"/>
    ${fries}
    <path d="M-86 -14 L86 -14 L70 96 L-70 96 Z" fill="#d62828"/>
    <path d="M-86 -14 Q0 22 86 -14 L82 6 Q0 40 -82 6 Z" fill="#b51d1d"/>
    <circle cx="0" cy="50" r="24" fill="#f26a1b" stroke="#fff" stroke-width="3"/>
    <path d="M-24 50 H24 M0 26 Q-14 50 0 74 M0 26 Q14 50 0 74" stroke="#fff" stroke-width="2.5" fill="none"/>
  </g>`;
}

function sodaBottle(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="0" cy="150" rx="62" ry="10" fill="#000" opacity=".45" filter="url(#soft)"/>
    <rect x="-16" y="-170" width="32" height="20" rx="4" fill="#d62828"/>
    <path d="M-14 -150 L14 -150 L16 -120 Q52 -86 52 -40 L52 120 Q52 150 22 150 L-22 150 Q-52 150 -52 120 L-52 -40 Q-52 -86 -16 -120 Z" fill="url(#cola)"/>
    <path d="M-52 -10 L52 -10 L52 50 L-52 50 Z" fill="#d62828"/>
    <path d="M-48 28 Q-10 -6 26 18 T50 8" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M-38 -70 Q-40 40 -36 130" stroke="#fff" stroke-opacity=".35" stroke-width="8" stroke-linecap="round" fill="none"/>
    <text x="0" y="96" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-weight="900" font-size="26" fill="#fff" opacity=".9">2L</text>
  </g>`;
}

export function comboFamiliaSVG() {
  return wrap(`
    ${sparkles([[80, 80], [520, 70, 0.8], [300, 40, 0.7]])}
    ${sodaBottle(470, 215, 1)}
    ${friesBox(160, 190, 1.05)}
    ${hotdog(savoryFilling({ seed: 3, double: true }), { x: 190, y: 360, scale: 0.6, rot: -6 })}
    ${hotdog(savoryFilling({ seed: 5, double: true }), { x: 420, y: 370, scale: 0.6, rot: 5 })}
    ${hotdog(savoryFilling({ seed: 7, bacon: true }), { x: 170, y: 480, scale: 0.66, rot: 4 })}
    ${hotdog(savoryFilling({ seed: 9, bacon: true }), { x: 430, y: 490, scale: 0.66, rot: -5 })}`, '#f26a1b');
}
