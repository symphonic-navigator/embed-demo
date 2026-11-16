import { describe, expect, test } from 'vitest'
import { chooseBackends, createSession } from './backends.js'

const fakeOrt = (working) => {
  const tried = []
  return {
    tried,
    InferenceSession: {
      create: async (bytes, { executionProviders: [ep] }) => {
        tried.push(ep)
        if (!working.includes(ep)) throw new Error(`${ep} unavailable`)
        return { ep }
      },
    },
  }
}

describe('chooseBackends', () => {
  test('tries WebGPU first when the browser has it', () => expect(chooseBackends(true)).toEqual(['webgpu', 'wasm']))
  test('uses WASM only without WebGPU', () => expect(chooseBackends(false)).toEqual(['wasm']))
})

describe('createSession', () => {
  test('falls back to WASM when WebGPU fails to initialise', async () => {
    const ort = fakeOrt(['wasm'])
    const { session, backend } = await createSession(ort, new Uint8Array(1), true)
    expect(backend).toBe('wasm')
    expect(session.ep).toBe('wasm')
    expect(ort.tried).toEqual(['webgpu', 'wasm'])
  })
  test('prefers WebGPU when both work', async () => {
    const { backend } = await createSession(fakeOrt(['webgpu', 'wasm']), new Uint8Array(1), true)
    expect(backend).toBe('webgpu')
  })
  test('never tries WebGPU when the browser lacks it', async () => {
    const ort = fakeOrt(['webgpu', 'wasm'])
    expect((await createSession(ort, new Uint8Array(1), false)).backend).toBe('wasm')
    expect(ort.tried).toEqual(['wasm'])
  })
  test('passes the last error on when nothing works', async () => {
    await expect(createSession(fakeOrt([]), new Uint8Array(1), true)).rejects.toThrow('wasm unavailable')
  })
})
