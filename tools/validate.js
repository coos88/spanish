#!/usr/bin/env node
// Validates data/*.json against tools/SCHEMA.md. Exit code 1 on any error.  Usage: node tools/validate.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const errs = [], ids = new Map();
const err = (m) => errs.push(m);
const claim = (id, where) => {
  if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) return err(`${where}: bad id ${JSON.stringify(id)}`);
  if (ids.has(id)) err(`${where}: duplicate id '${id}' (also ${ids.get(id)})`);
  ids.set(id, where);
};
const need = (o, keys, where) => keys.forEach((k) => { if (o[k] == null || o[k] === '') err(`${where}: missing '${k}'`); });
const noEnglish = (s, where) => { if (/\b(the|and|you|is|are|what|with)\b/i.test(s) && !/[áéíóúñ¿¡]/i.test(s)) err(`${where}: looks English in es field: ${s}`); };

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const chapters = files.filter((f) => /^ch\d+\.json$/.test(f)).sort();
const base = { vocab: read('vocab.json').items, phrases: read('phrases.json').items, verbs: read('verbs.json').items };
const themes = new Set([...Object.keys(read('vocab.json').themes), ...Object.keys(read('phrases.json').themes)]);
base.vocab.forEach((i) => claim(i.id, 'vocab.json')); base.phrases.forEach((i) => claim(i.id, 'phrases.json'));
base.verbs.forEach((v) => { claim(v.id, 'verbs.json'); for (let k = 0; k < 6; k++) claim(`${v.id}-${k}`, 'verbs.json(audio)'); });

const drillsById = new Map(), lessons = [], dialogues = new Map(), counts = {};
for (const f of chapters) {
  const c = read(f), w = (s) => `${f} ${s}`;
  need(c, ['id', 'title', 'goal'], f);
  if (!Array.isArray(c.canDo) || !c.canDo.length) err(w('canDo missing'));
  Object.keys(c.themes || {}).forEach((t) => themes.add(t));
  for (const i of c.vocab || []) { need(i, ['id', 'es', 'en', 't'], w(`vocab ${i.id}`)); claim(i.id, w('vocab')); noEnglish(i.es, w(i.id)); if (!themes.has(i.t)) err(w(`vocab ${i.id}: unknown theme ${i.t}`)); }
  for (const i of c.phrases || []) { need(i, ['id', 'es', 'en', 't'], w(`phrase ${i.id}`)); claim(i.id, w('phrase')); if (!i.id.startsWith('p-')) err(w(`phrase id must start p-: ${i.id}`)); noEnglish(i.es, w(i.id)); if (!themes.has(i.t)) err(w(`phrase ${i.id}: unknown theme ${i.t}`)); }
  for (const v of c.verbs || []) {
    need(v, ['id', 'inf', 'en', 'type'], w(`verb ${v.id}`)); claim(v.id, w('verb'));
    if (!Array.isArray(v.forms) || v.forms.length !== 6) err(w(`verb ${v.id}: forms must have 6 entries`));
    else for (let k = 0; k < 6; k++) claim(`${v.id}-${k}`, w('verb audio'));
    if (v.tenses) {
      for (const t of ['pret', 'imp']) if (!Array.isArray(v.tenses[t]) || v.tenses[t].length !== 6) err(w(`verb ${v.id}: tenses.${t} needs 6 entries`));
      if (!v.tenses.part) err(w(`verb ${v.id}: tenses.part missing`));
      for (let k = 0; k < 6; k++) claim(`${v.id}-pret-${k}`, w('verb audio'));
    }
  }
  for (const d of c.dialogues || []) {
    need(d, ['id', 'title'], w(`dialogue ${d.id}`)); dialogues.set(d.id, d);
    if (!d.lines || d.lines.length < 4) err(w(`dialogue ${d.id}: needs >= 4 lines`));
    for (const l of d.lines || []) { need(l, ['id', 'who', 'es', 'en'], w(`line ${l.id}`)); claim(l.id, w('dialogue line')); noEnglish(l.es, w(l.id)); }
  }
  for (const d of c.drills || []) {
    const dw = w(`drill ${d.id}`); need(d, ['id', 'type', 'prompt', 'answer', 'explain', 'full'], dw); drillsById.set(d.id, d);
    if (!['gap', 'choose', 'build', 'translate'].includes(d.type)) err(`${dw}: bad type`);
    if (!Array.isArray(d.answer) || !d.answer.length) err(`${dw}: answer must be a non-empty array`);
    if (d.full) { claim(d.full.id, dw + ' full'); need(d.full, ['es'], dw); if (d.full.id !== `${d.id}-f`) err(`${dw}: full.id should be ${d.id}-f`); noEnglish(d.full.es || '', dw); }
    if (d.explain && d.explain.split(/\s+/).length > 25) err(`${dw}: explain too long`);
    if (d.type === 'gap' && (d.prompt.match(/___/g) || []).length !== 1) err(`${dw}: gap prompt needs exactly one ___`);
    if (d.type === 'choose') { if (!d.options || d.options.length < 2 || d.options.length > 4) err(`${dw}: 2-4 options`); else if (!d.options.includes(d.answer[0]) || d.answer.length !== 1) err(`${dw}: answer must be one of options`); if ((d.prompt.match(/___/g) || []).length !== 1) err(`${dw}: choose prompt needs one ___`); }
    if (d.type === 'build') { const n = (d.answer[0] || '').split(/\s+/).length; if (n < 3 || n > 10) err(`${dw}: build sentence should be 3-10 words (${n})`); }
  }
  for (const l of c.lessons || []) {
    lessons.push(l); const lw = w(`lesson ${l.id}`); need(l, ['id', 'title', 'summary'], lw);
    if (!l.cards || l.cards.length < 1) err(`${lw}: needs cards`);
    for (const k of l.cards || []) { need(k, ['rule'], lw); if (k.rule && k.rule.split(/\s+/).length > 45) err(`${lw}: rule > 45 words`); for (const e of k.examples || []) { need(e, ['id', 'es', 'en'], lw); claim(e.id, lw + ' example'); noEnglish(e.es, lw); } }
    if (!l.drills || l.drills.length < 5) err(`${lw}: needs >= 5 drills`);
    (l.drills || []).forEach((id) => { if (!drillsById.has(id)) err(`${lw}: unknown drill ${id}`); });
    if (l.dialogue && !dialogues.has(l.dialogue)) err(`${lw}: unknown dialogue ${l.dialogue}`);
  }
  counts[f] = { vocab: (c.vocab || []).length, phrases: (c.phrases || []).length, verbs: (c.verbs || []).length, lessons: (c.lessons || []).length, drills: (c.drills || []).length, dialogues: (c.dialogues || []).length };
}
console.log(JSON.stringify(counts, null, 1));
if (errs.length) { console.error(errs.length + ' problem(s):\n' + errs.slice(0, 60).join('\n')); process.exit(1); }
console.log('OK, ids:', ids.size);
