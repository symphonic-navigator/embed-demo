# Open items for Chris

Embedding playground, overnighter run of 2026-11-16. Pull request: https://github.com/symphonic-navigator/embed-demo/pull/1

1. **Upload the model** to `SCAI-NGO/nemotron-3-embed-1b-onnx-web` by following [`docs/hf-upload.md`](docs/hf-upload.md)
   (export, validate, `hf auth login` with a fine-grained token, `hf upload`, CORS check). Until then the deployed
   page cannot load a model.
2. **Re-run the demo-set embeddings against the uploaded model** and commit the result:
   `cd tools/model && uv run python embed_demo_set.py --model-dir <uploaded folder>`. The committed vectors come
   from this run's export (SHA-256 `9016fbd1…ccea75e`). A fresh export in the same run reproduced that exact hash,
   so if your `build-info.json` shows the same value nothing needs to change. Otherwise the app logs a console
   warning about stale demo vectors.
3. **Enable GitHub Pages** (Settings → Pages → Source: GitHub Actions). `.github/workflows/pages.yml` then deploys on
   every push to `master`, or run it by hand (`workflow_dispatch`).
4. **Decide on threads (coi-serviceworker or similar).** GitHub Pages cannot send COOP/COEP headers, so WASM runs
   single-threaded. Measured in headless Chromium on a 4-vCPU Xeon (2.1 GHz): about **5.0 s per short text single-threaded**
   versus about **2.9 s with threads** (cross-origin isolated). Text length matters too (single thread: 64 tokens 10 s,
   128 tokens 16 s, 256 tokens 31 s, 512 tokens 52 s). Enabling threads needs a third-party service-worker script
   (`coi-serviceworker`), which was deliberately not added.
5. **WebGPU speed is unmeasured.** No GPU was available. The WebGPU path was checked for correctness only, with a
   software GPU (SwiftShader): the session initialises and all 12 test vectors match WASM (cosine 1.000000). Real
   GPU timings are still to be measured on a desktop.
6. **Model size and speed are the main user-facing risks.** 4-bit builds (0.7–0.9 GB) failed the quality bar
   (minimum cosine 0.952–0.955 against the 0.99 bar, rankings changed), so the app ships int8 (1.25 GB). If a
   smaller download matters more than the 0.99 bar, a calibrated 4-bit export (e.g. GPTQ/AWQ-style, mixed precision)
   would be the next experiment.
7. **Private/incognito windows do not cache the model** (Chromium refuses a 1.25 GB Cache API entry there), so those
   visitors download it every time. Normal windows cache it (verified by `pnpm smoke`).
8. **Tatoeba endpoint:** the app uses `https://api.tatoeba.org/v1/sentences` (the documented, versioned form of the
   `/unstable/` endpoint; same shape, CORS `*`; verified live on 2026-11-16). If you prefer `/unstable/`, change
   `TATOEBA_API` in `src/lib/tatoeba.js`.
