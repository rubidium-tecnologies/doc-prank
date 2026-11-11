import './glitch.css';
import { runFinale } from './finale.js';
import { initAudio, blip, staticBurst, errorBeep } from './sfx.js';

/* ===== налаштування ===== */
const TRIGGER_DELAY = 3000;          // мс після натискання «Переглянути текст» до початку консольного кадру
const TERMINAL_TIME = 500;           // скільки триває консольний стиль
const GAP_AFTER_TERMINAL = 2000;     // пауза перед початком глітчів
const RESPECT_REDUCED_MOTION = true; // false — ефект працює навіть із вимкненою анімацією в системі
const FREEZE_AFTER = 7000;          // мс після початку глітчів: удар, заморожування і фінал

/* ===== утиліти ===== */
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;
const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';
const gib = (n) => Array.from({ length: n }, () => ALPHA[ri(0, ALPHA.length - 1)]).join('');

/* піксельний череп 8×8 */
const SKULL = ['01111110', '11111111', '10011001', '10011001', '11111111', '11100111', '01111110', '01011010'];
const skull = (s) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 8 8" shape-rendering="crispEdges" fill="currentColor">${SKULL.flatMap(
    (row, y) => [...row].map((c, x) => (c === '1' ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : '')),
  ).join('')}</svg>`;

/* ===== колір та форми: різкі, без плавності ===== */
const NEON = ['#ff0000', '#00ff00', '#ff00ff', '#ffff00', '#00ffff', '#0000ff', '#ffffff', '#000000'];
const PAIRS = [
  ['#000000', '#ff0000'], ['#ff0000', '#000000'], ['#000000', '#00ff00'], ['#00ff00', '#000000'],
  ['#ffff00', '#000000'], ['#000000', '#ffff00'], ['#0000ff', '#ffff00'], ['#ff00ff', '#000000'],
  ['#000000', '#00ffff'], ['#ffffff', '#ff0000'], ['#ff0000', '#ffffff'], ['#00ffff', '#ff0000'],
];
const otherThan = (c) => { let x; do { x = pick(NEON); } while (x === c); return x; };
const darkOn = (c) => (c === '#000000' || c === '#0000ff' || c === '#ff0000' ? '#ffffff' : '#000000');
const jag = (n) => Array.from({ length: n }, () => `${ri(0, 100)}% ${ri(0, 100)}%`).join(',');

/* ===== повний екран ===== */
let keepFs = true; // доки йде «вірус», повертаємо повний екран при наступному дотику

function enterFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => {});
  } catch { /* ігноруємо */ }
}

function keepFullscreen() {
  const onChange = () => {
    if (!keepFs || document.fullscreenElement || document.webkitFullscreenElement) return;
    addEventListener('pointerdown', enterFullscreen, { once: true });
  };
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
}

/* ===== запуск ===== */
export function armPrank(api) {
  const safe = location.hash === '#safe' ||
    (RESPECT_REDUCED_MOTION && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // аварійний вихід: Esc (або додати #safe до адреси)
  if (!safe) {
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { location.hash = 'safe'; location.reload(); }
    });
  }

  api.gateBtn.addEventListener('click', () => {
    // усе, що потребує жесту користувача, — синхронно всередині кліку
    if (!safe) { enterFullscreen(); initAudio(); }

    api.gate.remove();
    api.rest.hidden = false;
    if (safe) return;

    keepFullscreen();
    const h = api.rest.querySelector('h1');
    if (h) {
      h.scrollIntoView({ block: 'start' });
      setTimeout(() => h.scrollIntoView({ block: 'start' }), 400); // після зміни розміру вікна
    }
    // відлік до глітчів стартує лише тепер
    setTimeout(() => flashTerminal(api), TRIGGER_DELAY);
  }, { once: true });
}

function flashTerminal(api) {
  const root = document.documentElement;
  root.classList.add('term');
  blip();
  api.titleEl.textContent = 'google@docs ~$: вступ█';
  document.title = 'google@docs ~$';
  setTimeout(() => {
    root.classList.remove('term');
    api.updateTitle();
    setTimeout(() => startGlitch(), GAP_AFTER_TERMINAL);
  }, TERMINAL_TIME);
}

/* ===== «вірус» ===== */
function startGlitch() {
  const root = document.documentElement;
  const doc = document.querySelector('.doc');
  const t0 = performance.now();
  const level = () => Math.min(1 + (performance.now() - t0) / 9000, 6); // наростає приблизно до 45 с
  let lastFlash = 0;
  let perm = 0;
  const btns = [];
  let frozen = false;
  let tickId;
  const timers = new Set();
  const intervals = new Set();
  // setTimeout, який можна скасувати разом з усіма іншими при заморожуванні
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  };

  root.classList.add('glitching');
  const overlay = document.createElement('div');
  overlay.className = 'gl-overlay';
  document.body.append(overlay);

  /* --- кольори: різкі, чисті, без градієнтів і плавних переходів --- */
  function recolor() {
    const [bg, text] = pick(PAIRS);
    const st = root.style;
    st.setProperty('--bg', bg);
    st.setProperty('--text', text);
    st.setProperty('--bar', otherThan(text));
    st.setProperty('--muted', text);
    st.setProperty('--pill', otherThan(text));
    st.setProperty('--line', text);
    st.setProperty('--head', otherThan(text));
    later(recolor, rnd(120, 500));
  }

  /* --- текст у випадковому місці екрана --- */
  function textAtPoint() {
    for (let i = 0; i < 6; i++) {
      const x = rnd(0, innerWidth), y = rnd(0, innerHeight);
      let node, off;
      if (document.caretRangeFromPoint) {
        const r = document.caretRangeFromPoint(x, y);
        if (r) { node = r.startContainer; off = r.startOffset; }
      } else if (document.caretPositionFromPoint) {
        const p = document.caretPositionFromPoint(x, y);
        if (p) { node = p.offsetNode; off = p.offset; }
      }
      const el = node && node.nodeType === 3 && node.parentElement;
      if (el && el.closest('#app, .gl-btn') && !el.closest('.gl-char')) return { node, off };
    }
    return null;
  }

  /* --- літери: пливуть, зникають, міняють розмір --- */
  const unwrap = (s) => { if (s.isConnected) s.replaceWith(document.createTextNode(s.textContent)); };
  function glitchChar() {
    const hit = textAtPoint();
    if (!hit) return;
    const { node } = hit;
    const off = Math.min(hit.off, node.data.length - 1);
    const ch = node.data[off];
    if (off < 0 || !ch || /\s/.test(ch)) return;
    const r = document.createRange();
    r.setStart(node, off); r.setEnd(node, off + 1);
    const s = document.createElement('span');
    s.className = 'gl-char';
    r.surroundContents(s);

    const keep = perm < 120 && chance(0.08);
    if (keep) perm++;
    const kind = pick(['drift', 'drift', 'hide', 'size', 'flick']);
    if (kind === 'drift') {
      s.style.setProperty('--dx', ri(-120, 120) + 'px');
      s.style.setProperty('--dy', ri(-140, 140) + 'px');
      s.style.setProperty('--r', pick([-180, -90, 90, 180, 270]) + 'deg');
      s.style.setProperty('--s', rnd(0.3, 3).toFixed(2));
      s.style.setProperty('--t', rnd(0.8, 2.4).toFixed(2) + 's');
      s.classList.add('drift');
      if (!keep) s.addEventListener('animationend', () => unwrap(s));
      return;
    }
    if (kind === 'hide') s.classList.add('hide');
    if (kind === 'size') s.style.fontSize = rnd(0.4, 3).toFixed(2) + 'em';
    if (kind === 'flick') s.style.color = pick(NEON);
    if (!keep) later(() => unwrap(s), rnd(500, 4000));
  }

  /* --- текст перетворюється на «hxjaopwhcbzj» --- */
  function garble() {
    const hit = textAtPoint();
    if (!hit) return;
    const n = hit.node;
    const orig = n.data;
    if (orig.trim().length < 2) return;
    if (orig.length < 40 && chance(0.5)) {
      n.data = orig.replace(/\S/g, () => ALPHA[ri(0, ALPHA.length - 1)]);
    } else {
      const len = Math.min(ri(6, 14), orig.length);
      const a = ri(0, orig.length - len);
      n.data = orig.slice(0, a) + gib(len) + orig.slice(a + len);
    }
    const g = n.data;
    if (chance(0.12)) return; // залишається назавжди
    later(() => { if (n.isConnected && n.data === g) n.data = orig; }, rnd(300, 2800));
  }

  /* --- блоки: нахил, розтягування, зрізи --- */
  function distortBlock() {
    const el = document.elementFromPoint(rnd(0, innerWidth), rnd(0, innerHeight));
    const b = el && el.closest('p, h1, h2, h3, li, tr, .toc-row, .titles, .title-page > div, .tabbar, .appbar');
    if (!b || b.dataset.gl) return;
    b.dataset.gl = '1';
    const old = b.style.cssText;
    b._old = old;
    switch (ri(0, 3)) {
      case 0: b.style.transform = `skewX(${ri(-25, 25)}deg) translateX(${ri(-40, 40)}px)`; break;
      case 1: b.style.transform = `scaleY(${rnd(0.3, 2).toFixed(2)})`; break;
      case 2: b.style.clipPath = `polygon(0 ${ri(0, 40)}%, 100% ${ri(0, 40)}%, 100% ${ri(60, 100)}%, 0 ${ri(60, 100)}%)`; b.style.transform = `translateX(${ri(-30, 30)}px)`; break;
      default: b.style.filter = `invert(1)`; b.style.transform = `translateX(${ri(-25, 25)}px)`;
    }
    later(() => { b.style.cssText = old; delete b.dataset.gl; }, rnd(120, 600));
  }

  /* --- іконки перетворюються на піксельні черепи --- */
  function swapIcon() {
    const hosts = [...document.querySelectorAll('.icon-btn, .share-btn, .tab-ico')].filter((h) => !h.dataset.sk);
    if (!hosts.length) return;
    const h = pick(hosts);
    const size = parseInt(h.querySelector('svg')?.getAttribute('width') || '30', 10);
    const orig = h.innerHTML;
    h.dataset.sk = '1';
    h.innerHTML = skull(size);
    if (chance(0.1)) return;
    later(() => { h.innerHTML = orig; delete h.dataset.sk; }, rnd(500, 3500));
  }

  /* --- нові кнопки --- */
  const LABELS = ['ВИДАЛИТИ ВСЕ', 'ПОМИЛКА 0x7F', 'ДОСТУП ЗАБОРОНЕНО', 'КРИТИЧНА ПОМИЛКА', 'SYSTEM FAILURE',
    'KERNEL PANIC', 'ВІДНОВИТИ ФАЙЛ', 'ОНОВИТИ ЗАРАЗ', 'VIRUS.EXE', 'ОЧИСТИТИ КЕШ', 'ЗАКРИТИ', 'ПРОДОВЖИТИ', 'ERR_0xC0000005'];
  function addButton() {
    if (frozen) return;
    if (btns.length >= 28) btns.shift().remove();
    const bg = pick(NEON);
    const b = document.createElement('button');
    b.className = 'gl-btn';
    b.textContent = pick(LABELS);
    Object.assign(b.style, {
      left: ri(2, 70) + '%', top: ri(10, 88) + '%',
      background: bg, color: darkOn(bg), borderColor: otherThan(bg),
      fontSize: ri(11, 22) + 'px',
    });
    b.addEventListener('click', () => {
      if (frozen) return;
      addButton(); addButton();
      b.style.left = ri(2, 70) + '%'; b.style.top = ri(10, 88) + '%';
      burst();
    });
    document.body.append(b);
    btns.push(b);
    errorBeep();
  }

  /* --- гострі осколки та смуги-«розриви» кадру --- */
  function addShard() {
    if (frozen) return;
    const d = document.createElement('div');
    d.className = 'gl-shard';
    Object.assign(d.style, {
      left: ri(-5, 95) + '%', top: ri(-5, 95) + '%', width: ri(40, 360) + 'px', height: ri(14, 260) + 'px',
      background: pick(NEON), clipPath: `polygon(${jag(ri(3, 5))})`,
    });
    document.body.append(d);
    later(() => d.remove(), rnd(80, 600));
  }
  function addSlices() {
    if (frozen) return;
    for (let i = 0, n = ri(2, 6); i < n; i++) {
      const d = document.createElement('div');
      d.className = 'gl-slice';
      Object.assign(d.style, {
        top: ri(0, 100) + '%', height: ri(3, 40) + 'px', left: ri(0, 30) + '%', width: ri(40, 100) + '%',
        background: pick(NEON),
      });
      document.body.append(d);
      later(() => d.remove(), rnd(60, 220));
    }
  }

  const GLYPHS = ['⚠', '✖', '⟳', '✉', '⚙', '▶', '?', '!', '☰'];
  function addAppbarIcon() {
    const bar = document.querySelector('.appbar');
    if (bar.querySelectorAll('.gl-extra').length >= 4) return;
    const b = document.createElement('button');
    b.className = 'icon-btn gl-extra';
    b.innerHTML = chance(0.4) ? skull(26) : `<span style="font-size:26px;line-height:1">${pick(GLYPHS)}</span>`;
    bar.insertBefore(b, bar.querySelector('.share-btn'));
  }

  const TABS = ['Вкладка 2', 'ERR_0x01', 'SYS_FAIL', 'Вкладка 404'];
  function addTab() {
    const bar = document.querySelector('.tabbar');
    if (bar.querySelectorAll('.gl-extra-tab').length >= 2) return;
    const s = document.createElement('span');
    s.className = 'gl-extra-tab';
    s.textContent = pick(TABS);
    bar.append(s);
  }

  /* --- короткі спотворення всього екрана --- */
  const FONTS = ['"Courier New", monospace', 'Impact, fantasy', '"Lucida Console", monospace', 'monospace', 'fantasy'];
  const layers = () => [...document.querySelectorAll('.doc, .appbar, .tabbar')];
  function burst() {
    if (frozen) return;
    switch (ri(0, 3)) {
      case 0: { // тремтіння
        let n = 0;
        const id = setInterval(() => {
          doc.style.transform = n++ > 6 ? '' : `translate(${ri(-8, 8)}px, ${ri(-5, 5)}px) rotate(${rnd(-0.6, 0.6).toFixed(2)}deg)`;
          if (n > 7) { clearInterval(id); intervals.delete(id); }
        }, 40);
        intervals.add(id);
        break;
      }
      case 1: { // інверсія (не частіше ніж раз на 3 с)
        if (performance.now() - lastFlash < 3000) return;
        lastFlash = performance.now();
        layers().forEach((l) => { l.style.filter = `invert(1) hue-rotate(${ri(0, 360)}deg)`; });
        later(() => layers().forEach((l) => { l.style.filter = ''; }), rnd(90, 160));
        break;
      }
      case 2: { // наближення з нахилом
        doc.style.transform = `scale(${rnd(1.03, 1.2).toFixed(2)}) rotate(${rnd(-2, 2).toFixed(2)}deg)`;
        later(() => { doc.style.transform = ''; }, rnd(150, 400));
        break;
      }
      default: { // RGB-розщеплення
        root.style.setProperty('--sx', ri(4, 12) + 'px');
        root.classList.add('fx-rgb');
        later(() => root.classList.remove('fx-rgb'), rnd(400, 1000));
      }
    }
  }
  function fontShake() {
    root.style.setProperty('--ff', pick(FONTS));
    doc.style.letterSpacing = rnd(-1, 5).toFixed(1) + 'px';
    later(() => { root.style.removeProperty('--ff'); doc.style.letterSpacing = ''; }, rnd(150, 500));
  }

  /* --- головний цикл: чим довше, тим більше хаосу --- */
  function tick() {
    const L = level();
    overlay.style.opacity = Math.min(0.3 + L * 0.12, 1);
    if (chance(0.45)) for (let i = 0; i < Math.ceil(L); i++) glitchChar();
    if (chance(0.12 * L)) garble();
    if (chance(0.10 * L)) distortBlock();
    if (chance(0.05 * L)) swapIcon();
    if (chance(0.035 * L)) addButton();
    if (chance(0.025 * L)) addAppbarIcon();
    if (chance(0.015 * L)) addTab();
    if (chance(0.03 * L)) burst();
    if (chance(0.02 * L)) fontShake();
    if (chance(0.06 * L)) addShard();
    if (chance(0.05 * L)) addSlices();
    if (chance(0.07 * L)) staticBurst();
  }

  /* --- заморожування: усе зупиняється в поточному стані --- */
  function freeze() {
    frozen = true;
    keepFs = false; // далі повним екраном керує finale/ending
    clearInterval(tickId);
    intervals.forEach(clearInterval);
    timers.forEach(clearTimeout);
    intervals.clear(); timers.clear();
    // тимчасові спотворення прибираємо, щоб «кадр» був чистим
    document.querySelectorAll('[data-gl]').forEach((b) => { b.style.cssText = b._old || ''; delete b.dataset.gl; });
    doc.style.transform = ''; doc.style.letterSpacing = '';
    layers().forEach((l) => { l.style.filter = ''; });
    document.querySelectorAll('.gl-shard, .gl-slice').forEach((n) => n.remove());
    root.classList.remove('fx-rgb');
    root.style.removeProperty('--ff');
    root.style.removeProperty('--sx');
    root.classList.add('frozen');
  }

  recolor();
  tickId = setInterval(tick, 110);

  // через 7 секунд: удар, заморожування, а далі — фінал (finale.js)
  setTimeout(() => { freeze(); runFinale(); }, FREEZE_AFTER);
}
