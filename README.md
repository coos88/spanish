# Spanish basics

Compact Spanish course for English speakers: three chapters of grammar lessons, drills and dialogues, a cheat sheet, and an app with spoken audio.
Inspired by [rust-for-java-devs](https://github.com/coos88/rust-for-java-devs): terse tables, no fluff.

**App: https://coos88.github.io/spanish/** (installable, works offline)

## The course
| Chapter | Goal | You can... |
|---|---|---|
| [1: Survive and introduce yourself](chapters/1/README.md) | A1: sounds, gender, present tense, ser/estar, tener/hay, questions, numbers, time, gustar | greet, introduce yourself, order, ask the way, tell the time |
| [2: Daily life and plans](chapters/2/README.md) | A1→A2: stem-changers, reflexives, ir a / tener que, estar + gerund, object pronouns | describe your routine, make plans, say what hurts |
| [3: Tell what happened](chapters/3/README.md) | A2: past tenses, connectors, directions | narrate yesterday or a holiday, report a problem |

Each chapter folder has `GRAMMAR.md`, `EXERCISES.md` (answers hidden), `VOCAB.md` and `PHRASES.md`, all generated from the same data as the app.

- [Cheat sheet](CHEATSHEET.md): the whole present-tense grammar on one page (reference)
- [In practice](PRACTICE.md): Spain vs LatAm, false friends, habits to unlearn, how to study

## The app
- **Learn**: lessons with rule cards, example sentences with audio, dialogues, and 6-10 drills per lesson (gap-fill, pick the answer, build the sentence, translate)
- **Flashcards** (spaced repetition), **Quiz** (hear it / EN→ES / ES→EN), **Verbs** (present, past, imperfect, present perfect), **Browse**, and a **Say it** box that speaks any text
- A chapter filter limits words and quizzes to what you've covered. Progress lives in your browser only (localStorage).

Audio is pre-generated with [Piper](https://github.com/OHF-Voice/piper1-gpl) (see [NOTICE](NOTICE) for licences and lineage) so it sounds the same on every device. Only the *Say it* box, and verb forms without recordings, use your browser's own speech voices.

## Run it
It's static files; no build step.
```
python3 -m http.server 8000        # then open http://localhost:8000
docker compose up -d --build       # or: nginx on http://localhost:8080 (NAS)
```
Deploys to GitHub Pages on every push to `main` (`.github/workflows/pages.yml`).

## Change the content
All content is data: see [tools/SCHEMA.md](tools/SCHEMA.md). Chapter 1's lessons are authored in `tools/build-ch1.py`; chapters 2 and 3 are edited directly in `data/ch2.json` / `data/ch3.json`.
```
node tools/validate.js                                   # check ids, answers, schema
node tools/gen-docs.js                                   # regenerate chapters/*/ docs
pip install piper-tts                                     # GPL build tool, not vendored
python tools/gen-audio.py --voices-dir ./voices          # only changed items are regenerated; see script header
```
Bump `CACHE` in `sw.js` when you change shell files so installed copies update.
Proofread new Spanish before generating audio: the audio bakes in any mistake.
