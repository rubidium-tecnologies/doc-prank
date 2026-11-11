/* Усі звуки створює сам браузер (Web Audio) — окремих аудіофайлів не потрібно.
   Браузери вмикають звук лише після дотику/кліку по сторінці, тому якщо жертва
   жодного разу не торкнулась екрана, звуків не буде (тільки тиша). */
export const SOUND_ENABLED = true;
const VOLUME = 0.55; // загальна гучність (0–1)

let ctx = null, master = null, noiseBuf = null;

export function initAudio() {
  if (!SOUND_ENABLED) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = VOLUME;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  const resume = () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}); };
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) => addEventListener(ev, resume, { passive: true }));
  resume();
}

const ready = () => ctx && ctx.state === 'running';
const r = (a, b) => a + Math.random() * (b - a);

function tone(freq, dur, { type = 'square', vol = 0.2, slide = 0, delay = 0 } = {}) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.3, type = 'lowpass', freq = 800, q = 1, delay = 0 } = {}) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}

/* ----- окремі звуки ----- */
export const blip = () => { tone(1200, 0.09, { vol: 0.12 }); tone(800, 0.09, { vol: 0.1, delay: 0.1 }); };
export const staticBurst = () => {
  noise(r(0.04, 0.14), { vol: 0.16, type: 'highpass', freq: 1200 });
  if (Math.random() < 0.5) tone(r(200, 2200), 0.05, { type: 'sawtooth', vol: 0.06 });
};
export const errorBeep = () => tone(r(300, 500), 0.14, { type: 'square', vol: 0.1, slide: -120 });

export function thud(power = 20) {
  const v = Math.min(0.9, 0.35 + power / 60);
  tone(75, 0.55, { type: 'sine', vol: v, slide: -50 });
  noise(0.4, { vol: v * 0.8, type: 'lowpass', freq: 320 });
}
export function crack() {
  noise(0.2, { vol: 0.35, type: 'highpass', freq: 2500 });
  for (let i = 0; i < 5; i++) noise(0.03, { vol: 0.28, type: 'bandpass', freq: r(2000, 6000), q: 3, delay: r(0.03, 0.4) });
}
export function shatterSound() {
  noise(1.0, { vol: 0.4, type: 'bandpass', freq: 4200, q: 0.6 });
  noise(0.5, { vol: 0.45, type: 'lowpass', freq: 500 });
  for (let i = 0; i < 16; i++) tone(r(1800, 6500), r(0.05, 0.18), { type: 'sine', vol: r(0.05, 0.12), delay: r(0, 0.9) });
}

export const key = () => { noise(0.03, { vol: 0.22, type: 'highpass', freq: 1500 }); tone(r(900, 1400), 0.02, { vol: 0.04 }); };
export const lineBeep = () => { tone(880, 0.06, { vol: 0.1 }); tone(1320, 0.06, { vol: 0.1, delay: 0.07 }); };

export function tick(urgent, left) {
  tone(urgent ? 1500 : 950, 0.05, { vol: 0.14 });
  if (urgent) tone(left % 2 ? 880 : 660, 0.4, { type: 'sawtooth', vol: 0.08 });
}
export function crashSound() {
  noise(0.7, { vol: 0.5, type: 'bandpass', freq: 1500, q: 0.5 });
  tone(440, 0.5, { type: 'sawtooth', vol: 0.22, slide: -330 });
  tone(110, 1.2, { type: 'sawtooth', vol: 0.12, delay: 0.1 });
}
export function chime() {
  [660, 880, 1320].forEach((f, i) => tone(f, 0.5, { type: 'sine', vol: 0.2, delay: i * 0.14 }));
}
