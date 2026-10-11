#!/usr/bin/env node
// Generates VOCAB.md and PHRASES.md from data/*.json so docs and app never drift. No dependencies: `node tools/gen-docs.js`
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'data', f + '.json'), 'utf8'));
const esc = (s) => s.replace(/\|/g, '\\|');

function table(file, title, intro) {
  const d = read(file);
  let out = `# ${title}\n\n${intro}\nGenerated from \`data/${file}.json\` by \`node tools/gen-docs.js\`. Don't edit by hand.\n`;
  for (const [key, name] of Object.entries(d.themes)) {
    const rows = d.items.filter((i) => i.t === key);
    if (!rows.length) continue;
    out += `\n## ${name}\n\n| Spanish | English |\n|---|---|\n`;
    for (const r of rows) out += `| ${esc(r.es)} | ${esc(r.en)} |\n`;
  }
  fs.writeFileSync(path.join(root, file.toUpperCase() + '.md'), out);
  console.log(file, d.items.length);
}
table('vocab', 'Vocab: the first 175 words', 'Nouns come with their article, so you learn the gender with the word. Spain forms first, *LatAm* in brackets.\n');
table('phrases', 'Phrases: survival Spanish', 'Whole phrases beat single words. Say them out loud; hear them in the [app](https://coos88.github.io/spanish/).\n');
