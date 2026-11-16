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
    uv run python export.py                 # default build, writes to ./out
    uv run python export.py --matmul-bits 8 --gather-bits 4 --out out-try
"""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper
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


def quantise_nbits(model: onnx.ModelProto, op_type: str, bits: int, block_size: int,
                   accuracy_level: int | None = None) -> onnx.ModelProto:
    # Gather is quantised along the hidden axis (1), MatMul weights along the input axis (0).
    quantiser = mnq.MatMulNBitsQuantizer(
        model, bits=bits, block_size=block_size, is_symmetric=True, accuracy_level=accuracy_level,
        op_types_to_quantize=(op_type,), quant_axes=((op_type, 1 if op_type == "Gather" else 0),),
    )
    quantiser.process()
    return quantiser.model.model


def quantise_embedding_int8(model: onnx.ModelProto) -> None:
    """Replace the embedding Gather by int8 rows with one float scale per row.

    The quantiser only offers 4-bit Gather. Here each token's row is stored as
    int8 and scaled back after the lookup, so only the looked-up rows are ever
    turned into floats: Gather(int8 table) -> Cast -> Mul(Gather(scales)).
    Built from standard ONNX operators only.
    """
    graph = model.graph
    init = {t.name: t for t in graph.initializer}
    node = next(n for n in graph.node if n.op_type == "Gather" and n.input[0] in init
                and len(init[n.input[0]].dims) == 2)
    weight = numpy_helper.to_array(init[node.input[0]])
    scales = np.abs(weight).max(axis=1, keepdims=True) / 127.0
    scales[scales == 0] = 1.0
    q = np.clip(np.round(weight / scales), -127, 127).astype(np.int8)
    name = node.input[0]
    graph.initializer.remove(init[name])
    graph.initializer.extend([numpy_helper.from_array(q, name + "_int8"),
                              numpy_helper.from_array(scales.astype(np.float32), name + "_scale")])
    ids, out = node.input[1], node.output[0]
    new_nodes = [
        helper.make_node("Gather", [name + "_int8", ids], [out + "_int8"], name="embed_gather_int8"),
        helper.make_node("Cast", [out + "_int8"], [out + "_f"], to=TensorProto.FLOAT, name="embed_cast"),
        helper.make_node("Gather", [name + "_scale", ids], [out + "_s"], name="embed_gather_scale"),
        helper.make_node("Mul", [out + "_f", out + "_s"], [out], name="embed_scale"),
    ]
    index = list(graph.node).index(node)
    graph.node.remove(node)
    for offset, n in enumerate(new_nodes):
        graph.node.insert(index + offset, n)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--matmul-bits", type=int, choices=[4, 8], default=8)
    parser.add_argument("--accuracy-level", type=int, choices=[0, 1, 2, 3, 4], default=None,
                        help="MatMulNBits compute precision; 4 = int8 activations (faster on CPU)")
    parser.add_argument("--gather-bits", type=int, choices=[4, 8], default=8)
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

    # MatMul weights become MatMulNBits, which has WASM and WebGPU kernels.
    print(f"Quantising MatMul weights to {args.matmul_bits}-bit blocks of {args.block_size}…")
    model = quantise_nbits(model, "MatMul", args.matmul_bits, args.block_size, args.accuracy_level)
    # The 131072 x 2048 token embedding table (a quarter of all parameters) is a Gather.
    print(f"Quantising the embedding table to {args.gather_bits} bits…")
    if args.gather_bits == 4:
        model = quantise_nbits(model, "Gather", 4, args.block_size)
    else:
        quantise_embedding_int8(model)

    target = args.out / "model.onnx"
    onnx.save_model(model, target)
    print(f"Wrote {target} ({target.stat().st_size / 1e6:.0f} MB)")

    info = {
        "base_model": f"{BASE_REPO}@{BASE_REVISION}",
        "onnx_source": f"{ONNX_REPO}@{ONNX_REVISION}",
        "quantisation": {
            "matmul": f"MatMulNBits, {args.matmul_bits}-bit, symmetric, block size {args.block_size}",
            "accuracy_level": args.accuracy_level,
            "embedding": (f"GatherBlockQuantized, 4-bit, block size {args.block_size}" if args.gather_bits == 4
                          else "int8 per row (Gather + Cast + Mul)"),
        },
        "model_onnx_sha256": sha256(target),
    }
    (args.out / "build-info.json").write_text(json.dumps(info, indent=2) + "\n")
    print(json.dumps(info, indent=2))


if __name__ == "__main__":
    main()
