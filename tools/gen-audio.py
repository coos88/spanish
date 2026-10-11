#!/usr/bin/env python3
"""Generate app audio with Piper (offline, build-time only) and encode to AAC .m4a (macOS afconvert).

Usage:  python tools/gen-audio.py --voices-dir DIR [--only es] [--espeak-dir DIR]
        --espeak-dir: some piper-tts wheels fail to find their bundled espeak data ("Error processing file .../phontab");
        copy site-packages/piper/espeak-ng-data to DIR/espeak-ng-data and pass DIR.
Needs:  pip install piper-tts   (GPL-3 engine; never vendored here, output audio is not a derivative)
Voices: es_ES-davefx-medium (CC0) -> audio/es/   es_MX-ald-medium (Unlicense) -> audio/mx/
Output: audio/<voice>/<id>.m4a  (+ <id>-slow.m4a for phrases), audio/manifest.json (text hashes, so unchanged items are skipped)
"""
import argparse, hashlib, json, subprocess, sys, tempfile, wave
from pathlib import Path

from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parent.parent
VOICES = {"es": "es_ES-davefx-medium", "mx": "es_MX-ald-medium"}
SLOW = 1.4  # length_scale; >1 = slower


def items():
    """Yield (id, text, want_slow) for everything the app can speak."""
    for f in ("vocab", "phrases"):
        for it in json.loads((ROOT / "data" / f"{f}.json").read_text())["items"]:
            yield it["id"], it["es"].replace("«", "").replace("»", ""), f == "phrases"
    verbs = json.loads((ROOT / "data" / "verbs.json").read_text())
    subj = ["yo", "tú", "él", "nosotros", "vosotros", "ellos"]
    for v in verbs["items"]:
        for i, form in enumerate(v["forms"]):
            # reflexive forms already carry the pronoun ("me llamo")
            yield f"{v['id']}-{i}", form if v["type"] == "reflexive" else f"{subj[i]} {form}", False


def synth(voice, text, scale, out):
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
                out = ROOT / "audio" / key / f"{id_}{suffix}.m4a"
                h = hashlib.sha1(f"{name}|{scale}|{text}".encode()).hexdigest()[:12]
                k = f"{key}/{id_}{suffix}"
                if manifest.get(k) == h and out.exists():
                    continue
                synth(voice, text, scale, out)
                manifest[k] = h
                made += 1
        print(f"{key}: generated {made}")
    mpath.write_text(json.dumps(manifest, indent=0, sort_keys=True))


if __name__ == "__main__":
    sys.exit(main())
