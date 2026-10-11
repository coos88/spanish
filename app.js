// Spanish basics: vanilla ES module, no build step. All paths are relative so it works under /spanish/ and /.
const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');

// ---------- storage (every access guarded: private windows can throw) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('es.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('es.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const settings = { accents: store.get('accents', true), chapter: store.get('chapter', 1) };

// ---------- data ----------
// Chapter 1's words live in vocab/phrases/verbs.json; every chapter has chN.json (lessons, drills, dialogues, new words).
const load = (f) => fetch(`data/${f}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const [vocab0, phrases0, verbs0, ...chFiles] = await Promise.all(['vocab', 'phrases', 'verbs', 'ch1', 'ch2', 'ch3'].map(load));
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
const verbs = { pronouns: verbs0.pronouns, items: allVerbs };
const inCh = (it) => it.ch <= settings.chapter;
// views read these at build time, so they always reflect the chapter filter
let words, phrasesList, all;
function applyChapter() {
  words = allWords.filter(inCh); phrasesList = allPhrases.filter(inCh); all = [...words, ...phrasesList];
}
applyChapter();

// ---------- helpers ----------
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
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
  const want = 'es-es';
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
  const a = new Audio(`audio/es/${id}${slow ? '-slow' : ''}.m4a`);
  current = a;
  // A failed clip fires both the 'error' event and a play() rejection: fall back exactly once,
  // and not at all if a newer click already replaced this clip (AbortError).
  let fell = false;
  const fallback = (e) => {
    if (fell || current !== a || e?.name === 'AbortError') return;
    fell = true; speakTTS(text);
  };
  a.addEventListener('error', fallback, { once: true });
  a.play().catch(fallback);
}
const speakBtn = (id, text, slowOk = false) => [
  el('button', { class: 'speak', title: 'Listen', 'aria-label': `Listen: ${text}`, onclick: (e) => { e.stopPropagation(); say(id, text); } }, '🔊'),
  slowOk && el('button', { class: 'speak slow', title: 'Listen slowly', 'aria-label': `Listen slowly: ${text}`, onclick: (e) => { e.stopPropagation(); say(id, text, { slow: true }); } }, '🐢'),
];
const isPhrase = (it) => it.id.startsWith('p-') || it.id.startsWith('dlg-');

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
    deck = buildDeck(pickPool()); next();
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
  const pickPool = () => (setSel.value === 'words' ? words : setSel.value === 'phrases' ? phrasesList : all);
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
  const TENSES = { pres: 'Present', pret: 'Past: indefinido', imp: 'Past: imperfect', perf: 'Present perfect' };
  const SUBJ = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'], HABER = ['he', 'has', 'ha', 'hemos', 'habéis', 'han'];
  const formsOf = (v, t) => (t === 'pres' ? v.forms : t === 'perf' ? HABER.map((h) => `${h} ${v.tenses.part}`) : v.tenses[t]);
  const spoken = (v, t, k) => (v.type === 'reflexive' && t === 'pres' ? formsOf(v, t)[k] : `${SUBJ[k]} ${formsOf(v, t)[k]}`);
  const hear = (v, t, k) => (t === 'pres' ? say(`${v.id}-${k}`, spoken(v, t, k)) : t === 'pret' ? say(`${v.id}-pret-${k}`, spoken(v, t, k)) : speakTTS(spoken(v, t, k)));
  const anyTenses = verbs.items.some((v) => v.tenses && inCh(v));
  const tenseSel = el('select', { 'aria-label': 'Tense' }, ...Object.entries(TENSES).filter(([t]) => t === 'pres' || anyTenses).map(([t, n]) => el('option', { value: t }, n)));
  const sel = el('select', { 'aria-label': 'Verb' });
  const pool = () => verbs.items.filter((v) => inCh(v) && (tenseSel.value === 'pres' || v.tenses));
  const fillSel = () => sel.replaceChildren(el('option', { value: '' }, 'Mixed'), ...pool().map((v) => el('option', { value: v.id }, `${v.inf} (${v.en})`)));
  const box = el('div');
  const table = (v, t) => el('table', {}, el('tbody', {}, verbs.pronouns.map((p, k) =>
    el('tr', {}, el('th', {}, p), el('td', {}, formsOf(v, t)[k]), el('td', {}, el('button', { class: 'speak', 'aria-label': `Listen: ${formsOf(v, t)[k]}`, onclick: () => hear(v, t, k) }, '🔊'))))));
  const drill = () => {
    const t = tenseSel.value, list = pool();
    const v = (sel.value && list.find((x) => x.id === sel.value)) || pick(list, 1)[0];
    const k = Math.floor(Math.random() * 6), ans = formsOf(v, t)[k];
    const field = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Verb form' });
    const fb = el('div', { class: 'feedback' });
    const form = el('form', { class: 'row', onsubmit: (e) => {
      e.preventDefault();
      if (field.disabled) { drill(); return; }
      field.disabled = true;
      const ok = norm(field.value) === norm(ans) || (v.type === 'reflexive' && t === 'pres' && norm(field.value) === norm(ans.split(' ').pop()));
      fb.className = 'feedback ' + (ok ? 'good' : 'bad'); fb.textContent = ok ? '¡Correcto!' : `Not quite: ${ans}`;
      hear(v, t, k); form.querySelector('button').textContent = 'Next →'; form.querySelector('button').focus();
    } }, field, el('button', { class: 'primary' }, 'Check'));
    box.replaceChildren(
      el('div', { class: 'card', style: 'cursor:default' }, el('div', { class: 'big' }, `${verbs.pronouns[k]} + ${v.inf}`), el('div', { class: 'hint' }, `${v.en} · ${v.type} · ${TENSES[t].toLowerCase()}`)),
      form, fb, el('h2', {}, `${v.inf} (reference)`), table(v, t));
    field.focus();
  };
  fillSel();
  sel.onchange = drill; tenseSel.onchange = () => { fillSel(); drill(); }; drill();
  return [el('p', { class: 'muted' }, 'Type the form. Press Enter to check, Enter again for the next one.'), el('div', { class: 'row' }, tenseSel, sel), box];
};

views.browse = () => {
  const kind = el('select', { 'aria-label': 'List' }, el('option', { value: 'phrases' }, 'Phrases'), el('option', { value: 'words' }, 'Words'));
  const q = el('input', { type: 'text', placeholder: 'Search…', 'aria-label': 'Search', style: 'max-width:220px' });
  const box = el('div');
  const draw = () => {
    const src = { items: kind.value === 'words' ? words : phrasesList, themes: themeName }, term = q.value.toLowerCase(), t = strip(term);
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

// ---------- learn: lessons, dialogues, drills ----------
const lessonsState = () => store.get('lessons', {});
let openLesson = null;
const fmt = (text) => text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? el('strong', {}, part) : part));
const tokens = (sentence) => sentence.replace(/[¿?¡!.,;:]/g, '').split(/\s+/).filter(Boolean).map((w) => w.toLowerCase());

function exampleRow(e) {
  return el('div', { class: 'item' }, speakBtn(e.id, e.es)[0], el('div', { class: 'txt' }, el('div', { class: 'es' }, e.es), el('div', { class: 'muted' }, e.en)));
}

function dialogueBlock(d) {
  const play = el('button', { class: 'ghost' }, '▶ Play dialogue');
  play.onclick = async () => {
    play.disabled = true;
    for (const line of d.lines) {
      await new Promise((res) => { const a = new Audio(`audio/es/${line.id}.m4a`); current = a; a.onended = res; a.onerror = res; a.play().catch(res); });
      await new Promise((r) => setTimeout(r, 250));
    }
    play.disabled = false;
  };
  return el('div', {}, el('h2', {}, `Dialogue: ${d.title}`), play,
    ...d.lines.map((l) => el('div', { class: 'item' }, speakBtn(l.id, l.es, true), el('div', { class: 'txt' },
      el('div', { class: 'es' }, el('span', { class: 'muted' }, `${l.who}: `), l.es), el('div', { class: 'muted' }, l.en)))));
}

/** Runs a list of drills in `box`; calls onDone(score, total) when finished. */
function runDrills(box, ids, onDone) {
  const qs = shuffle(ids).slice(0, 10).map((id) => drillById.get(id)).filter(Boolean);
  let i = 0, score = 0;
  const ask = () => {
    if (i >= qs.length) { onDone(score, qs.length); return; }
    const d = qs[i];
    let finished = false;
    const fb = el('div', { class: 'feedback' });
    const extra = el('div', { class: 'row' });
    const finish = (ok, shown) => {
      if (finished) return; finished = true;
      if (ok) score++;
      fb.className = 'feedback ' + (ok ? 'good' : 'bad');
      fb.textContent = ok ? '¡Correcto!' : `Not quite: ${shown ?? d.answer[0]}`;
      extra.replaceChildren(el('div', { class: 'muted' }, d.explain), el('div', { style: 'flex-basis:100%' }),
        ...speakBtn(d.full.id, d.full.es), el('span', { class: 'es' }, d.full.es),
        el('button', { class: 'primary', onclick: () => { i++; ask(); } }, i + 1 >= qs.length ? 'Finish' : 'Next →'));
      extra.querySelector('.primary').focus();
      say(d.full.id, d.full.es);
    };
    const head = [el('div', { class: 'stats' }, `Drill ${i + 1} of ${qs.length} · ${score} correct`),
      el('div', { class: 'card', style: 'cursor:default' }, el('div', { class: 'big' }, d.prompt), d.hint ? el('div', { class: 'hint' }, `(${d.hint})`) : null)];
    let body;
    if (d.type === 'choose') {
      const btns = shuffle(d.options).map((o) => {
        const b = el('button', { class: 'opt', onclick: () => {
          box.querySelectorAll('.opt').forEach((x) => { x.disabled = true; });
          b.classList.add(o === d.answer[0] ? 'right' : 'wrong');
          if (o !== d.answer[0]) [...box.querySelectorAll('.opt')].find((x) => x.textContent === d.answer[0])?.classList.add('right');
          finish(o === d.answer[0]);
        } }, o);
        return b;
      });
      body = el('div', { class: 'opts' }, btns);
    } else if (d.type === 'build') {
      const target = tokens(d.answer[0]);
      let bank = shuffle(target.map((w, k) => ({ w, k })));
      if (bank.map((x) => x.w).join(' ') === target.join(' ')) bank = bank.reverse();
      const chosen = [];
      const line = el('div', { class: 'row tiles', 'aria-label': 'Your sentence', style: 'min-height:48px;border-bottom:2px solid var(--line)' });
      const pool = el('div', { class: 'row tiles' });
      const draw = () => {
        line.replaceChildren(...chosen.map((t) => el('button', { class: 'opt', disabled: finished ? '' : null, onclick: () => { chosen.splice(chosen.indexOf(t), 1); bank.push(t); draw(); } }, t.w)));
        pool.replaceChildren(...bank.map((t) => el('button', { class: 'opt', disabled: finished ? '' : null, onclick: () => { bank.splice(bank.indexOf(t), 1); chosen.push(t); draw(); } }, t.w)));
      };
      draw();
      const check = el('button', { class: 'primary', onclick: () => {
        const got = chosen.map((t) => t.w).join(' ');
        const ok = d.answer.some((a) => norm(tokens(a).join(' ')) === norm(got));
        finish(ok); draw();
      } }, 'Check');
      body = el('div', {}, line, pool, el('div', { class: 'row' }, check));
    } else { // gap | translate: typed
      const field = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Your answer' });
      const form = el('form', { class: 'row', onsubmit: (e) => {
        e.preventDefault(); if (finished) return;
        field.disabled = true;
        const ok = d.answer.some((a) => matchEs(field.value, a));
        finish(ok);
        if (!ok && d.type === 'translate') {
          const self = el('button', { class: 'ghost good', type: 'button', onclick: () => { score++; fb.className = 'feedback good'; fb.textContent = 'Counted as correct.'; self.remove(); } }, 'I was right ✓');
          extra.prepend(self);
        }
      } }, field, el('button', { class: 'primary' }, 'Check'));
      body = form;
      queueMicrotask(() => field.focus());
    }
    box.replaceChildren(...head, body, fb, extra);
  };
  ask();
}

function lessonPage(l) {
  const st = lessonsState(); st[l.id] = { ...st[l.id], read: Date.now() }; store.set('lessons', st);
  const drillBox = el('div');
  const practice = el('button', { class: 'primary', onclick: () => {
    runDrills(drillBox, l.drills, (score, total) => {
      const s2 = lessonsState(); s2[l.id] = { ...s2[l.id], best: Math.max(s2[l.id]?.best ?? 0, Math.round((score / total) * 10)) }; store.set('lessons', s2);
      drillBox.replaceChildren(el('div', { class: 'card' }, el('div', { class: 'big' }, `${score} / ${total}`),
        el('div', { class: 'hint' }, score / total >= 0.8 ? '¡Muy bien! Lesson done.' : 'Practice again; repetition works.')),
        el('div', { class: 'row' }, el('button', { class: 'primary', onclick: () => practice.click() }, 'Practise again'),
          el('button', { class: 'ghost', onclick: () => { openLesson = null; show('learn'); } }, '← All lessons')));
    });
    practice.scrollIntoView?.({ block: 'nearest' });
  } }, `Practise (${Math.min(10, l.drills.length)} drills)`);
  return [
    el('button', { class: 'ghost', onclick: () => { openLesson = null; show('learn'); } }, '← All lessons'),
    el('h2', {}, l.title), el('p', { class: 'muted' }, l.summary),
    ...l.cards.map((c) => el('div', { class: 'lesson-card' }, el('p', {}, fmt(c.rule)), ...(c.examples || []).map(exampleRow),
      c.trap ? el('div', { class: 'notice' }, '⚠ ', fmt(c.trap)) : null, c.note ? el('p', { class: 'muted' }, 'ℹ ', fmt(c.note)) : null)),
    l.dialogue && dialogueById.has(l.dialogue) ? dialogueBlock(dialogueById.get(l.dialogue)) : null,
    el('div', { class: 'row' }, practice), drillBox];
}

views.learn = () => {
  if (openLesson) { const l = lessonsAll.find((x) => x.id === openLesson); if (l) return lessonPage(l); openLesson = null; }
  const st = lessonsState();
  const next = lessonsAll.find((l) => (st[l.id]?.best ?? 0) < 8);
  const out = [];
  for (const c of chapters) {
    const ls = lessonsAll.filter((l) => l.ch === c.id);
    out.push(el('h2', {}, `Chapter ${c.id}: ${c.title}`), el('p', { class: 'muted' }, c.goal),
      el('ul', { class: 'candos' }, c.canDo.map((x) => el('li', {}, x))));
    for (const l of ls) {
      const best = st[l.id]?.best;
      out.push(el('button', { class: 'ghost lesson-row' + (l === next ? ' next' : ''), onclick: () => { openLesson = l.id; show('learn'); } },
        el('span', {}, best >= 8 ? '✓ ' : l === next ? '→ ' : '', el('strong', {}, l.title), el('span', { class: 'muted' }, ` · ${l.summary}`)),
        el('span', { class: 'muted' }, best != null ? `${best}/10` : '')));
    }
  }
  return out.length ? out : [el('p', {}, 'No lessons yet.')];
};

// ---------- shell ----------
let currentTab = 'learn';
function show(tab) {
  currentTab = tab; notice = null; current?.pause(); speechSynthesis?.cancel?.();
  document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  view.replaceChildren(...[views[tab]()].flat());
  store.set('tab', tab);
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) show(b.dataset.tab); });
const chSel = $('#chapter');
for (let c = 1; c <= maxCh; c++) chSel.append(el('option', { value: String(c) }, c === 1 ? 'Chapter 1 only' : `Chapters 1–${c}`));
chSel.value = String(settings.chapter);
chSel.onchange = () => { settings.chapter = Number(chSel.value); store.set('chapter', settings.chapter); applyChapter(); show(currentTab); };
const accSel = $('#accents');
accSel.checked = settings.accents;
accSel.onchange = () => { settings.accents = accSel.checked; store.set('accents', settings.accents); };
show(views[store.get('tab', 'learn')] ? store.get('tab', 'learn') : 'learn');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
