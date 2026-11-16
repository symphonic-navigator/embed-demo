# embed-demo: vector embeddings, hands on

A small, self-explanatory web page where curious people can *play* with real vector embeddings. It has two parts:

- **Explainer**: what an embedding is, king − man + woman, meaning in context, a map of texts across languages,
  the cosine, top-k / top-p / temperature, and where embeddings help and where they mislead.
- **Playground**: semantic search over a small, mostly Japanese text collection from Tatoeba (or your own texts),
  with every text listed by similarity, live top-k, top-p and temperature sliders, a k line and a p line, and an
  "angle fan" that draws each result at its exact angle to the query.

The embeddings are real: NVIDIA's **Nemotron-3-Embed-1B**, quantised to int8 (1.25 GB), runs locally in the
browser with onnxruntime-web (WebGPU when available, otherwise WebAssembly on the CPU). There is no backend. Texts
you add stay in your browser.

A teaching tool by [Second Circuit – Association for digital freedom of thought](https://scai.world).

## Prerequisites

- Node.js 22 LTS or newer, with corepack (`corepack enable` provides the pinned pnpm)
- For the model tooling only: [uv](https://docs.astral.sh/uv/) and about 20 GB of free disk and 16 GB of RAM
- For the smoke check: Chromium via Playwright (`pnpm exec playwright install chromium`, or set `CHROMIUM_PATH`)

## Installation

```bash
corepack enable
pnpm install
```

## Usage

```bash
pnpm dev        # development server on http://localhost:5173/
pnpm build      # production build in dist/ (base path /embed-demo/ for GitHub Pages)
pnpm preview    # serve the build on http://localhost:4173/embed-demo/
```

By default the app loads the model from the Hugging Face repository
[`SCAI-NGO/nemotron-3-embed-1b-onnx-web`](https://huggingface.co/SCAI-NGO/nemotron-3-embed-1b-onnx-web). The first
visit downloads about 1.25 GB; the files are then kept in the browser's Cache API, so later visits start within
seconds (not in private/incognito windows, which refuse to store that much).

## Development setup

To work without the Hugging Face repository (or before the model is uploaded), export the model locally (see
below) and serve it on a second port with the CORS header the browser needs:

```bash
pnpm serve-model                                   # serves tools/model/out/ on http://localhost:8765/
VITE_MODEL_BASE_URL=http://localhost:8765/ pnpm dev
```

The model folder deliberately lives outside `public/`, so the 1.25 GB file never ends up in `dist/`.

Checks:

```bash
pnpm install --frozen-lockfile && pnpm test && pnpm lint && pnpm build
pnpm smoke                                         # needs tools/model/out/; builds, serves and drives the app
cd tools/model && uv run python validate.py        # ONNX model against the original BF16 model
```

`pnpm smoke` walks through the whole visitor journey in headless Chromium (Explainer and progress, Playground, the
first suggestion, sliders, the angle fan, live Tatoeba sentences, my texts across a reload, the phone view). It
fails on any request to a host other than the site, the model server and `api.tatoeba.org`, and checks that the
second load fetches nothing from the model server.

## Environment variables

| Variable | What it does | Format | Example |
| --- | --- | --- | --- |
| `VITE_MODEL_BASE_URL` | Base URL of the folder with `model.onnx`, `tokenizer.json` and `tokenizer_config.json`. Read at build time. Unset: the Hugging Face repository above. | Absolute URL ending with `/` | `http://localhost:8765/` |
| `MODEL_DIR` | Folder served by `pnpm serve-model`. | Path | `tools/model/out` (default) |
| `PORT` | Port of `pnpm serve-model`. | Number | `8765` (default) |
| `CHROMIUM_PATH` | Browser binary for `pnpm smoke`, if Playwright's own Chromium is not installed. | Path | `/opt/pw-browsers/chromium` |

See `.env.example`. The app has no secrets and needs none.

## Regenerating the model and the demo embeddings

Everything lives in `tools/model/` (Python, managed with uv, versions pinned in `uv.lock`).

```bash
cd tools/model
uv run python export.py           # downloads the sources (~7 GB), writes the browser model to out/
uv run python validate.py         # must print PASS: cosine >= 0.99 per sentence, identical rankings
rm -rf out-src                    # the 4.6 GB fp32 download is no longer needed
uv run python embed_demo_set.py   # writes src/data/demo-set.json, suggestion-vectors.json, pca-map.json
```

- `export.py` takes the community fp32 ONNX export of `nvidia/Nemotron-3-Embed-1B-BF16` (both at pinned
  revisions), quantises MatMul weights to 8-bit blocks and the embedding table to int8, and adds the original
  tokenizer, licence, notice and a model card. Every 4-bit variant failed the quality bar (minimum cosine about
  0.95), so int8 is the default.
- `embed_demo_set.py` embeds the curated sentences in `demo_sentences.json` with exactly the browser's method
  (same tokenizer, `passage: ` prefix, mean pooling, L2 normalisation) and stores the SHA-256 of `model.onnx`. The
  app warns in the console when the loaded model's fingerprint differs, because then the demo vectors are stale.
- `curate_demo_set.py` refreshes `demo_sentences.json` from the Tatoeba API (the curation is the id list in it).

**After uploading a new model**, download the uploaded files (or use the folder you uploaded), run
`uv run python embed_demo_set.py --model-dir <that folder>` and commit the three JSON files. The demo vectors must
come from exactly the files the browser loads. Uploading is described in [`docs/hf-upload.md`](docs/hf-upload.md).

## Deployment

`.github/workflows/pages.yml` builds and deploys to GitHub Pages on every push to `master` (and by hand). Pages must
first be enabled in the repository settings with "GitHub Actions" as the source. `.github/workflows/ci.yml` runs
tests, lint and build on pull requests.

## Attribution

- Sentences from [Tatoeba](https://tatoeba.org), CC BY 2.0 FR. The ids of the curated sentences are in
  `tools/model/demo_sentences.json` and linked from each result.
- Embedding model: [NVIDIA Nemotron-3-Embed-1B](https://huggingface.co/nvidia/Nemotron-3-Embed-1B-BF16),
  Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES, licensed under OpenMDW-1.1. The browser build is a modified
  (quantised) version; its model card, licence text and notices travel with the model files.
- ONNX conversion: [kzzalews/Nemotron-3-Embed-1B-BF16-onnx](https://huggingface.co/kzzalews/Nemotron-3-Embed-1B-BF16-onnx).

## Licence

GNU Affero General Public License v3.0, see [`LICENSE`](LICENSE).
