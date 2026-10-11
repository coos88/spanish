// Spanish basics: vanilla ES module, no build step. All paths are relative so it works under /spanish/ and /.
const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');

// ---------- storage (every access guarded: private windows can throw) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('es.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('es.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const settings = { voice: store.get('voice', 'es'), accents: store.get('accents', true) };

// ---------- data ----------
const load = (f) => fetch(`data/${f}.json`).then((r) => r.json());
const [vocab, phrases, verbs] = await Promise.all([load('vocab'), load('phrases'), load('verbs')]);
const words = vocab.items;
const all = [...words, ...phrases.items];
const themeName = { ...vocab.themes, ...phrases.themes };

// ---------- helpers ----------
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  n.append(...kids.flat().filter((x) => x != null && x !== false));
  return n;
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

// ---------- speech ----------
let current = null;
let notice = null;
function speakTTS(text) {
  if (!('speechSynthesis' in window)) return showNotice('This browser has no speech synthesis. Pre-recorded words still work.');
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (!voices.length) return showNotice('No Spanish voice found on this device. Install one in your system settings (e.g. Spanish in macOS Spoken Content, or Google TTS on Android).');
  const want = settings.voice === 'mx' ? 'es-mx' : 'es-es';
  const v = voices.find((x) => x.lang.toLowerCase().replace('_', '-') === want) || voices[0];
  speechSynthesis.cancel();
  // Safari drops events right after cancel(); a short delay avoids a silent first utterance.
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = v; u.lang = v.lang; u.rate = Number($('#rate')?.value || 1);
    window.__utt = u; // keep a strong ref until it ends
    speechSynthesis.speak(u);
  }, 125);
}
if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', () => {});
function showNotice(msg) {
  notice?.remove();
  notice = el('div', { class: 'notice', role: 'status' }, msg);
  view.prepend(notice);
}
/** Play pre-generated audio for an id; fall back to browser TTS if the file is missing. */
function say(id, text, { slow = false } = {}) {
  current?.pause();
  const a = new Audio(`audio/${settings.voice}/${id}${slow ? '-slow' : ''}.m4a`);
  current = a;
  a.addEventListener('error', () => speakTTS(text), { once: true });
  a.play().catch(() => speakTTS(text));
}
const speakBtn = (id, text, slowOk = false) => [
  el('button', { class: 'speak', title: 'Listen', 'aria-label': `Listen: ${text}`, onclick: (e) => { e.stopPropagation(); say(id, text); } }, '🔊'),
  slowOk && el('button', { class: 'speak slow', title: 'Listen slowly', 'aria-label': `Listen slowly: ${text}`, onclick: (e) => { e.stopPropagation(); say(id, text, { slow: true }); } }, '🐢'),
];
const isPhrase = (it) => it.id.startsWith('p-');

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
function buildDeck(pool, newLimit = 10) {
  const p = progress(), now = Date.now();
  const due = pool.filter((i) => p[i.id] && p[i.id].due <= now);
  const fresh = pool.filter((i) => !p[i.id]).slice(0, newLimit);
  return shuffle([...due, ...fresh]);
}

// ---------- views ----------
const views = {};

views.cards = () => {
  const setSel = el('select', { 'aria-label': 'Deck' },
    el('option', { value: 'words' }, 'Words'), el('option', { value: 'phrases' }, 'Phrases'), el('option', { value: 'all' }, 'Everything'));
  const dirSel = el('select', { 'aria-label': 'Direction' },
    el('option', { value: 'es-en' }, 'Spanish → English'), el('option', { value: 'en-es' }, 'English → Spanish'));
  setSel.value = store.get('deck', 'words'); dirSel.value = store.get('dir', 'es-en');
  const box = el('div');
  let deck, flipped;
  const start = () => {
    store.set('deck', setSel.value); store.set('dir', dirSel.value);
    const pool = setSel.value === 'words' ? words : setSel.value === 'phrases' ? phrases.items : all;
    deck = buildDeck(pool); next();
  };
  const next = () => {
    flipped = false;
    if (!deck.length) {
      const p = progress(); const known = all.filter((i) => (p[i.id]?.box ?? 0) >= 3).length;
      box.replaceChildren(el('div', { class: 'card' }, el('div', { class: 'big' }, '¡Muy bien! 🎉'),
        el('div', { class: 'hint' }, `Nothing due right now. ${known} of ${all.length} items are in box 3 or higher.`)),
        el('div', { class: 'row' }, el('button', { class: 'ghost', onclick: () => { deck = shuffle(pickPool()).slice(0, 10); next(); } }, 'Practice 10 random anyway')));
      return;
    }
    render();
  };
  const pickPool = () => (setSel.value === 'words' ? words : setSel.value === 'phrases' ? phrases.items : all);
  const render = () => {
    const it = deck[0], front = dirSel.value === 'es-en' ? it.es : it.en, back = dirSel.value === 'es-en' ? it.en : it.es;
    const card = el('div', { class: 'card', tabindex: '0', role: 'button', 'aria-label': 'Flip card', onclick: flip, onkeydown: (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } } },
      el('div', { class: 'big' }, flipped ? back : front),
      el('div', { class: 'hint' }, flipped ? themeName[it.t] : 'tap to flip'));
    const audio = el('div', { class: 'row' }, speakBtn(it.id, it.es, isPhrase(it)));
    const grading = flipped ? el('div', { class: 'row' },
      el('button', { class: 'ghost bad', onclick: () => { grade(it.id, false); deck.push(deck.shift()); next(); } }, '✗ Again'),
      el('button', { class: 'ghost good', onclick: () => { grade(it.id, true); deck.shift(); next(); } }, '✓ Got it')) : null;
    box.replaceChildren(el('div', { class: 'stats' }, `${deck.length} left in this session`), card, audio, grading);
    if (flipped || dirSel.value === 'es-en') card.focus({ preventScroll: true });
  };
  const flip = () => { flipped = !flipped; const it = deck[0]; render(); if (flipped) say(it.id, it.es); };
  setSel.onchange = dirSel.onchange = start;
  start();
  return [el('div', { class: 'row' }, setSel, dirSel), box];
};

views.quiz = () => {
  const mode = el('select', { 'aria-label': 'Prompt' },
    el('option', { value: 'listen' }, 'Hear it → English'), el('option', { value: 'en-es' }, 'English → Spanish'), el('option', { value: 'es-en' }, 'Spanish → English'));
  const input = el('select', { 'aria-label': 'Answer style' }, el('option', { value: 'choose' }, 'Pick the answer'), el('option', { value: 'type' }, 'Type the answer'));
  const theme = el('select', { 'aria-label': 'Topic' }, el('option', { value: '' }, 'All topics'),
    ...Object.entries(themeName).map(([k, v]) => el('option', { value: k }, v)));
  mode.value = store.get('qmode', 'listen'); input.value = store.get('qinput', 'choose');
  const box = el('div');
  let qs, i, score;
  const start = () => {
    store.set('qmode', mode.value); store.set('qinput', input.value);
    const pool = all.filter((x) => !theme.value || x.t === theme.value);
    if (pool.length < 4) { box.replaceChildren(el('p', {}, 'Not enough items in this topic.')); return; }
    qs = pick(pool, 10); i = 0; score = 0; ask();
  };
  const ask = () => {
    if (i >= qs.length) {
      box.replaceChildren(el('div', { class: 'card' }, el('div', { class: 'big' }, `${score} / ${qs.length}`),
        el('div', { class: 'hint' }, score >= 9 ? '¡Excelente!' : score >= 6 ? '¡Bien!' : 'Keep going, repetition works.')),
        el('div', { class: 'row' }, el('button', { class: 'primary', onclick: start }, 'Again')));
      return;
    }
    const q = qs[i], m = mode.value;
    const toEs = m === 'en-es', target = toEs ? q.es : q.en;
    const prompt = el('div', { class: 'card', style: 'cursor:default' },
      el('div', { class: 'big' }, m === 'listen' ? '🔊 ?' : m === 'es-en' ? q.es : q.en),
      el('div', { class: 'hint' }, `Question ${i + 1} of ${qs.length}`));
    const fb = el('div', { class: 'feedback' });
    const done = (ok, extra) => {
      if (ok) score++;
      fb.className = 'feedback ' + (ok ? 'good' : 'bad');
      fb.textContent = ok ? '¡Correcto!' : `Not quite: ${target}`;
      if (extra) extra();
      box.append(el('div', { class: 'row' }, el('button', { class: 'primary', autofocus: '', onclick: () => { i++; ask(); } }, 'Next →')));
      box.querySelector('.primary')?.focus();
      if (m !== 'listen' || ok) say(q.id, q.es);
    };
    const parts = [el('div', { class: 'stats' }, `Score ${score}`), prompt];
    if (m === 'listen') parts.push(el('div', { class: 'row' }, speakBtn(q.id, q.es, isPhrase(q))));
    if (input.value === 'choose') {
      const distract = pick(all.filter((x) => x.id !== q.id && isPhrase(x) === isPhrase(q)), 3);
      const buttons = shuffle([q, ...distract]).map((c) => {
        const b = el('button', { class: 'opt', onclick: () => {
          box.querySelectorAll('.opt').forEach((x) => { x.disabled = true; });
          b.classList.add(c.id === q.id ? 'right' : 'wrong');
          if (c.id !== q.id) [...box.querySelectorAll('.opt')].find((x) => x.dataset.id === q.id)?.classList.add('right');
          done(c.id === q.id);
        } }, toEs ? c.es : c.en);
        b.dataset.id = c.id; return b;
      });
      parts.push(el('div', { class: 'opts' }, buttons));
    } else {
      const field = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Your answer' });
      const form = el('form', { class: 'row', onsubmit: (e) => {
        e.preventDefault(); if (field.disabled) return;
        field.disabled = true;
        done(toEs ? matchEs(field.value, q.es) : matchEn(field.value, q.en));
      } }, field, el('button', { class: 'primary' }, 'Check'));
      parts.push(form);
    }
    parts.push(fb);
    box.replaceChildren(...parts);
    box.querySelector('input')?.focus();
    if (m === 'listen') say(q.id, q.es);
  };
  mode.onchange = input.onchange = theme.onchange = start;
  start();
  return [el('div', { class: 'row' }, mode, input, theme), box];
};

views.verbs = () => {
  const sel = el('select', { 'aria-label': 'Verb' }, el('option', { value: '' }, 'Mixed'),
    ...verbs.items.map((v) => el('option', { value: v.id }, `${v.inf} (${v.en})`)));
  const box = el('div');
  const table = (v) => el('table', {}, el('tbody', {}, verbs.pronouns.map((p, k) =>
    el('tr', {}, el('th', {}, p), el('td', {}, v.forms[k]), el('td', {}, el('button', { class: 'speak', 'aria-label': `Listen: ${v.forms[k]}`, onclick: () => say(`${v.id}-${k}`, v.forms[k]) }, '🔊'))))));
  const drill = () => {
    const v = sel.value ? verbs.items.find((x) => x.id === sel.value) : pick(verbs.items, 1)[0];
    const k = Math.floor(Math.random() * 6), ans = v.forms[k];
    const field = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Verb form' });
    const fb = el('div', { class: 'feedback' });
    const form = el('form', { class: 'row', onsubmit: (e) => {
      e.preventDefault();
      if (field.disabled) { drill(); return; }
      field.disabled = true;
      const ok = norm(field.value) === norm(ans) || (v.type === 'reflexive' && norm(field.value) === norm(ans.split(' ').pop()));
      fb.className = 'feedback ' + (ok ? 'good' : 'bad'); fb.textContent = ok ? '¡Correcto!' : `Not quite: ${ans}`;
      say(`${v.id}-${k}`, ans); form.querySelector('button').textContent = 'Next →'; form.querySelector('button').focus();
    } }, field, el('button', { class: 'primary' }, 'Check'));
    box.replaceChildren(
      el('div', { class: 'card', style: 'cursor:default' }, el('div', { class: 'big' }, `${verbs.pronouns[k]} + ${v.inf}`), el('div', { class: 'hint' }, `${v.en} · ${v.type} · present tense`)),
      form, fb, el('h2', {}, `${v.inf} (reference)`), table(v));
    field.focus();
  };
  sel.onchange = drill; drill();
  return [el('p', { class: 'muted' }, 'Type the present-tense form. Press Enter to check, Enter again for the next one.'), el('div', { class: 'row' }, sel), box];
};

views.browse = () => {
  const kind = el('select', { 'aria-label': 'List' }, el('option', { value: 'phrases' }, 'Phrases'), el('option', { value: 'words' }, 'Words'));
  const q = el('input', { type: 'text', placeholder: 'Search…', 'aria-label': 'Search', style: 'max-width:220px' });
  const box = el('div');
  const draw = () => {
    const src = kind.value === 'words' ? vocab : phrases, term = q.value.toLowerCase(), t = strip(term);
    const items = src.items.filter((x) => !term || strip(x.es).includes(t) || x.en.toLowerCase().includes(term));
    const out = [];
    for (const [k, name] of Object.entries(src.themes)) {
      const group = items.filter((x) => x.t === k);
      if (!group.length) continue;
      out.push(el('h2', {}, name), ...group.map((x) => el('div', { class: 'item' },
        speakBtn(x.id, x.es, isPhrase(x)).slice(0, 1), el('div', { class: 'txt' }, el('div', { class: 'es' }, x.es), el('div', { class: 'muted' }, x.en)),
        isPhrase(x) ? speakBtn(x.id, x.es, true)[1] : null)));
    }
    box.replaceChildren(...(out.length ? out : [el('p', { class: 'muted' }, 'Nothing found.')]));
  };
  kind.onchange = q.oninput = draw; draw();
  return [el('div', { class: 'row' }, kind, q), box];
};

views.say = () => {
  const ta = el('textarea', { 'aria-label': 'Spanish text', placeholder: 'Type or paste Spanish text here…' }, store.get('say', 'Hola, me llamo Coos. ¿Cómo estás?'));
  const rate = el('input', { type: 'range', id: 'rate', min: '0.5', max: '1.3', step: '0.1', value: '0.9', 'aria-label': 'Speed' });
  const btn = el('button', { class: 'primary', onclick: () => { store.set('say', ta.value); speakTTS(ta.value); } }, '🔊 Speak');
  return [el('p', { class: 'muted' }, 'Speaks any text using your device’s Spanish voice (the browser’s built-in speech). Quality depends on the voices installed on your system.'),
    ta, el('div', { class: 'row' }, btn, el('label', {}, 'Speed ', rate))];
};

// ---------- shell ----------
function show(tab) {
  notice = null; current?.pause(); speechSynthesis?.cancel?.();
  document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  view.replaceChildren(...[views[tab]()].flat());
  store.set('tab', tab);
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) show(b.dataset.tab); });
const voiceSel = $('#voice'), accSel = $('#accents');
voiceSel.value = settings.voice; accSel.checked = settings.accents;
voiceSel.onchange = () => { settings.voice = voiceSel.value; store.set('voice', settings.voice); };
accSel.onchange = () => { settings.accents = accSel.checked; store.set('accents', settings.accents); };
show(views[store.get('tab', 'cards')] ? store.get('tab', 'cards') : 'cards');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
