# Spanish basics

Compact Spanish reference and exercises for English speakers, plus a small app with spoken audio.
Inspired by [rust-for-java-devs](https://github.com/coos88/rust-for-java-devs): terse tables, no fluff.

**App: https://coos88.github.io/spanish/** (installable, works offline)

- [Cheat sheet](CHEATSHEET.md): pronunciation, gender, present tense, ser/estar, questions, numbers, gustar, ir a...
- [In practice](PRACTICE.md): Spain vs LatAm, false friends, habits to unlearn, how to study
- [Vocab](VOCAB.md): 175 words by theme (generated)
- [Phrases](PHRASES.md): 54 survival phrases (generated)
- [Exercises](exercises/README.md): 6 short worksheets with answer keys

## The app
Flashcards (spaced repetition), quiz (hear it / EN→ES / ES→EN, pick or type), present-tense verb drill, a browsable phrasebook, and a *Say it* box that speaks any text.
Spain Spanish voice. Progress lives in your browser only (localStorage).

Audio is pre-generated with [Piper](https://github.com/OHF-Voice/piper1-gpl) (see [NOTICE](NOTICE)) so it sounds the same on every device. Only the *Say it* box uses your browser's own speech voices.

## Run it
It's static files; no build step.
```
python3 -m http.server 8000        # then open http://localhost:8000
docker compose up -d --build       # or: nginx on http://localhost:8080 (NAS)
```
Deploys to GitHub Pages on every push to `main` (`.github/workflows/pages.yml`).

## Change the content
Everything is in `data/*.json`.
```
node tools/gen-docs.js                                   # regenerate VOCAB.md / PHRASES.md
pip install piper-tts                                     # GPL build tool, not vendored
python tools/gen-audio.py --voices-dir ./voices          # only changed items are regenerated; see script header
```
Bump `CACHE` in `sw.js` when you change shell files so installed copies update.
Proofread new Spanish before generating audio: the audio bakes in any mistake.
