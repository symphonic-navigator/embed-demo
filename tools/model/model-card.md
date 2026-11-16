---
license: other
license_name: openmdw-1.1
license_link: LICENSE
base_model: nvidia/Nemotron-3-Embed-1B-BF16
pipeline_tag: feature-extraction
library_name: onnxruntime
tags:
  - onnx
  - embeddings
  - onnxruntime-web
  - int8
language:
  - multilingual
---

# Nemotron-3-Embed-1B, int8 ONNX for the browser

A quantised ONNX build of [nvidia/Nemotron-3-Embed-1B-BF16](https://huggingface.co/nvidia/Nemotron-3-Embed-1B-BF16)
made for running in a web browser with [onnxruntime-web](https://onnxruntime.ai/) (WASM or WebGPU). It powers the
[embedding playground](https://github.com/symphonic-navigator/embed-demo) by Second Circuit.

## What was changed

This is a modified version of the NVIDIA model:

- Converted to ONNX: the graph is the community export
  [kzzalews/Nemotron-3-Embed-1B-BF16-onnx](https://huggingface.co/kzzalews/Nemotron-3-Embed-1B-BF16-onnx) (fp32,
  bidirectional attention, validated against the original weights).
- Quantised: every MatMul weight is stored as 8-bit blocks (ONNX Runtime `MatMulNBits`, symmetric, block size 32),
  and the token embedding table as int8 with one scale per row.
- The graph outputs `last_hidden_state`. Mean pooling over the attention mask and L2 normalisation are done by the
  caller. Prefix queries with `query: ` and documents with `passage: `.

Exact source revisions, settings and the SHA-256 of `model.onnx` are in `build-info.json`. The files are produced
by `tools/model/export.py` in the playground repository.

## Quality

Compared with the original BF16 model (Sentence Transformers, float32 on CPU) on 16 multilingual test sentences
(Japanese, French, German, English): minimum cosine similarity 0.99988, mean 0.99994, and identical rankings for all
four test queries (`tools/model/validate.py`).

## Licence and attribution

The model materials are licensed under the OpenMDW License Agreement, version 1.1 (OpenMDW-1.1); see `LICENSE`.
Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. The notices of origin that come with the model are kept in
`NOTICE` (the model derives from mistralai/Ministral-3-3B-Instruct-2512, Apache-2.0). This build was modified as
described above by Second Circuit – Association for digital freedom of thought (https://scai.world).
