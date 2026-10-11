// Español: vanilla ES module, no build step. All paths are relative so it works under /spanish/ and /.
const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view'), sheet = $('#sheet'), toastEl = $('#toast');

// ---------- storage (every access guarded: private windows can throw) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('es.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('es.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
  reset() { try { Object.keys(localStorage).filter((k) => k.startsWith('es.')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } },
};
const settings = { accents: store.get('accents', true), chapter: store.get('chapter', 1) };

// ---------- data ----------
// Chapter 1's words live in vocab/phrases/verbs.json; every chapter has chN.json (lessons, drills, dialogues, new words).
const load = (f) => fetch(`data/${f}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const [vocab0, phrases0, verbs0, ...chFiles] = await Promise.all(['vocab', 'phrases', 'verbs', 'ch1', 'ch2', 'ch3'].map(load));
if (!vocab0 || !phrases0 || !verbs0) {
  view.replaceChildren(Object.assign(document.createElement('div'), {
    className: 'page center',
    innerHTML: '<h1 class="title-lg">Couldn’t load the course</h1><p class="caption">Check your connection and reload.</p><button class="btn btn-primary" onclick="location.reload()">Reload</button>',
  }));
  throw new Error('data failed to load');
}
const chapters = chFiles.filter(Boolean);
const maxCh = chapters.length || 1;
if (settings.chapter > maxCh) settings.chapter = maxCh;
const themeName = Object.assign({}, vocab0.themes, phrases0.themes, ...chapters.map((c) => c.themes || {}));
const tag = (items, ch) => items.map((i) => ({ ...i, ch }));
const allWords = [...tag(vocab0.items, 1), ...chapters.flatMap((c) => tag(c.vocab || [], c.id))];
const allPhrases = [...tag(phrases0.items, 1), ...chapters.flatMap((c) => tag(c.phrases || [], c.id))];
// A later chapter may re-declare a verb to add tenses (same infinitive): it replaces the earlier entry
// but keeps the earlier chapter number, so there is one row per verb everywhere.
const allVerbs = [...new Map([...tag(verbs0.items, 1), ...chapters.flatMap((c) => tag(c.verbs || [], c.id))]
  .reduce((m, v) => m.set(v.inf, { ...v, ch: Math.min(v.ch, m.get(v.inf)?.ch ?? v.ch) }), new Map())).values()];
const lessonsAll = chapters.flatMap((c) => (c.lessons || []).map((l) => ({ ...l, ch: c.id })));
const drillById = new Map(chapters.flatMap((c) => c.drills || []).map((d) => [d.id, d]));
const dialogueById = new Map(chapters.flatMap((c) => c.dialogues || []).map((d) => [d.id, d]));
const itemById = new Map([...allWords, ...allPhrases].map((i) => [i.id, i]));
const LEVEL = { 1: 'A1', 2: 'A1 → A2', 3: 'A2' };
const inCh = (it) => it.ch <= settings.chapter;
const poolWords = () => allWords.filter(inCh);
const poolPhrases = () => allPhrases.filter(inCh);
const poolAll = () => [...poolWords(), ...poolPhrases()];
const setChapter = (n) => { settings.chapter = n; store.set('chapter', n); };

// ---------- helpers ----------
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  n.append(...kids.flat().filter((x) => x != null && x !== false));
  return n;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function icon(name) {
  const s = document.createElementNS(SVGNS, 'svg'), u = document.createElementNS(SVGNS, 'use');
  s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true'); u.setAttribute('href', `#i-${name}`); s.append(u);
  return s;
}
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, n) => shuffle(a).slice(0, n);
const strip = (s) => s.toLowerCase().replace(/ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'ñ');
const clean = (s) => s.toLowerCase().replace(/[¿?¡!.,;:«»"]/g, '').replace(/\s+/g, ' ').trim();
const norm = (s) => (settings.accents ? strip(clean(s)) : clean(s));
const noArticle = (s) => s.replace(/^(el|la|los|las|un|una) /, '');
// accept answers with or without leading article, and ignore the "(Spain; LatAm: ...)" style notes on the EN side
const matchEs = (guess, target) => { const g = norm(guess), t = norm(target); return g === t || noArticle(g) === noArticle(t); };
const enAnswers = (en) => en.split(/ \/ |\(/)[0].split('/').map((x) => norm(x)).filter(Boolean);
const matchEn = (guess, en) => { const g = norm(guess).replace(/^(the|to|a) /, ''); return enAnswers(en).some((a) => a.replace(/^(the|to|a) /, '') === g); };
const fmt = (text) => text.split(/\*\*(.+?)\*\*/g).flatMap((part, i) => (i % 2 ? [el('strong', {}, part)]
  : part.split(/\*(.+?)\*/g).map((q, j) => (j % 2 ? el('em', {}, q) : q))));
const tokens = (sentence) => sentence.replace(/[¿?¡!.,;:]/g, '').split(/\s+/).filter(Boolean).map((w) => w.toLowerCase());
const isPhrase = (it) => it.id.startsWith('p-') || it.id.startsWith('dlg-');
const es = (text, cls = '') => el('span', { lang: 'es', class: cls }, text);

// ---------- toast & sheet ----------
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 6000);
}
toastEl.addEventListener('click', () => { toastEl.hidden = true; });
function openSheet(...nodes) {
  sheet.replaceChildren(el('div', { class: 'sheet-in' }, el('div', { class: 'handle' }), ...nodes));
  if (!sheet.open) sheet.showModal();
}
const closeSheet = () => { if (sheet.open) sheet.close(); };
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

// ---------- speech ----------
let current = null;
function speakTTS(text) {
  if (!('speechSynthesis' in window)) return toast('This browser has no speech synthesis. Pre-recorded words still work.');
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (!voices.length) return toast('No Spanish voice found on this device. Install one in your system settings (e.g. Spanish in macOS Spoken Content, or Google TTS on Android).');
  const v = voices.find((x) => x.lang.toLowerCase().replace('_', '-') === 'es-es') || voices[0];
  speechSynthesis.cancel();
  // Safari drops events right after cancel(); a short delay avoids a silent first utterance.
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = v; u.lang = v.lang; u.rate = Number($('#rate')?.value || 1);
    window.__utt = u; // keep a strong ref until it ends
    speechSynthesis.speak(u);
  }, 125);
}
/** Play pre-generated audio for an id; fall back to browser TTS if the file is missing. `auto` = not user-initiated. */
function say(id, text, { slow = false, auto = false } = {}, btn = null) {
  current?.pause();
  const a = new Audio(`audio/es/${id}${slow ? '-slow' : ''}.m4a`);
  current = a;
  if (btn) {
    a.addEventListener('play', () => btn.classList.add('is-playing'));
    for (const ev of ['ended', 'pause', 'error']) a.addEventListener(ev, () => btn.classList.remove('is-playing'));
  }
  // A failed clip fires both the 'error' event and a play() rejection: fall back exactly once,
  // and not at all if a newer click already replaced this clip (AbortError) or autoplay was blocked.
  let fell = false;
  const fallback = (e) => {
    if (fell || current !== a || e?.name === 'AbortError' || (auto && e?.name === 'NotAllowedError')) return;
    fell = true; speakTTS(text);
  };
  a.addEventListener('error', fallback, { once: true });
  a.play().catch(fallback);
  return a;
}
/** Round audio button. `fn(btn)` starts playback. */
function audioBtn(label, fn, { slow = false } = {}) {
  const b = el('button', { class: 'play' + (slow ? ' slow' : ''), type: 'button', title: slow ? 'Listen slowly' : 'Listen', 'aria-label': `${slow ? 'Listen slowly' : 'Listen'}: ${label}`,
    onclick: (e) => { e.stopPropagation(); fn(b); } }, slow ? '🐢' : icon('play'));
  return b;
}
const playBtn = (id, text, opts = {}) => audioBtn(text, (b) => say(id, text, opts, b), opts);
const stopAudio = () => { current?.pause(); try { speechSynthesis?.cancel?.(); } catch { /* ignore */ } };

// ---------- spaced repetition (Leitner) ----------
const DAY = 86400000;
const INTERVALS = [0, 1, 2, 4, 8, 16]; // days per box 0..5
const progress = () => store.get('progress', {});
function grade(id, ok) {
  const p = progress();
  const box = ok ? Math.min((p[id]?.box ?? 0) + 1, 5) : 0;
  p[id] = { box, due: Date.now() + INTERVALS[box] * DAY };
  store.set('progress', p);
}
const dueItems = (pool) => { const p = progress(), now = Date.now(); return pool.filter((i) => p[i.id] && p[i.id].due <= now); };
const freshItems = (pool) => { const p = progress(); return pool.filter((i) => !p[i.id]); };
function reviewDeck(pool) {
  const due = shuffle(dueItems(pool)).slice(0, 25);
  const freshN = due.length >= 10 ? 0 : Math.min(8, 10 - due.length);
  return shuffle([...due, ...freshItems(pool).slice(0, freshN)]);
}

// ---------- days & streak ----------
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function markDay(kind) {
  const days = store.get('days', {}), k = dayKey();
  days[k] = { ...days[k], [kind]: (days[k]?.[kind] || 0) + 1 };
  for (const old of Object.keys(days).sort().slice(0, -60)) delete days[old];
  store.set('days', days);
}
function streak() {
  const days = store.get('days', {}), c = new Date();
  if (!days[dayKey(c)]) c.setDate(c.getDate() - 1);
  let n = 0;
  while (days[dayKey(c)]) { n++; c.setDate(c.getDate() - 1); }
  return n;
}
const practisedToday = () => !!store.get('days', {})[dayKey()];
const lessonsState = () => store.get('lessons', {});
const setLesson = (id, patch) => { const st = lessonsState(); st[id] = { ...st[id], ...patch }; store.set('lessons', st); };
const lessonPhases = (l) => ['learn', ...(l.dialogue && dialogueById.has(l.dialogue) ? ['listen'] : []), 'drills'];
const nextLesson = () => { const st = lessonsState(); return lessonsAll.find((l) => (st[l.id]?.best ?? 0) < 8); };

// ---------- router ----------
const screens = {}, sessions = {};
let lastTab = store.get('tab', 'today');
if (!['today', 'course', 'library'].includes(lastTab)) lastTab = 'today';
const go = (hash) => { location.hash = hash; };
const replace = (hash) => { location.replace(hash); };
function mount(node) { view.replaceChildren(node); window.scrollTo(0, 0); }
const needsWelcome = () => !store.get('onboarded', 0) && !Object.keys(lessonsState()).length && !Object.keys(progress()).length;

function route() {
  stopAudio(); closeSheet(); toastEl.hidden = true;
  const [name, ...rest] = (location.hash.slice(1) || lastTab).split('/');
  const isSession = ['lesson', 'review', 'practice'].includes(name);
  document.body.classList.toggle('in-session', isSession);
  const tab = ['today', 'course', 'library'].includes(name) ? name : null;
  document.querySelectorAll('#tabbar a').forEach((a) => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (tab) { lastTab = tab; store.set('tab', tab); }
  if (needsWelcome() && !isSession) { screens.welcome(); document.body.classList.add('in-session'); return; }
  if (isSession) return sessions[name](...rest);
  if (screens[name]) return screens[name](...rest);
  replace('#today');
}
window.addEventListener('hashchange', route);
const exitSession = () => go('#' + lastTab);

// ---------- generic UI pieces ----------
function chips(options, value, onchange, { scroll = false, label } = {}) {
  const wrap = el('div', { class: 'chip-group' + (scroll ? ' scroll' : ''), role: 'radiogroup', 'aria-label': label });
  const draw = (v) => wrap.replaceChildren(...options.map((o) => el('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(o.value === v), disabled: o.disabled, title: o.title,
    onclick: () => { onchange(o.value); draw(o.value); } }, o.label)));
  draw(value);
  return wrap;
}
const field = (props = {}) => el('input', { class: 'field', type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', lang: 'es', ...props });
const btn = (label, onclick, kind = 'primary', extra = {}) => el('button', { class: `btn btn-${kind}` + (extra.block === false ? '' : ' btn-block'), type: 'button', onclick, disabled: extra.disabled }, label);
const focusSoon = (n) => requestAnimationFrame(() => n.focus({ preventScroll: true }));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ---------- session shell ----------
/** Full-screen guided session: header with close + segmented progress, scrolling body, sticky footer. */
function sessionShell({ weights = [1], confirm = false } = {}) {
  document.body.classList.add('in-session');
  const label = el('span', { class: 's-label', 'aria-live': 'polite' });
  const segs = weights.map((w) => el('span', { class: 'prog-seg', style: `flex-grow:${w}` }, el('b')));
  const body = el('div', { class: 's-body' }), foot = el('div', { class: 's-foot' });
  const leave = () => {
    if (!confirm) return exitSession();
    openSheet(el('h2', { class: 'title-lg', style: 'margin:0' }, 'Leave the lesson?'), el('p', { class: 'caption', style: 'margin:0' }, 'Your place is saved.'),
      btn('Keep going', closeSheet), btn('Leave', () => { closeSheet(); exitSession(); }, 'text', { }));
  };
  const root = el('div', { class: 'session' },
    el('div', { class: 's-head' }, el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: leave }, icon('close')),
      el('div', { class: 'prog', 'aria-hidden': 'true' }, segs), label), body, foot);
  mount(root);
  return {
    body, foot, leave,
    /** Replace the step content (and footer). */
    set(nodes, footNodes = []) {
      body.replaceChildren(...[nodes].flat()); foot.replaceChildren(...[footNodes].flat()); foot.className = 's-foot';
      body.style.animation = 'none'; void body.offsetWidth; body.style.animation = '';
      window.scrollTo(0, 0);
    },
    progress(seg, frac, text) {
      segs.forEach((s, i) => s.firstChild.style.setProperty('--fill', i < seg ? 1 : i === seg ? frac : 0));
      label.textContent = text || '';
    },
  };
}
document.addEventListener('keydown', (e) => {
  if (!document.body.classList.contains('in-session') || sheet.open || e.target.matches?.('input, textarea')) return;
  if (e.key === 'Escape') { $('.s-head .icon-btn')?.click(); return; }
  if (/^[1-4]$/.test(e.key)) $$opts()[Number(e.key) - 1]?.click();
});
const $$opts = () => [...document.querySelectorAll('.opts .opt:not(:disabled)')];

// ---------- exercises (shared by lessons, review, practice) ----------
const promptBlock = (s) => el('div', { class: 'prompt' },
  s.eyebrow && el('p', { class: 'eyebrow' }, s.eyebrow),
  s.listen
    ? el('div', { class: 'stack', style: 'align-items:flex-start' }, audioBtn('the word', s.listen, {}), el('span', { class: 'caption' }, 'Tap to hear it again'))
    : el('div', { class: 'prompt-line' }, el('div', { class: 'display-sm', lang: s.promptLang }, s.prompt), s.audio && audioBtn('prompt', s.audio)),
  s.hint && el('div', { class: 'caption' }, s.hint));

/**
 * One question. s: { kind: choose|type|build, eyebrow, prompt, promptLang, hint, audio(btn), listen(btn),
 * options, correct, check(guess), answers, shown, explain, sentence:{es, play(btn, auto)}, self, cont, extra }
 * `resolve(ok)` is called when the learner presses Continue.
 */
function exercise(sh, s, resolve) {
  let settled = false, ok = false;
  const reveal = (result, shown) => {
    if (settled) return; settled = true; ok = result;
    const head = el('div', { class: 'fb-head' }, icon(ok ? 'check' : 'close'), ok ? '¡Correcto!' : 'Not quite');
    const panel = el('div', { class: 'fb-panel ' + (ok ? 'good' : 'bad'), role: 'status' }, head);
    if (!ok) panel.append(el('div', { class: 'fb-answer', lang: 'es' }, shown ?? s.shown));
    if (s.explain) panel.append(el('div', {}, s.explain));
    if (s.sentence) panel.append(el('div', { class: 'fb-sentence' }, audioBtn(s.sentence.es, (b) => s.sentence.play(b)), el('span', { lang: 'es', class: 'title-sm' }, s.sentence.es)));
    if (s.extra) panel.append(s.extra());
    const cont = btn(s.cont || 'Continue', () => resolve(ok));
    const actions = el('div', { class: 'fb-actions' }, cont);
    if (s.self && !ok) {
      const mine = btn('I was right', () => { ok = true; panel.className = 'fb-panel good'; head.replaceChildren(icon('check'), 'Counted as correct'); mine.remove(); focusSoon(cont); }, 'secondary');
      actions.prepend(mine);
    }
    panel.append(actions);
    sh.foot.className = 's-foot fb'; sh.foot.replaceChildren(panel);
    focusSoon(cont);
    s.sentence?.play(null, true);
  };
  const parts = [promptBlock(s)];
  let footer = [];
  if (s.kind === 'choose') {
    const bs = s.options.map((label, i) => el('button', { class: 'opt', type: 'button', onclick: () => {
      const good = label === s.correct, b = bs[i];
      bs.forEach((x) => { x.disabled = true; x.classList.add('is-dim'); });
      b.classList.remove('is-dim'); b.classList.add(good ? 'is-right' : 'is-wrong'); b.append(el('span', { class: 'glyph' }, good ? '✓' : '✗'));
      if (!good) { const r = bs.find((x) => x.dataset.label === s.correct); r.classList.remove('is-dim'); r.classList.add('is-right'); r.append(el('span', { class: 'glyph' }, '✓')); }
      reveal(good);
    } }, el('span', { class: 'num' }, String(i + 1)), el('span', { lang: s.optLang }, label)));
    bs.forEach((x, i) => { x.dataset.label = s.options[i]; });
    parts.push(el('div', { class: 'opts' }, bs));
  } else if (s.kind === 'type') {
    const input = field({ 'aria-label': 'Your answer' });
    const submit = () => {
      if (settled || !input.value.trim()) return;
      input.disabled = true;
      const good = s.check(input.value);
      input.classList.add(good ? 'is-right' : 'is-wrong'); reveal(good);
    };
    const check = btn('Check', submit, 'primary', { disabled: true });
    input.addEventListener('input', () => { check.disabled = !input.value.trim(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    parts.push(el('div', { class: 'stack', style: 'gap:8px' }, input, settings.accents && el('span', { class: 'caption ink-3' }, 'Accents are forgiven.')));
    if (s.table) parts.push(s.table());
    footer = [check]; focusSoon(input);
  } else { // build
    const target = tokens(s.answers[0]);
    let bank = shuffle(target.map((w, k) => ({ w, k })));
    if (bank.map((x) => x.w).join(' ') === target.join(' ')) bank = bank.reverse();
    const chosen = [];
    const lineEl = el('div', { class: 'line', 'aria-label': 'Your sentence' }), bankEl = el('div', { class: 'bank' });
    const check = btn('Check', () => {
      const got = chosen.map((t) => t.w).join(' ');
      const good = s.answers.some((a) => norm(tokens(a).join(' ')) === norm(got));
      draw(); reveal(good);
    }, 'primary', { disabled: true });
    const tile = (t, from, to) => el('button', { class: 'tile', type: 'button', disabled: settled, onclick: () => { from.splice(from.indexOf(t), 1); to.push(t); draw(); } }, t.w);
    const draw = () => {
      lineEl.replaceChildren(...chosen.map((t) => tile(t, chosen, bank)));
      bankEl.replaceChildren(...bank.map((t) => tile(t, bank, chosen)));
      check.disabled = settled || !chosen.length;
    };
    draw();
    parts.push(lineEl, bankEl); footer = [check];
  }
  sh.set(parts, footer);
}

/** Flip card. resolve(ok) is called straight from Again / Got it. */
function flipCard(sh, it, dir, resolve, eyebrow) {
  const front = dir === 'es-en' ? it.es : it.en, back = dir === 'es-en' ? it.en : it.es;
  const face = (txt, cls, lang) => el('div', { class: `face ${cls}`, 'aria-hidden': cls === 'back' ? 'true' : null },
    cls === 'front' && eyebrow && el('p', { class: 'eyebrow' }, eyebrow), el('div', { class: 'display-sm', lang }, txt),
    cls === 'front' ? el('span', { class: 'caption ink-3' }, 'Tap to flip') : el('span', { class: 'caption' }, themeName[it.t] || ''));
  let flipped = false;
  const card = el('button', { class: 'flash', type: 'button', 'aria-label': `Flip card. ${front}`, onclick: flip },
    el('div', { class: 'flash-in' }, face(front, 'front', dir === 'es-en' ? 'es' : 'en'), face(back, 'back', dir === 'es-en' ? 'en' : 'es')));
  const audio = el('div', { class: 'row', style: 'justify-content:center' }, playBtn(it.id, it.es), isPhrase(it) && playBtn(it.id, it.es, { slow: true }));
  const showBtn = btn('Show answer', flip);
  function flip() {
    if (flipped) return; flipped = true;
    card.classList.add('is-flipped'); card.setAttribute('aria-label', `Answer: ${back}`); card.querySelector('.back').removeAttribute('aria-hidden');
    sh.foot.replaceChildren(el('div', { class: 'fb-actions' }, btn('Again', () => resolve(false), 'again'), btn('Got it', () => resolve(true), 'got')));
    $('.btn-got', sh.foot)?.focus();
    say(it.id, it.es);
  }
  sh.set([card, audio], [showBtn]);
  if (dir === 'es-en') say(it.id, it.es, { auto: true });
  focusSoon(card);
}

/** Finish screen shared by lessons, reviews and practice. */
function finishScreen(sh, { title, big, sub, lines = [], misses = [], missLabel = 'Missed', primary, secondary, tertiary }) {
  const parts = [el('div', { class: 's-body done-wrap', style: 'padding:0' },
    el('h1', { class: 'display' }, title), big && el('div', { class: 'display-xl', style: 'color:var(--accent)' }, big), sub && el('div', { class: 'caption' }, sub),
    ...lines.filter(Boolean).map((l) => el('div', { class: 'caption' }, l)),
    misses.length ? el('div', { class: 'stack', style: 'align-items:center' }, el('p', { class: 'eyebrow' }, missLabel),
      el('div', { class: 'chips-miss' }, misses.map((m) => el('button', { class: 'miss', type: 'button', lang: 'es', onclick: () => m.play() }, icon('play'), m.es)))) : null)];
  sh.progress(99, 1, '');
  sh.set(parts, [primary && btn(primary.label, primary.fn), secondary && btn(secondary.label, secondary.fn, 'secondary'), tertiary && btn(tertiary.label, tertiary.fn, 'text')]);
  $('.btn-primary', sh.foot)?.focus();
}
const streakLine = () => (streak() >= 2 ? `🔥 ${streak()}-day streak` : '');

/** Run n steps of an exercise-producing function; onDone(score, misses). */
function runSteps(sh, { n, seg = 0, label, make, onDone }) {
  let i = 0, score = 0; const misses = [];
  const step = () => {
    if (i >= n) { sh.progress(seg, 1, label(n - 1)); return onDone(score, misses); }
    sh.progress(seg, i / n, label(i));
    make(i, (ok, miss) => { if (ok) score++; else if (miss) misses.push(miss); i++; step(); });
  };
  step();
}

// ---------- screens: welcome ----------
screens.welcome = () => {
  let pickCh = 1;
  const list = el('div', { class: 'stack', role: 'radiogroup', 'aria-label': 'Starting chapter' });
  const draw = () => list.replaceChildren(...chapters.map((c) => el('button', { class: 'radio-card', type: 'button', role: 'radio', 'aria-checked': String(c.id === pickCh), onclick: () => { pickCh = c.id; draw(); } },
    el('span', { class: 'rd' }), el('span', {}, el('span', { class: 'title' }, `Chapter ${c.id}`), el('br'), el('span', { class: 'caption' }, `${c.title} · ${LEVEL[c.id] || ''}`)))));
  draw();
  mount(el('div', { class: 'page', style: 'padding-top:max(48px,10vh)' },
    el('h1', { class: 'display' }, '¡Hola!'),
    el('p', { class: 'body-lg ink-2', style: 'margin:0' }, `${lessonsAll.length} short lessons in ${chapters.length} chapters. Spain Spanish. Five minutes a day.`),
    el('p', { class: 'eyebrow', style: 'margin-top:16px' }, 'Where do you want to start?'), list,
    btn('Start learning', () => {
      store.set('onboarded', pickCh); setChapter(pickCh);
      const first = lessonsAll.find((l) => l.ch === pickCh);
      document.body.classList.remove('in-session');
      go(first ? `#lesson/${first.id}` : '#today');
      if (location.hash === `#lesson/${first?.id}`) route();
    })));
};

// ---------- screens: today ----------
const settingsBtn = () => el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Settings', onclick: settingsSheet }, icon('gear'));
screens.today = () => {
  const h = new Date().getHours(), greeting = h >= 5 && h < 12 ? 'Buenos días' : h >= 12 && h < 20 ? 'Buenas tardes' : 'Buenas noches';
  const st = lessonsState(), nxt = nextLesson();
  const resume = lessonsAll.find((l) => st[l.id]?.at);
  const cur = resume || nxt;
  const page = el('div', { class: 'page' },
    el('div', { class: 'page-head greet' }, el('div', {}, el('h1', { class: 'display-sm', lang: 'es' }, greeting),
      el('div', { class: 'caption ink-3' }, new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))), settingsBtn()));
  // continue card
  if (cur) {
    const at = st[cur.id]?.at, phases = lessonPhases(cur), names = { learn: 'Learn', listen: 'Listen', drills: 'Practise' };
    const idx = at ? phases.indexOf(at.phase) : -1;
    const started = at || (st[cur.id]?.best != null);
    const eyebrow = (at ? 'Continue' : started ? 'Repeat' : 'Next') + ` · Chapter ${cur.ch}`;
    page.append(el('div', { class: 'card hero' },
      el('p', { class: 'eyebrow accent' }, eyebrow), el('h2', { class: 'title-lg hero-title' }, cur.title), el('div', { class: 'ink-2' }, cur.summary),
      el('div', { class: 'row', style: 'margin-top:12px' }, el('div', { class: 'pips' }, phases.map((_, i) => el('i', { class: i < idx ? 'done' : i === idx ? 'cur' : '' }))),
        el('span', { class: 'caption ink-3' }, phases.map((p) => names[p]).join(' · '))),
      btn(el('span', {}, at ? 'Continue lesson' : started ? 'Practise again' : 'Start lesson'), () => go(`#lesson/${cur.id}`))));
  } else {
    page.append(el('div', { class: 'card hero' }, el('p', { class: 'eyebrow accent' }, 'Course complete 🎉'), el('h2', { class: 'title-lg hero-title' }, 'You finished every lesson.'),
      el('div', { class: 'ink-2' }, 'Review keeps it fresh.'), btn('Open course', () => go('#course'), 'secondary')));
  }
  // review card
  const pool = poolAll(), due = dueItems(pool).length, unseen = freshItems(pool).length;
  if (due > 0) {
    const mins = Math.ceil(Math.min(due, 25) * 15 / 60);
    page.append(el('div', { class: 'card' }, el('div', { class: 'row spread' }, el('div', {},
      el('h2', { class: 'title', style: 'margin:0' }, 'Review'), el('div', { class: 'caption' }, `${plural(due, 'card')} due${mins >= 1 ? ` · about ${mins} min` : ''}`)),
      btn(el('span', {}, 'Review'), () => go('#review'), cur ? 'secondary' : 'primary', { block: false }))));
  } else if (unseen > 0) {
    page.append(el('div', { class: 'card' }, el('div', { class: 'row spread' }, el('div', {},
      el('h2', { class: 'title', style: 'margin:0' }, 'Review'), el('div', { class: 'caption' }, `Nothing due · learn ${Math.min(8, unseen)} new words`)),
      btn('Learn new', () => go('#review'), 'secondary', { block: false }))));
  } else {
    page.append(el('div', { class: 'card muted' }, el('div', { class: 'row spread' }, el('div', {},
      el('h2', { class: 'title', style: 'margin:0' }, 'All caught up'), el('div', { class: 'caption' }, 'Next cards tomorrow.')),
      btn('Practise anyway', practiceSheet, 'secondary', { block: false }))));
  }
  // caption row
  const p = progress(), done = lessonsAll.filter((l) => (st[l.id]?.best ?? 0) >= 8).length, known = allWords.filter((w) => (p[w.id]?.box ?? 0) >= 3).length;
  const n = streak();
  page.append(el('div', { class: 'stat-line' },
    n >= 2 ? el('span', { class: 'flame' }, icon('flame'), `${n}-day streak`) : practisedToday() ? el('span', { class: 'flame' }, icon('check'), 'Practised today') : null,
    el('span', {}, `${done} of ${lessonsAll.length} lessons`), known ? el('span', {}, `${plural(known, 'word')} at box 3+`) : null),
  el('div', {}, el('button', { class: 'btn btn-text', type: 'button', style: 'padding-left:0', onclick: practiceSheet }, 'More practice ›')));
  mount(page);
};

// ---------- screens: course ----------
screens.course = () => {
  const st = lessonsState(), nxt = nextLesson();
  const page = el('div', { class: 'page' }, el('h1', { class: 'title-lg' }, 'Course'));
  for (const c of chapters) {
    const ls = lessonsAll.filter((l) => l.ch === c.id);
    page.append(el('div', { class: 'chapter-head' }, el('p', { class: 'eyebrow' }, `Chapter ${c.id} · ${LEVEL[c.id] || ''}`), el('h2', { class: 'title' }, c.title),
      el('div', { class: 'caption', style: 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden' }, c.canDo.join(', ')),
      el('div', { class: 'dots', 'aria-hidden': 'true' }, ls.map((l) => el('i', { class: (st[l.id]?.best ?? 0) >= 8 ? 'done' : '' })))));
    for (const l of ls) {
      const s = st[l.id] || {}, best = s.best, isDone = (best ?? 0) >= 8, isNext = l === nxt, retry = best != null && !isDone;
      const mark = el('span', { class: 'mark' }, isDone || isNext ? icon(isNext ? 'chevron' : 'check') : retry ? '↻' : '');
      const node = el('button', { class: 'node' + (isDone ? ' is-done' : '') + (isNext ? ' is-next' : '') + (retry ? ' is-retry' : ''), type: 'button', onclick: () => go(`#lesson/${l.id}`) },
        mark, el('span', { class: 'grow' }, el('span', { class: isNext ? 'title-sm' : '', style: isNext ? '' : 'font-weight:500' }, l.title), s.at ? el('span', { class: 'ink-3 caption' }, ' · in progress') : null,
          isNext ? el('div', { class: 'caption', style: 'font-weight:400' }, l.summary) : null),
        best != null ? el('span', { class: 'score' }, `${best}/10`) : null,
        isNext ? el('span', { class: 'btn btn-primary', style: 'min-height:44px;width:100%;margin-top:8px' }, s.at ? 'Continue' : 'Start') : null);
      page.append(node);
    }
  }
  mount(page);
  $('.is-next', page)?.scrollIntoView({ block: 'center' });
};

// ---------- lesson session ----------
sessions.lesson = (id) => {
  const l = lessonsAll.find((x) => x.id === id);
  if (!l) return replace('#course');
  if (l.ch > settings.chapter) setChapter(l.ch);
  const dlg = l.dialogue && dialogueById.get(l.dialogue);
  const drillIds = shuffle(l.drills).slice(0, 10).filter((d) => drillById.has(d));
  const nCards = l.cards.length, nDrills = Math.max(1, drillIds.length);
  const weights = dlg ? [nCards, 1, nDrills] : [nCards, nDrills];
  const seg = { learn: 0, listen: dlg ? 1 : -1, drills: dlg ? 2 : 1 };
  const sh = sessionShell({ weights, confirm: true });
  const saved = lessonsState()[id]?.at;
  setLesson(id, { read: lessonsState()[id]?.read || Date.now() });
  const setAt = (phase, i = 0) => setLesson(id, { at: { phase, i } });

  const exRow = (e, auto) => {
    const row = el('div', { class: 'ex' }, playBtn(e.id, e.es), el('div', { class: 'grow' }, el('div', { class: 'title-sm', lang: 'es' }, e.es), el('div', { class: 'caption' }, e.en)));
    return row;
  };
  const learn = (i) => {
    setAt('learn', i);
    const c = l.cards[i], last = i === nCards - 1;
    sh.progress(seg.learn, i / nCards, `Learn ${i + 1} of ${nCards}`);
    sh.set([
      el('div', { class: 'caption ink-3' }, l.title),
      el('div', { class: 'card stack', style: 'gap:14px' }, el('p', { class: 'body-lg', style: 'margin:0' }, fmt(c.rule)),
        el('div', {}, (c.examples || []).map((e) => exRow(e))),
        c.trap && el('div', { class: 'panel trap' }, el('strong', { style: 'color:inherit' }, '⚠ Trap '), fmt(c.trap)),
        c.note && el('div', { class: 'panel note' }, 'ℹ ', fmt(c.note)))],
    [btn(last ? (dlg ? 'Listen to the dialogue →' : 'Practise →') : 'Next →', () => (last ? (dlg ? listen() : drills()) : learn(i + 1)))]);
    if (i > 0 && c.examples?.[0]) say(c.examples[0].id, c.examples[0].es, { auto: true });
    $('.s-foot .btn', sh.foot) && focusSoon($('.btn', sh.foot));
  };
  const listen = () => {
    setAt('listen');
    sh.progress(seg.listen, 0, 'Listen');
    let run = 0, showEn = false;
    const lines = dlg.lines.map((ln) => el('div', { class: 'dlg-line' }, el('span', { class: 'who' + (ln.who === 'A' ? '' : ' b') }, ln.who),
      el('div', { class: 'grow' }, el('div', { class: 'title-sm', lang: 'es', style: 'font-weight:500' }, ln.es), el('div', { class: 'en' }, ln.en)),
      el('div', { class: 'btns' }, playBtn(ln.id, ln.es), playBtn(ln.id, ln.es, { slow: true }))));
    const list = el('div', { class: 'stack', style: 'gap:4px' }, lines);
    list.classList.add('hide-en');
    const enBtn = el('button', { class: 'btn btn-text', type: 'button', style: 'align-self:center', onclick: () => { showEn = !showEn; list.classList.toggle('hide-en', !showEn); enBtn.textContent = showEn ? 'Hide English' : 'Show English'; } }, 'Show English');
    const playAll = el('button', { class: 'btn btn-secondary btn-block', type: 'button' }, icon('play'), 'Play all');
    const setIdle = () => playAll.replaceChildren(icon('play'), 'Play all');
    playAll.onclick = async () => {
      if (playAll.dataset.on) { run++; delete playAll.dataset.on; current?.pause(); lines.forEach((x) => x.classList.remove('is-now')); setIdle(); return; }
      const my = ++run; playAll.dataset.on = '1'; playAll.replaceChildren(icon('pause'), 'Pause');
      for (let k = 0; k < dlg.lines.length; k++) {
        lines.forEach((x, j) => x.classList.toggle('is-now', j === k)); lines[k].scrollIntoView({ block: 'center', behavior: 'smooth' });
        const a = new Audio(`audio/es/${dlg.lines[k].id}.m4a`); current = a;
        await new Promise((res) => { a.onended = res; a.onerror = res; a.onpause = res; a.play().catch(res); });
        if (my !== run || current !== a) return;
        await new Promise((r) => setTimeout(r, 250));
        if (my !== run) return;
      }
      lines.forEach((x) => x.classList.remove('is-now')); delete playAll.dataset.on; setIdle();
      if (!showEn) enBtn.click();
    };
    sh.set([el('h2', { class: 'title-lg', style: 'margin:0' }, dlg.title), el('div', { class: 'ink-2', style: 'margin-top:-8px' }, 'Listen once, then read along.'), playAll, list, enBtn],
      [btn('Practise →', () => { run++; drills(); })]);
    sh.progress(seg.listen, 1, 'Listen');
  };
  const drills = () => {
    setAt('drills');
    const label = (i) => `Practise ${Math.min(i + 1, nDrills)}/${nDrills}`;
    runSteps(sh, { n: drillIds.length, seg: seg.drills, label, onDone: (score, misses) => done(score, drillIds.length, misses),
      make: (i, resolve) => {
        const d = drillById.get(drillIds[i]), last = i === drillIds.length - 1;
        const sentence = { es: d.full.es, play: (b, auto) => say(d.full.id, d.full.es, { auto }, b) };
        const base = { eyebrow: { gap: 'Fill the gap', choose: 'Choose', build: 'Build the sentence', translate: 'Translate' }[d.type], prompt: d.prompt, hint: d.hint,
          explain: d.explain, sentence, shown: d.answer[0], cont: last ? 'Finish' : 'Continue', promptLang: d.type === 'gap' ? 'es' : null };
        const miss = { es: d.full.es, play: () => say(d.full.id, d.full.es) };
        const res = (ok) => resolve(ok, miss);
        if (d.type === 'choose') exercise(sh, { ...base, kind: 'choose', options: shuffle(d.options), correct: d.answer[0], optLang: 'es' }, res);
        else if (d.type === 'build') exercise(sh, { ...base, kind: 'build', answers: d.answer }, res);
        else exercise(sh, { ...base, kind: 'type', check: (g) => d.answer.some((a) => matchEs(g, a)), self: d.type === 'translate' }, res);
      } });
  };
  const done = (score, total, misses) => {
    const pct = score / total, best10 = Math.round(pct * 10), prev = lessonsState()[id] || {};
    setLesson(id, { best: Math.max(prev.best ?? 0, best10), done: prev.done || (best10 >= 8 ? Date.now() : undefined), at: null });
    markDay('lesson');
    const idx = lessonsAll.indexOf(l), nxt = lessonsAll[idx + 1];
    const again = { label: 'Practise again', fn: () => { shuffle(l.drills); replace(`#lesson/${id}`); route(); } };
    const next = nxt ? { label: 'Next lesson →', fn: () => { replace(`#lesson/${nxt.id}`); } } : { label: 'Back to Course', fn: () => go('#course') };
    finishScreen(sh, { title: pct >= 0.8 ? '¡Muy bien!' : 'Casi', big: `${score} / ${total}`, sub: `Best so far: ${Math.max(prev.best ?? 0, best10)}/10`,
      lines: [`✓ Learn${dlg ? ' · ✓ Listen' : ''} · ✓ Practise`, streakLine()], misses,
      primary: pct >= 0.8 ? next : again, secondary: pct >= 0.8 ? null : next, tertiary: { label: 'Back to Today', fn: () => go('#today') } });
  };
  // resume where the learner left off
  if (saved?.phase === 'drills') drills();
  else if (saved?.phase === 'listen' && dlg) listen();
  else learn(saved?.phase === 'learn' ? Math.min(saved.i, nCards - 1) : 0);
};

// ---------- review session ----------
sessions.review = () => {
  const pool = poolAll();
  let st = store.get('review', null);
  if (!st || st.day !== dayKey() || st.i >= st.ids.length || !st.ids.every((x) => itemById.has(x))) {
    st = { day: dayKey(), ids: reviewDeck(pool).map((x) => x.id), i: 0, graded: {}, right: 0, wrong: [] };
  }
  if (!st.ids.length) { toast('Nothing to review right now.'); return replace('#today'); }
  store.set('review', st);
  const sh = sessionShell({ confirm: true });
  const optsFor = (it, key) => {
    const same = pool.filter((x) => x.id !== it.id && isPhrase(x) === isPhrase(it));
    const theme = same.filter((x) => x.t === it.t);
    const ds = pick(theme.length >= 3 ? theme : same, 3);
    return shuffle([it, ...ds]).map((x) => x[key]);
  };
  const finish = () => {
    store.set('review', null); markDay('review');
    const total = Object.keys(st.graded).length, p = progress(), now = Date.now();
    const later = pool.filter((i) => p[i.id] && p[i.id].due > now).map((i) => p[i.id].due).sort((a, b) => a - b);
    const days = later.length ? Math.max(1, Math.ceil((later[0] - now) / DAY)) : 0;
    const count = later.filter((d) => d <= now + days * DAY).length;
    const more = dueItems(pool).length;
    finishScreen(sh, { title: '¡Hecho!', big: `${st.right} / ${total}`, sub: 'right first time',
      lines: [days ? `Next review: ${days === 1 ? 'tomorrow' : `in ${days} days`} · ${plural(count, 'card')}` : '', streakLine()],
      misses: st.wrong.map((x) => itemById.get(x)).map((it) => ({ es: it.es, play: () => say(it.id, it.es) })), missLabel: 'Tricky',
      primary: { label: 'Back to Today', fn: () => go('#today') }, secondary: more ? { label: `Review ${Math.min(more, 25)} more`, fn: () => { route(); } } : null });
  };
  const step = () => {
    if (st.i >= st.ids.length) { sh.progress(0, 1, ''); return finish(); }
    const it = itemById.get(st.ids[st.i]), box = progress()[it.id]?.box;
    sh.progress(0, st.i / st.ids.length, `${st.i + 1} of ${st.ids.length}`);
    const resolve = (ok) => {
      if (!(it.id in st.graded)) {
        grade(it.id, ok); st.graded[it.id] = ok ? 1 : 0;
        if (ok) st.right++; else { st.wrong.push(it.id); st.ids.push(it.id); }
      }
      st.i++; store.set('review', st); step();
    };
    const theme = themeName[it.t] || '';
    const sentence = { es: it.es, play: (b, auto) => say(it.id, it.es, { auto }, b) };
    const base = { sentence, shown: it.es, explain: theme, promptLang: null };
    const aud = (b) => say(it.id, it.es, {}, b);
    if (!box) return flipCard(sh, it, 'es-en', resolve, (box === undefined && !(it.id in st.graded) ? 'New · ' : 'Review · ') + theme);
    if (box === 1) return exercise(sh, { ...base, kind: 'choose', eyebrow: 'What does it mean?', prompt: it.es, promptLang: 'es', audio: aud, options: optsFor(it, 'en'), correct: it.en, shown: it.en }, resolve);
    if (box === 2) { setTimeout(() => say(it.id, it.es, { auto: true }), 150); return exercise(sh, { ...base, kind: 'choose', eyebrow: 'Listen', listen: aud, options: optsFor(it, 'en'), correct: it.en, shown: it.en }, resolve); }
    if (box === 3) return exercise(sh, { ...base, kind: 'choose', eyebrow: 'Say it in Spanish', prompt: it.en, options: optsFor(it, 'es'), correct: it.es, optLang: 'es' }, resolve);
    if (box === 4) return exercise(sh, { ...base, kind: 'type', eyebrow: 'Type it in Spanish', prompt: it.en, check: (g) => matchEs(g, it.es) }, resolve);
    setTimeout(() => say(it.id, it.es, { auto: true }), 150);
    return exercise(sh, { ...base, kind: 'type', eyebrow: 'Dictation', listen: aud, check: (g) => matchEs(g, it.es) }, resolve);
  };
  step();
};

// ---------- verbs (shared by library and practice) ----------
const TENSES = { pres: 'Present', pret: 'Past (indefinido)', imp: 'Past (imperfect)', perf: 'Present perfect' };
const TENSE_CHIP = { pres: 'Present', pret: 'Indefinido', imp: 'Imperfect', perf: 'Perfect' };
const SUBJ = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'], HABER = ['he', 'has', 'ha', 'hemos', 'habéis', 'han'];
const hasTense = (v, t) => t === 'pres' || (t === 'perf' ? !!v.tenses?.part : !!v.tenses?.[t]);
const formsOf = (v, t) => (t === 'pres' ? v.forms : t === 'perf' ? HABER.map((h) => `${h} ${v.tenses.part}`) : v.tenses[t]);
const spoken = (v, t, k) => (v.type === 'reflexive' && t === 'pres' ? formsOf(v, t)[k] : `${SUBJ[k]} ${formsOf(v, t)[k]}`);
const hear = (v, t, k, b) => (t === 'pres' ? say(`${v.id}-${k}`, spoken(v, t, k), {}, b) : t === 'pret' ? say(`${v.id}-pret-${k}`, spoken(v, t, k), {}, b) : speakTTS(spoken(v, t, k)));
const verbTable = (v, t) => el('table', { class: 'vtable' }, el('tbody', {}, verbs0.pronouns.map((p, k) =>
  el('tr', {}, el('th', { scope: 'row', lang: 'es' }, p), el('td', { class: 'f', lang: 'es' }, formsOf(v, t)[k]), el('td', { class: 'a' }, audioBtn(formsOf(v, t)[k], (b) => hear(v, t, k, b)))))));
const verbFamily = (v) => (v.type.startsWith('reflexive') ? 'Reflexive' : v.type.startsWith('stem') ? 'Stem-changing' : v.type.startsWith('irregular') ? 'Irregular' : 'Regular');

// ---------- library ----------
screens.library = (seg, extra) => {
  seg = ['words', 'phrases', 'verbs', 'say'].includes(seg) ? seg : store.get('lib', 'words');
  store.set('lib', seg);
  if (seg === 'verbs' && extra) return verbPage(extra);
  const top = el('div', { class: 'lib-top' }, el('h1', { class: 'title-lg', style: 'margin:0' }, 'Library'),
    el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Library section' }, [['words', 'Words'], ['phrases', 'Phrases'], ['verbs', 'Verbs'], ['say', 'Say it']].map(([k, n]) =>
      el('button', { type: 'button', role: 'radio', 'aria-checked': String(k === seg), onclick: () => replace(`#library/${k}`) }, n))));
  const page = el('div', { class: 'page' }, top);
  const body = el('div', { class: 'stack', style: 'gap:0' });
  if (seg === 'say') {
    const ta = el('textarea', { class: 'field', 'aria-label': 'Spanish text', lang: 'es', placeholder: 'Type or paste Spanish text here…' }, store.get('say', 'Hola, me llamo Coos. ¿Cómo estás?'));
    const rate = el('input', { type: 'range', id: 'rate', min: '0.5', max: '1.3', step: '0.1', value: '0.9', 'aria-label': 'Speed', style: 'flex:1' });
    page.append(el('p', { class: 'caption', style: 'margin:0' }, 'Speaks any text with your device’s Spanish voice (the browser’s built-in speech). Quality depends on the voices installed on your system.'),
      ta, el('label', { class: 'row caption' }, 'Speed', rate), btn(el('span', {}, 'Speak'), () => { store.set('say', ta.value); speakTTS(ta.value); }));
    return mount(page);
  }
  const search = field({ type: 'search', placeholder: seg === 'verbs' ? 'Search a verb' : 'Search Spanish or English', 'aria-label': 'Search', lang: null });
  top.append(search);
  const p = progress();
  const draw = () => {
    const term = search.value.trim().toLowerCase(), t = strip(term);
    const hit = (x, en, esT) => !term || strip(esT).includes(t) || en.toLowerCase().includes(term);
    if (seg === 'verbs') {
      const items = allVerbs.filter((v) => hit(v, v.en, v.inf));
      const out = [btn('Drill verbs →', () => go('#practice/verbs'), 'secondary')];
      for (const fam of ['Regular', 'Irregular', 'Stem-changing', 'Reflexive']) {
        const g = items.filter((v) => verbFamily(v) === fam);
        if (!g.length) continue;
        out.push(el('p', { class: 'eyebrow group-head' }, fam), ...g.map((v) => el('button', { class: 'verb-row', type: 'button', onclick: () => go(`#library/verbs/${v.id}`) },
          el('span', { class: 'grow' }, el('span', { class: 'title-sm', lang: 'es' }, v.inf), el('span', { class: 'caption' }, `  ${v.en}`)), el('span', { class: 'caption ink-3' }, `CH ${v.ch}`), icon('chevron'))));
      }
      body.replaceChildren(...(items.length ? out : [el('p', { class: 'caption' }, `Nothing found for “${search.value}”.`)]));
      return;
    }
    const src = seg === 'words' ? allWords : allPhrases, items = src.filter((x) => hit(x, x.en, x.es));
    const keys = [...new Set(items.map((x) => x.t))].sort((a, b) => Math.min(...items.filter((x) => x.t === a).map((x) => x.ch)) - Math.min(...items.filter((x) => x.t === b).map((x) => x.ch)));
    const out = [];
    for (const k of keys) {
      const g = items.filter((x) => x.t === k), chs = [...new Set(g.map((x) => x.ch))];
      out.push(el('p', { class: 'eyebrow group-head' }, `${themeName[k] || k} · CH ${chs.length > 1 ? `${Math.min(...chs)}–${Math.max(...chs)}` : chs[0]}`));
      for (const x of g) {
        const box = p[x.id]?.box, status = box >= 3 ? 'good' : box >= 1 ? 'gold' : 'none';
        const row = el('div', { class: 'lib-item' }, playBtn(x.id, x.es), el('button', { class: 'txt', type: 'button', onclick: () => toggle(x, row) },
          el('span', { class: 'es', lang: 'es' }, x.es), el('span', { class: 'en' }, x.en)),
        isPhrase(x) && playBtn(x.id, x.es, { slow: true }), el('span', { class: `dot ${status}`, title: status === 'good' ? 'Learned' : status === 'gold' ? 'Learning' : 'Not reviewed yet', 'aria-label': status === 'good' ? 'Learned' : status === 'gold' ? 'Learning' : 'Not reviewed yet' }));
        out.push(row);
      }
    }
    body.replaceChildren(...(out.length ? out : [el('p', { class: 'caption' }, `Nothing found for “${search.value}”.`)]));
  };
  const toggle = (x, row) => {
    if (row.nextSibling?.classList?.contains('detail')) return row.nextSibling.remove();
    const pr = progress()[x.id], d = pr ? Math.ceil((pr.due - Date.now()) / DAY) : 0;
    const info = pr ? `Box ${pr.box} · ${d <= 0 ? 'due now' : `next review in ${plural(d, 'day')}`}` : 'Not reviewed yet';
    const known = btn('Mark as known', () => { const q = progress(); q[x.id] = { box: 3, due: Date.now() + INTERVALS[3] * DAY }; store.set('progress', q); draw(); toast(`“${x.es}” marked as known.`); }, 'text', { block: false });
    row.after(el('div', { class: 'detail' }, el('span', {}, info), (pr?.box ?? 0) < 3 && known));
  };
  search.addEventListener('input', draw);
  draw();
  page.append(body);
  mount(page);
};
function verbPage(id) {
  const v = allVerbs.find((x) => x.id === id);
  if (!v) return replace('#library/verbs');
  let t = 'pres';
  const tableBox = el('div');
  const tenseBar = el('div');
  const draw = () => {
    tenseBar.replaceChildren(chips(Object.keys(TENSES).filter((k) => hasTense(v, k)).map((k) => ({ value: k, label: TENSE_CHIP[k] })), t, (x) => { t = x; draw(); }, { label: 'Tense' }));
    tableBox.replaceChildren(verbTable(v, t));
  };
  draw();
  mount(el('div', { class: 'page' },
    el('div', { class: 'row' }, el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to verbs', onclick: () => replace('#library/verbs') }, icon('back')),
      el('div', {}, el('h1', { class: 'title-lg', lang: 'es' }, v.inf), el('div', { class: 'caption' }, `${v.en} · ${v.type}`))),
    tenseBar, el('div', { class: 'card', style: 'padding:4px 12px' }, tableBox),
    btn('Drill this verb →', () => { store.set('verbs', { tense: t, verb: v.id }); go('#practice/verbs'); })));
}

// ---------- settings & practice sheets ----------
function settingsSheet() {
  const accents = el('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(settings.accents), 'aria-label': 'Forgive missing accents',
    onclick: () => { settings.accents = !settings.accents; store.set('accents', settings.accents); accents.setAttribute('aria-checked', String(settings.accents)); } });
  const sel = el('select', { class: 'select', 'aria-label': 'Review words up to chapter', onchange: () => setChapter(Number(sel.value)) },
    chapters.map((c) => el('option', { value: String(c.id) }, `Chapter ${c.id}`)));
  sel.value = String(settings.chapter);
  const reset = () => openSheet(el('h2', { class: 'title-lg', style: 'margin:0' }, 'Delete all progress?'), el('p', { class: 'caption', style: 'margin:0' }, 'This removes lessons, review history and streak from this device.'),
    btn('Cancel', closeSheet, 'secondary'), btn('Delete', () => { store.reset(); closeSheet(); location.hash = ''; location.reload(); }, 'text'));
  openSheet(el('h2', { class: 'title-lg', style: 'margin:0' }, 'Settings'),
    el('div', { class: 'set-row' }, el('div', {}, el('div', { class: 'title-sm' }, 'Forgive missing accents'), el('div', { class: 'caption' }, 'cafe counts as café when you type')), accents),
    el('div', { class: 'set-row' }, el('div', {}, el('div', { class: 'title-sm' }, 'Review words up to'), el('div', { class: 'caption' }, 'Rises as you start later chapters')), sel),
    el('button', { class: 'btn btn-text bad', type: 'button', style: 'align-self:flex-start;padding-left:0', onclick: reset }, 'Reset progress'),
    el('p', { class: 'eyebrow', style: 'margin-top:8px' }, 'About'),
    el('p', { class: 'caption', style: 'margin:0' }, 'Spain Spanish. Audio: Piper TTS voice es_ES davefx (see NOTICE for licence and lineage). Progress is stored only in this browser. ',
      el('a', { href: 'https://github.com/coos88/spanish' }, 'Source on GitHub')));
}
function practiceSheet() {
  const p = progress(), weak = poolAll().filter((i) => p[i.id] && p[i.id].box <= 1).length;
  const v = store.get('verbs', { tense: 'pres', verb: '' });
  const row = (ic, title, sub, hash) => el('button', { class: 'sheet-row', type: 'button', onclick: () => { closeSheet(); go(hash); } }, icon(ic),
    el('span', { class: 'grow' }, el('span', { class: 'title-sm' }, title), el('br'), el('span', { class: 'caption' }, sub)), icon('chevron'));
  const QM = { listen: 'hear it', 'en-es': 'English → Spanish', 'es-en': 'Spanish → English' };
  openSheet(el('h2', { class: 'title-lg', style: 'margin:0' }, 'More practice'),
    el('div', {}, row('cards', 'Flashcards', `${{ words: 'Words', phrases: 'Phrases', all: 'Everything' }[store.get('deck', 'words')]} · ${store.get('dir', 'es-en') === 'es-en' ? 'ES → EN' : 'EN → ES'}`, '#practice/cards'),
      row('quiz', 'Quick quiz', `10 questions · ${QM[store.get('qmode', 'listen')]}`, '#practice/quiz'),
      row('verb', 'Verb drill', `${TENSE_CHIP[v.tense]} · ${v.verb ? 'one verb' : 'mixed verbs'}`, '#practice/verbs'),
      weak >= 4 && row('target', 'Weak spots', `${plural(weak, 'card')} you keep missing`, '#practice/weak')));
}

// ---------- practice sessions ----------
sessions.practice = (kind) => {
  const sh = sessionShell();
  const intro = (title, groups, start) => {
    sh.progress(0, 0, '');
    sh.set([el('h1', { class: 'display-sm' }, title), ...groups.map(([name, node]) => el('div', { class: 'stack', style: 'gap:8px' }, el('p', { class: 'eyebrow' }, name), node))], [btn('Start', start)]);
  };
  const exit = { label: 'Back to Today', fn: () => go('#today') };
  if (kind === 'cards') {
    let deck = store.get('deck', 'words'), dir = store.get('dir', 'es-en');
    const begin = () => {
      store.set('deck', deck); store.set('dir', dir);
      const pool = deck === 'words' ? poolWords() : deck === 'phrases' ? poolPhrases() : poolAll();
      let q = shuffle([...dueItems(pool), ...freshItems(pool).slice(0, 10)]);
      const total = q.length;
      if (!total) {
        return sh.set([el('h1', { class: 'display-sm' }, 'Nothing due'), el('p', { class: 'ink-2' }, 'You’re all caught up here. Practise a random set anyway?')],
          [btn('Practise 10 random', () => { q = shuffle(pool).slice(0, 10); run(q, q.length); }), btn('Back', exit.fn, 'text')]);
      }
      run(q, total);
    };
    const run = (q, total) => {
      let known = 0;
      const step = () => {
        if (!q.length) { markDay('practice'); return finishScreen(sh, { title: '¡Muy bien!', big: `${known} / ${total}`, sub: 'right first time', primary: exit }); }
        sh.progress(0, (total - q.length) / total, `${q.length} left`);
        flipCard(sh, q[0], dir, (ok) => { grade(q[0].id, ok); if (ok) { q.shift(); known++; } else q.push(q.shift()); step(); });
      };
      step();
    };
    intro('Flashcards', [['Deck', chips([{ value: 'words', label: 'Words' }, { value: 'phrases', label: 'Phrases' }, { value: 'all', label: 'Everything' }], deck, (v) => { deck = v; })],
      ['Direction', chips([{ value: 'es-en', label: 'ES → EN' }, { value: 'en-es', label: 'EN → ES' }], dir, (v) => { dir = v; })]], begin);
  } else if (kind === 'quiz') {
    let mode = store.get('qmode', 'listen'), inp = store.get('qinput', 'choose'), theme = store.get('qtheme', '');
    const pool = poolAll(), themes = Object.entries(themeName).map(([k, n]) => ({ value: k, label: n, disabled: pool.filter((x) => x.t === k).length < 4, title: 'Too few items' }));
    if (theme && themes.find((x) => x.value === theme)?.disabled) theme = '';
    const begin = () => {
      store.set('qmode', mode); store.set('qinput', inp); store.set('qtheme', theme);
      const src = pool.filter((x) => !theme || x.t === theme), qs = pick(src, 10), toEs = mode === 'en-es';
      runSteps(sh, { n: qs.length, label: (i) => `${i + 1} of ${qs.length}`,
        onDone: (score) => { markDay('practice'); finishScreen(sh, { title: score >= 9 ? '¡Excelente!' : score >= 6 ? '¡Bien!' : 'Keep going', big: `${score} / ${qs.length}`, sub: 'Repetition works.', primary: { label: 'Again', fn: begin }, tertiary: exit }); },
        make: (i, resolve) => {
          const q = qs[i], target = toEs ? q.es : q.en, aud = (b) => say(q.id, q.es, {}, b);
          const base = { eyebrow: mode === 'listen' ? 'Listen' : toEs ? 'In Spanish' : 'In English', sentence: { es: q.es, play: (b, auto) => say(q.id, q.es, { auto }, b) }, shown: target,
            explain: themeName[q.t], ...(mode === 'listen' ? { listen: aud } : { prompt: toEs ? q.en : q.es, promptLang: toEs ? null : 'es', audio: toEs ? null : aud }), cont: i === qs.length - 1 ? 'Finish' : 'Continue' };
          if (mode === 'listen') setTimeout(() => say(q.id, q.es, { auto: true }), 150);
          if (inp === 'choose') {
            const same = src.length >= 4 ? src : pool, ds = pick(same.filter((x) => x.id !== q.id && isPhrase(x) === isPhrase(q)), 3);
            exercise(sh, { ...base, kind: 'choose', options: shuffle([q, ...ds]).map((c) => (toEs ? c.es : c.en)), correct: target, optLang: toEs ? 'es' : null }, resolve);
          } else exercise(sh, { ...base, kind: 'type', check: (g) => (toEs ? matchEs(g, q.es) : matchEn(g, q.en)) }, resolve);
        } });
    };
    intro('Quick quiz', [['Prompt', chips([{ value: 'listen', label: 'Hear it' }, { value: 'en-es', label: 'EN → ES' }, { value: 'es-en', label: 'ES → EN' }], mode, (v) => { mode = v; })],
      ['Answer', chips([{ value: 'choose', label: 'Pick' }, { value: 'type', label: 'Type' }], inp, (v) => { inp = v; })],
      ['Topic', chips([{ value: '', label: 'All' }, ...themes], theme, (v) => { theme = v; }, { scroll: true })]], begin);
  } else if (kind === 'verbs') {
    const cfg = store.get('verbs', { tense: 'pres', verb: '' });
    const vpool = (t) => allVerbs.filter((v) => inCh(v) && hasTense(v, t));
    const begin = () => {
      store.set('verbs', cfg);
      const t = cfg.tense, list = vpool(t), one = cfg.verb && list.find((x) => x.id === cfg.verb), n = 10;
      const qs = Array.from({ length: n }, () => ({ v: one || pick(list, 1)[0], k: Math.floor(Math.random() * 6) }));
      runSteps(sh, { n, label: (i) => `${i + 1} of ${n}`,
        onDone: (score) => { markDay('practice'); finishScreen(sh, { title: score >= 9 ? '¡Excelente!' : score >= 6 ? '¡Bien!' : 'Keep going', big: `${score} / ${n}`, primary: { label: 'Again', fn: begin }, tertiary: exit }); },
        make: (i, resolve) => {
          const { v, k } = qs[i], ans = formsOf(v, t)[k];
          exercise(sh, { kind: 'type', eyebrow: `${TENSES[t]} · ${v.type}`, prompt: `${verbs0.pronouns[k].split(' (')[0]} + ${v.inf}`, hint: v.en, shown: ans, cont: i === n - 1 ? 'Finish' : 'Continue',
            sentence: { es: spoken(v, t, k), play: (b) => hear(v, t, k, b) },
            check: (g) => norm(g) === norm(ans) || (v.type === 'reflexive' && t === 'pres' && norm(g) === norm(ans.split(' ').pop())),
            table: () => el('details', { class: 'disc' }, el('summary', {}, 'Show the table'), verbTable(v, t)) }, resolve);
        } });
    };
    const verbChips = () => chips([{ value: '', label: 'Mixed' }, ...vpool(cfg.tense).map((v) => ({ value: v.id, label: v.inf }))], cfg.verb, (x) => { cfg.verb = x; }, { scroll: true });
    const verbBox = el('div', {}, verbChips());
    if (cfg.verb && !vpool(cfg.tense).find((v) => v.id === cfg.verb)) cfg.verb = '';
    const tenses = Object.keys(TENSES).filter((t) => vpool(t).length);
    intro('Verb drill', [['Tense', chips(tenses.map((t) => ({ value: t, label: TENSE_CHIP[t] })), cfg.tense, (t) => { cfg.tense = t; cfg.verb = ''; verbBox.replaceChildren(verbChips()); })], ['Verb', verbBox]], begin);
  } else if (kind === 'weak') {
    const p = progress(), pool = poolAll();
    const items = pick(pool.filter((i) => p[i.id] && p[i.id].box <= 1), 15);
    if (items.length < 4) { toast('No weak spots right now.'); return replace('#today'); }
    runSteps(sh, { n: items.length, label: (i) => `${i + 1} of ${items.length}`,
      onDone: (score) => { markDay('practice'); finishScreen(sh, { title: '¡Hecho!', big: `${score} / ${items.length}`, sub: 'Weak spots', primary: exit }); },
      make: (i, resolve) => {
        const it = items[i], same = pool.filter((x) => x.id !== it.id && isPhrase(x) === isPhrase(it));
        exercise(sh, { kind: 'choose', eyebrow: 'What does it mean?', prompt: it.es, promptLang: 'es', audio: (b) => say(it.id, it.es, {}, b), options: shuffle([it, ...pick(same, 3)]).map((x) => x.en), correct: it.en, shown: it.en,
          sentence: { es: it.es, play: (b, auto) => say(it.id, it.es, { auto }, b) }, explain: themeName[it.t], cont: i === items.length - 1 ? 'Finish' : 'Continue' },
        (ok) => { grade(it.id, ok); resolve(ok); });
      } });
  } else replace('#today');
};

// ---------- boot ----------
route();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
