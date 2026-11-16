# Uploading the browser model to Hugging Face

The app loads its model from `https://huggingface.co/SCAI-NGO/nemotron-3-embed-1b-onnx-web/resolve/main/`. The
repository already exists and is empty. These steps fill it. Nothing here needs to happen in CI, and the token never
goes into the repository or the build.

## 1. Export and validate the model

```bash
cd tools/model
uv run python export.py
uv run python validate.py        # must end with PASS
rm -rf out-src                   # free 4.6 GB
```

`out/` now holds:

| File | Size | Purpose |
| --- | --- | --- |
| `model.onnx` | 1.25 GB | quantised graph with weights (int8) |
| `tokenizer.json`, `tokenizer_config.json` | 17 MB | the original NVIDIA tokenizer |
| `config.json` | 1 KB | model configuration, for reference |
| `LICENSE` | 3 KB | OpenMDW-1.1 text with NVIDIA's copyright line (required when redistributing) |
| `NOTICE` | 1 KB | notices of origin (required when redistributing) |
| `README.md` | 3 KB | the model card: base model, what was changed, quality, licence and attribution |
| `build-info.json` | 1 KB | source revisions, quantisation settings, SHA-256 of `model.onnx` |

The SHA-256 of the run that produced the committed demo vectors was
`9016fbd1ace6e42795ef2daf92e7e10cdc8094e700c92c64639f69856ccea75e`. If yours matches (see `build-info.json`),
the committed demo vectors fit your files. If not, do step 6.

## 2. Install the Hugging Face CLI

```bash
uv tool install huggingface_hub
hf version
```

## 3. Create a token and log in

1. On https://huggingface.co/settings/tokens create a **fine-grained** token.
2. Give it **write** access to repositories of the **SCAI-NGO** organisation only (nothing else).
3. Log in and paste the token when asked (it is stored in your user profile, not in this repository):

```bash
hf auth login
hf auth whoami
```

## 4. Upload

```bash
hf upload SCAI-NGO/nemotron-3-embed-1b-onnx-web tools/model/out . --commit-message "Add int8 browser build"
```

`hf upload` handles the large file itself (Xet/LFS). The `README.md` in the folder becomes the model card. Look over
it on the repository page; it already states the base model, the quantisation, the OpenMDW-1.1 licence and the
attribution the licence requires (licence text and notices are uploaded alongside).

## 5. Check that the browser can fetch the files (CORS)

```bash
curl -sI -H "Origin: https://symphonic-navigator.github.io" \
  https://huggingface.co/SCAI-NGO/nemotron-3-embed-1b-onnx-web/resolve/main/tokenizer_config.json \
  | grep -iE "^HTTP|access-control-allow-origin"

curl -sIL -H "Origin: https://symphonic-navigator.github.io" \
  https://huggingface.co/SCAI-NGO/nemotron-3-embed-1b-onnx-web/resolve/main/model.onnx \
  | grep -iE "^HTTP|^location|access-control-allow-origin|content-length"
```

Expected: `HTTP/2 200` (or a `302` to the CDN followed by `200`), `access-control-allow-origin` present on every
hop, and a `content-length` of about 1252692075 for `model.onnx`. The repository must be **public**.

Then open the deployed page (or `pnpm dev` without `VITE_MODEL_BASE_URL`), watch the progress bar fill, and check
the browser console: there should be no warning that the model fingerprint differs from the demo vectors.

## 6. If the fingerprint differs: regenerate the demo vectors

The demo-set vectors must come from exactly the uploaded files.

```bash
cd tools/model
uv run python embed_demo_set.py --model-dir out
git add ../../src/data/demo-set.json ../../src/data/suggestion-vectors.json ../../src/data/pca-map.json
git commit -m "Regenerate demo embeddings for the uploaded model"
```

Run `pnpm test` afterwards: `src/data/defaults.test.js` checks that the default slider values still show both lines
for the first suggestion.
