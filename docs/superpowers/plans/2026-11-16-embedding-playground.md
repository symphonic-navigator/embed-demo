# Embedding Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, self-explanatory browser page (Explainer + Playground) in which non-experts search a small multilingual text collection with real Nemotron-3-Embed-1B embeddings computed locally, and see top-k, top-p and temperature at work.

**Architecture:** Vite + React (JSX) single page. Inference runs in a Web Worker with onnxruntime-web (WebGPU when it initialises, WASM otherwise) on a 4-bit quantised ONNX graph that is fetched from Hugging Face and stored in the Cache API. Tokenisation uses `@huggingface/tokenizers` with the model's `tokenizer.json`. Pure maths lives in small `src/lib/*.js` modules with Vitest tests. Python tooling under `tools/model/` (uv) builds, validates and precomputes the model data.

**Tech Stack:** pnpm, Vite, React, onnxruntime-web, @huggingface/tokenizers, Vitest, fake-indexeddb, ESLint, Playwright (smoke only), uv + Python (torch CPU, sentence-transformers, onnx, onnxruntime).

**Spec:** `docs/superpowers/specs/2026-11-16-embedding-playground-design.md`. Brief: `docs/superpowers/overnighter/2026-11-16-embedding-playground-brief.md`. Executors read both.

## Global Constraints

- British English everywhere: code, comments, UI text, docs ("colour", "initialise", "behaviour", "licence" as a noun).
- Footer on every page: "Second Circuit – Association for digital freedom of thought" linking to https://scai.world, plus Tatoeba attribution ("Sentences from Tatoeba (tatoeba.org), CC BY 2.0 FR."), model credit (NVIDIA Nemotron-3-Embed-1B, OpenMDW-1.1) and the licence (AGPL-3.0).
- All text (user input and Tatoeba) is untrusted and rendered as React text children only. No `dangerouslySetInnerHTML`, no `innerHTML`, no HTML built from data.
- Runtime network access only to: the site's own origin, the model base URL (and the HF CDN hosts it redirects to), and `api.tatoeba.org`. No runtime CDN: ORT `.wasm` files are bundled by Vite.
- Model base URL: one constant, `import.meta.env.VITE_MODEL_BASE_URL` falling back to `https://huggingface.co/SCAI-NGO/nemotron-3-embed-1b-onnx-web/resolve/main/`.
- Full 2048 dimensions; no truncation control.
- Prefixes: queries `query: `, documents `passage: `. Mean pooling over the attention mask, then L2 normalisation.
- Never commit model weights (`*.onnx`, `*.onnx.data`, `*.safetensors`); model outputs live in git-ignored `tools/model/out*/`.
- Python only via uv (`uv add`, `uv run`). JS only via pnpm. `"test": "vitest run"`.
- Dependencies: React, Vite, onnxruntime-web, @huggingface/tokenizers; dev: Vitest, fake-indexeddb, ESLint, Playwright. Nothing else without a recorded reason.
- Commit messages imperative, no Conventional Commits prefix, ending with `Co-Authored-By: Claude <noreply@anthropic.com>`. Push to `feature/embedding-playground` only. Never merge.
- Phase verification: `pnpm install --frozen-lockfile && pnpm test && pnpm lint && pnpm build` (+ `pnpm smoke` once the UI exists); model tooling: `cd tools/model && uv run python validate.py`.

## Review Focus

1. **Tatoeba returns something odd** (empty `data`, missing translations, a 4000-character text, HTML in `text`, a non-JSON error page, network failure): the fetch shows a friendly message, stores nothing invalid, renders any text literally. Pinned by `parseTatoebaResponse` tests in Task 5 and the failure path in Task 10.
2. **Ties and degenerate similarity lists** (all similarities equal, a single text, an empty "My texts" tab, p = 1.00): the p cut never exceeds the list length, an empty tab shows a hint rather than a broken list. Pinned by `topPCount` tests in Task 3 and the empty-state step in Task 10.
3. **Very long pasted text** (a whole chapter): it is still embedded (truncated to `MAX_TOKENS` = 512 tokens, said so in the UI), the hint about one vector for a novel appears, the UI keeps ticking. Pinned by the `truncate` test in Task 2 and Task 10's long-text hint.
4. **Second visit / stale cache**: the model comes from the Cache API with no network request; a model whose SHA-256 differs from the demo-set fingerprint logs a console warning (the stale demo vectors become visible). Pinned by Task 11's cache check and Task 10 Step 5b.
5. **WebGPU session creation fails** (adapter missing, unsupported op): the worker falls back to WASM and reports the backend actually in use. Pinned by `chooseBackends` test in Task 7.

## Plan review (fresh subagent, folded in)

23 findings: 1 blocker (wrong expected `topPCount` in the mock-up check: 2, not 3), 11 important, 11 minor. All were folded in above except: finding 9 (endpoint) is answered by the live discovery recorded in Task 5; findings 8 and 19 were already done in the code; finding 22's "plain arrays" mutation was dropped. Details in the overnighter report.

---

### Task 0: Baseline and scaffold

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `vite.config.js`, `eslint.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/lib/sanity.test.js`, `obsidian/Embedding playground.md`, `obsidian/.obsidian/app.json`
- Modify: `.gitignore` (add `node_modules/`, `dist/`, `.env`, `test-results/`)

**Interfaces:** Produces the script names every later task uses: `pnpm test` (`vitest run`), `pnpm lint` (`eslint .`), `pnpm build` (`vite build`), `pnpm dev`.

- [ ] **Step 1: Record the baseline.** Run `pnpm test`, `pnpm lint`, `pnpm build` on the empty repo. Expected: all three fail with "no package.json". Record exact output.
- [ ] **Step 2: Scaffold** with `corepack enable`, `pnpm init`, add `react react-dom`, dev `vite @vitejs/plugin-react vitest eslint @eslint/js eslint-plugin-react-hooks eslint-plugin-react-refresh globals`. `vite.config.js`: `base: '/embed-demo/'` for `build`, `'/'` for `serve`; Vitest `environment: 'node'`. Pin `"packageManager"` in `package.json`.
- [ ] **Step 3: Trivial test** `src/lib/sanity.test.js`: `expect(1 + 1).toBe(2)`.
- [ ] **Step 4: Verify.** `pnpm install --frozen-lockfile && pnpm test && pnpm lint && pnpm build` → 1 test passed, lint clean, `dist/` built.
- [ ] **Step 5: Obsidian vault** with an index note (project purpose, links to spec, plan, brief, report). Commit `obsidian/.obsidian/app.json`; state files are git-ignored.
- [ ] **Step 6: Commit** `Scaffold Vite, React, Vitest and ESLint` and push.

### Task 1: Model spike (gate)

**Files:**
- Create/keep: `tools/model/export.py` (already written: downloads the community fp32 export at a pinned revision, MatMulNBits quantisation of MatMul and Gather, writes `out/`), `tools/model/validate.py`, `tools/model/test_sentences.py`, `tools/model/common.py`, `spike/` (temporary browser check: `spike/index.html`, `spike/spike.mjs`)
- Modify: `tools/model/pyproject.toml` (`onnx-ir`, `tokenizers`)

**Interfaces:**
- Produces: `tools/model/common.py` with `load_tokenizer(model_dir: Path) -> tokenizers.Tokenizer`, `embed_onnx(session, tokenizer, texts: list[str], prefix: str) -> np.ndarray` (one text per run, batch 1, mean pooling, L2 normalisation, `MAX_TOKENS = 512` truncation) — reused by Task 8.
- Produces: `out/model.onnx`, `out/tokenizer.json`, `out/build-info.json` (`model_onnx_sha256`).

- [ ] **Step 1: Record resources** (`df -h`, `free -g`, `nproc`) in the report notes; stop at the gate if below about 15 GB disk or 10 GB RAM. Read the OpenMDW-1.1 licence and NOTICE: stop if redistribution of a modified build is forbidden; otherwise ship `LICENSE` and `NOTICE` with the model. Commit and push the scripts before the download and quantisation; delete `out-src/` and failed variants as you go.
- [ ] **Step 2: `test_sentences.py`**: 12 passages (ja ×5, fr ×2, de ×2, en ×3; topics cat/sleep, weather, trains, food, tax) and 4 queries (fr "un chat qui dort", en "it is raining", de "Ich fahre mit dem Zug", ja "税金") each with its expected top passage.
- [ ] **Step 3: `validate.py`** computes the BF16 reference with Sentence Transformers on CPU, float32, `attn_implementation="sdpa"`, `encode_query`/`encode_document`; computes ONNX vectors with `common.embed_onnx` for `--model out/model.onnx` (default) and optionally `--model` of the fp32 source; prints per-sentence cosine, min cosine, per-query ranking for both, and exits non-zero if any cosine < 0.99 or any ranking differs. Red: run before `out/` exists → fails with "model not found".
- [ ] **Step 4: Validate fp32 community export** (`uv run python validate.py --model <fp32 path>`). Expected: cosine ≥ 0.9999, identical rankings (proves bidirectional attention, which a causal graph would not pass).
- [ ] **Step 5: Export q4** (`uv run python export.py`) and validate. Expected: min cosine ≥ 0.99 and identical rankings. If q4 fails, export `--bits 8 --out out-q8` and validate that. Record sizes.
- [ ] **Step 6: Browser check** in headless Chromium (Playwright) with onnxruntime-web WASM single-threaded: load `out/model.onnx`, tokenise with `@huggingface/tokenizers`, embed the 12 passages, compare with Python ORT vectors (cosine ≥ 0.999), record download size, session-create time, per-text embedding time, and peak JS heap. Also try `executionProviders: ['webgpu']` and record that it is unavailable.
- [ ] **Step 7: Decide** q4 vs int8: smallest passing build that loads in Chromium. List the graph's op types and record WebGPU coverage (try WebGPU on SwiftShader with `--enable-unsafe-webgpu` if no GPU). Record in the report. **Gate:** if no build passes or loads, push, write the report, stop.
- [ ] **Step 8: Commit** `Validate the quantised ONNX model against the BF16 reference` and push. Delete `spike/` before the commit (keep its numbers in the report).

### Task 2: Vector maths

**Files:** Create `src/lib/vector.js`, `src/lib/vector.test.js`

**Interfaces:** Produces `meanPool(hidden: Float32Array, seqLen: number, dim: number, mask: ArrayLike<number>) -> Float32Array`, `l2Normalise(v: Float32Array) -> Float32Array` (new array), `cosine(a, b) -> number` (dot product / norms, works for unnormalised input), `truncate(ids: number[], max: number) -> number[]`.

- [ ] **Step 1: Tests**: `meanPool` of 3 tokens × 2 dims `[1,2, 3,4, 100,100]` with mask `[1,1,0]` → `[2,3]`; `l2Normalise([3,4])` → `[0.6,0.8]`; `cosine([1,0],[0,1])` → 0, `cosine([1,2],[2,4])` → 1 (±1e-6), `cosine([1,0],[-1,0])` → -1; `truncate([1..10], 4)` → `[1,2,3,4]` and short input unchanged.
- [ ] **Step 2:** `pnpm test` → FAIL (module missing). **Step 3:** implement. **Step 4:** `pnpm test` → PASS.
- [ ] **Step 5: Mutations** (each alone, watch a test fail, restore with `git checkout -- src/lib/vector.js`): ignore the mask in `meanPool`; divide by `seqLen` instead of mask sum; drop the `Math.sqrt` in `l2Normalise`; drop the norm division in `cosine`.
- [ ] **Step 6: Commit** `Add mean pooling, normalisation and cosine` and push.

### Task 3: Ranking, softmax with temperature, top-p cut, reasons

**Files:** Create `src/lib/ranking.js`, `src/lib/ranking.test.js`

**Interfaces:**
- Consumes `cosine` from Task 2.
- Produces `rankBySimilarity(query: Float32Array, items: {id, vector}[]) -> {item, similarity}[]` (descending, stable), `softmax(similarities: number[], temperature: number) -> number[]` (subtract max before `exp`), `topPCount(probabilities: number[], p: number) -> number` (smallest n with cumulative ≥ p − 1e-9, clamped to `[1, length]`, 0 for empty), `exclusionReason(rank: number, k: number, pCount: number) -> null | 'k' | 'p' | 'kp'` (rank is 1-based), `REASON_LABELS = { k: 'k too low', p: 'p too low', kp: 'k and p too low' }`.

- [ ] **Step 1: Tests**: softmax sums to 1; softmax of `[0.82,0.71,0.63,0.52]` at T=0.08 is strictly decreasing and its first value > value at T=0.5 (flatter); softmax of `[1000, 999]` has no NaN; `topPCount([0.5,0.3,0.2], 0.8)` → 2, `(…, 0.81)` → 3, `(…, 1)` → 3, `([], 0.8)` → 0, all-equal `[0.25×4]` at p 0.5 → 2; `exclusionReason(3,4,3)` → null, `(4,4,3)` → 'p', `(5,4,3)` → 'kp', `(3,2,5)` → 'k'; `rankBySimilarity` orders by cosine and keeps insertion order for ties; mock-up check: similarities `[0.82,0.71,0.63,0.52,0.38,0.29,0.21,0.18]`, T 0.08, p 0.80 → `topPCount` = 2; floating-point edge `topPCount([0.7,0.1,0.2], 0.8)` → 2 (0.7 + 0.1 = 0.7999999999999999).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Mutations:** remove max subtraction (the `[1000,999]` test fails); drop the epsilon in the cumulative check; swap 'k' and 'p' in `exclusionReason`; sort ascending.
- [ ] **Step 6: Commit** `Add top-p cut with temperature and k/p reasons` and push.

### Task 4: Angle-fan maths

**Files:** Create `src/lib/fan.js`, `src/lib/fan.test.js`

**Interfaces:** Produces `angleDegrees(similarity: number) -> number` (`acos` of the similarity clamped to [-1, 1], in degrees), `pointOnCircle(degrees: number, radius: number) -> {x, y}` (SVG coordinates, y negated so angles open upwards), `arcPath(degrees: number, radius: number) -> string` (pie slice from the x-axis, `M 0 0 L r 0 A r r 0 0 0 x y Z`).

- [ ] **Step 1: Tests**: `angleDegrees(1)` → 0, `(0)` → 90, `(0.82)` ≈ 34.92 (±0.01), `(1.0000001)` → 0 (no NaN), `(-1)` → 180; `pointOnCircle(90, 400)` → `{x≈0, y≈-400}`; `arcPath(90, 100)` contains `A 100 100 0 0 0`, ends with `Z`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Mutations:** drop the clamp; forget the y negation; radians instead of degrees.
- [ ] **Step 6: Commit** `Add angle maths for the fan` and push.

### Task 5: Tatoeba client and response validation

**Files:** Create `src/lib/tatoeba.js`, `src/lib/tatoeba.test.js`

**Interfaces:** Produces `TATOEBA_API = 'https://api.tatoeba.org/v1/sentences'` (discovered from the live API on 2026-11-16: `/v1/` is the documented stable version of the `/unstable/` endpoint, same shape, CORS `*`), `randomSentenceUrl() -> string` (params `lang=jpn`, `sort=random`, `limit=1`, `trans:lang=fra`, `showtrans:lang=fra,deu,eng`, `word_count=4-20`, `is_unapproved=no`), `parseTatoebaResponse(json: unknown) -> {id: number, lang: string, text: string}[]` (sentence plus at most one translation per language, preferring `is_direct`; throws `TatoebaError` on bad shape), `MAX_TEXT_LENGTH = 300`, `fetchRandomSentences(fetchFn = fetch) -> Promise<…same…>` (throws `TatoebaError` with a friendly message on network/HTTP/shape failure).

- [ ] **Step 1: Tests** (fixtures copied from a real response): valid response → 1 ja + up to 1 fra/deu/eng; picks the direct translation; `data: []` → throws; missing `data` → throws; `id` as string or ≤ 0 → item dropped; `text` empty, > 300 chars or not a string → item dropped; `lang` not `/^[a-z]{3}$/` → dropped; `text` containing `<img src=x onerror=…>` is returned unchanged (it is rendered as text, never parsed); main sentence invalid or not `jpn` → throws; `res.json()` rejecting (non-JSON page) → `TatoebaError`; `fetchRandomSentences` with a fetch returning status 500 → `TatoebaError`; fetch rejecting → `TatoebaError`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Mutations:** remove the length check; accept string ids; skip the `Array.isArray(data)` check; prefer indirect translations.
- [ ] **Step 6: Commit** `Add Tatoeba client with response validation` and push. Code-quality review checks spec §9 explicitly.

### Task 6: IndexedDB storage

**Files:** Create `src/lib/storage.js`, `src/lib/storage.test.js`; dev dependency `fake-indexeddb`.

**Interfaces:** Produces `openStore(name = 'embed-demo') -> Promise<Store>` with `Store.add(collection: 'my-texts' | 'tatoeba', entry: {text, lang?, sourceId?, vector: Float32Array}) -> Promise<number>` (returns auto-increment id), `Store.list(collection) -> Promise<entry[]>` (insertion order, each with `id`), `Store.remove(id) -> Promise<void>`, `Store.clear(collection) -> Promise<void>`. One object store `entries` with an index on `collection`. No wrapper library.

- [ ] **Step 1: Tests** (`import 'fake-indexeddb/auto'`, fresh database name per test): add then list returns the text and a `Float32Array` vector of equal values; two collections stay separate; `remove` deletes one; `clear('my-texts')` leaves `tatoeba` entries; reopening the store (new `openStore` call, same name) still lists entries (survives reload).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Mutations:** `clear` clears the whole object store; `list` ignores the collection index. `Store.hasSource(collection, sourceId)` lets Task 10 skip Tatoeba sentences already stored.
- [ ] **Step 6: Commit** `Add IndexedDB storage for texts and vectors` and push.

### Task 7: Model loading, cache and embedding worker

**Files:** Create `src/config.js`, `src/lib/modelCache.js`, `src/lib/backends.js`, `src/lib/backends.test.js`, `src/worker/embed.worker.js`, `src/lib/embedder.js`, `scripts/serve-model.mjs`, `.env.example`. Modify `package.json` (`"serve-model": "node scripts/serve-model.mjs"`; dependencies `onnxruntime-web`, `@huggingface/tokenizers`).

**Interfaces:**
- `src/config.js`: `MODEL_BASE_URL` (env or HF default, always ends with `/`), `MODEL_FILES = { model: 'model.onnx', tokenizer: 'tokenizer.json', tokenizerConfig: 'tokenizer_config.json' }`, `MODEL_LABEL = 'Nemotron-3-Embed-1B (int8)'` (decided in Task 1), `MAX_TOKENS = 256` (decided in Task 1: 512 tokens take about 50 s on single-threaded WASM), `MODEL_SIZE_BYTES` fallback for the progress bar. Cache name `embed-demo-model-<first 12 hex of demo-set sha256>`; other `embed-demo-model-*` caches are deleted on load, so a redeploy with regenerated demo vectors invalidates old cached models.
- `modelCache.js`: `fetchCached(url: string, onProgress: (loaded, total) => void) -> Promise<ArrayBuffer>`; Cache API keyed by the stable config URL; on miss, `fetch`, read the stream for progress, `cache.put(url, new Response(bytes))`.
- `backends.js`: `chooseBackends(hasWebGpu: boolean) -> string[]` (`['webgpu', 'wasm']` or `['wasm']`) and `createSession(ort, bytes, hasWebGpu) -> Promise<{session, backend: 'webgpu' | 'wasm'}>` that tries each in order and returns the first that initialises.
- Worker protocol (main → worker): `{type: 'load'}`, `{type: 'embed', id, texts: string[], kind: 'query' | 'passage'}`. Worker → main: `{type: 'progress', loaded, total}`, `{type: 'preparing'}` (download done, hashing and session creation running; the UI shows "Preparing the model… 12 s"), `{type: 'ready', backend, fingerprint}`, `{type: 'embed-progress', id, done, total}`, `{type: 'embedded', id, vectors: Float32Array[], truncated: boolean[]}`, `{type: 'error', id?, message}`.
- `embedder.js`: `createEmbedder({onProgress, onReady}) -> {load(), embed(texts, kind, onItem) -> Promise<Float32Array[]>, backend}`.
- Import `onnxruntime-web/webgpu` (WebGPU EP plus WASM fallback; it uses `ort-wasm-simd-threaded.asyncify.wasm`). `ort.env.wasm.wasmPaths = { wasm: <Vite ?url import of onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm> }`. `numThreads` left to ORT (1 without cross-origin isolation). The worker passes the tokenizer's plain-number mask to `meanPool`, and `BigInt64Array`s only to ORT.
- Fingerprint: SHA-256 (`crypto.subtle.digest`) of the downloaded `model.onnx` bytes, hex.

- [ ] **Step 1: Tests** for `chooseBackends` and `createSession` with a fake `ort.InferenceSession.create`: when it rejects for `webgpu` → backend `wasm`; when both succeed → backend `webgpu`; with no WebGPU, `webgpu` is never tried; when both fail the error propagates.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Mutations:** return `'webgpu'` without trying; swap the order (caught by the both-succeed test).
- [ ] **Step 6: Implement** config, cache, worker, embedder, `scripts/serve-model.mjs` (Node `http`, serves `tools/model/out/` on port 8765 with `Access-Control-Allow-Origin: *` and `Content-Length`, no dependencies), `.env.example` (`VITE_MODEL_BASE_URL=http://localhost:8765/`).
- [ ] **Step 7: Verify** `pnpm install --frozen-lockfile && pnpm test && pnpm lint && pnpm build` → PASS; `ls dist/assets` shows `.wasm` files (no CDN).
- [ ] **Step 8: Commit** `Load the model in a worker with Cache API and backend fallback` and push.

### Task 8: Demo set, PCA map and fingerprint data

**Files:** Create `tools/model/demo_sentences.json` (curated: Tatoeba id, lang, text; about 40, mostly Japanese, distinct topics, some known translation pairs), `tools/model/curate_demo_set.py` (fetches each curated id from `https://api.tatoeba.org/v1/sentences/{id}` and refreshes the text, so the list is verifiable), `tools/model/embed_demo_set.py` (`--model-dir`, default `out/`, so it can run against the downloaded uploaded files), `src/data/demo-set.json`, `src/data/pca-map.json`, `src/data/suggestions.js`.

**Interfaces:**
- Consumes `common.embed_onnx`, `common.load_tokenizer` (Task 1).
- `src/data/demo-set.json`: `{ model: {label, sha256}, prefix: 'passage: ', items: [{id: 'tatoeba-<id>', sourceId, lang, text, vector: number[2048] (rounded to 6 decimals)}] }`.
- `src/data/pca-map.json`: `{ caption, points: [{label, lang, group, x, y}] }`, PCA (numpy SVD) computed offline over 4 meanings × 4 languages.
- `suggestions.js`: `DEMO_SUGGESTIONS = ['un chat qui dort', …]` (first chip "un chat qui dort").

- [ ] **Step 1:** Curate and run `uv run python curate_demo_set.py` → writes `demo_sentences.json` with attribution ids.
- [ ] **Step 2:** `uv run python embed_demo_set.py` → writes both JSON files; prints the top 6 similarities for each suggestion against the demo set.
- [ ] **Step 3: Defaults.** Using the printed similarities, pick `DEFAULTS = {k, p, temperature}` in `src/data/suggestions.js` so that for the first chip: `topPCount < k`, at least one rank r with `exclusionReason(r) === 'p'` and the top result is a cat-sleeping sentence. Add a Vitest test `src/data/defaults.test.js` that loads `demo-set.json` and `src/data/suggestion-vectors.json` (written by the script: the `query: `-prefixed vector of each suggestion, used only by this test), ranks the demo set for the first suggestion with `rankBySimilarity`, and asserts those three conditions with `softmax`/`topPCount`/`exclusionReason`.
- [ ] **Step 4: Mutation:** set default k to 1 → test fails; restore. Also assert spec §7 step 5: at `temperature` = slider maximum 0.5 the p count for the first chip is ≥ k. Slider ranges (from the mock-up): k 1–10, p 0.05–1.00 step 0.01, T 0.02–0.50 step 0.01.
- [ ] **Step 5: Commit** `Add curated demo set with precomputed embeddings` and push.

### Task 9: App shell, Explainer, loading status, phone gate, footer

**Files:** Create `src/App.jsx` (replace scaffold), `src/styles.css`, `src/components/Footer.jsx`, `src/components/LoadingStatus.jsx`, `src/components/Explainer.jsx`, `src/components/explainer/KingQueenSketch.jsx`, `src/components/explainer/CosineTriangle.jsx`, `src/components/explainer/PcaMap.jsx`, `src/lib/device.js`, `src/lib/device.test.js`, `src/lib/format.js`, `src/lib/format.test.js`.

**Interfaces:**
- `device.js`: `isPhone(matchMediaFn) -> boolean` (true when `(max-width: 600px)` and `(pointer: coarse)` both match).
- `format.js`: `formatBytes(n) -> string` ("412 MB", "1.2 GB"; decimal units), `formatSeconds(ms) -> string` ("2.4 s").
- `LoadingStatus` props `{loaded, total, ready, onOpen}`: "Loading the embedding model {MODEL_LABEL} — have a look around…", a `<progress>` with "412 MB of 1.2 GB", then the button "You can explore vector embeddings now", pulsing once every 10 s (CSS animation) until clicked.
- Phone: Explainer only, note "For the interactive demo, please open this page on a computer." and a "Load anyway" link; no model request.
- Explainer sections exactly as spec §5.9, in order; SVG drawings, no chart library; PCA caption "A flattened view, distances are approximate."

- [ ] **Step 1: Tests** `isPhone` (both true → true, either false → false); `formatBytes(412e6)` → "412 MB", `(1.2e9)` → "1.2 GB", `(0)` → "0 MB"; `formatSeconds(2400)` → "2.4 s".
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Mutations:** `||` for `&&` in `isPhone`; binary units in `formatBytes`.
- [ ] **Step 6:** Implement components. Verify `pnpm build` and manual load with `pnpm dev`.
- [ ] **Step 7: Commit** `Add the Explainer, loading status and phone gate` and push.

### Task 10: Playground

**Files:** Create `src/components/Playground.jsx`, `src/components/Controls.jsx`, `src/components/ResultsList.jsx`, `src/components/AngleFan.jsx`, `src/components/DemoSetTab.jsx`, `src/components/MyTextsTab.jsx`, `src/components/ThingsToTry.jsx`, `src/components/InferenceStatus.jsx`, `src/lib/useTimer.js`.

**Interfaces:** Consumes Tasks 2–8. Playground state: `activeTab: 'demo' | 'mine'`, `query`, `results: {item, similarity}[]`, `k`, `p`, `temperature`, `hoveredId`. Sliders recompute `softmax`/`topPCount` only (no new search). Results always list every text of the active tab.

- [ ] **Step 1:** Results list: rank, text (with `lang`), reason badge (`REASON_LABELS`), similarity bar and share bar (percentage), greyed rows when excluded, exactly two dashed lines (k line under rank k, p line under rank `topPCount`; one combined line label when equal). Slider hints from spec §5.7 analogies.
- [ ] **Step 2:** Angle fan (SVG, quarter circle 0–90° extended to 180° if any similarity < 0): query on x-axis; points at `angleDegrees`; hover linked both ways with the list; arc + "cos(35°) = 0.82 = similarity"; 90° labelled "unrelated"; excluded points greyed; footnote "Angles to the query are exact; angles between two results are not meaningful." Side by side ≥ 1000 px, collapsible "Show the angles" (collapsed) below.
- [ ] **Step 3:** Inference status: "Embedding your query… 2.4 s (CPU/WASM)" with a running timer; batch "Embedding 12 of 40…".
- [ ] **Step 4:** Demo set tab: curated + stored Tatoeba entries; chips; "Fetch random sentences from Tatoeba" (embeds with progress, stores); "Reset demo set"; friendly error on `TatoebaError`; attribution line.
- [ ] **Step 5:** My texts tab: textarea, "Add & embed", permanent warning "Stored only in this browser and not backed up. Don't put anything important or secret here.", delete per entry, "Clear all", soft limit hint at 50, long-text hint when the worker reports `truncated` ("only the first 256 tokens count; one vector for a whole novel says little"), empty-state hint, "Things to try" box with the four prompts from spec §5.6.
- [ ] **Step 5b:** Query input with a Search button (Enter submits); the last query vector is kept, so adding, deleting, fetching or resetting re-ranks without re-embedding the query; sliders start from `DEFAULTS`. Fingerprint: when `ready.fingerprint !== demoSet.model.sha256`, `console.warn` that the demo vectors are stale. Explainer section 5 links to the angle fan ("Try it in the Playground").
- [ ] **Step 6:** Verify `pnpm test && pnpm lint && pnpm build`; grep `src` for `dangerouslySetInnerHTML|innerHTML` → no matches.
- [ ] **Step 7: Commit** `Add the Playground with results list and angle fan` and push. Code-quality review checks spec §9 explicitly.

### Task 11: Smoke check

**Files:** Create `scripts/smoke.mjs`; modify `package.json` (`"smoke": "node scripts/smoke.mjs"`; dev dependency `playwright` (added in Task 1); launch with `executablePath` from `CHROMIUM_PATH`, defaulting to Playwright's own browser).

**Interfaces:** Expects the model served by `pnpm serve-model` (it starts it itself if port 8765 is free) and builds with `VITE_MODEL_BASE_URL=http://localhost:8765/`, serves `dist/` with `vite preview`.

- [ ] **Step 1:** Script covering spec §7 steps 1–7: Explainer visible with status line and progress; button appears; Playground opens on Demo set; chip "un chat qui dort" → top result contains `猫`, k line and p line both present, p line above k line, at least one "p too low" badge; raising temperature moves the p line down without a new embed message; hover rank 1 → fan text matches `cos\(\d+°\) = 0\.\d\d = similarity`; My texts: add two texts, search "autumn", reload, both still there, "Clear all" empties. Step 8: phone viewport (390×844, touch) → no request to the model URL, note visible.
- [ ] **Step 2:** Network guard: fail on any request whose origin is not the preview origin, the model origin, or `api.tatoeba.org`. Second load in the same context: no network request for `model.onnx`.
- [ ] **Step 3:** Mutation: point `wasmPaths` at jsDelivr → smoke fails on the network guard; restore.
- [ ] **Step 4:** Record timings (load, query embed) printed by the script.
- [ ] **Step 5: Commit** `Add Playwright smoke check` and push.

### Task 12: CI, Pages workflow, README, upload guide, open items

**Files:** Create `.github/workflows/ci.yml` (`pull_request`: pnpm install --frozen-lockfile, test, lint, build), `.github/workflows/pages.yml` (push to `master` and `workflow_dispatch`; `actions/upload-pages-artifact` + `actions/deploy-pages`), `README.md` (rewrite), `docs/hf-upload.md`, `open-items.md`.

- [ ] **Step 1:** Workflows with `pnpm/action-setup`, `actions/setup-node` (Node LTS, pnpm cache); Pages: `permissions: pages: write, id-token: write, contents: read`, `actions/configure-pages`, `upload-pages-artifact` (`dist`), `deploy-pages`. Verify: `uv run --with pyyaml python -c "import yaml,sys;[yaml.safe_load(open(f)) for f in sys.argv[1:]]" .github/workflows/*.yml`; the CI result on the PR is the final evidence.
- [ ] **Step 2:** README sections from the brief, env var table (`VITE_MODEL_BASE_URL`: base URL of the model folder, must end with `/`, example `http://localhost:8765/`), regeneration steps (export → validate → upload → `embed_demo_set.py` against the uploaded files → commit JSON), attribution and licence.
- [ ] **Step 3:** `docs/hf-upload.md` per the brief (export command, `uv tool install huggingface_hub`, `hf auth login` with fine-grained token, `hf upload SCAI-NGO/nemotron-3-embed-1b-onnx-web tools/model/out`, model card with OpenMDW-1.1 text and NOTICE, CORS check with `curl -I -H 'Origin: https://symphonic-navigator.github.io'`).
- [ ] **Step 4:** `open-items.md`: re-run demo embeddings after upload; coi-serviceworker decision with measured numbers; Pages enablement; WebGPU unmeasured.
- [ ] **Step 5:** Full verification incl. `pnpm smoke` and `uv run python validate.py`.
- [ ] **Step 6: Commit** `Add CI, Pages deployment, README and upload guide` and push.

### Task 13: Finish (do not merge)

- [ ] **Step 1:** Final whole-branch review by a fresh subagent; fold in findings.
- [ ] **Step 2:** Open a **draft** PR to `master` with **Decisions made without Chris**.
- [ ] **Step 3:** Commit `docs/superpowers/specs/2026-11-16-embedding-playground-overnighter-report.md` and `open-items.md` with the PR link, push, update the PR description (ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`).
- [ ] **Step 4:** Do **not** merge. Send the push notification.
