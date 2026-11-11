import './finale.css';
import { thud, crack, shatterSound, key, lineBeep } from './sfx.js';
import { runEnding } from './ending.js';

/* ============================================================
   ✏️  ТУТ ВПИШІТЬ СВОЇ ДАНІ
   Усе це лише показується на екрані і нікуди не надсилається.
   ============================================================ */
const PRANK_DATA = {
  fullName: 'Плуговий Роман Валерійович',
  country: 'Україна',
  city: 'Київ',
  ip: '', // залиште порожнім — IP визначиться автоматично
};
// Додаткові рядки (за бажанням): назва: 'значення'
const EXTRA_DATA = {
  // phone: '+380 00 000 00 00',
};

/* ===== тайминги та тексти ===== */
const HIT_GAP = 2000;                 // пауза між ударами, мс
const HITS = [14, 18, 22, 27, 34];    // сила кожного удару (px); усього 5 ударів
const STAGES = [0, 0.18, 0.36, 0.64, 1]; // розмір тріщин після кожного удару (0 — тріщин ще немає)
const SHATTER_DELAY = 450;            // пауза між останнім ударом і розпадом на осколки
const BLACK_PAUSE = 3000;             // чорний екран перед появою тексту
const PROMPT_START = 'rubidium@h4ck ~@:';
const PROMPT = 'rubidium@h4ck ~$:';
const START_CMD = 'start hack';

const root = document.documentElement;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));

/* ===== головна послідовність ===== */
export async function runFinale() {
  const W = root.clientWidth, H = window.innerHeight;
  const geo = buildGeometry(W, H);
  const cracks = createCracks(W, H, geo);
  const infoPromise = collectInfo(); // збір даних іде у фоні

  for (let i = 0; i < HITS.length; i++) {
    if (i > 0) await sleep(HIT_GAP);
    quake(HITS[i]);
    if (STAGES[i] > 0) { cracks.reveal(STAGES[i]); crack(); }
  }
  await sleep(SHATTER_DELAY);
  await shatter(W, H, geo, cracks.svg);
  await sleep(BLACK_PAUSE);
  await hackTerminal(infoPromise);
}

/* ===== удар ===== */
function quake(q) {
  root.style.setProperty('--q', q + 'px');
  root.classList.remove('quake');
  void root.offsetWidth; // перезапуск анімації
  root.classList.add('quake');
  thud(q);
  try { navigator.vibrate?.(q * 8); } catch { /* ігноруємо */ }
  setTimeout(() => root.classList.remove('quake'), 700);
}

/* ===== геометрія: промені тріщин + осколки між ними ===== */
function buildGeometry(W, H) {
  const C = { x: W / 2, y: H / 2 };
  const Rfull = Math.hypot(W, H) / 2;   // від центру до найдальшого кута
  const K = 7, S = 24, Rmax = Rfull * 1.7;
  const base = rnd(0, Math.PI * 2);
  const rays = [];

  for (let j = 0; j < K; j++) {
    const a = base + (j + rnd(-0.25, 0.25)) * (Math.PI * 2 / K);
    const pts = [{ x: C.x, y: C.y, d: 0 }];
    let off = 0;
    for (let s = 1; s <= S; s++) {
      const d = (s * Rmax) / S;
      off = Math.max(-22, Math.min(22, off + rnd(-6, 6)));
      pts.push({ x: C.x + Math.cos(a) * d - Math.sin(a) * off, y: C.y + Math.sin(a) * d + Math.cos(a) * off, d });
    }
    // дрібні відгалуження
    const branches = [];
    for (let s = 3; s < S - 6; s++) {
      if (Math.random() > 0.28) continue;
      const ba = a + (Math.random() < 0.5 ? 1 : -1) * rnd(0.5, 1.1);
      const step = rnd(14, 34);
      const bp = [pts[s]];
      let x = pts[s].x, y = pts[s].y;
      for (let n = ri(3, 6); n > 0; n--) {
        x += Math.cos(ba + rnd(-0.2, 0.2)) * step; y += Math.sin(ba + rnd(-0.2, 0.2)) * step;
        bp.push({ x, y, d: Math.hypot(x - C.x, y - C.y) });
      }
      branches.push({ pts: bp });
    }
    rays.push({ pts, branches });
  }

  // середні точки хорд між сусідніми променями (щоб тріщини були «рваними»)
  const mids = new Map();
  const mid = (idx, j) => {
    const key = idx + '-' + j;
    if (!mids.has(key)) {
      const p = rays[j].pts[idx], q = rays[(j + 1) % K].pts[idx];
      mids.set(key, { x: (p.x + q.x) / 2 + rnd(-8, 8), y: (p.y + q.y) / 2 + rnd(-8, 8) });
    }
    return mids.get(key);
  };

  // кільця «павутини» та осколки
  const ringIdx = [4, 8, 14];
  const bounds = [0, ...ringIdx, S];
  const cells = [];
  for (let L = 0; L < bounds.length - 1; L++) {
    const a = bounds[L], b = bounds[L + 1];
    for (let j = 0; j < K; j++) {
      const r1 = rays[j], r2 = rays[(j + 1) % K];
      const poly = [];
      for (let s = a; s <= b; s++) poly.push(r1.pts[s]);
      poly.push(mid(b, j));
      for (let s = b; s >= a; s--) poly.push(r2.pts[s]);
      if (a > 0) poly.push(mid(a, j));
      cells.push(poly.map((p) => [p.x, p.y]));
    }
  }
  const ringPoints = (idx) => {
    const out = [];
    for (let j = 0; j < K; j++) out.push(rays[j].pts[idx], mid(idx, j));
    out.push(rays[0].pts[idx]);
    return out;
  };

  return { C, Rfull, rays, cells, ringIdx, ringPoints, ringD: (idx) => rays[0].pts[idx].d };
}

/* ===== тріщини (SVG поверх екрана) ===== */
function createCracks(W, H, geo) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'gl-cracks');
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  document.body.append(svg);

  const line = (pts, w) => `<polyline stroke-width="${w}" points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"/>`;
  const prefix = (pts, rc) => { const out = []; for (const p of pts) { if (p.d > rc) break; out.push(p); } return out; };

  function reveal(f) {
    const rc = f * geo.Rfull;
    let html = `<circle cx="${geo.C.x}" cy="${geo.C.y}" r="6" fill="#fff" stroke="none"/>`;
    for (const r of geo.rays) {
      const v = prefix(r.pts, rc);
      if (v.length > 1) html += line(v, 2);
      for (const b of r.branches) { const bv = prefix(b.pts, rc); if (bv.length > 1) html += line(bv, 1); }
    }
    for (const idx of geo.ringIdx) if (geo.ringD(idx) <= rc) html += line(geo.ringPoints(idx), 1.4);
    svg.innerHTML = `<g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" opacity=".92">${html}</g>`;
  }
  return { svg, reveal };
}

/* ===== знімок інтерфейсу (лише те, що видно на екрані) ===== */
function buildStage(W, H, cracksSvg) {
  const stage = document.createElement('div');
  stage.className = 'shard-stage';
  stage.style.cssText = `width:${W}px;height:${H}px`;
  stage.append(document.querySelector('.appbar').cloneNode(true));

  const doc = document.querySelector('.doc');
  const dc = doc.cloneNode(true);
  // «заморожені» літери, що пливли: фіксуємо їхній поточний вигляд
  const o = [...doc.querySelectorAll('.gl-char.drift')], c = [...dc.querySelectorAll('.gl-char.drift')];
  o.forEach((el, i) => {
    const cs = getComputedStyle(el);
    c[i].classList.remove('drift');
    c[i].style.animation = 'none';
    c[i].style.transform = cs.transform;
    c[i].style.opacity = cs.opacity;
  });
  // блоки поза екраном замінюємо порожніми заглушками тієї ж висоти
  [...doc.children].forEach((k, i) => {
    const r = k.getBoundingClientRect();
    if (r.bottom < -40 || r.top > H + 40) {
      const cs = getComputedStyle(k);
      const ph = document.createElement('div');
      ph.style.cssText = `height:${r.height}px;margin:${cs.marginTop} 0 ${cs.marginBottom}`;
      dc.children[i].replaceWith(ph);
    }
  });
  const dr = doc.getBoundingClientRect();
  Object.assign(dc.style, { position: 'absolute', left: '0', right: '0', top: dr.top + 'px', transform: '' });
  stage.append(dc);

  stage.append(document.querySelector('.tabbar').cloneNode(true));
  document.querySelectorAll('body > .gl-btn').forEach((b) => stage.append(b.cloneNode(true)));
  const ov = document.querySelector('body > .gl-overlay');
  if (ov) stage.append(ov.cloneNode(true));
  stage.append(cracksSvg.cloneNode(true));
  return stage;
}

/* ===== розпад на осколки ===== */
async function shatter(W, H, geo, cracksSvg) {
  const stage = buildStage(W, H, cracksSvg);
  const shards = [];

  geo.cells.forEach((poly) => {
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const minx = Math.max(0, Math.floor(Math.min(...xs))), maxx = Math.min(W, Math.ceil(Math.max(...xs)));
    const miny = Math.max(0, Math.floor(Math.min(...ys))), maxy = Math.min(H, Math.ceil(Math.max(...ys)));
    const w = maxx - minx, h = maxy - miny;
    if (w < 2 || h < 2) return;

    const el = document.createElement('div');
    el.className = 'shard';
    el.style.cssText = `left:${minx}px;top:${miny}px;width:${w}px;height:${h}px;clip-path:polygon(${poly
      .map(([x, y]) => `${(x - minx).toFixed(1)}px ${(y - miny).toFixed(1)}px`).join(',')})`;
    const s = stage.cloneNode(true);
    s.style.left = -minx + 'px'; s.style.top = -miny + 'px';
    el.append(s);
    document.body.append(el);
    shards.push({ el, cx: (minx + maxx) / 2, cy: (miny + maxy) / 2 });
  });

  shatterSound();
  root.classList.add('blackout'); // оригінал ховається, під уламками — чорний екран

  const anims = shards.map(({ el, cx, cy }) => {
    let dx = cx - geo.C.x, dy = cy - geo.C.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const dist = Math.max(W, H) * rnd(0.7, 1.5);
    const end = `perspective(900px) translate3d(${dx * dist + rnd(-50, 50)}px, ${dy * dist + rnd(80, 420)}px, ${rnd(-300, 300)}px) rotateX(${ri(-260, 260)}deg) rotateY(${ri(-260, 260)}deg) rotateZ(${ri(-300, 300)}deg)`;
    return el.animate(
      [{ transform: 'perspective(900px) translate3d(0,0,0)', opacity: 1 }, { opacity: 1, offset: 0.7 }, { transform: end, opacity: 0 }],
      { duration: rnd(1400, 2200), delay: (len / geo.Rfull) * 150, easing: 'cubic-bezier(.12,.7,.3,1)', fill: 'forwards' },
    );
  });
  await Promise.all(anims.map((a) => a.finished));
  shards.forEach((s) => s.el.remove());
}

/* ===== «зібрані дані» ===== */
async function getIP() {
  if (PRANK_DATA.ip) return PRANK_DATA.ip;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
    clearTimeout(t);
    return (await r.json()).ip;
  } catch { return 'не вдалося визначити'; }
}

async function getOS() {
  const ua = navigator.userAgent;
  let os = 'невідомо';
  if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS ' + (/OS ([\d_]+)/.exec(ua)?.[1] || '').replace(/_/g, '.');
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  try {
    const h = await navigator.userAgentData?.getHighEntropyValues(['model', 'platformVersion']);
    if (h) {
      const major = parseInt(h.platformVersion, 10);
      if (os === 'Android' && major) os = `Android ${major}`;
      if (os === 'Windows' && major) os = major >= 13 ? 'Windows 11' : 'Windows 10';
      if (h.model) os += ` (${h.model})`;
    }
  } catch { /* ігноруємо */ }
  return os.trim();
}

function getBrowser() {
  const ua = navigator.userAgent;
  const map = [['Edg', 'Edge'], ['OPR', 'Opera'], ['SamsungBrowser', 'Samsung Internet'], ['YaBrowser', 'Yandex'],
    ['Firefox', 'Firefox'], ['FxiOS', 'Firefox'], ['CriOS', 'Chrome'], ['Chrome', 'Chrome']];
  for (const [key, name] of map) {
    const m = new RegExp(key + '/([\\d.]+)').exec(ua);
    if (m) return `${name} ${m[1].split('.')[0]}`;
  }
  const v = /Version\/([\d.]+)/.exec(ua);
  return v ? `Safari ${v[1].split('.')[0]}` : 'невідомо';
}

async function getBattery() {
  try {
    const b = await navigator.getBattery();
    return `${Math.round(b.level * 100)}% (${b.charging ? 'заряджається' : 'не заряджається'})`;
  } catch { return 'недоступно в цьому браузері'; }
}

function getGPU() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    return gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  } catch { return 'невідомо'; }
}

function getNetwork() {
  const c = navigator.connection;
  return c ? `${c.effectiveType || '?'}${c.downlink ? `, ~${c.downlink} Мбіт/с` : ''}` : 'невідомо';
}

async function collectInfo() {
  const [ip, os, battery] = await Promise.all([getIP(), getOS(), getBattery()]);
  return [
    ['user_IP', ip],
    ['user_OS', os],
    ['browser', getBrowser()],
    ['battery', battery],
    ['screen', `${screen.width}x${screen.height} @${devicePixelRatio}x`],
    ['gpu', getGPU()],
    ['cpu_cores', navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : 'невідомо'],
    ['ram', navigator.deviceMemory ? `${navigator.deviceMemory}+ GB` : 'невідомо'],
    ['network', getNetwork()],
    ['language', navigator.language],
    ['timezone', Intl.DateTimeFormat().resolvedOptions().timeZone],
    ['local_time', () => new Date().toLocaleString('uk-UA')],
    ['full_name', PRANK_DATA.fullName],
    ['country', PRANK_DATA.country],
    ['city', PRANK_DATA.city],
    ...Object.entries(EXTRA_DATA),
  ];
}

/* ===== термінал ===== */
async function hackTerminal(infoPromise) {
  const term = document.createElement('div');
  term.className = 'hack-term';
  document.body.append(term);
  const cursor = document.createElement('span');
  cursor.className = 'cur';

  // sound: 'key' — клацання на кожну літеру, 'key2' — на кожну другу, 'line' — один сигнал на рядок
  async function typeLine(text, min, max, { parent = term, sound = 'none' } = {}) {
    const line = document.createElement('div');
    line.className = 'line';
    const txt = document.createElement('span');
    line.append(txt, cursor);
    parent.append(line);
    if (sound === 'line') lineBeep();
    let i = 0;
    for (const ch of text) {
      txt.textContent += ch;
      if (sound === 'key' || (sound === 'key2' && i % 2 === 0)) key();
      i++;
      term.scrollTop = term.scrollHeight;
      await sleep(rnd(min, max));
    }
  }

  await sleep(400);
  await typeLine(`${PROMPT_START} ${START_CMD}`, 55, 120, { sound: 'key' });
  await sleep(1000);

  const rows = await infoPromise;
  for (const [k, v] of rows) {
    await typeLine(`${PROMPT} ${k}: ${typeof v === 'function' ? v() : v}`, 12, 28, { sound: 'line' });
    await sleep(rnd(350, 900));
  }

  await runEnding({ term, typeLine, sleep }); // рамка, відлік, фінал — ending.js
}
