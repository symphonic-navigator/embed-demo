# Overnighter brief: embedding playground

Hi, thank you for taking this one on! We are building a small, self-explanatory browser page where curious non-experts from a Discord community can *play* with real vector embeddings (NVIDIA Nemotron-3-Embed-1B, running locally in their browser). They should leave with an "aha" and with "vector embeddings" as a new tool in their kit. It is a teaching tool by Second Circuit, so clarity and honesty matter more than polish.

Nobody is available to answer questions during this run. That is intended: the spec has been reviewed by Chris, and everything after it is yours, from the plan to the pull request. The decision rules below tell you how to settle what the spec leaves open.

## What to read, in this order

1. This brief
2. Spec: `docs/superpowers/specs/2026-11-16-embedding-playground-design.md` (reviewed by Chris; do not change it)
3. The two validated clickable mock-ups it references: `docs/superpowers/specs/mockups/results-list.html` and `docs/superpowers/specs/mockups/angle-fan.html`. They are fragments, so open them in a browser or read the source. **Take only the maths and the layout from them.** Their German UI text is superseded by British English, the note proposing a third "minimum similarity" line is superseded (no third line), and their `innerHTML` rendering must not be copied (spec §9).

## Where you run

- Branch `feature/embedding-playground`. The session starts on the default branch (`master`), so first run `git fetch origin feature/embedding-playground && git checkout feature/embedding-playground`. Everything you push to that branch survives, everything else does not.
- The cloud environment may lack tools. Installing what you need (Node LTS, pnpm via corepack, uv, Playwright with Chromium, Python packages) is fine; please do it without asking and note it in the report.
- Task 0 (setup plus first build and tests) should take about 15 minutes. If it takes much longer, something is off: note it and carry on if you can. The model work in the spike (downloading about 2.3 GB, exporting and quantising on CPU) is **not** part of Task 0 and may take considerably longer. That is expected.
- The repository is empty apart from `LICENSE` (AGPL-3.0), a two-line `README.md`, `.gitignore` and the docs. You scaffold the Vite + React (JSX, not TypeScript) app yourself with pnpm.
- Python: always use **uv** (`uv init`, `uv add`, `uv run`). Never pip or a hand-made venv. Python tooling for the model lives in its own folder, e.g. `tools/model/` with its own `pyproject.toml`.
- There is probably no GPU. The model card asks for CUDA, but the reference embeddings only need to be correct, not fast: run Transformers/Sentence Transformers on CPU with `attn_implementation="sdpa"` (or `"eager"`) in float32.
- Browser checks: headless Chromium via Playwright, WASM backend. WebGPU will probably not be available. Make the WebGPU path correct by construction and say in the report that it was not measured.
- Docker test containers: not needed. This is a static site.
- **Check resources before the spike:** run `df -h` and `free -g` and record them. The spike can need about 15–20 GB of disk and 10–16 GB of RAM for an fp32 export. Prefer quantising the community export over doing your own export, delete intermediate files as you go, and push the scripts before any long CPU step. If disk or RAM are too small, treat it as a spike-gate stop (see below) and report the numbers.
- **Network:** both source models are public and not gated (verified on 2026-11-16), so no HF token is needed and none must be used. If the HF Hub, npm, PyPI or the Playwright browser download is unreachable, that is a stop for the affected part: report it, and do not look for workarounds or tokens.
- If superpowers skills are not available, please emulate them with the plain Agent tool and say so in the report.

## The model pipeline: what to commit and what not

This is the part that needs care, because the model files cannot travel with the repository and Chris uploads them himself.

- **Never commit model weights** (`*.onnx`, `*.onnx.data`, `*.safetensors`, quantised outputs). Add their output folder to `.gitignore`. GitHub rejects files over 100 MB anyway.
- Commit a **reproducible export script** under `tools/model/`, with pinned versions in `uv.lock`. It downloads `nvidia/Nemotron-3-Embed-1B-BF16`, produces the browser model (ONNX, quantised, with tokenizer files) and writes it to a local output folder, ready for `hf upload`. Mean pooling and L2 normalisation may live in JavaScript; the ONNX graph must use **bidirectional attention** and must be validated as in spec §5.2. You may start from the community export `kzzalews/Nemotron-3-Embed-1B-BF16-onnx` if it validates, but the script must still reproduce the final files from public sources.
- Commit a **validation script** that compares the ONNX model against the BF16 reference (cosine ≥ about 0.99 per sentence, identical ranking for the test queries) and prints the numbers. Put the real numbers in the report.
- Commit a **demo-set embedding script** that produces the precomputed vectors JSON from the exact browser model files (same tokenizer, same prefix `passage: `, same pooling and normalisation as the browser code). Commit the JSON it produced in your run. Because Chris re-runs the export locally before uploading, the README must tell him to re-run this script against the uploaded model and commit the result. Record this as an item in `open-items.md`.
- The model URL is a single config constant pointing at `https://huggingface.co/SCAI-NGO/nemotron-3-embed-1b-onnx-web/resolve/main/`. That repository exists but is **empty** until Chris uploads. For development and for your Playwright checks, the app must also be able to load the model from a local folder via the Vite env variable `VITE_MODEL_BASE_URL` (documented in `.env.example` and the README, defaulting to the HF URL).
- **The local model folder must live outside `public/`** (otherwise Vite copies about 1 GB into `dist/` and the Pages artefact breaks). Serve it with a separate static server on another port that sends CORS headers, add a script for it (e.g. `pnpm serve-model`), name the exact command in the README, and git-ignore the folder.
- **Caching:** HF `resolve/main` redirects to presigned CDN URLs, so the HTTP cache will not reliably keep the model. Store the model files explicitly in the Cache API, keyed by the stable config URL. The Playwright smoke check verifies that a second load makes no network request for the model.
- **No runtime CDN:** onnxruntime-web fetches its `.wasm` files from jsDelivr by default. Set `ort.env.wasm.wasmPaths` to the bundled or self-hosted assets, and make sure the tokenizer library makes no remote requests (load `tokenizer.json` from the model base URL). The Playwright smoke check fails on any request outside the site's own origin, the model base URL (and the HF CDN hosts it redirects to) and the Tatoeba API host.
- **Cross-origin isolation:** GitHub Pages cannot send COOP/COEP headers, so there is no SharedArrayBuffer and WASM runs single-threaded. Measure single-threaded WASM as the realistic case and say so in the report. Using `coi-serviceworker` or similar to enable threads would add a third-party script. That is Chris's decision, so do not add it; record it in `open-items.md` with your measured numbers.
- **int8 vs. q4 and WebGPU:** int8 dynamic quantisation (MatMulInteger / DynamicQuantizeLinear) has weak WebGPU support, while q4 (MatMulNBits) has WebGPU kernels. Make WebGPU operator coverage part of the quantisation decision, and fall back to WASM automatically if the WebGPU session fails to initialise.
- **Model fingerprint:** store a hash of the model files (or of the `.onnx` file) in the demo-set JSON, and have the app log a console warning if the loaded model's hash differs. This makes stale demo vectors visible after Chris re-exports.
- **Dimensions:** the app uses the full 2048 dimensions. There is no truncation control in the UI.
- Write `docs/hf-upload.md`: a step-by-step guide for Chris (the repository already exists) covering the export command, `uv tool install huggingface_hub`, `hf auth login` (fine-grained token, write access to SCAI-NGO repositories only), `hf upload SCAI-NGO/nemotron-3-embed-1b-onnx-web <folder>`, the model card (base model, quantisation, OpenMDW-1.1 licence text and attribution as the licence requires), and how to check that the browser can fetch the files (CORS).
- **Spike gate (spec §5.2).** If no quantised ONNX build reaches the quality bar, or none fits the browser (it must load within the WASM memory limit in headless Chromium), do not build the rest on a broken foundation. Push what you have, write down exactly what failed and with which numbers, and stop. If the OpenMDW-1.1 licence forbids redistributing a quantised build, also stop there and report.

## Open points for the run

- **decide:** int8 or q4 (spec §6). Use the spike's numbers. Prefer the smallest build that passes the quality bar.
- **decide:** the exact Tatoeba API endpoint and response shape (`https://api.tatoeba.org/unstable/…`, CORS `*` verified on 2026-11-16). Discover it from the live API. If the live API is unreachable from the cloud, build against the documented shape, guard it defensively and note that it was not verified.
- **decide:** the curated demo set. About 40 Tatoeba sentences, centred on Japanese, with known French/German/English translations for some of them and clearly distinct topics. Store their Tatoeba IDs for attribution. If the API is unreachable, use Tatoeba's public export files (also CC BY 2.0 FR).
- **decide:** the dataset for the Explainer's PCA map, precomputed and committed like the demo set, with its PCA done offline in the script.
- **decide:** the default slider values (k, p, temperature) so that the first search with the first suggestion chip on the demo set shows both lines, with the p line above the k line, and at least one row carrying only "p too low" (as in spec §7 step 4). Take the mock-up's values (k = 4, p = 0.80, T = 0.08) as a starting point and tune them against real similarities.
- **decide:** the `obsidian/` vault (Chris's convention): create an `obsidian/` folder with a short index note about the project. Commit `.obsidian/` settings, but git-ignore its state files (`obsidian/.obsidian/workspace*.json`, `obsidian/.obsidian/cache`).

## Planning

1. Write the plan with `superpowers:writing-plans` to `docs/superpowers/plans/2026-11-16-embedding-playground.md`.
2. It starts with **Task 0: baseline**: run the full suites before any change and record the exact counts and the exact failures, against the known state below. Known state on the default branch: **no code and no tests yet**. Task 0 therefore covers scaffolding (Vite + React JSX + Vitest + ESLint via pnpm, with `"test": "vitest run"` in `package.json` so it never starts watch mode), `pnpm test` reporting one trivial passing test, and `pnpm lint` and `pnpm build` succeeding.
3. Task 1 is the **model spike** (spec §5.2 and the pipeline section above). Everything after it depends on its result.
4. Every task stands alone: exact file paths (with line anchors where it modifies code), the exact command for each test step with the expected pass or fail, red test, green, then mutations. No placeholders, no "see above", no "similar to Task N".
5. The final task repeats: do not merge.
6. Have the plan reviewed by a fresh subagent that gets the spec, this brief and the plan, not your conclusions. Fold in the findings, then commit the plan.

## How to work

- Task by task as in the plan: red test, green, then every mutation individually (break, watch it fail, restore with `git checkout -- <file>`).
- Tests (Vitest) are for the logic that can be wrong: cosine, mean pooling, normalisation, softmax with temperature, the top-p cut, the k/p reason logic ("k too low", "p too low", "k and p too low"), the angle maths of the fan, IndexedDB storage (with `fake-indexeddb`), and validation of Tatoeba responses. Do not write tests for trivial components or getters. UI behaviour is checked with a small Playwright smoke script, run as `pnpm smoke` against the local model (`VITE_MODEL_BASE_URL=http://localhost:<port>/`), not a heavy end-to-end suite. It covers spec §7 steps 1–7 and the network checks above.
- Subagent-driven (`superpowers:subagent-driven-development`): one fresh subagent per task, then a spec-compliance review and a code-quality review. Subagents never merge, push or switch branches; you commit and push.
- Commit and push after every task. Commit messages: imperative, free-form, no Conventional Commits prefix (e.g. `Add top-p cut with temperature`). End each one with `Co-Authored-By: Claude <noreply@anthropic.com>`; the commit author is Claude, which is intended.
- Full verification at the end of each phase: `pnpm install --frozen-lockfile && pnpm test && pnpm lint && pnpm build`. Once the UI exists, add `pnpm smoke`. For the model tooling: `cd tools/model && uv run python validate.py` (keep that file name).
- Only those commands count as evidence.
- Rules to follow:
  - All code, comments, UI text, README and docs in **British English** (colour, initialise, behaviour, licence as a noun).
  - Comments only where the logic is non-obvious or the reasoning matters. The maths deserves short explanations, because people from the community will read this code to learn.
  - No over-engineering. No unnecessary abstractions or wrapper layers, and no error handling for cases that cannot occur. Prefer clarity over cleverness. Keep dependencies few: React, Vite, onnxruntime-web, a tokenizer library, and only what clearly earns its place.
  - The README must include: project description, prerequisites, installation, usage, development setup, every environment variable (what it does, format, example), how to regenerate the model and the demo embeddings, attribution (Tatoeba CC BY 2.0 FR, NVIDIA model and OpenMDW-1.1), and the licence (AGPL-3.0). Provide `.env.example`.
  - Add a GitHub Actions workflow that builds and deploys to GitHub Pages (`actions/deploy-pages`), with the correct Vite `base` for the project path `/embed-demo/`. It deploys **only on push to `master` and on `workflow_dispatch`**. Do **not** enable Pages or trigger a deployment; Chris does that.
  - Add a CI workflow on `pull_request` that runs `pnpm install --frozen-lockfile && pnpm test && pnpm lint && pnpm build`. That job is the CI gate and must be green on the PR.
  - Footer on every page: "Second Circuit – Association for digital freedom of thought" linking to https://scai.world.

## Deciding without Chris

When the spec leaves something open, or something unforeseen comes up, choose the option that satisfies these, in this order:

1. **Breaks nothing.** Existing behaviour, data and interfaces keep working; prefer the reversible change.
2. **True to the spirit of the application.** A teaching tool for curious non-experts: self-explanatory, honest about its limits, never looking frozen, never more exact than it is. Follow the patterns you have established; no new dependencies unless the spec asks for them or they clearly earn their place.
3. **Opens no new security hole.** Never weaken validation or the handling of untrusted text (spec §9).
4. **True to the spec.**

If a question can only be answered by changing the spec's scope, do not guess: leave that part out and record it in `open-items.md` (repository root; create it).

Log every decision you made this way. Put it in the report and in the PR description under **Decisions made without Chris**, each with the options you saw and why you chose this one.

## A few things that matter to us

- Please do not merge or deploy. Do not enable GitHub Pages, do not upload anything to Hugging Face, and leave `gitops-*`/`argocd-*` and devices alone.
- No secrets in logs, assertions or the report. This project has no secrets; keep it that way.
- Specs outside this topic stay as they are; if one looks wrong, mention it in the report.
- Security boundary: spec §9. Everything that renders user or Tatoeba text, and the Tatoeba response validation, is the sensitive part. It is touched by this work, so the code-quality review of those tasks must check it explicitly (no `dangerouslySetInnerHTML`, no HTML from data).
- At the end: none beyond the report and PR.

## Out of scope

- Everything in spec §8.
- Committing model weights to the repository.
- Uploading to Hugging Face or deploying to GitHub Pages.
- A partial playground before the model has loaded, and a similarity-threshold line (Chris decided against both).

## The report

Order at the end: first open a **draft PR** to `master`, then make one final commit with the report `docs/superpowers/specs/2026-11-16-embedding-playground-overnighter-report.md` and `open-items.md` (both containing the PR link), push it, and update the PR description. The PR description ends with the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. The report contains:
- the environment (CPU, RAM, GPU or none, tool versions)
- the plan review findings and what you did with them
- Task 0 planned vs. measured
- the spike results: quality numbers per sentence, model sizes, load and embedding times on WASM, and the quantisation chosen
- for each task the commit and the real test output
- every mutation individually
- the decisions made without Chris
- deviations, surprises and open points for Chris, including the exact steps he has to do next (export, upload, regenerate demo embeddings, enable Pages)
- the PR link

Do not merge the PR.

## When you are done or stuck

Send a short message via `PushNotification` if it is available; otherwise the PR is the signal and the report says so. If you get stuck, push what you have, write down in the report where and why, and stop there. A clear account of being stuck is worth more than a guess.
