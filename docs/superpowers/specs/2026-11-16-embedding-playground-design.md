# Embedding Playground — Design

Date: 2026-11-16
Repository: `symphonic-navigator/embed-demo`
Licence: AGPL-3.0 (already in `LICENSE`)

## 1. Intent

A small, self-explanatory web page that lets curious people *play* with vector embeddings and come away with two things:

1. **An "aha" moment**: searching by meaning works, it works across languages that are worlds apart (Japanese texts, French query), and the mechanics behind ranking and filtering are not magic.
2. **A new tool in their kit**: when they later decide what to build themselves, they recognise "this looks like a problem vector embeddings can solve".

The audience is a Discord community: highly interested non-experts, many of whom want to start building their own software. It is a teaching tool, not a product. It is published by Second Circuit as part of its mission of helping people understand AI.

Nobody presents it. People open the link on their own and explore. Learning happens by playing, so the page must explain itself and must never greet the visitor with an empty screen.

## 2. Goals, non-goals, anti-goals

**Goals**
- Runs entirely in the browser on desktop computers (Windows, macOS, Linux). No install, no account, no backend. Phones get the Explainer only (see 5.4).
- Hosted on GitHub Pages.
- Real embeddings computed locally by NVIDIA's **Nemotron-3-Embed-1B** (quantised), not faked.
- Semantic search over a small text collection, with live top-k / top-p / temperature controls.
- An explainer page that teaches the concepts and is honest about the limits.

**Non-goals**
- Chunking, large corpora, vector databases, server-side inference.
- Production robustness, multi-user features, accounts, sync, backups.
- Supporting every exotic browser. Current Chrome, Edge, Firefox and Safari are the target.

**Anti-goals** (would make it a failure even if it technically works)
- An empty or confusing first screen.
- The app *looking* frozen or broken while it computes on slow hardware ("it made my PC catch fire").
- Visualisations that pretend to be more exact than they are.
- "My texts" turning into a feature that does the thinking for people. It is meant for their own wild experiments.

## 3. Constraints

- All user-facing text and all artefacts (code, comments, docs) in **British English**. The *texts being searched* are multilingual by design.
- Footer on every page: **"Second Circuit – Association for digital freedom of thought"**, linking to https://scai.world.
- GitHub Pages limits: 100 MB per file, about 1 GB per repository. The model cannot be hosted on Pages. It is fetched from the Hugging Face Hub (CORS is permitted).
- The model is about 1.14B parameters. BF16/fp16 (about 2.3 GB) is too large for the browser, so a quantised build is needed (int8 about 1.2 GB, or q4 about 0.7 GB).
- Data persists only in the visitor's browser (IndexedDB). It is unbacked and unencrypted, and the UI says so.

## 4. Model facts (from the model card, 2026-11-16)

- `nvidia/Nemotron-3-Embed-1B-BF16`, licence OpenMDW-1.1. Before redistributing a quantised build, read the licence text. If it attaches conditions (licence text, notices, attribution), meet them in the HF repository and in the app. If it forbids redistribution, stop and come back. *(Claude's call.)*
- 34 languages, including Japanese, French, German and English.
- 2048-dimensional output. Vectors can be truncated from the front (e.g. 1024, 512) and must be L2-renormalised afterwards.
- Pruned Ministral-3 architecture (`model_type: ministral3`) with **bidirectional attention** (`is_causal: false`) and **mean pooling** (`pooling: avg`).
- Asymmetric: prefix queries with `query: ` and documents with `passage: `.
- There is no official ONNX build. A community export exists at `kzzalews/Nemotron-3-Embed-1B-BF16-onnx` (fp32 and fp16; it is unverified).

## 5. Decided parts of the how

### 5.1 Stack
- **React + JSX + Vite**, package manager **pnpm**.
- **onnxruntime-web** for inference, used directly and not through a Transformers.js pipeline, because Transformers.js support for `ministral3` is not confirmed. Only the **tokenizer** from Transformers.js (or an equivalent library that reads `tokenizer.json`) is used. Mean pooling and L2 normalisation are done by hand.
- Inference runs in a **Web Worker**, so the UI never blocks.
- WebGPU is used when available. Otherwise WASM (CPU) is the fallback.
- Persistence is **IndexedDB**.
- Deployment: **GitHub Actions → GitHub Pages**.
- The quantised model lives in the **Hugging Face model repository `SCAI-NGO/nemotron-3-embed-1b-onnx-web`** (already created by Chris; organisation-owned). It does not go on GitHub: Pages has a 100 MB per-file and 1 GB per-site limit and a soft limit of 100 GB of traffic per month (only about 100 first visits). Pages does not serve LFS files. GitHub release assets send no CORS header, which was verified on 2026-11-16, so the browser cannot fetch them.
- **The upload is a manual step for Chris.** The builder writes a step-by-step guide (`docs/hf-upload.md`) and hands it over once the model files exist. The repository already exists, so the guide covers: creating a write token, logging in with `hf auth login`, uploading with `hf upload`, the model card (base model, quantisation, licence and attribution as required by OpenMDW), and checking that the files are reachable from the browser. The model URL is a single config constant pointing at that repository. Install the CLI with `uv tool install huggingface_hub` (then `hf auth login`). A fine-grained token needs write access to SCAI-NGO repositories.
- The browser caches the model after the first download (Cache API / browser cache), so later visits do not download it again.

### 5.2 First step: the ONNX spike (gate for everything else)
Before building the app, prove the model path works:
1. Compute reference embeddings for a handful of multilingual test sentences in Python with the original BF16 model (via `uv`, Sentence Transformers `encode_query` / `encode_document`).
2. Obtain a browser-sized quantised ONNX model, either by quantising the community export or by exporting it ourselves with `optimum` (bidirectional mask and mean pooling handled correctly).
3. Run it in the browser with onnxruntime-web and compare. Per-sentence cosine similarity to the reference vector should be about 0.99 or higher, and the ranking for the test queries must match.
4. Record download size, load time and per-text embedding time on WASM and WebGPU.

If the spike fails, stop and come back before continuing.

### 5.3 Page structure
Two areas: the **Explainer** and the **Playground**.

### 5.4 First visit and loading
- A first-time visitor lands on the **Explainer**.
- Below it, a status line reads: *"Loading the embedding model <exact model name and quantisation> — have a look around…"*, with a real progress bar (e.g. "412 MB of 1.2 GB").
- When the model is ready, a button appears: **"You can explore vector embeddings now"**. It pulses briefly about once every 10 seconds until clicked.
- On later visits the model comes from cache and the button appears within seconds.
- **The Playground opens only when the model is fully loaded.** There is no partial or "precomputed only" playground during the download, because Chris decided it would be confusing. Precomputed demo-set vectors still exist, but only to speed up the first search.
- **Phones:** only the Explainer is shown, together with the note *"For the interactive demo, please open this page on a computer."* The model is not downloaded. *(Claude's call: the builder detects phones by small viewport plus coarse pointer, and offers a "Load anyway" link for tablets and the curious.)*

### 5.5 Never looking frozen
- Every inference shows visible state: e.g. *"Embedding your query… 2.4 s"*, with a running timer and an indication of the backend in use (GPU/WebGPU or CPU/WASM).
- Batch embedding shows per-item progress ("Embedding 12 of 40…").
- The UI stays responsive throughout (worker).

### 5.6 Text collections: two tabs
Search always runs against the **active tab only**.

**Demo set**
- A curated set of about 40 short sentences from **Tatoeba**. Its centre of gravity is Japanese, so that a French query against Japanese texts works out of the box, mixed with other languages and with clearly distinct topics (so that unrelated items exist). It includes sentences whose translations are known, so cross-lingual hits can be verified.
- It ships as static JSON **together with precomputed embeddings**, produced with exactly the same quantised model the browser uses. On a first visit only the query has to be embedded.
- The curated sentences are read-only.
- Button **"Fetch random sentences from Tatoeba"**: adds sentences live from the Tatoeba API (CORS `*` confirmed). Each fetch brings a sentence together with some of its translations (e.g. ja / fr / de / en). They are embedded in the browser with progress shown and stored in IndexedDB.
- Button **"Reset demo set"** restores the curated state.
- Attribution: *"Sentences from Tatoeba (tatoeba.org), CC BY 2.0 FR."* Some Tatoeba sentences are CC0; crediting all of them under CC BY 2.0 FR is fine.
- The Tatoeba endpoint is under `/unstable/`. The curated set is the foundation and live fetching is an extra, so a failed fetch shows a friendly message and nothing breaks.

**My texts**
- Users paste text into a text field, one text per entry, then click **"Add & embed"**. Text and vector are stored in IndexedDB.
- A warning is permanently visible: *"Stored only in this browser and not backed up. Don't put anything important or secret here."*
- Entries can be deleted one at a time, or all at once with "Clear all". There is no editing (delete and re-add instead).
- Soft limit of about 50 entries, with a friendly hint and no hard block.
- No chunking. When a single text is very long, a hint explains that one vector for a whole novel says little.
- **No automatic filling.** Instead a small **"Things to try"** box offers prompts, not content. For example: paste a haiku and a dadaist poem, then search for "autumn"; the same sentence in three languages; a sentence and its negation; two texts that share words but not meaning.

### 5.7 Search results list (validated as a clickable mock-up)
- **All** texts of the active tab are always listed, sorted by similarity. Nothing is hidden.
- Texts that fall outside the filters are **greyed out** with a reason badge: **"k too low"**, **"p too low"** or **"k and p too low"**.
- Exactly **two boundary lines** are drawn in the list: a **k line** and a **p line**. They move live as the sliders change, without re-running the search. There is no third line (no similarity threshold).
- Sliders for **top-k**, **top-p** and **temperature**, each with a one-sentence hint beside it.
- top-p is defined as: softmax over the cosine similarities with temperature T, then include results in rank order until the cumulative probability reaches p. Temperature exists because raw cosine values sit close together, so without it the softmax is nearly flat and p would hardly filter.
- Each result shows two bars: the raw **similarity** and its **share** after softmax.
- Analogies (in the UI hints and on the Explainer):
  - top-k = "only the top 10 of each year group get a place". It depends on rank only.
  - top-p = "admit the best until together they hold 80 % of all the points". A clear-cut year admits few, a close one admits many. The same mechanism as top-p sampling in LLMs.
- Suggested queries are shown as clickable chips above the list (e.g. *"un chat qui dort"*), so nobody faces an empty search box.
- Reference: the mock-up `docs/superpowers/specs/mockups/results-list.html`.

### 5.8 Angle fan (validated as a clickable mock-up)
- A second view beside the results list. It sits side by side on wide viewports, and on narrow viewports (tablets, or phones after "Load anyway") it is a collapsible section ("Show the angles"), collapsed by default.
- The query lies on the x-axis. Each result sits on the unit circle at θ = arccos(similarity). This is **exact**: any two vectors span a plane in which their angle is preserved.
- Hovering a point or a list row (the two are linked both ways) highlights it, draws the angle arc and shows *"cos(35°) = 0.82 = similarity"*. 90° is labelled "unrelated".
- Points that are greyed out in the list are greyed out in the fan too.
- A footnote states: *"Angles to the query are exact; angles between two results are not meaningful."*
- Expected effect: real similarities often sit between about 0.2 and 0.7, so points cluster between about 45° and 80°. The Explainer addresses this ("Why is nothing ever close to 0°?").
- Reference: the mock-up `docs/superpowers/specs/mockups/angle-fan.html`.

### 5.9 Explainer page
Short, visual, friendly sections, in this order:
1. **What is an embedding?** A neural network like an LLM, but trained to capture what a text *means* rather than to write text. The result is a point in a space with 2048 dimensions.
2. **The classic: king − man + woman ≈ queen.** Shown as a drawn 2D sketch, not computed live, and framed as history (word2vec, 2013, one fixed vector per word). This arithmetic does not reliably work with modern sentence models.
3. **Meaning depends on context.** "Bank" as a building full of money, a bench, or a riverbank. Modern models embed whole phrases and passages (chunks), not isolated words.
4. **Across languages.** A 2D **PCA map** of a curated, precomputed set, showing that texts cluster by meaning and not by language. Captioned honestly: "a flattened view, distances are approximate".
5. **Measuring similarity: the cosine.** cos = adjacent ÷ hypotenuse, shown as a right-angled triangle, not as a wave. Why cosine rather than Pythagorean (Euclidean) distance: for unit-length vectors, distance² = 2 − 2·cos, so both give the same ranking. Cosine is preferred because it measures *direction* and ignores length, and it is easy to read (1 = same, 0 = unrelated). Links to the angle fan, and covers why real values rarely approach 0°.
6. **Top-k, top-p and temperature.** The year-group analogy, and the connection to LLM sampling.
7. **When is this the right tool, and where are the limits?** Uses: search by meaning, duplicate detection, recommendations, RAG. Limits: negation, irony, and the fact that "similar" is not "true". This section is as important as the rest.

### 5.10 Footer
"Second Circuit – Association for digital freedom of thought" → https://scai.world, plus the Tatoeba attribution, the model credit and the licence.

## 6. Left to the builder
- The quantisation level (int8 or q4), chosen from the spike's quality, size and speed measurements.
- Choice of tokenizer library, worker messaging design, IndexedDB wrapper (or none).
- Visual design and styling, within the validated layouts above. The mock-ups are a structural reference, not pixel-perfect.
- Which charting approach to use for the PCA map and the fan (plain SVG is fine).
- Curating the exact demo sentences and suggested queries, keeping the goals in 5.6 in mind.
- Router or tabs for Explainer and Playground.
- Test scope: unit tests (Vitest) for the maths (softmax/top-p cut, cosine, pooling, the k/p reason logic). No heavy end-to-end suite.
- README (description, prerequisites, development setup, how the demo-set embeddings are regenerated) and the `obsidian` vault convention.

## 7. End-to-end example

1. Alex opens the GitHub Pages link on a laptop in Chrome. The Explainer appears straight away. Below it a status line reads "Loading the embedding model Nemotron-3-Embed-1B (int8) — have a look around…", and the progress bar starts filling.
2. Alex reads about king − man + woman and about the cosine triangle. After three minutes the bar is full and "You can explore vector embeddings now" appears and pulses.
3. Alex clicks it. The Playground opens on the **Demo set** tab: about 40 sentences, mostly Japanese, plus suggestion chips.
4. Alex clicks the chip *"un chat qui dort"*. The status shows "Embedding your query… 0.8 s (GPU)". All demo sentences are listed by similarity, with `猫が日向で眠っている。` near the top. With k = 4 the k line sits under rank 4. The p line sits under rank 3, so rank 4 carries "p too low" and rank 5 and below carry "k and p too low".
5. Alex raises the temperature. The softmax flattens, the p line moves down and rank 4 becomes active again. No new search runs.
6. Alex hovers rank 1. In the angle fan the point lights up and the arc reads "cos(35°) = 0.82 = similarity".
7. Alex switches to **My texts**, pastes a haiku and a dadaist poem, and clicks "Add & embed" twice. The progress is visible each time. Alex searches "autumn". After a reload of the page both texts are still there. "Clear all" empties the tab.
8. On a phone, the same link shows only the Explainer and the note "For the interactive demo, please open this page on a computer." Nothing is downloaded.

## 8. Out of scope

- Uploading the model to Hugging Face (Chris does it manually by following `docs/hf-upload.md`).
- Enabling GitHub Pages in the repository settings and the first deployment (Chris).
- Chunking, file import (txt/pdf), editing entries, export/import of "My texts".
- Any backend, analytics, telemetry, cookies, accounts.
- Localising the UI (British English only).
- A similarity-threshold line, and a playground that works before the model has fully loaded.

## 9. Security boundary

- There is no backend and there are no secrets. The app holds no credentials of any kind, and the Hugging Face token never enters the repository or the build.
- Network access only to: the Hugging Face model repository (model files), the Tatoeba API (live sentences) and the site's own origin.
- **All text is untrusted**, both what users paste and what the Tatoeba API returns. It is rendered as text only. There is no `dangerouslySetInnerHTML` and no HTML injection anywhere. Tatoeba responses are validated for shape and length before being stored.
- User texts never leave the browser. They are not sent anywhere, and only embedded locally.
- No third-party scripts or CDNs at runtime beyond the model download. Dependencies are bundled by Vite.
