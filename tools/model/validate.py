"""Compare the browser ONNX model with the original BF16 model.

The reference runs the original nvidia/Nemotron-3-Embed-1B-BF16 weights with
Sentence Transformers on CPU in float32 (encode_query / encode_document, so the
model's own prompts and pooling are used). The candidate runs the ONNX file with
common.embed_onnx, the same way the browser does.

Passes when every per-sentence cosine is at least 0.99 and every test query
ranks the passages in the same order as the reference.

Usage:
    uv run python validate.py                      # checks out/model.onnx
    uv run python validate.py --model out-src/model.onnx
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import torch
from huggingface_hub import snapshot_download
from sentence_transformers import SentenceTransformer

from common import PASSAGE_PREFIX, QUERY_PREFIX, embed_onnx, load_session, load_tokenizer
from export import BASE_REPO, BASE_REVISION
from test_sentences import PASSAGES, QUERIES

MIN_COSINE = 0.99


def main() -> int:
    parser = argparse.ArgumentParser()
    here = Path(__file__).parent
    parser.add_argument("--model", type=Path, default=here / "out" / "model.onnx")
    parser.add_argument("--tokenizer-dir", type=Path, default=here / "out")
    args = parser.parse_args()
    if not args.model.exists():
        print(f"model not found: {args.model} (run export.py first)")
        return 1

    queries = [q for q, _ in QUERIES]
    base = snapshot_download(BASE_REPO, revision=BASE_REVISION)
    st = SentenceTransformer(base, device="cpu",
                             model_kwargs={"torch_dtype": torch.float32, "attn_implementation": "sdpa"})
    ref_p = st.encode_document(PASSAGES, normalize_embeddings=True)
    ref_q = st.encode_query(queries, normalize_embeddings=True)
    del st

    session = load_session(args.model)
    tokenizer = load_tokenizer(args.tokenizer_dir)
    onnx_p = embed_onnx(session, tokenizer, PASSAGES, PASSAGE_PREFIX)
    onnx_q = embed_onnx(session, tokenizer, queries, QUERY_PREFIX)

    ok = True
    print(f"Model: {args.model} ({args.model.stat().st_size / 1e6:.0f} MB)\n")
    print("Per-sentence cosine (ONNX vs BF16 reference):")
    cosines = []
    for text, a, b in zip(PASSAGES + queries, np.vstack([onnx_p, onnx_q]), np.vstack([ref_p, ref_q])):
        c = float(a @ b)
        cosines.append(c)
        print(f"  {c:.5f}  {text}")
    print(f"  min {min(cosines):.5f}  mean {np.mean(cosines):.5f}")
    if min(cosines) < MIN_COSINE:
        ok = False
        print(f"FAIL: a cosine is below {MIN_COSINE}")

    print("\nRankings (passage indices, best first):")
    for (query, expected), rq, oq in zip(QUERIES, ref_q, onnx_q):
        ref_rank = list(np.argsort(-(ref_p @ rq)))
        onnx_rank = list(np.argsort(-(onnx_p @ oq)))
        same = ref_rank == onnx_rank
        print(f"  {query!r}: reference {ref_rank} onnx {onnx_rank} {'same' if same else 'DIFFERENT'}")
        print(f"    top similarity reference {float(ref_p[ref_rank[0]] @ rq):.3f} onnx {float(onnx_p[onnx_rank[0]] @ oq):.3f}")
        if not same:
            ok = False
        if ref_rank[0] != expected:
            print(f"    note: the reference itself ranks passage {ref_rank[0]} first, expected {expected}")

    print("\nPASS" if ok else "\nFAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
