#!/usr/bin/env python3
"""Generate app audio with Piper (offline, build-time only) and encode to AAC .m4a (macOS afconvert).

Usage:  python tools/gen-audio.py --voices-dir DIR [--only es] [--espeak-dir DIR]
        --espeak-dir: some piper-tts wheels fail to find their bundled espeak data ("Error processing file .../phontab");
        copy site-packages/piper/espeak-ng-data to DIR/espeak-ng-data and pass DIR.
Needs:  pip install piper-tts   (GPL-3 engine; never vendored here, output audio is not a derivative)
Voice:  es_ES-davefx-medium (CC0 data, see NOTICE for lineage) -> audio/es/
Output: audio/<voice>/<id>.m4a  (+ <id>-slow.m4a for phrases and dialogue lines), audio/manifest.json (text hashes, so unchanged items are skipped)
"""
import argparse, hashlib, json, subprocess, sys, tempfile, wave
from pathlib import Path

from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parent.parent
VOICES = {"es": "es_ES-davefx-medium"}
SLOW = 1.4  # length_scale; >1 = slower
# one-letter words come out nearly silent on their own, so they are voiced inside a tiny phrase
OVERRIDE = {"y": "uno y dos", "a": "voy a casa"}


def items():
    """Yield (id, text, want_slow) for everything the app can speak. Rule: anything with an id and Spanish text gets audio."""
    def load(f):
        return json.loads((ROOT / "data" / f).read_text())

    def clean(t):
        return t.replace("«", "").replace("»", "")

    subj = ["yo", "tú", "él", "nosotros", "vosotros", "ellos"]

    def verb_items(v):
        for i, form in enumerate(v["forms"]):
            # reflexive forms already carry the pronoun ("me llamo")
            yield f"{v['id']}-{i}", form if v["type"] == "reflexive" else f"{subj[i]} {form}", False
        for i, form in enumerate((v.get("tenses") or {}).get("pret", [])):
            yield f"{v['id']}-pret-{i}", f"{subj[i]} {form}", False  # imperfect/perfect forms use browser TTS

    for it in load("vocab.json")["items"]:
        yield it["id"], clean(it["es"]), False
    for it in load("phrases.json")["items"]:
        yield it["id"], clean(it["es"]), True
    for v in load("verbs.json")["items"]:
        yield from verb_items(v)
    for f in sorted((ROOT / "data").glob("ch*.json")):
        c = json.loads(f.read_text())
        for it in c.get("vocab", []):
            yield it["id"], clean(it["es"]), False
        for it in c.get("phrases", []):
            yield it["id"], clean(it["es"]), True
        for v in c.get("verbs", []):
            yield from verb_items(v)
        for l in c.get("lessons", []):
            for card in l["cards"]:
                for e in card.get("examples", []):
                    yield e["id"], clean(e["es"]), False
        for d in c.get("drills", []):
            yield d["full"]["id"], clean(d["full"]["es"]), False
        for dlg in c.get("dialogues", []):
            for line in dlg["lines"]:
                yield line["id"], clean(line["es"]), True


def synth(voice, text, scale, out):
    text = OVERRIDE.get(text, text)
    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / "a.wav"
        with wave.open(str(wav), "wb") as w:
            voice.synthesize_wav(text, w, syn_config=SynthesisConfig(length_scale=scale))
        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "40000", str(wav), str(out)], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voices-dir", required=True, type=Path)
    ap.add_argument("--only", choices=VOICES)
    ap.add_argument("--espeak-dir", type=Path, help="parent dir containing espeak-ng-data")
    args = ap.parse_args()

    mpath = ROOT / "audio" / "manifest.json"
    manifest = json.loads(mpath.read_text()) if mpath.exists() else {}
    for key, name in VOICES.items():
        if args.only and key != args.only:
            continue
        voice = PiperVoice.load(args.voices_dir / f"{name}.onnx", **({"espeak_data_dir": args.espeak_dir} if args.espeak_dir else {}))
        made = 0
        for id_, text, slow in items():
            variants = [("", 1.0)] + ([("-slow", SLOW)] if slow else [])
            for suffix, scale in variants:
                if len(text) <= 3:
                    scale = round(scale * 1.7, 2)  # one-syllable words are inaudibly short at normal speed
                out = ROOT / "audio" / key / f"{id_}{suffix}.m4a"
                h = hashlib.sha1(f"{name}|{scale}|{text}".encode()).hexdigest()[:12]
                k = f"{key}/{id_}{suffix}"
                if manifest.get(k) == h and out.exists():
                    continue
                synth(voice, text, scale, out)
                manifest[k] = h
                made += 1
        # prune clips whose item no longer exists
        keep = {f"{i}{sfx}" for i, _, slow in items() for sfx in (["", "-slow"] if slow else [""])}
        gone = [f for f in (ROOT / "audio" / key).glob("*.m4a") if f.stem not in keep]
        for f in gone:
            f.unlink(); manifest.pop(f"{key}/{f.stem}", None)
        print(f"{key}: generated {made}, pruned {len(gone)}")
    mpath.write_text(json.dumps(manifest, indent=0, sort_keys=True))


if __name__ == "__main__":
    sys.exit(main())
