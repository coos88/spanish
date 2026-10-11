# Content schema

Chapter 1's words, phrases and verbs live in `data/vocab.json`, `data/phrases.json`, `data/verbs.json`.
Every chapter, including 1, has `data/chN.json` with the lessons, drills and dialogues for that chapter.
Chapters 2 and up also put their *new words / phrases / verbs* inside `data/chN.json` (keys `vocab`, `phrases`, `verbs`).
The app merges everything. **All ids are globally unique** and double as audio file names (`audio/es/<id>.m4a`).

```jsonc
{
  "id": 2,
  "title": "Daily life and plans",
  "goal": "one sentence",
  "canDo": ["Describe your daily routine", "..."],
  "themes": { "routine": "Daily routine" },            // new vocab/phrase themes: key -> display name
  "vocab":   [{ "id": "despertarse", "es": "despertarse", "en": "to wake up", "t": "routine" }],
  "phrases": [{ "id": "p-me-duele-la-cabeza", "es": "Me duele la cabeza.", "en": "My head hurts.", "t": "health" }],   // ids start with p-
  "verbs":   [{ "id": "v-dormir", "inf": "dormir", "en": "to sleep", "type": "stem-changing o→ue",
                "forms": ["duermo","duermes","duerme","dormimos","dormís","duermen"],       // present, 6 persons (yo tú él nosotros vosotros ellos)
                "tenses": { "pret": ["dormí","dormiste","durmió","dormimos","dormisteis","durmieron"],   // chapter 3 verbs only
                            "imp":  ["dormía","dormías","dormía","dormíamos","dormíais","dormían"],
                            "part": "dormido" } }],
  "lessons": [{
    "id": "l-reflexives", "title": "Reflexive verbs", "summary": "one line",
    "cards": [{                                       // 2-4 per lesson; rule <= 40 words
      "rule": "Text. Use **bold** for the key forms.",
      "examples": [{ "id": "s-me-levanto", "es": "Me levanto a las siete.", "en": "I get up at seven." }],   // 2-3 per card; ids start s-
      "trap": "optional: a mistake English speakers make",
      "note": "optional: Spain/LatAm or register note"
    }],
    "drills": ["d-reflexives-1", "d-reflexives-2"],   // ids from "drills" below, 6-8 per lesson
    "dialogue": "dlg-routine"                          // optional dialogue id
  }],
  "drills": [
    { "id": "d-reflexives-1", "type": "gap",       "prompt": "Yo ___ a las siete.", "hint": "levantarse (yo)", "answer": ["me levanto"], "explain": "short why", "full": { "id": "d-reflexives-1-f", "es": "Yo me levanto a las siete." } },
    { "id": "d-reflexives-2", "type": "choose",    "prompt": "Ella ___ ducha por la mañana.", "options": ["me","te","se","nos"], "answer": ["se"], "explain": "...", "full": { "id": "...", "es": "..." } },
    { "id": "d-reflexives-3", "type": "build",     "prompt": "I wash my hands.", "answer": ["Me lavo las manos."], "explain": "...", "full": { "id": "...", "es": "Me lavo las manos." } },
    { "id": "d-reflexives-4", "type": "translate", "prompt": "I am going to bed.", "answer": ["Me acuesto.", "Me voy a la cama."], "explain": "...", "full": { "id": "...", "es": "Me acuesto." } }
  ],
  "dialogues": [{ "id": "dlg-routine", "title": "Describing your day", "lines": [
      { "id": "dlg-routine-1", "who": "A", "es": "¿A qué hora te levantas?", "en": "What time do you get up?" } ] }]
}
```

Rules
- `gap`: prompt contains `___` exactly once; `answer` lists every accepted string (accents are forgiven in the app, spelling is not). `full.es` is the complete correct sentence.
- `choose`: 2-4 `options`, `answer` has exactly one, which is in `options`.
- `build`: `prompt` is English; `answer[0]` is the sentence the learner assembles from shuffled word tiles (punctuation is stripped from tiles); extra answers are accepted alternate orders. Use 4-9 words.
- `translate`: `answer` lists accepted Spanish translations (include gender/formality variants). Keep prompts short.
- Every drill has `explain` (<= 20 words) and `full` (its id gets audio; use `<drillId>-f`).
- Spain Spanish by default, including vosotros in verb tables. A LatAm difference goes in a card `note`, not in the answers.
- Beginner level: short sentences, vocabulary the learner has met in this or an earlier chapter.
- `canDo`, titles, rules, explanations are English. Everything in `es` fields is Spanish only (no English words: it is spoken by a Spanish voice).
- No "Coos" or other real names except generic ones (Ana, Luis, Marta, Pablo).
- Validate with `node tools/validate.js` before finishing.
