// Animações e micro-interações com GSAP (https://github.com/greensock/GSAP)
// Tudo que é movimento decorativo fica atrás de `prefers-reduced-motion: no-preference`.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

const MOTION_OK = '(prefers-reduced-motion: no-preference)';
const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const mm = gsap.matchMedia();

const prefersMotion = () => window.matchMedia(MOTION_OK).matches;

// --- Hero: entrada em timeline, flutuação contínua e parallax com o mouse ---
function initHero() {
  mm.add(MOTION_OK, () => {
    const title = document.querySelector('[data-anim="hero-title"]');
    const split = title ? SplitText.create(title, { type: 'words', mask: 'words', wordsClass: 'word' }) : null;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    // Ao terminar, desfaz a divisão para o título voltar ao HTML original (acessível e sem wrappers)
    if (split) tl.from(split.words, { yPercent: 110, duration: 0.9, stagger: 0.05, onComplete: () => split.revert() });
    tl.from('[data-anim="hero-item"]', { y: 24, autoAlpha: 0, duration: 0.7, stagger: 0.1 }, 0.25)
      .from('.hero-stage__glow', { scale: 0.3, autoAlpha: 0, duration: 1.1, ease: 'back.out(1.6)' }, 0.1)
      .from('.hero-stage__ring', { scale: 0.6, autoAlpha: 0, duration: 1 }, 0.25)
      .from('.hero-stage__main', { yPercent: -60, rotation: -10, autoAlpha: 0, duration: 1.2, ease: 'bounce.out' }, 0.35)
      .from('.hero-stage__side', { scale: 0.2, autoAlpha: 0, duration: 0.8, stagger: 0.15, ease: 'back.out(1.8)' }, 0.8)
      .from('.hero-ing', { scale: 0, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: 'back.out(3)' }, 1)
      .from('.hero-stage__tag', { xPercent: -30, autoAlpha: 0, duration: 0.7 }, 1.15);

    // Loops ociosos
    gsap.to('.hero-stage__ring', { rotation: 360, duration: 50, repeat: -1, ease: 'none' });
    gsap.to('.hero-stage__main', { yPercent: -4, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.6 });
    gsap.utils.toArray('.hero-stage__side, .hero-ing').forEach((el, i) => {
      gsap.to(el, {
        yPercent: gsap.utils.random(-14, 14),
        rotation: `+=${gsap.utils.random(-12, 12)}`,
        duration: gsap.utils.random(2.2, 3.6),
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        delay: 1.6 + i * 0.12,
      });
    });

    // Ao rolar, a vitrine afasta e o texto sobe levemente
    gsap.to('.hero-stage', {
      scale: 0.86,
      yPercent: 10,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });

    return () => split?.revert();
  });

  // Parallax pelo mouse (só em desktop)
  mm.add(`${MOTION_OK} and ${FINE_POINTER}`, () => {
    const stage = document.getElementById('hero-stage');
    if (!stage) return;
    const layers = gsap.utils.toArray(stage.querySelectorAll('[data-depth]')).map(el => ({
      depth: parseFloat(el.dataset.depth) || 1,
      x: gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3.out' }),
    }));
    const onMove = (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      layers.forEach(l => { l.x(nx * 30 * l.depth); l.y(ny * 24 * l.depth); });
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  });
}

// --- Contadores dos cards de estatística ---
function initCounters() {
  mm.add(MOTION_OK, () => {
    document.querySelectorAll('[data-count]').forEach(el => {
      const end = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const obj = { v: 0 };
      gsap.to(obj, {
        v: end,
        duration: 1.6,
        delay: 0.9,
        ease: 'power2.out',
        onUpdate: () => { el.textContent = obj.v.toFixed(decimals); },
      });
    });
  });
}

// --- Faixa de produtos em loop infinito; acelera com a velocidade do scroll ---
function initMarquee() {
  const track = document.querySelector('.marquee__track');
  if (!track) return;
  track.append(...[...track.children].map(n => n.cloneNode(true)));

  mm.add(MOTION_OK, () => {
    const loop = gsap.to(track, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
    const st = ScrollTrigger.create({
      onUpdate: (self) => {
        const boost = gsap.utils.clamp(1, 5, 1 + Math.abs(self.getVelocity()) / 400);
        gsap.timeline({ overwrite: true })
          .to(loop, { timeScale: boost, duration: 0.2 })
          .to(loop, { timeScale: 1, duration: 1 }, '+=0.2');
      },
    });
    return () => { loop.kill(); st.kill(); };
  });
}

// --- Header esconde ao descer e volta ao subir ---
function initHeader() {
  const header = document.getElementById('header');
  if (!header) return;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      header.classList.toggle('header--scrolled', y > 40);
      const menuOpen = document.getElementById('nav')?.classList.contains('open');
      header.classList.toggle('is-hidden', !menuOpen && self.direction === 1 && y > 320);
    },
  });
}

// --- Revelação das seções ao rolar ---
function initReveals() {
  mm.add(MOTION_OK, () => {
    const targets = gsap.utils.toArray(
      '.section-header, .feature-item, .visual-card, .review-bubble, .contact-mini-card, .contact-map-wrapper, .about-content > p'
    );
    gsap.set(targets, { autoAlpha: 0, y: 40 });
    ScrollTrigger.batch(targets, {
      start: 'top 88%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out' }),
    });

    // Parallax suave da foto do combo
    gsap.fromTo('.visual-card__cover-img', { yPercent: -6, scale: 1.12 }, {
      yPercent: 6,
      ease: 'none',
      scrollTrigger: { trigger: '.visual-card--banner', start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

// --- Inclinação 3D e botões magnéticos (desktop) ---
function initPointerEffects() {
  mm.add(`${MOTION_OK} and ${FINE_POINTER}`, () => {
    const cleanups = [];

    document.querySelectorAll('[data-tilt]').forEach(card => {
      gsap.set(card, { transformPerspective: 900 });
      const rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3.out' });
      const ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3.out' });
      const move = (e) => {
        const r = card.getBoundingClientRect();
        rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
        ry(((e.clientX - r.left) / r.width - 0.5) * 10);
      };
      const leave = () => { rx(0); ry(0); };
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerleave', leave);
      cleanups.push(() => { card.removeEventListener('pointermove', move); card.removeEventListener('pointerleave', leave); });
    });

    document.querySelectorAll('[data-magnetic]').forEach(btn => {
      const x = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' });
      const y = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' });
      const move = (e) => {
        const r = btn.getBoundingClientRect();
        x((e.clientX - r.left - r.width / 2) * 0.3);
        y((e.clientY - r.top - r.height / 2) * 0.3);
      };
      const leave = () => { x(0); y(0); };
      btn.addEventListener('pointermove', move);
      btn.addEventListener('pointerleave', leave);
      cleanups.push(() => { btn.removeEventListener('pointermove', move); btn.removeEventListener('pointerleave', leave); });
    });

    return () => cleanups.forEach(fn => fn());
  });
}

export function initAnimations() {
  initHero();
  initCounters();
  initMarquee();
  initHeader();
  initReveals();
  initPointerEffects();
}

// --- Cardápio ---
// Primeira exibição: cards entram em cascata quando o grid aparece
export function revealProducts(cards) {
  if (!prefersMotion()) return;
  gsap.set(cards, { autoAlpha: 0, y: 50 });
  ScrollTrigger.batch(cards, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out', clearProps: 'transform' }),
  });
}

// Troca de categoria: os cards atuais saem e os da nova categoria entram em cascata
let filterTimeline;
export function filterProducts(cards, matches) {
  const apply = () => cards.forEach(card => { card.hidden = !matches(card); });
  if (!prefersMotion()) { apply(); return; }

  filterTimeline?.progress(1);
  const leaving = cards.filter(c => !c.hidden);
  filterTimeline = gsap.timeline({ onComplete: () => ScrollTrigger.refresh() })
    .to(leaving, { autoAlpha: 0, y: 16, duration: 0.18, ease: 'power2.in', stagger: 0.01 })
    .add(() => {
      apply();
      const entering = cards.filter(c => !c.hidden);
      gsap.fromTo(entering, { autoAlpha: 0, y: 28, scale: 0.96 }, {
        autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out', stagger: 0.06, clearProps: 'transform',
      });
    });
}

// --- Carrinho ---
// A foto do produto "voa" até o carrinho visível (header ou barra inferior no celular)
export function flyToCart(sourceImg) {
  const targets = [document.getElementById('mobile-cart-open'), document.getElementById('cart-open-btn')];
  const target = targets.find(el => el && el.offsetParent !== null && el.getBoundingClientRect().width > 0);
  if (!target) return;

  const bump = () => gsap.fromTo(['#cart-count', '#mobile-cart-count'], { scale: 1.6 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });

  const from = sourceImg?.getBoundingClientRect();
  if (!prefersMotion() || !from || from.width === 0) { bump(); return; }

  const to = target.getBoundingClientRect();
  const size = Math.min(from.width, from.height, 160);
  const ghost = document.createElement('img');
  ghost.src = sourceImg.currentSrc || sourceImg.src;
  ghost.alt = '';
  ghost.className = 'fly-to-cart';
  Object.assign(ghost.style, {
    inlineSize: `${size}px`,
    blockSize: `${size}px`,
    left: `${from.left + from.width / 2 - size / 2}px`,
    top: `${from.top + from.height / 2 - size / 2}px`,
  });
  document.body.appendChild(ghost);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);

  gsap.timeline({ onComplete: () => { ghost.remove(); bump(); } })
    .to(ghost, { x: dx, duration: 0.8, ease: 'power1.inOut' }, 0)
    .to(ghost, { y: dy, duration: 0.8, ease: 'back.in(1.4)' }, 0)
    .to(ghost, { scale: 0.18, rotation: 200, duration: 0.8, ease: 'power2.in' }, 0)
    .to(ghost, { autoAlpha: 0, duration: 0.15 }, 0.7);
}

// Itens do carrinho entram em cascata ao abrir a gaveta
export function revealCartItems() {
  if (!prefersMotion()) return;
  gsap.from('#cart-items-list > *', { x: 40, autoAlpha: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out', delay: 0.15, clearProps: 'all' });
}
