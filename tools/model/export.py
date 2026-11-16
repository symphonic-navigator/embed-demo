"""Build the browser model for the embedding playground.

Downloads the community fp32 ONNX export of nvidia/Nemotron-3-Embed-1B-BF16
(validated against the original model by validate.py), quantises its weights
to 4-bit (or 8-bit) blocks with ONNX Runtime's MatMulNBits quantiser and writes
everything the browser needs into one folder, ready for `hf upload`:

    model.onnx              quantised graph with weights inside (single file)
    tokenizer.json          the original NVIDIA tokenizer
    tokenizer_config.json
    config.json             model configuration (for reference)
    LICENSE, NOTICE         licence text and notices required by OpenMDW-1.1
    build-info.json         source revisions, quantisation settings, SHA-256

The graph outputs `last_hidden_state`; mean pooling and L2 normalisation
happen in JavaScript (src/lib/vector.js) and in embed_demo_set.py.

Usage:
    uv run python export.py                 # q4, writes to ./out
    uv run python export.py --bits 8 --out out-q8
"""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

import onnx
from huggingface_hub import hf_hub_download
from onnxruntime.quantization import matmul_nbits_quantizer as mnq

# Pinned sources: change these deliberately, never implicitly.
BASE_REPO = "nvidia/Nemotron-3-Embed-1B-BF16"
BASE_REVISION = "c0c9fea93ea424587517f2c59e20db9f1d6bf615"
ONNX_REPO = "kzzalews/Nemotron-3-Embed-1B-BF16-onnx"
ONNX_REVISION = "d1a7e40269d80090791bdc37166f4cbf708153b0"

BASE_FILES = ["tokenizer.json", "tokenizer_config.json", "config.json", "LICENSE", "NOTICE"]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 24), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--bits", type=int, choices=[4, 8], default=4)
    parser.add_argument("--block-size", type=int, default=32)
    parser.add_argument("--out", type=Path, default=Path(__file__).parent / "out")
    parser.add_argument("--work", type=Path, default=Path(__file__).parent / "out-src",
                        help="where the fp32 source is downloaded (about 4.6 GB, delete afterwards)")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    print(f"Downloading {ONNX_REPO}@{ONNX_REVISION[:8]} (fp32, about 4.6 GB)…")
    # A real folder rather than the HF cache: onnx refuses symlinked external data.
    src = hf_hub_download(ONNX_REPO, "model.onnx", revision=ONNX_REVISION, local_dir=args.work)
    hf_hub_download(ONNX_REPO, "model.onnx.data", revision=ONNX_REVISION, local_dir=args.work)

    for name in BASE_FILES:
        shutil.copy(hf_hub_download(BASE_REPO, name, revision=BASE_REVISION), args.out / name)

    print("Loading the fp32 graph…")
    model = onnx.load(src)

    # MatMul weights become MatMulNBits (has WASM and WebGPU kernels). The
    # 131072 x 2048 token embedding table (a quarter of all parameters) is a
    # Gather, which becomes GatherBlockQuantized, quantised along the hidden axis.
    print(f"Quantising to {args.bits}-bit blocks of {args.block_size}…")
    quantiser = mnq.MatMulNBitsQuantizer(
        model,
        bits=args.bits,
        block_size=args.block_size,
        is_symmetric=True,
        op_types_to_quantize=("MatMul", "Gather"),
        quant_axes=(("MatMul", 0), ("Gather", 1)),
    )
    quantiser.process()
    del model

    target = args.out / "model.onnx"
    onnx.save_model(quantiser.model.model, target)
    print(f"Wrote {target} ({target.stat().st_size / 1e6:.0f} MB)")

    info = {
        "base_model": f"{BASE_REPO}@{BASE_REVISION}",
        "onnx_source": f"{ONNX_REPO}@{ONNX_REVISION}",
        "quantisation": {"bits": args.bits, "block_size": args.block_size, "symmetric": True,
                         "ops": ["MatMul -> MatMulNBits", "Gather -> GatherBlockQuantized"]},
        "model_onnx_sha256": sha256(target),
    }
    (args.out / "build-info.json").write_text(json.dumps(info, indent=2) + "\n")
    print(json.dumps(info, indent=2))


if __name__ == "__main__":
    main()
