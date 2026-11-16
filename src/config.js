// Where the browser model lives. One constant; override it for development
// with VITE_MODEL_BASE_URL (see .env.example and the README).
const DEFAULT_MODEL_BASE_URL = 'https://huggingface.co/SCAI-NGO/nemotron-3-embed-1b-onnx-web/resolve/main/'
const base = import.meta.env.VITE_MODEL_BASE_URL || DEFAULT_MODEL_BASE_URL
export const MODEL_BASE_URL = base.endsWith('/') ? base : base + '/'

export const MODEL_FILES = {
  model: 'model.onnx',
  tokenizer: 'tokenizer.json',
  tokenizerConfig: 'tokenizer_config.json',
}

export const MODEL_LABEL = 'Nemotron-3-Embed-1B (int8)'

// Expected size of model.onnx, used when the server sends no Content-Length.
export const MODEL_SIZE_BYTES = 1_252_692_075

// Longer texts are cut to their first 256 tokens. On a CPU without threads,
// 512 tokens take about 50 s, which feels broken. The UI says when it happens.
export const MAX_TOKENS = 256

export const QUERY_PREFIX = 'query: '
export const PASSAGE_PREFIX = 'passage: '

// Cache API name prefix. The full name ends with the demo set's model
// fingerprint, so a deploy with regenerated demo vectors drops old models.
export const CACHE_PREFIX = 'embed-demo-model-'
