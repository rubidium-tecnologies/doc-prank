import './ending.css';
import { tick, crashSound, chime } from './sfx.js';

/* ============================================================
   ✏️  НАЛАШТУВАННЯ ФІНАЛУ
   ============================================================ */
const COUNTDOWN_SECONDS = 60;
const BUTTON_TEXT = '[здаюся, 12 в журналі]';
const THREAT_TEXT = `Поставте мені 12 балів протягом ${COUNTDOWN_SECONDS} секунд, інакше всі ваші дані будуть злиті в rubidium_victim_base, а також в інші соцмережі, а тим часом акаунти telegram та viber будуть знесені шляхом report_spam.`;
const JOKE_TEXT = 'Жарт! Веб-сайт абсолютно безпечний і не може завдати шкоди жертві, але за такий проєкт ви все одно маєте поставити мені 12 балів :)';
const RELOAD_AFTER = 10000;      // мс від появи білого екрана до перезавантаження сайту
const BSOD_REVEAL_AFTER = 20000; // мс після «краху» ОС до появи «Жарт!» (0 — не показувати; тоді жертва залишиться на екрані помилки)
const FORCE_CRASH_SCREEN = '';   // '' = за ОС жертви; для перевірки: 'windows' | 'linux' | 'ios' | 'android' | 'mac'

const rnd = (a, b) => a + Math.random() * (b - a);

/* ===== головна функція ===== */
export async function runEnding({ term, typeLine, sleep }) {
  const toBottom = () => term.scrollTo({ top: term.scrollHeight, behavior: 'smooth' });

  // 1. прокрутка вниз і рамка з «знайденими акаунтами»
  await sleep(900);
  const box = document.createElement('div');
  box.className = 'hack-box';
  term.append(box);
  toBottom();
  await sleep(800);
  await typeLine('victim_telegram_account: знайдено', 25, 45, { parent: box, sound: 'key2' });
  await sleep(500);
  await typeLine('victim_viber_account: знайдено', 25, 45, { parent: box, sound: 'key2' });
  await sleep(1200);

  // 2. зворотний відлік
  const timer = document.createElement('div');
  timer.className = 'hack-timer';
  term.append(timer);
  toBottom();

  const endAt = Date.now() + COUNTDOWN_SECONDS * 1000;
  let shown = -1, finished = false;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const id = setInterval(() => {
    if (finished) return;
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (left === shown) return;
    shown = left;
    timer.textContent = fmt(left);
    timer.classList.toggle('urgent', left <= 10);
    if (left > 0) tick(left <= 10, left);
    else { finished = true; clearInterval(id); crash(term, sleep); }
  }, 200);
  timer.textContent = fmt(COUNTDOWN_SECONDS);

  // 3. погроза та кнопка
  await sleep(700);
  const threat = document.createElement('div');
  threat.className = 'hack-threat';
  term.append(threat);
  await typeLine(THREAT_TEXT, 12, 22, { parent: threat, sound: 'key2' });
  if (finished) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hack-btn';
  btn.textContent = BUTTON_TEXT;
  btn.addEventListener('click', () => {
    if (finished) return;
    finished = true;
    clearInterval(id);
    showJoke(term);
  });
  term.append(btn);
  toBottom();
}

/* ===== кнопку натиснули: усе зникає, екран білий, «Жарт!», перезавантаження ===== */
function showJoke(term) {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  chime();
  term.replaceChildren();
  const j = document.createElement('div');
  j.className = 'hack-joke';
  const p = document.createElement('p');
  p.textContent = JOKE_TEXT;
  j.append(p);
  document.body.append(j);
  void j.offsetWidth;
  j.classList.add('on');
  setTimeout(() => p.classList.add('on'), 700);
  setTimeout(() => location.reload(), RELOAD_AFTER);
}

/* ===== час вийшов: чорний екран → повний екран → «фатальна помилка» ===== */
async function crash(term, sleep) {
  term.replaceChildren(); // повністю чорний екран
  await sleep(1500);
  goFullscreen();

  const kind = detectCrash();
  const el = document.createElement('div');
  el.className = `crash crash-${kind}`;
  el.innerHTML = SCREENS[kind]();
  document.body.append(el);
  crashSound();
  try { navigator.vibrate?.([300, 100, 300]); } catch { /* ігноруємо */ }
  if (kind === 'windows') animateWindows(el);
  if (kind === 'linux') animateLinux(el);

  // запобіжник: щоб жертва не залишилась «зі зламаним пристроєм» назавжди
  if (BSOD_REVEAL_AFTER > 0) setTimeout(() => showJoke(term), BSOD_REVEAL_AFTER);
}

function detectCrash() {
  if (FORCE_CRASH_SCREEN) return FORCE_CRASH_SCREEN;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'mac';
  return 'linux';
}

/* Повний екран браузери дозволяють лише після дотику/кліку. Якщо зараз заборонено —
   екран помилки все одно закриває сторінку, а повний екран вмикається при першому дотику. */
function goFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  const arm = () => {
    const go = () => { try { req.call(el); } catch { /* ігноруємо */ } };
    ['pointerdown', 'touchend', 'keydown'].forEach((ev) => addEventListener(ev, go, { once: true }));
  };
  try { const p = req.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(arm); } catch { arm(); }
}

/* ===== самі екрани ===== */
function fakeQR() {
  const n = 21, cells = [];
  const finder = (x, y) => {
    const inZone = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    if (!inZone) return null;
    const ax = x > 13 ? x - 14 : x, ay = y > 13 ? y - 14 : y;
    return ax === 0 || ax === 6 || ay === 0 || ay === 6 || (ax >= 2 && ax <= 4 && ay >= 2 && ay <= 4);
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const f = finder(x, y);
    const nearFinder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
    const on = f !== null ? f : (nearFinder ? false : Math.random() < 0.5);
    if (on) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
  }
  return `<svg class="qr" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">${cells.join('')}</svg>`;
}

const SCREENS = {
  windows: () => `
    <div class="smile">:(</div>
    <p>На вашому пристрої виникла проблема, і його потрібно перезавантажити. Ми лише збираємо інформацію про помилку, а потім перезавантажимо його для вас.</p>
    <p><span class="pct">0</span>% завершено</p>
    <div class="row">${fakeQR()}
      <div><p class="small">Щоб дізнатися більше про цю проблему та можливі виправлення, відвідайте https://www.windows.com/stopcode</p>
      <p class="small">Якщо ви звернетеся до служби підтримки, повідомте їм цю інформацію:</p>
      <p class="small">Код зупинки: CRITICAL_PROCESS_DIED</p></div>
    </div>`,
  linux: () => '<pre></pre>',
  ios: () => `
    <svg viewBox="0 0 200 250" fill="none">
      <rect x="94" y="0" width="12" height="64" rx="3" fill="#bdbdbd"/>
      <rect x="84" y="64" width="32" height="38" rx="5" fill="#bdbdbd"/>
      <rect x="96" y="102" width="8" height="9" fill="#bdbdbd"/>
      <rect x="34" y="140" width="132" height="84" rx="8" stroke="#bdbdbd" stroke-width="8"/>
      <rect x="12" y="230" width="176" height="12" rx="6" fill="#bdbdbd"/>
    </svg>
    <p>support.apple.com/iphone/restore</p>`,
  android: () => `
    <h2>Ваш пристрій пошкоджено.</h2>
    <p>Йому не можна довіряти, він може працювати некоректно.</p>
    <p>Відвідайте це посилання на іншому пристрої:<br><span class="link">g.co/ABH</span></p>
    <p>Код помилки: dm-verity corruption</p>
    <div class="foot">Натисніть кнопку живлення, щоб продовжити<br>powered by android</div>`,
  mac: () => `
    <p>Потрібно перезавантажити комп’ютер. Натисніть і утримуйте кнопку живлення, доки він не вимкнеться, а потім натисніть її ще раз.</p>
    <p>You need to restart your computer. Hold down the Power button until it turns off, then press the Power button again.</p>
    <p>Sie müssen Ihren Computer neu starten. Halten Sie die Ein-/Aus-Taste gedrückt, bis er ausgeschaltet ist.</p>
    <p>Vous devez redémarrer votre ordinateur. Maintenez le bouton d’alimentation enfoncé jusqu’à extinction.</p>`,
};

function animateWindows(el) {
  const pct = el.querySelector('.pct');
  let v = 0;
  const id = setInterval(() => {
    v = Math.min(100, v + Math.ceil(rnd(1, 4)));
    pct.textContent = v;
    if (v >= 100) clearInterval(id);
  }, 800);
}

function animateLinux(el) {
  const pre = el.querySelector('pre');
  const msg = 'Kernel panic - not syncing: Attempted to kill init! exitcode=0x0000000b';
  const lines = [
    'EXT4-fs error (device sda1): ext4_find_entry:1455: inode #2: comm systemd: reading directory lblock 0',
    'rubidium_victim_base: unable to read inode block - data corrupted',
    msg,
    'CPU: 0 PID: 1 Comm: systemd Not tainted 5.15.0-91-generic #101-Ubuntu',
    'Hardware name: rubidium/victim_base, BIOS 1.0.12 11/11/2026',
    'Call Trace:',
    ' <TASK>',
    ' dump_stack_lvl+0x4a/0x63',
    ' dump_stack+0x10/0x16',
    ' panic+0x149/0x321',
    ' do_exit.cold+0x15/0x5e',
    ' do_group_exit+0x3a/0x90',
    ' __x64_sys_exit_group+0x14/0x20',
    ' do_syscall_64+0x5c/0xc0',
    ' entry_SYSCALL_64_after_hwframe+0x62/0xcc',
    ' </TASK>',
    'Kernel Offset: 0x2a000000 from 0xffffffff81000000 (relocation range: 0xffffffff80000000-0xffffffffbfffffff)',
    `---[ end ${msg} ]---`,
  ];
  let t = 11.2 + Math.random(), i = 0;
  const id = setInterval(() => {
    t += rnd(0.001, 0.02);
    pre.textContent += `[${t.toFixed(6).padStart(12, ' ')}] ${lines[i++]}\n`;
    if (i >= lines.length) clearInterval(id);
  }, 70);
}
