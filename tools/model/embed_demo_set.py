"""Precompute the demo-set vectors and the Explainer's PCA map.

Uses exactly the browser model files (same tokenizer.json, same prefixes,
same pooling and normalisation; see common.py), so the precomputed vectors
match what the browser would compute. Run it again whenever the model
changes, against the files that are actually uploaded:

    uv run python embed_demo_set.py                  # uses ./out
    uv run python embed_demo_set.py --model-dir path/to/downloaded/files

Writes:
    src/data/demo-set.json            the demo set with vectors and model fingerprint
    src/data/suggestion-vectors.json  query vectors of the suggestion chips (tests only)
    src/data/pca-map.json             2D PCA of a small set for the Explainer
"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

from common import PASSAGE_PREFIX, QUERY_PREFIX, embed_onnx, load_session, load_tokenizer

HERE = Path(__file__).parent
DATA = HERE.parent.parent / "src" / "data"

# Keep in step with src/data/suggestions.js (a test checks this).
SUGGESTIONS = [
    "un chat qui dort",
    "the train is late again",
    "Ich trinke gern Kaffee",
    "il pleut toute la journée",
    "お金を払う",
    "spring flowers",
]

# For the Explainer's map: four meanings, each in four languages. Written for
# this demo (not from Tatoeba).
PCA_SET = {
    "a cat asleep": {"jpn": "猫が眠っている。", "fra": "Le chat dort.", "deu": "Die Katze schläft.",
                     "eng": "The cat is asleep."},
    "rain": {"jpn": "外は雨が降っている。", "fra": "Il pleut dehors.", "deu": "Draußen regnet es.",
             "eng": "It is raining outside."},
    "coffee": {"jpn": "私はコーヒーが好きです。", "fra": "J'aime le café.", "deu": "Ich mag Kaffee.",
               "eng": "I like coffee."},
    "a late train": {"jpn": "電車が遅れている。", "fra": "Le train est en retard.",
                     "deu": "Der Zug hat Verspätung.", "eng": "The train is late."},
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 24), b""):
            h.update(chunk)
    return h.hexdigest()


def rounded(v: np.ndarray) -> list[float]:
    return [round(float(x), 5) for x in v]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path, default=HERE / "out")
    args = parser.parse_args()
    model_path = args.model_dir / "model.onnx"
    session = load_session(model_path)
    tokenizer = load_tokenizer(args.model_dir)
    fingerprint = sha256(model_path)

    sentences = json.loads((HERE / "demo_sentences.json").read_text())
    vectors = embed_onnx(session, tokenizer, [s["text"] for s in sentences], PASSAGE_PREFIX)
    items = [{"id": f"tatoeba-{s['sourceId']}", **s, "vector": rounded(v)} for s, v in zip(sentences, vectors)]
    demo = {"model": {"label": "Nemotron-3-Embed-1B (int8)", "sha256": fingerprint},
            "prefix": PASSAGE_PREFIX, "items": items}
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "demo-set.json").write_text(json.dumps(demo, ensure_ascii=False) + "\n")

    queries = embed_onnx(session, tokenizer, SUGGESTIONS, QUERY_PREFIX)
    (DATA / "suggestion-vectors.json").write_text(json.dumps(
        {"sha256": fingerprint, "queries": [{"text": t, "vector": rounded(v)} for t, v in zip(SUGGESTIONS, queries)]},
        ensure_ascii=False) + "\n")
    for text, q in zip(SUGGESTIONS, queries):
        sims = vectors @ q
        order = np.argsort(-sims)[:6]
        print(f"\n{text!r}")
        for i in order:
            print(f"  {sims[i]:.3f}  {sentences[i]['text']}")

    # PCA: centre the vectors, take the two directions of largest variance
    # (the first two right-singular vectors) and project onto them.
    labels = [(group, lang, text) for group, langs in PCA_SET.items() for lang, text in langs.items()]
    pv = embed_onnx(session, tokenizer, [t for _, _, t in labels], PASSAGE_PREFIX)
    centred = pv - pv.mean(axis=0)
    _, s, vt = np.linalg.svd(centred, full_matrices=False)
    xy = centred @ vt[:2].T
    xy /= np.abs(xy).max()
    explained = float((s[:2] ** 2).sum() / (s ** 2).sum())
    points = [{"group": g, "lang": lang, "text": t, "x": round(float(x), 4), "y": round(float(y), 4)}
              for (g, lang, t), (x, y) in zip(labels, xy)]
    (DATA / "pca-map.json").write_text(json.dumps(
        {"explainedVariance": round(explained, 3), "points": points}, ensure_ascii=False, indent=1) + "\n")
    print(f"\nPCA: the two axes keep {explained:.0%} of the variance")
    for p in points:
        print(f"  {p['x']:+.2f} {p['y']:+.2f}  {p['group']:<13} {p['lang']}  {p['text']}")
    print(f"\nModel fingerprint {fingerprint}")


if __name__ == "__main__":
    main()
