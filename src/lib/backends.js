// WebGPU runs the model on the graphics card and is much faster, but not every
// browser or machine can create a WebGPU session for this model. WASM (the
// CPU) always works, so it is the fallback.

export function chooseBackends(hasWebGpu) {
  return hasWebGpu ? ['webgpu', 'wasm'] : ['wasm']
}

export async function createSession(ort, bytes, hasWebGpu) {
  let lastError
  for (const backend of chooseBackends(hasWebGpu)) {
    try {
      const session = await ort.InferenceSession.create(bytes, { executionProviders: [backend] })
      return { session, backend }
    } catch (err) {
      lastError = err
      console.info(`The ${backend} backend could not start:`, err?.message ?? err)
    }
  }
  throw lastError
}
