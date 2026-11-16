"""Embedding with the browser model files, exactly as the browser does it.

Same tokenizer.json, same prefixes, one text per run (batch 1, so there is no
padding), mean pooling over the attention mask and L2 normalisation. Keep this
in step with src/lib/vector.js and src/worker/embed.worker.js.
"""

from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

QUERY_PREFIX = "query: "
PASSAGE_PREFIX = "passage: "
MAX_TOKENS = 256  # longer texts are truncated (and the UI says so): 512 tokens take about 50 s on single-threaded WASM


def load_tokenizer(model_dir: Path) -> Tokenizer:
    return Tokenizer.from_file(str(model_dir / "tokenizer.json"))


def load_session(model_path: Path) -> ort.InferenceSession:
    return ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])


def embed_onnx(session: ort.InferenceSession, tokenizer: Tokenizer, texts: list[str], prefix: str) -> np.ndarray:
    vectors = []
    for text in texts:
        ids = tokenizer.encode(prefix + text).ids[:MAX_TOKENS]
        input_ids = np.array([ids], dtype=np.int64)
        mask = np.ones_like(input_ids)
        hidden = session.run(["last_hidden_state"], {"input_ids": input_ids, "attention_mask": mask})[0][0]
        v = hidden.mean(axis=0)  # mean pooling; every token is real because there is no padding
        vectors.append(v / np.linalg.norm(v))
    return np.stack(vectors).astype(np.float32)
