/* =========================================================
   UNIVERSAL PRENSADOS — INTERACTIVE CLIENT LOGIC
   - Three.js 3D Hero Scene with Ambient Particles & Lights
   - 3D Physics Tilt Effect on Cards
   - Complete Light / Dark Theme Engine with LocalStorage
   - Full Interactive Delivery System (Cart Drawer, Customizer,
     Joinville Neighborhoods Delivery Fees, Pix & WhatsApp Order)
   ========================================================= */

import * as THREE from "three";
import { initAnalytics, trackAddToCart, trackBeginCheckout, trackPurchase, trackApplyCoupon, trackViewItem, trackSearch } from "./analytics.js";

// Initialize Analytics
initAnalytics();

// --- 1. PRODUCT DATABASE ---
const PRODUCTS = [
  // SALGADOS
  {
    id: 'dog',
    name: '1. Dog Tradicional',
    category: 'salgados',
    price: 11.50,
    desc: 'Pão prensado crocante, milho, batata palha, catchup, maionese e salsicha.',
    image: 'images/dog.jpg',
    badge: 'Clássico',
    hasExtras: true
  },
  {
    id: 'dog_duplo',
    name: '2. Dog Duplo',
    category: 'salgados',
    price: 12.50,
    desc: 'Pão prensado na chapa bem crocante, milho, batata palha, catchup, maionese e duas salsichas.',
    image: 'images/dog.jpg',
    badge: 'Duplo',
    hasExtras: true
  },
  {
    id: 'dogzao',
    name: '3. Dogzão Especial',
    category: 'salgados',
    price: 17.00,
    desc: 'Pão prensado, milho, batata palha, salsicha, fatias crocantes de bacon, calabresa fatiada, catchup e maionese.',
    image: 'images/dogzao.jpg',
    badge: '🔥 Mais Pedido',
    hasExtras: true
  },
  {
    id: 'dogzao_duplo',
    name: '4. Dogzão Duplo',
    category: 'salgados',
    price: 18.00,
    desc: 'Super reforçado! Pão prensado, milho, batata palha, 2 salsichas, muito bacon, calabresa, catchup e maionese.',
    image: 'images/dogzao.jpg',
    badge: 'Gigante',
    hasExtras: true
  },
  {
    id: 'dog_lino',
    name: '5. Dog Lino (Frango)',
    category: 'salgados',
    price: 13.50,
    desc: 'Pão prensado macio e crocante, milho, batata palha, catchup, maionese e salsicha de frango selecionada.',
    image: 'images/dog.jpg',
    badge: 'Frango',
    hasExtras: true
  },
  {
    id: 'dog_linozao',
    name: '6. Dog Linozão Especial',
    category: 'salgados',
    price: 19.00,
    desc: 'Pão prensado, milho, batata palha, catchup, maionese, salsicha de frango, bacon crocante e calabresa.',
    image: 'images/dogzao.jpg',
    badge: 'Imperdível',
    hasExtras: true
  },
  {
    id: 'cheese',
    name: 'Cheese Prensado',
    category: 'salgados',
    price: 15.00,
    desc: 'Pão prensado, milho, batata palha, catchup, maionese, salsicha e camada dupla de queijo mussarela derretido.',
    image: 'images/dogzao.jpg',
    badge: '🧀 Muito Queijo',
    hasExtras: true
  },

  // ESPECIAIS
  {
    id: 'chicken',
    name: '7. Chicken Especial',
    category: 'especiais',
    price: 17.00,
    desc: 'Pão prensado na hora, milho, batata palha, salsicha, frango desfiado artesanal suculento e maionese da casa.',
    image: 'images/chicken.jpg',
    badge: '⭐ Favorito',
    hasExtras: true
  },
  {
    id: 'chickao',
    name: '8. Chickão Completo',
    category: 'especiais',
    price: 20.50,
    desc: 'O campeão da chapa! Pão prensado, milho, batata palha, salsicha, frango desfiado, bacon em fatias e calabresa.',
    image: 'images/chickao.jpg',
    badge: '🔥 Campeão',
    hasExtras: true
  },

  // COMBOS
  {
    id: 'combo_chicken',
    name: 'Combo Chicken Completo',
    category: 'combos',
    price: 30.50,
    desc: '1 Chicken Grande + Porção de batata frita de 150g + 1 Refrigerante lata 350ml gelado.',
    image: 'images/combo_chicken.jpg',
    badge: '📦 Combo Individual',
    hasExtras: true
  },
  {
    id: 'combo_dogzao',
    name: 'Combo Dogzão Completo',
    category: 'combos',
    price: 30.50,
    desc: '1 Dogzão Grande bem recheado + Batata frita crocante de 150g + 1 Refrigerante lata geladinho.',
    image: 'images/combo_dogzao.jpg',
    badge: '🔥 Top Vendas',
    hasExtras: true
  },
  {
    id: 'combo_kids',
    name: 'Combo Kids',
    category: 'combos',
    price: 20.50,
    desc: '1 Dog pequeno + Batata frita de 100g + Suco ou refrigerante lata.',
    image: 'images/combo_kids.jpg',
    badge: '👶 Para os Pequenos',
    hasExtras: true
  },
  {
    id: 'combo_familia',
    name: 'Combo Família Universal',
    category: 'combos',
    price: 109.90,
    desc: '2 Dogs Duplos Grandes + 2 Dogzões Grandes + Batata frita 600g + 1 Coca-Cola 2L.',
    image: 'images/combo_familia.jpg',
    badge: '👨‍👩‍👧‍👦 Para Toda Família',
    hasExtras: true
  },

  // DOCES
  {
    id: 'doce_sonho',
    name: 'Prensado Sonho de Valsa',
    category: 'doces',
    price: 13.50,
    desc: 'Pão prensado quentinho com toque especial, creme de leite fresco e muito bombom Sonho de Valsa derretido.',
    image: 'images/doce_sonho.jpg',
    badge: 'Sobremesa',
    hasExtras: false
  },
  {
    id: 'doce_ouro',
    name: 'Prensado Ouro Branco',
    category: 'doces',
    price: 13.50,
    desc: 'Pão prensado douradinho com creme de leite suave e bombons Ouro Branco cremosos.',
    image: 'images/doce_ouro.jpg',
    badge: 'Delicioso',
    hasExtras: false
  },
  {
    id: 'doce_kitkat',
    name: 'Prensado Kit Kat Crocante',
    category: 'doces',
    price: 17.00,
    desc: 'Pão prensado crocante com creme de leite fresco e barras de chocolate Kit Kat que derretem na boca.',
    image: 'images/doce_kitkat.jpg',
    badge: '🍫 Premium',
    hasExtras: false
  },

  // BEBIDAS
  {
    id: 'refri_lata',
    name: 'Refrigerante Lata 350ml',
    category: 'bebidas',
    price: 8.00,
    desc: 'Coca-Cola, Guaraná Antarctica, Fanta Laranja ou Sprite. Bem gelado!',
    image: 'images/refri_lata.jpg',
    badge: '',
    hasExtras: false
  },
  {
    id: 'refri_600',
    name: 'Refrigerante 600ml',
    category: 'bebidas',
    price: 10.00,
    desc: 'Garrafa individual de 600ml estupidamente gelada.',
    image: 'images/refri_lata.jpg',
    badge: '',
    hasExtras: false
  },
  {
    id: 'refri_2l',
    name: 'Refrigerante 2 Litros',
    category: 'bebidas',
    price: 20.00,
    desc: 'Ideal para compartilhar em família ou com a galera.',
    image: 'images/refri_2l.jpg',
    badge: '',
    hasExtras: false
  },
  {
    id: 'suco_polpa',
    name: 'Suco Natural de Polpa 500ml',
    category: 'bebidas',
    price: 9.00,
    desc: 'Polpa de fruta natural batida na hora: Maracujá, Laranja, Abacaxi ou Morango.',
    image: 'images/suco.jpg',
    badge: 'Fruta Natural',
    hasExtras: false
  },
  {
    id: 'chopp_pilsen',
    name: 'Chopp Pilsen Artesanal 400ml',
    category: 'bebidas',
    price: 13.00,
    desc: 'Chopp Pilsen artesanal de Joinville, servido com colarinho perfeito e super gelado.',
    image: 'images/chopp.jpg',
    badge: '🍺 Gelado',
    hasExtras: false
  },
  {
    id: 'agua',
    name: 'Água Mineral 500ml',
    category: 'bebidas',
    price: 4.50,
    desc: 'Água mineral natural gelada, com ou sem gás.',
    image: 'images/agua.jpg',
    badge: '',
    hasExtras: false
  }
];
 
// --- 1b. IMAGE OPTIMIZATION HELPER ---
// Maps original image filenames to optimized versions
const IMAGE_MAP = {
  'dog.jpg': 'dog',
  'dogzao.jpg': 'dogzao',
  'chicken.jpg': 'chicken',
  'chickao.jpg': 'chickao',
  'combo_chicken.jpg': 'combo_chicken',
  'combo_dogzao.jpg': 'combo_dogzao',
  'combo_kids.jpg': 'combo_kids',
  'combo_familia.jpg': 'combo_familia',
  'doce_sonho.jpg': 'doce_sonho',
  'doce_ouro.jpg': 'doce_ouro',
  'doce_kitkat.jpg': 'doce_kitkat',
  'refri_lata.jpg': 'refri_lata',
  'refri_2l.jpg': 'refri_2l',
  'suco.jpg': 'suco',
  'chopp.jpg': 'chopp',
  'agua.jpg': 'agua'
};
 
// Generate responsive picture element with WebP/AVIF srcset
function createOptimizedPicture(imagePath, alt, className = '', fetchPriority = '') {
  const baseName = IMAGE_MAP[imagePath] || imagePath.replace('images/', '').replace('.jpg', '').replace('.png', '');
  const optimizedPath = `images/optimized/${baseName}`;
 
  // Check if optimized version exists (fallback to original if not)
  const hasOptimized = IMAGE_MAP[imagePath];
 
  if (!hasOptimized) {
    // Fallback for external images or non-optimized images
    return `<img src="${imagePath}" alt="${alt}" class="${className}" ${fetchPriority ? `fetchpriority="${fetchPriority}"` : ''} loading="lazy">`;
  }
 
  const srcsetAvif = [320, 480, 640, 800, 1024]
    .map(w => `${optimizedPath}-${w}w.avif ${w}w`)
    .join(', ');
  const srcsetWebp = [320, 480, 640, 800, 1024]
    .map(w => `${optimizedPath}-${w}w.webp ${w}w`)
    .join(', ');
 
  return `
    <picture>
      <source type="image/avif" srcset="${srcsetAvif}" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw">
      <source type="image/webp" srcset="${srcsetWebp}" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw">
      <img src="${optimizedPath}.webp" alt="${alt}" class="${className}" ${fetchPriority ? `fetchpriority="${fetchPriority}"` : ''} loading="lazy" width="400" height="300">
    </picture>
  `;
}
 
// Create optimized image tag for modal (single image, no srcset needed)
function createOptimizedImageTag(imagePath, alt, className = '') {
  const baseName = IMAGE_MAP[imagePath] || imagePath.replace('images/', '').replace('.jpg', '').replace('.png', '');
  const optimizedPath = `images/optimized/${baseName}`;
  const hasOptimized = IMAGE_MAP[imagePath];
 
  if (!hasOptimized) {
    return { src: imagePath, srcset: '' };
  }
 
  return {
    src: `${optimizedPath}.webp`,
    srcset: `
      ${optimizedPath}-320w.avif 320w,
      ${optimizedPath}-480w.avif 480w,
      ${optimizedPath}-640w.avif 640w,
      ${optimizedPath}-800w.avif 800w,
      ${optimizedPath}-1024w.avif 1024w
    `,
    srcsetWebp: `
      ${optimizedPath}-320w.webp 320w,
      ${optimizedPath}-480w.webp 480w,
      ${optimizedPath}-640w.webp 640w,
      ${optimizedPath}-800w.webp 800w,
      ${optimizedPath}-1024w.webp 1024w
    `
  };
}
 
// --- 2. GLOBAL STATE ---
let cart = [];
let appliedCoupon = null; // { code: 'BEMVINDO10', discountPercent: 10 }
let currentCustomizingItem = null;
let currentModalQty = 1;

// Format Currency BRL
function formatBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// --- 3. TOAST NOTIFICATION UTILITY ---
function showToast(message, icon = '✓') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// --- 4. LIGHT / DARK THEME ENGINE ---
function initThemeEngine() {
  const toggleBtn = document.getElementById('theme-toggle');
  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (metaColorScheme) metaColorScheme.content = theme;
    localStorage.setItem('color-scheme', theme);
  }

  // Initial load sync
  const saved = localStorage.getItem('color-scheme');
  if (saved) {
    applyTheme(saved);
  } else {
    applyTheme(getTheme());
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = getTheme();
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      showToast(`Modo ${next === 'dark' ? 'Escuro' : 'Claro'} ativado!`, next === 'dark' ? '🌙' : '☀️');
    });
  }

  // Listen to OS system color changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('color-scheme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

// --- 5. THREE.JS 3D HERO CANVAS ANIMATION ---
function initHero3D() {
  const canvas = document.getElementById('hero-3d-canvas');
  if (!canvas) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 25;

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xfff5ea, 1.4);
  mainLight.position.set(12, 18, 15);
  scene.add(mainLight);

  const warmBackLight = new THREE.PointLight(0xe63914, 2.8, 60);
  warmBackLight.position.set(-10, 8, -5);
  scene.add(warmBackLight);

  const goldenFillLight = new THREE.PointLight(0xf59e0b, 2.2, 50);
  goldenFillLight.position.set(8, -8, 10);
  scene.add(goldenFillLight);

  // Helper to build smooth rounded capsule geometries (compatible with all Three.js releases)
  function createCapsule(radius, length, material) {
    const group = new THREE.Group();
    // Cylinder body laying on X axis
    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, 32),
      material
    );
    cylinder.rotation.z = Math.PI / 2;
    group.add(cylinder);

    // Left hemisphere cap
    const leftCap = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 16),
      material
    );
    leftCap.position.x = -length / 2;
    group.add(leftCap);

    // Right hemisphere cap
    const rightCap = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 16),
      material
    );
    rightCap.position.x = length / 2;
    group.add(rightCap);

    return group;
  }

  // ====== 3D HOT DOG / PRENSADO ARTISANAL MODEL ======
  const hotdogGroup = new THREE.Group();

  // 1. Salsicha (Juicy Reddish-Brown Hotdog Sausage)
  const sausageMat = new THREE.MeshStandardMaterial({
    color: 0xb32815,
    roughness: 0.3,
    metalness: 0.08
  });
  const sausage = createCapsule(1.15, 12.8, sausageMat);
  sausage.position.set(0, 0.25, 0);
  hotdogGroup.add(sausage);

  // 2. Pão Artesanal Prensado (Toasted Golden Bread Buns)
  const bunMat = new THREE.MeshStandardMaterial({
    color: 0xdf9438, // Golden toasted bun color
    roughness: 0.7,
    metalness: 0.03
  });

  // Bottom bun (Ligeiramente achatado na chapa)
  const bottomBun = createCapsule(1.65, 11.2, bunMat);
  bottomBun.position.set(0, -0.65, 0);
  bottomBun.scale.set(1.05, 0.72, 1.3);
  hotdogGroup.add(bottomBun);

  // Back bun lip (Apoio de trás do pão)
  const backBun = createCapsule(1.35, 10.6, bunMat);
  backBun.position.set(0, 0.15, -0.95);
  backBun.rotation.x = -0.22;
  backBun.scale.set(1.02, 0.8, 0.85);
  hotdogGroup.add(backBun);

  // Front bun lip (Apoio da frente do pão)
  const frontBun = createCapsule(1.35, 10.6, bunMat);
  frontBun.position.set(0, 0.15, 0.95);
  frontBun.rotation.x = 0.22;
  frontBun.scale.set(1.02, 0.8, 0.85);
  hotdogGroup.add(frontBun);

  // 3. Marcas de Prensa na Chapa (Grill Press Marks)
  const grillMat = new THREE.MeshStandardMaterial({
    color: 0x662908, // Charred grill marks
    roughness: 0.9
  });
  for (let i = -4.5; i <= 4.5; i += 1.5) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 2.9), grillMat);
    mark.position.set(i, -1.18, 0);
    mark.rotation.y = 0.25;
    hotdogGroup.add(mark);
  }

  // 4. Molhos em Zigue-zague (Catchup & Mostarda / Maionese da Casa)
  const wavePointsKetchup = [];
  const wavePointsMustard = [];
  for (let x = -5.2; x <= 5.2; x += 0.4) {
    const waveK = Math.sin(x * 2.3) * 0.45;
    wavePointsKetchup.push(new THREE.Vector3(x, 1.48, waveK + 0.1));

    const waveM = Math.cos(x * 2.3) * 0.4;
    wavePointsMustard.push(new THREE.Vector3(x, 1.44, waveM - 0.1));
  }

  const ketchupCurve = new THREE.CatmullRomCurve3(wavePointsKetchup);
  const mustardCurve = new THREE.CatmullRomCurve3(wavePointsMustard);

  const ketchupMat = new THREE.MeshStandardMaterial({
    color: 0xd9160d, // Brilho de catchup artesanal
    roughness: 0.18,
    metalness: 0.12
  });
  const mustardMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Mostarda dourada especial
    roughness: 0.22,
    metalness: 0.05
  });

  const ketchupMesh = new THREE.Mesh(
    new THREE.TubeGeometry(ketchupCurve, 64, 0.22, 12, false),
    ketchupMat
  );
  const mustardMesh = new THREE.Mesh(
    new THREE.TubeGeometry(mustardCurve, 64, 0.18, 12, false),
    mustardMat
  );
  hotdogGroup.add(ketchupMesh);
  hotdogGroup.add(mustardMesh);

  // 5. Ingredientes do Recheio: Milho Cozido & Batata Palha Crocante & Bacon
  // Grãos de milho verde
  const cornMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
  const cornGeom = new THREE.SphereGeometry(0.18, 12, 12);
  for (let i = 0; i < 30; i++) {
    const corn = new THREE.Mesh(cornGeom, cornMat);
    const x = (Math.random() - 0.5) * 9.2;
    const z = (Math.random() - 0.5) * 1.5;
    corn.position.set(x, 1.42 + Math.random() * 0.15, z);
    corn.scale.set(1.2, 0.8, 1.0);
    hotdogGroup.add(corn);
  }

  // Palitos de batata palha
  const strawMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.65 });
  const strawGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.95, 6);
  for (let i = 0; i < 40; i++) {
    const straw = new THREE.Mesh(strawGeom, strawMat);
    const x = (Math.random() - 0.5) * 9.0;
    const z = (Math.random() - 0.5) * 1.6;
    straw.position.set(x, 1.5 + Math.random() * 0.25, z);
    straw.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    hotdogGroup.add(straw);
  }

  // Cubinhos de Bacon Crocante
  const baconMat = new THREE.MeshStandardMaterial({ color: 0x8b1c11, roughness: 0.45 });
  const baconGeom = new THREE.BoxGeometry(0.32, 0.16, 0.32);
  for (let i = 0; i < 20; i++) {
    const bacon = new THREE.Mesh(baconGeom, baconMat);
    const x = (Math.random() - 0.5) * 8.6;
    const z = (Math.random() - 0.5) * 1.4;
    bacon.position.set(x, 1.55 + Math.random() * 0.15, z);
    bacon.rotation.set(
      (Math.random() - 0.5) * 0.6,
      Math.random() * Math.PI,
      (Math.random() - 0.5) * 0.6
    );
    hotdogGroup.add(bacon);
  }

  // Sementes de gergelim douradas no topo do pão
  const sesameMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.8 });
  const sesameGeom = new THREE.SphereGeometry(0.08, 8, 8);
  for (let i = 0; i < 35; i++) {
    const sesame = new THREE.Mesh(sesameGeom, sesameMat);
    const x = (Math.random() - 0.5) * 9.5;
    const isBack = Math.random() > 0.5;
    const z = isBack ? -1.0 - Math.random() * 0.3 : 1.0 + Math.random() * 0.3;
    sesame.position.set(x, 0.75 + Math.random() * 0.2, z);
    sesame.scale.set(1.5, 0.6, 1.0);
    hotdogGroup.add(sesame);
  }

  // Posicionamento centralizado bem no meio do início do site
  function updateHotdogScaleAndPos() {
    const isMobile = window.innerWidth <= 768;
    const scale = isMobile ? 0.82 : 1.12;
    hotdogGroup.scale.set(scale, scale, scale);
    hotdogGroup.position.set(0, isMobile ? 0.5 : 0, isMobile ? -4 : -1);
  }
  updateHotdogScaleAndPos();
  hotdogGroup.rotation.set(0.25, 0, 0.1);
  scene.add(hotdogGroup);

  // 6. Floating Golden Seasoning & Steam Embers (Partículas flutuantes de aroma e tempero)
  const particleCount = 120;
  const partGeom = new THREE.BufferGeometry();
  const partPositions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    partPositions[i] = (Math.random() - 0.5) * 45;
    partPositions[i + 1] = (Math.random() - 0.5) * 30;
    partPositions[i + 2] = (Math.random() - 0.5) * 20;
  }

  partGeom.setAttribute('position', new THREE.BufferAttribute(partPositions, 3));

  const partMat = new THREE.PointsMaterial({
    color: 0xf59e0b,
    size: 0.38,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  const particleSystem = new THREE.Points(partGeom, partMat);
  scene.add(particleSystem);

  // Mouse interactivity
  let mouseX = 0;
  let mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // Animation Loop with Clock
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();
    const isMobile = window.innerWidth <= 768;

    // Flutuação suave bem no meio da tela com reação ao cursor
    const baseY = isMobile ? 0.5 : 0;
    hotdogGroup.position.x = mouseX * 0.9;
    hotdogGroup.position.y = baseY + Math.sin(elapsedTime * 1.3) * 0.55;
    
    // Rotação suave 3D em torno do centro
    const targetRotY = Math.sin(elapsedTime * 0.75) * 0.28 + mouseX * 0.5;
    const targetRotX = 0.25 + Math.cos(elapsedTime * 0.6) * 0.14 - mouseY * 0.35;
    const targetRotZ = 0.08 + Math.sin(elapsedTime * 0.5) * 0.08;

    hotdogGroup.rotation.y += (targetRotY - hotdogGroup.rotation.y) * 0.05;
    hotdogGroup.rotation.x += (targetRotX - hotdogGroup.rotation.x) * 0.05;
    hotdogGroup.rotation.z += (targetRotZ - hotdogGroup.rotation.z) * 0.05;

    // Drift suave das partículas de tempero
    particleSystem.rotation.y += 0.001;
    particleSystem.rotation.x += 0.0005;

    renderer.render(scene, camera);
  }
  animate();

  // Resize handler
  window.addEventListener('resize', () => {
    updateHotdogScaleAndPos();
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  });
}

// --- 6. 3D TILT PHYSICS ON CARDS ---
function initTiltPhysics() {
  const cards = document.querySelectorAll('[data-tilt], .product-card');

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = -((y - centerY) / centerY) * 8; // max 8 deg
      const rotateY = ((x - centerX) / centerX) * 8;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
    });
  });
}

// --- 7. RENDER MENU PRODUCTS ---
function renderProducts(filterCategory = 'todos') {
  const container = document.getElementById('products-container');
  if (!container) return;

  container.innerHTML = '';

  const filtered = filterCategory === 'todos' 
    ? PRODUCTS 
    : PRODUCTS.filter(p => p.category === filterCategory);

  filtered.forEach(product => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.dataset.id = product.id;

    const optimizedPicture = createOptimizedPicture(product.image, product.name, 'product-card__thumb');

    card.innerHTML = `
      <div class="product-card__thumb-wrapper">
        ${optimizedPicture}
        ${product.badge ? `<span class="product-card__badge ${product.badge.includes('Mais') ? 'product-card__badge--hot' : ''}">${product.badge}</span>` : ''}
      </div>
      <div class="product-card__body">
        <div class="product-card__header">
          <h3 class="product-card__title">${product.name}</h3>
          <span class="product-card__price">${formatBRL(product.price)}</span>
        </div>
        <p class="product-card__desc">${product.desc}</p>
        <div class="product-card__actions">
          <button class="btn btn--add-cart" data-action="open-modal" data-id="${product.id}">
            <span>+ Adicionar ao Pedido</span>
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  // Re-bind tilt physics to new product cards
  initTiltPhysics();

  // Attach button click events
  container.querySelectorAll('[data-action="open-modal"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.dataset.id;
      openCustomizerModal(id);
    });
  });
}

// --- 8. CUSTOMIZATION MODAL (Lanche Customizer) ---
function openCustomizerModal(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  // Analytics: Track View Item
  trackViewItem(product);

  currentCustomizingItem = product;
  currentModalQty = 1;

  const modalBackdrop = document.getElementById('custom-modal-backdrop');
  const imgEl = document.getElementById('modal-item-img');
  const titleEl = document.getElementById('modal-item-title');
  const descEl = document.getElementById('modal-item-desc');
  const priceEl = document.getElementById('modal-item-price');
  const categoryEl = document.getElementById('modal-item-category');
  const notesEl = document.getElementById('modal-item-notes');
  const qtyEl = document.getElementById('modal-qty-val');

  // Use optimized image for modal
  const optimizedImg = createOptimizedImageTag(product.image, product.name);
  imgEl.src = optimizedImg.src;
  if (optimizedImg.srcset) {
    imgEl.srcset = optimizedImg.srcsetWebp;
    imgEl.setAttribute('srcset', optimizedImg.srcsetWebp);
    // Add type attribute for AVIF
    imgEl.dataset.avifSrcset = optimizedImg.srcset;
  }
  imgEl.alt = product.name;
  titleEl.textContent = product.name;
  descEl.textContent = product.desc;
  priceEl.textContent = formatBRL(product.price);
  categoryEl.textContent = product.category.toUpperCase();
  notesEl.value = '';
  qtyEl.textContent = '1';

  // Uncheck all extras & removals
  document.querySelectorAll('#custom-modal input[type="checkbox"]').forEach(cb => cb.checked = false);

  // Hide or show sections depending on hasExtras
  const extrasSection = document.getElementById('section-extras');
  const removalsSection = document.getElementById('section-removals');
  if (product.hasExtras) {
    extrasSection.classList.remove('hidden');
    removalsSection.classList.remove('hidden');
  } else {
    extrasSection.classList.add('hidden');
    removalsSection.classList.add('hidden');
  }

  updateModalTotal();
  modalBackdrop.classList.add('active');
  modalBackdrop.setAttribute('aria-hidden', 'false');
}

function closeCustomizerModal() {
  const modalBackdrop = document.getElementById('custom-modal-backdrop');
  if (modalBackdrop) {
    modalBackdrop.classList.remove('active');
    modalBackdrop.setAttribute('aria-hidden', 'true');
  }
}

function updateModalTotal() {
  if (!currentCustomizingItem) return;

  let total = currentCustomizingItem.price;

  // Add checked extras
  document.querySelectorAll('#custom-modal input[name="extra"]:checked').forEach(cb => {
    total += parseFloat(cb.dataset.price || 0);
  });

  const totalCalculated = total * currentModalQty;
  document.getElementById('modal-total-calc').textContent = formatBRL(totalCalculated);
}

// --- 9. CART SYSTEM ---
function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('up_cart');
    if (saved) {
      cart = JSON.parse(saved);
    }
  } catch (e) {
    cart = [];
  }
}

function saveCartToStorage() {
  localStorage.setItem('up_cart', JSON.stringify(cart));
}

function addToCart(item, extras = [], removals = [], notes = '', qty = 1) {
  const extrasTotal = extras.reduce((sum, ext) => sum + ext.price, 0);
  const unitPrice = item.price + extrasTotal;

  cart.push({
    id: item.id,
    name: item.name,
    category: item.category,
    image: item.image,
    basePrice: item.price,
    unitPrice: unitPrice,
    qty: qty,
    extras: extras,
    removals: removals,
    notes: notes
  });

  saveCartToStorage();
  updateCartUI();
  showToast(`${qty}x ${item.name} adicionado ao seu carrinho!`, '🌭');

  // Analytics: Track Add to Cart
  trackAddToCart({ ...item, unitPrice }, qty);
}

function updateCartItemQty(index, delta) {
  if (!cart[index]) return;

  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
    showToast('Item removido do carrinho.', '🗑️');
  }
  saveCartToStorage();
  updateCartUI();
}

function removeCartItem(index) {
  if (!cart[index]) return;
  cart.splice(index, 1);
  saveCartToStorage();
  updateCartUI();
  showToast('Item removido do carrinho.', '🗑️');
}

function getCartSubtotal() {
  return cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
}

function getCartDiscount() {
  if (!appliedCoupon) return 0;
  const subtotal = getCartSubtotal();
  return (subtotal * appliedCoupon.discountPercent) / 100;
}

function getCartTotal() {
  const subtotal = getCartSubtotal();
  const discount = getCartDiscount();
  return Math.max(0, subtotal - discount);
}

function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = getCartSubtotal();
  const discount = getCartDiscount();
  const total = getCartTotal();

  // Badges in header and buttons
  const badgeEl = document.getElementById('cart-count');
  const quickTotalEl = document.getElementById('cart-quick-total');
  const itemsCountEl = document.getElementById('cart-items-count');

  if (badgeEl) badgeEl.textContent = totalItems;
  if (quickTotalEl) quickTotalEl.textContent = formatBRL(subtotal);
  if (itemsCountEl) itemsCountEl.textContent = totalItems;

  // Mobile Bottom Bar
  const mobileBar = document.getElementById('mobile-cart-bar');
  const mobileCount = document.getElementById('mobile-cart-count');
  const mobilePrice = document.getElementById('mobile-cart-price');
  if (mobileBar) {
    if (totalItems > 0) {
      mobileBar.classList.add('active');
      mobileCount.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;
      mobilePrice.textContent = formatBRL(total);
    } else {
      mobileBar.classList.remove('active');
    }
  }

  // Free shipping progress bar (Free shipping over R$ 70,00)
  const freeShippingThreshold = 70.00;
  const progressBar = document.getElementById('free-shipping-progress');
  const progressText = document.getElementById('free-shipping-text');
  if (progressBar && progressText) {
    const percent = Math.min(100, (subtotal / freeShippingThreshold) * 100);
    progressBar.style.inlineSize = `${percent}%`;

    if (subtotal >= freeShippingThreshold) {
      progressText.innerHTML = `🎉 Parabéns! Você ganhou <strong>Entrega Grátis!</strong>`;
    } else {
      const diff = freeShippingThreshold - subtotal;
      progressText.innerHTML = `Faltam ${formatBRL(diff)} para <strong>Entrega Grátis!</strong>`;
    }
  }

  // Render items inside drawer
  const listContainer = document.getElementById('cart-items-list');
  const cartFooter = document.getElementById('cart-footer');

  if (listContainer) {
    if (cart.length === 0) {
      listContainer.innerHTML = `
        <div class="cart-empty-state">
          <span class="cart-empty-state__icon">🛒</span>
          <h4>Seu carrinho está vazio</h4>
          <p>Que tal escolher um Dogzão Especial ou um combo para hoje?</p>
          <a href="#cardapio" class="btn btn--outline" onclick="closeCart()">Explorar Cardápio</a>
        </div>
      `;
      if (cartFooter) cartFooter.style.display = 'none';
    } else {
      if (cartFooter) cartFooter.style.display = 'flex';
      listContainer.innerHTML = '';

      cart.forEach((item, index) => {
        const itemCard = document.createElement('div');
        itemCard.className = 'cart-item-card';

        let detailsArr = [];
        if (item.extras && item.extras.length > 0) {
          detailsArr.push(`+ ${item.extras.map(e => e.name).join(', ')}`);
        }
        if (item.removals && item.removals.length > 0) {
          detailsArr.push(`${item.removals.join(', ')}`);
        }
        if (item.notes) {
          detailsArr.push(`Obs: "${item.notes}"`);
        }

        const detailsText = detailsArr.length > 0 
          ? `<div class="cart-item-card__details">${detailsArr.join(' • ')}</div>` 
          : '';

        itemCard.innerHTML = `
          ${createOptimizedPicture(item.image, item.name, 'cart-item-card__img')}
          <div class="cart-item-card__info">
            <h4 class="cart-item-card__title">${item.name}</h4>
            ${detailsText}
            <div class="cart-item-card__bottom">
              <span class="cart-item-card__price">${formatBRL(item.unitPrice * item.qty)}</span>
              <div class="cart-item-qty-actions">
                <button type="button" class="cart-qty-btn" onclick="updateCartItemQty(${index}, -1)">−</button>
                <span class="cart-item-qty">${item.qty}</span>
                <button type="button" class="cart-qty-btn" onclick="updateCartItemQty(${index}, 1)">+</button>
                <button type="button" class="cart-item-remove-btn" onclick="removeCartItem(${index})" title="Remover item">✕</button>
              </div>
            </div>
          </div>
        `;
        listContainer.appendChild(itemCard);
      });
    }
  }

  // Summary lines
  const subtotalValEl = document.getElementById('cart-subtotal-val');
  const totalValEl = document.getElementById('cart-total-val');
  const discountRow = document.getElementById('discount-row');
  const discountLabel = document.getElementById('discount-label');
  const discountVal = document.getElementById('discount-val');

  if (subtotalValEl) subtotalValEl.textContent = formatBRL(subtotal);
  if (totalValEl) totalValEl.textContent = formatBRL(total);

  if (discountRow) {
    if (appliedCoupon && discount > 0) {
      discountRow.classList.remove('hidden');
      discountLabel.textContent = `${appliedCoupon.discountPercent}%`;
      discountVal.textContent = `- ${formatBRL(discount)}`;
    } else {
      discountRow.classList.add('hidden');
    }
  }
}

function openCart() {
  document.getElementById('cart-drawer').classList.add('active');
  document.getElementById('cart-overlay').classList.add('active');
}

function closeCart() {
  document.getElementById('cart-drawer').classList.remove('active');
  document.getElementById('cart-overlay').classList.remove('active');
}

// --- 10. CHECKOUT MODAL & ORDER PROCESSING ---
function openCheckoutModal() {
  if (cart.length === 0) {
    showToast('Adicione pelo menos um item para continuar.', '⚠️');
    return;
  }
  
  // Analytics: Track Begin Checkout
  trackBeginCheckout([...cart]);
  
  closeCart();
  updateCheckoutSummary();
  const checkoutBackdrop = document.getElementById('checkout-modal-backdrop');
  checkoutBackdrop.classList.add('active');
  checkoutBackdrop.setAttribute('aria-hidden', 'false');
}

function closeCheckoutModal() {
  const checkoutBackdrop = document.getElementById('checkout-modal-backdrop');
  if (checkoutBackdrop) {
    checkoutBackdrop.classList.remove('active');
    checkoutBackdrop.setAttribute('aria-hidden', 'true');
  }
}

function updateCheckoutSummary() {
  const subtotal = getCartSubtotal();
  const discount = getCartDiscount();
  
  // Delivery Fee
  const isDelivery = document.querySelector('input[name="delivery_type"]:checked')?.value === 'delivery';
  let fee = 0;

  if (isDelivery) {
    // If subtotal is over R$ 70,00, delivery is free
    if (subtotal >= 70.00) {
      fee = 0;
    } else {
      const districtSelect = document.getElementById('order-district');
      const selectedOption = districtSelect ? districtSelect.options[districtSelect.selectedIndex] : null;
      fee = selectedOption && selectedOption.dataset.fee ? parseFloat(selectedOption.dataset.fee) : 5.00;
    }
  }

  const finalTotal = Math.max(0, subtotal - discount + fee);

  const subtotalEl = document.getElementById('checkout-subtotal');
  const feeEl = document.getElementById('checkout-fee');
  const totalEl = document.getElementById('checkout-total');
  const discountRow = document.getElementById('checkout-discount-row');
  const discountEl = document.getElementById('checkout-discount');

  if (subtotalEl) subtotalEl.textContent = formatBRL(subtotal);
  if (feeEl) {
    feeEl.textContent = fee === 0 ? (isDelivery ? 'GRÁTIS 🎉' : 'R$ 0,00 (Retirada)') : formatBRL(fee);
  }
  if (totalEl) totalEl.textContent = formatBRL(finalTotal);

  if (discountRow) {
    if (appliedCoupon && discount > 0) {
      discountRow.classList.remove('hidden');
      discountEl.textContent = `- ${formatBRL(discount)}`;
    } else {
      discountRow.classList.add('hidden');
    }
  }
}

function processOrder(e) {
  e.preventDefault();

  if (cart.length === 0) {
    showToast('Seu carrinho está vazio!', '⚠️');
    return;
  }

  const name = document.getElementById('order-name').value.trim();
  const phone = document.getElementById('order-phone').value.trim();
  const deliveryType = document.querySelector('input[name="delivery_type"]:checked').value;
  const paymentMethod = document.querySelector('input[name="payment_method"]:checked').value;

  let district = '';
  let street = '';
  let number = '';
  let compl = '';
  let ref = '';

  if (deliveryType === 'delivery') {
    const districtSelect = document.getElementById('order-district');
    district = districtSelect.value;
    street = document.getElementById('order-street').value.trim();
    number = document.getElementById('order-number').value.trim();
    compl = document.getElementById('order-compl').value.trim();
    ref = document.getElementById('order-ref').value.trim();

    if (!district || !street || !number) {
      showToast('Por favor, preencha o endereço completo de entrega.', '⚠️');
      return;
    }
  }

  if (!name || !phone) {
    showToast('Por favor, informe seu nome e telefone.', '⚠️');
    return;
  }

  // Calculate financials
  const subtotal = getCartSubtotal();
  const discount = getCartDiscount();
  let fee = 0;
  if (deliveryType === 'delivery') {
    if (subtotal >= 70.00) {
      fee = 0;
    } else {
      const districtSelect = document.getElementById('order-district');
      const selectedOption = districtSelect.options[districtSelect.selectedIndex];
      fee = selectedOption && selectedOption.dataset.fee ? parseFloat(selectedOption.dataset.fee) : 5.00;
    }
  }
  const total = Math.max(0, subtotal - discount + fee);

  // Generate Unique Order Code
  const orderId = `UP-${Math.floor(1000 + Math.random() * 9000)}`;

  // Format Payment Description
  let paymentText = '';
  if (paymentMethod === 'pix') {
    paymentText = '⚡ Pix (Chave: 47996366274)';
  } else if (paymentMethod === 'cartao') {
    paymentText = '💳 Cartão na Entrega (Maquininha)';
  } else {
    const change = document.getElementById('order-change').value.trim();
    paymentText = `💵 Dinheiro ${change ? `(Troco para: ${change})` : '(Sem troco)'}`;
  }

  // Build WhatsApp Message
  let msg = `🌭 *NOVO PEDIDO ONLINE - UNIVERSAL PRENSADOS*\n`;
  msg += `*Pedido:* #${orderId}\n`;
  msg += `--------------------------------------\n`;
  msg += `👤 *Cliente:* ${name}\n`;
  msg += `📱 *WhatsApp:* ${phone}\n`;
  msg += `🛵 *Tipo:* ${deliveryType === 'delivery' ? 'Entrega em Casa' : 'Retirada no Balcão (Jarivatuba)'}\n`;

  if (deliveryType === 'delivery') {
    msg += `📍 *Endereço:* ${street}, nº ${number}\n`;
    msg += `📍 *Bairro:* ${district} - Joinville/SC\n`;
    if (compl) msg += `🏢 *Compl:* ${compl}\n`;
    if (ref) msg += `🔍 *Ref:* ${ref}\n`;
  }
  msg += `--------------------------------------\n`;
  msg += `📋 *ITENS DO PEDIDO:*\n\n`;

  cart.forEach((item, i) => {
    msg += `${i + 1}. *${item.qty}x ${item.name}* — ${formatBRL(item.unitPrice * item.qty)}\n`;
    if (item.extras && item.extras.length > 0) {
      msg += `   └ Adicionais: ${item.extras.map(e => e.name).join(', ')}\n`;
    }
    if (item.removals && item.removals.length > 0) {
      msg += `   └ Retirar: ${item.removals.join(', ')}\n`;
    }
    if (item.notes) {
      msg += `   └ Observação: "${item.notes}"\n`;
    }
    msg += `\n`;
  });

  msg += `--------------------------------------\n`;
  msg += `💵 *Subtotal:* ${formatBRL(subtotal)}\n`;
  if (discount > 0) {
    msg += `🎉 *Desconto Cupom (${appliedCoupon.code}):* -${formatBRL(discount)}\n`;
  }
  if (deliveryType === 'delivery') {
    msg += `🛵 *Taxa de Entrega:* ${fee === 0 ? 'GRÁTIS' : formatBRL(fee)}\n`;
  }
  msg += `💰 *TOTAL A PAGAR: ${formatBRL(total)}*\n`;
  msg += `💳 *Forma de Pagamento:* ${paymentText}\n`;
  msg += `--------------------------------------\n`;
  msg += `Aguardando confirmação do pedido! Muito obrigado!`;

  const encodedMsg = encodeURIComponent(msg);
  const whatsappUrl = `https://wa.me/5547996366274?text=${encodedMsg}`;

  // Open WhatsApp in new tab
  window.open(whatsappUrl, '_blank');

  // Analytics: Track Purchase
  trackPurchase({
    orderId,
    items: [...cart],
    subtotal,
    discount,
    deliveryFee: fee,
    total,
    paymentMethod,
    deliveryType,
  });

  // Show Success Modal
  closeCheckoutModal();
  document.getElementById('success-order-id').textContent = `#${orderId}`;
  document.getElementById('success-order-dest').textContent = deliveryType === 'delivery' 
    ? `${street}, ${number} - ${district}` 
    : 'Retirada no Balcão (R. Monsenhor Gercino, 4486)';
  document.getElementById('success-order-total').textContent = formatBRL(total);
  document.getElementById('success-whatsapp-link').href = whatsappUrl;

  const successModal = document.getElementById('success-modal-backdrop');
  successModal.classList.add('active');
  successModal.setAttribute('aria-hidden', 'false');

  // Clear Cart
  cart = [];
  appliedCoupon = null;
  saveCartToStorage();
  updateCartUI();
}

// --- 11. INITIALIZATION & DOM EVENTS ---
document.addEventListener('DOMContentLoaded', () => {
  // Load Theme
  initThemeEngine();

  // Load 3D WebGL Scene
  initHero3D();

  // Load Saved Cart
  loadCartFromStorage();

  // Render initial menu
  renderProducts('todos');

  // Initialize Tilt
  initTiltPhysics();

  // Mobile menu hamburger toggle
  const menuToggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('nav');
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', open);
    });

    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Header scroll shadow
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('header--scrolled');
    } else {
      header.classList.remove('header--scrolled');
    }
  }, { passive: true });

  // Menu Category Filter Tabs
  document.querySelectorAll('.menu-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.menu-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const category = btn.dataset.category;
      
      // Analytics: Track Category Filter (Search)
      if (category !== 'todos') {
        trackSearch(`category:${category}`);
      }
      
      renderProducts(category);
    });
  });

  // Direct Add Button on Hero Featured Card
  document.querySelectorAll('.add-to-cart-direct').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      openCustomizerModal(itemId);
    });
  });

  // Customization Modal Events
  const customModalClose = document.getElementById('custom-modal-close');
  if (customModalClose) {
    customModalClose.addEventListener('click', closeCustomizerModal);
  }

  // Checkbox change updates total in customizer
  document.querySelectorAll('#custom-modal input[name="extra"]').forEach(cb => {
    cb.addEventListener('change', updateModalTotal);
  });

  // Quantity in modal
  const minusBtn = document.getElementById('modal-qty-minus');
  const plusBtn = document.getElementById('modal-qty-plus');
  const qtyValEl = document.getElementById('modal-qty-val');

  if (minusBtn) {
    minusBtn.addEventListener('click', () => {
      if (currentModalQty > 1) {
        currentModalQty--;
        qtyValEl.textContent = currentModalQty;
        updateModalTotal();
      }
    });
  }

  if (plusBtn) {
    plusBtn.addEventListener('click', () => {
      currentModalQty++;
      qtyValEl.textContent = currentModalQty;
      updateModalTotal();
    });
  }

  // Confirm Add to Cart
  const confirmAddBtn = document.getElementById('modal-confirm-add-btn');
  if (confirmAddBtn) {
    confirmAddBtn.addEventListener('click', () => {
      if (!currentCustomizingItem) return;

      const extras = [];
      document.querySelectorAll('#custom-modal input[name="extra"]:checked').forEach(cb => {
        extras.push({
          name: cb.dataset.name,
          price: parseFloat(cb.dataset.price)
        });
      });

      const removals = [];
      document.querySelectorAll('#custom-modal input[name="removal"]:checked').forEach(cb => {
        removals.push(cb.value);
      });

      const notes = document.getElementById('modal-item-notes').value.trim();

      addToCart(currentCustomizingItem, extras, removals, notes, currentModalQty);
      closeCustomizerModal();
    });
  }

  // Cart Open & Close Triggers
  document.getElementById('cart-open-btn')?.addEventListener('click', openCart);
  document.getElementById('mobile-cart-open')?.addEventListener('click', openCart);
  document.getElementById('cart-close-btn')?.addEventListener('click', closeCart);
  document.getElementById('cart-overlay')?.addEventListener('click', closeCart);

  // Header "Fazer Pedido" scroll to menu
  document.getElementById('header-order-btn')?.addEventListener('click', () => {
    document.getElementById('cardapio')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Coupon Copy Button in Banner
  const copyCouponBtn = document.getElementById('copy-coupon-btn');
  if (copyCouponBtn) {
    copyCouponBtn.addEventListener('click', () => {
      const code = copyCouponBtn.dataset.code;
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Cupom ${code} copiado com sucesso!`, '📋');
        copyCouponBtn.textContent = 'Copiado! ✓';
        setTimeout(() => {
          copyCouponBtn.textContent = 'Copiar Cupom';
        }, 2000);
      });
    });
  }

  // Apply Coupon in Cart Drawer
  const applyCouponBtn = document.getElementById('cart-coupon-apply');
  const couponInput = document.getElementById('cart-coupon-input');
  const couponMsg = document.getElementById('coupon-feedback-msg');

  if (applyCouponBtn && couponInput) {
    applyCouponBtn.addEventListener('click', () => {
      const code = couponInput.value.trim().toUpperCase();
      if (code === 'BEMVINDO10') {
        appliedCoupon = { code: 'BEMVINDO10', discountPercent: 10 };
        couponMsg.className = 'coupon-feedback success';
        couponMsg.textContent = 'Cupom aplicado! 10% de desconto.';
        updateCartUI();
        showToast('Desconto de 10% aplicado no pedido!', '🎉');
        
        // Analytics: Track Coupon Application
        const discountAmount = getCartSubtotal() * 0.1;
        trackApplyCoupon('BEMVINDO10', discountAmount);
      } else if (!code) {
        couponMsg.className = 'coupon-feedback error';
        couponMsg.textContent = 'Digite um cupom válido.';
      } else {
        couponMsg.className = 'coupon-feedback error';
        couponMsg.textContent = 'Cupom inválido ou expirado.';
      }
    });
  }

  // Checkout Open Trigger
  document.getElementById('proceed-to-checkout-btn')?.addEventListener('click', openCheckoutModal);
  document.getElementById('checkout-modal-close')?.addEventListener('click', closeCheckoutModal);

  // Delivery type radio toggle
  document.querySelectorAll('input[name="delivery_type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const addressGroup = document.getElementById('address-step-group');
      const isDelivery = e.target.value === 'delivery';

      document.querySelectorAll('.delivery-type-card').forEach(c => c.classList.remove('active'));
      e.target.closest('.delivery-type-card').classList.add('active');

      if (isDelivery) {
        addressGroup.classList.remove('hidden');
        document.getElementById('order-district').setAttribute('required', 'true');
        document.getElementById('order-street').setAttribute('required', 'true');
        document.getElementById('order-number').setAttribute('required', 'true');
      } else {
        addressGroup.classList.add('hidden');
        document.getElementById('order-district').removeAttribute('required');
        document.getElementById('order-street').removeAttribute('required');
        document.getElementById('order-number').removeAttribute('required');
      }
      updateCheckoutSummary();
    });
  });

  // District selector change updates delivery fee
  document.getElementById('order-district')?.addEventListener('change', updateCheckoutSummary);

  // --- VIACEP INTEGRATION FOR ADDRESS AUTOCOMPLETE ---
  const cepInput = document.getElementById('order-cep');
  const cepLoading = document.getElementById('cep-loading');
  const cepStatus = document.getElementById('cep-status');
  const districtSelect = document.getElementById('order-district');
  const streetInput = document.getElementById('order-street');

  // Map of Joinville neighborhoods to district options
  const JOINVILLE_DISTRICTS = {
    'jarivatuba': 'Jarivatuba',
    'joao costa': 'João Costa',
    'guanabara': 'Guanabara',
    'fatima': 'Fátima',
    'itaum': 'Itaum',
    'paranaguamirim': 'Paranaguamirim',
    'boehmerwald': 'Boehmerwald',
    'bucarein': 'Bucarein',
    'floresta': 'Floresta',
    'centro': 'Centro'
  };

  // Format CEP input (99999-999)
  function formatCEP(value) {
    const digits = value.replace(/\D/g, '');
    if (digits.length > 5) {
      return digits.slice(0, 5) + '-' + digits.slice(5, 8);
    }
    return digits;
  }

  // Validate CEP format
  function isValidCEP(cep) {
    return /^\d{5}-?\d{3}$/.test(cep);
  }

  // Normalize string for comparison
  function normalizeStr(str) {
    return str.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  // Find matching district from ViaCEP response
  function findMatchingDistrict(bairro, localidade, uf) {
    if (uf !== 'SC' || localidade?.toLowerCase() !== 'joinville') {
      return null;
    }
    const normalizedBairro = normalizeStr(bairro);
    return JOINVILLE_DISTRICTS[normalizedBairro] || null;
  }

  // Fetch address from ViaCEP
  async function fetchCEP(cep) {
    const cleanCEP = cep.replace('-', '');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      if (!response.ok) throw new Error('Erro na requisição');
      const data = await response.json();
      if (data.erro) throw new Error('CEP não encontrado');
      return data;
    } catch (error) {
      console.error('[ViaCEP] Erro:', error.message);
      return null;
    }
  }

  // Update form fields with ViaCEP data
  function fillAddressFields(data) {
    if (!data) return;

    // Enable fields
    districtSelect.disabled = false;
    streetInput.disabled = false;

    // Fill street
    if (data.logradouro) {
      streetInput.value = data.logradouro;
    }

    // Find and select matching district
    const matchedDistrict = findMatchingDistrict(data.bairro, data.localidade, data.uf);
    if (matchedDistrict) {
      // Find the option with matching value
      const option = districtSelect.querySelector(`option[value="${matchedDistrict}"]`);
      if (option) {
        districtSelect.value = matchedDistrict;
        // Trigger change to update delivery fee
        districtSelect.dispatchEvent(new Event('change'));
      }
      cepStatus.textContent = `✓ Endereço encontrado: ${data.bairro}, ${data.localidade}/${data.uf}`;
      cepStatus.style.color = 'var(--color-success)';
    } else {
      cepStatus.textContent = `⚠ CEP válido, mas bairro não está em nossa área de entrega (${data.bairro}, ${data.localidade}/${data.uf})`;
      cepStatus.style.color = 'var(--color-secondary)';
    }

    // Focus next field
    streetInput.focus();
  }

  // CEP input event handler
  if (cepInput) {
    let cepDebounceTimer;

    cepInput.addEventListener('input', (e) => {
      const formatted = formatCEP(e.target.value);
      e.target.value = formatted;

      clearTimeout(cepDebounceTimer);
      
      if (isValidCEP(formatted)) {
        cepLoading.classList.add('active');
        cepStatus.textContent = 'Buscando endereço...';
        cepStatus.style.color = 'var(--text-muted)';

        cepDebounceTimer = setTimeout(async () => {
          const data = await fetchCEP(formatted);
          cepLoading.classList.remove('active');
          
          if (data) {
            fillAddressFields(data);
          } else {
            cepStatus.textContent = '✗ CEP não encontrado ou fora de Joinville/SC';
            cepStatus.style.color = '#ef4444';
            districtSelect.disabled = false;
            streetInput.disabled = false;
          }
        }, 300);
      } else {
        cepStatus.textContent = '';
        districtSelect.disabled = true;
        streetInput.disabled = true;
        districtSelect.value = '';
        streetInput.value = '';
      }
    });

    // Handle paste
    cepInput.addEventListener('paste', (e) => {
      setTimeout(() => {
        const formatted = formatCEP(cepInput.value);
        cepInput.value = formatted;
        if (isValidCEP(formatted)) {
          cepInput.dispatchEvent(new Event('input'));
        }
      }, 0);
    });
  }

  // Payment method radio toggle
  document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const method = e.target.value;
      document.querySelectorAll('.payment-option-card').forEach(c => c.classList.remove('active'));
      e.target.closest('.payment-option-card').classList.add('active');

      const pixBox = document.getElementById('pix-box');
      const cashBox = document.getElementById('cash-box');

      if (method === 'pix') {
        pixBox.classList.remove('hidden');
        cashBox.classList.add('hidden');
      } else if (method === 'dinheiro') {
        pixBox.classList.add('hidden');
        cashBox.classList.remove('hidden');
      } else {
        pixBox.classList.add('hidden');
        cashBox.classList.add('hidden');
      }
    });
  });

  // Copy Pix Key Button
  document.getElementById('copy-pix-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText('47996366274').then(() => {
      showToast('Chave Pix copiada com sucesso!', '⚡');
    });
  });

  // Checkout Form Submission
  document.getElementById('checkout-form')?.addEventListener('submit', processOrder);

  // Success Modal Close
  document.getElementById('success-close-btn')?.addEventListener('click', () => {
    document.getElementById('success-modal-backdrop').classList.remove('active');
  });

  // Close modals on clicking backdrop
  ['custom-modal-backdrop', 'checkout-modal-backdrop', 'success-modal-backdrop'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          el.classList.remove('active');
          el.setAttribute('aria-hidden', 'true');
        }
      });
    }
  });

  // Initial cart UI update
  updateCartUI();
});




