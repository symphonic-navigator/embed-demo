import { describe, expect, test } from 'vitest'
import fixture from './fixtures/tatoeba-random.json'
import { MAX_TEXT_LENGTH, TatoebaError, fetchRandomSentences, parseTatoebaResponse, randomSentenceUrl } from './tatoeba.js'

const clone = () => structuredClone(fixture)
const sentence = (over = {}) => ({ id: 1, text: '猫が寝ている。', lang: 'jpn', license: 'CC BY 2.0 FR', ...over })
const translation = (over = {}) => ({ id: 2, text: 'Le chat dort.', lang: 'fra', license: 'CC BY 2.0 FR', is_direct: true, ...over })
const response = (main, translations) => ({ data: [{ ...main, translations }] })

describe('randomSentenceUrl', () => {
  test('asks the v1 API for one random Japanese sentence with translations', () => {
    const url = new URL(randomSentenceUrl())
    expect(url.origin + url.pathname).toBe('https://api.tatoeba.org/v1/sentences')
    expect(url.searchParams.get('lang')).toBe('jpn')
    expect(url.searchParams.get('sort')).toBe('random')
    expect(url.searchParams.get('limit')).toBe('1')
    expect(url.searchParams.get('showtrans:lang')).toBe('fra,deu,eng')
  })
})

describe('parseTatoebaResponse', () => {
  test('a real response gives the sentence and one translation per language', () => {
    const items = parseTatoebaResponse(clone())
    expect(items[0]).toEqual({ id: fixture.data[0].id, lang: 'jpn', text: fixture.data[0].text })
    const langs = items.slice(1).map((i) => i.lang)
    expect(new Set(langs).size).toBe(langs.length)
    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items.length).toBeLessThanOrEqual(4)
  })
  test('prefers a direct translation over an indirect one', () => {
    const items = parseTatoebaResponse(response(sentence(), [
      translation({ id: 3, text: 'Indirect.', is_direct: false }),
      translation({ id: 4, text: 'Direct.', is_direct: true }),
    ]))
    expect(items.map((i) => i.id)).toEqual([1, 4])
  })
  test('throws when data is missing, empty or not an array', () => {
    expect(() => parseTatoebaResponse({})).toThrow(TatoebaError)
    expect(() => parseTatoebaResponse({ data: [] })).toThrow(TatoebaError)
    expect(() => parseTatoebaResponse({ data: 'x' })).toThrow(TatoebaError)
    expect(() => parseTatoebaResponse(null)).toThrow(TatoebaError)
  })
  test('throws when the main sentence is invalid or not Japanese', () => {
    expect(() => parseTatoebaResponse(response(sentence({ id: '1' }), []))).toThrow(TatoebaError)
    expect(() => parseTatoebaResponse(response(sentence({ text: '' }), []))).toThrow(TatoebaError)
    expect(() => parseTatoebaResponse(response(sentence({ lang: 'fra' }), []))).toThrow(TatoebaError)
  })
  test('drops invalid translations', () => {
    const items = parseTatoebaResponse(response(sentence(), [
      translation({ id: '5' }),
      translation({ id: 0, lang: 'deu' }),
      translation({ id: 6, lang: 'eng', text: 'x'.repeat(MAX_TEXT_LENGTH + 1) }),
      translation({ id: 7, lang: 'eng', text: 42 }),
      translation({ id: 8, lang: 'en<b>', text: 'Bad language code.' }),
      translation({ id: 9, lang: 'deu', text: '   ' }),
      translation({ id: 10, lang: 'deu', is_unapproved: true }),
      translation({ id: 11, lang: 'deu', license: null }),
    ]))
    expect(items.map((i) => i.id)).toEqual([1])
  })
  test('keeps markup as plain text: it is rendered as text, never parsed', () => {
    const evil = '<img src=x onerror=alert(1)>'
    const items = parseTatoebaResponse(response(sentence(), [translation({ text: evil })]))
    expect(items[1].text).toBe(evil)
  })
  test('trims before checking the length', () => {
    const text = ' ' + 'x'.repeat(MAX_TEXT_LENGTH) + ' '
    expect(parseTatoebaResponse(response(sentence(), [translation({ text })]))[1].text).toHaveLength(MAX_TEXT_LENGTH)
  })
  test('MAX_TEXT_LENGTH is 300', () => expect(MAX_TEXT_LENGTH).toBe(300))
})

describe('fetchRandomSentences', () => {
  const ok = (json) => async () => ({ ok: true, status: 200, json: async () => json })
  test('returns the parsed sentences', async () => {
    expect((await fetchRandomSentences(ok(clone())))[0].lang).toBe('jpn')
  })
  test('HTTP errors become a TatoebaError', async () => {
    const fetchFn = async () => ({ ok: false, status: 500, json: async () => ({}) })
    await expect(fetchRandomSentences(fetchFn)).rejects.toThrow(TatoebaError)
  })
  test('network failures become a TatoebaError', async () => {
    await expect(fetchRandomSentences(async () => { throw new TypeError('offline') })).rejects.toThrow(TatoebaError)
  })
  test('a timeout becomes a friendly TatoebaError', async () => {
    const fetchFn = async () => { throw new DOMException('slow', 'TimeoutError') }
    await expect(fetchRandomSentences(fetchFn)).rejects.toThrow('taking too long')
  })
  test('a non-JSON page becomes a TatoebaError', async () => {
    const fetchFn = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad') } })
    await expect(fetchRandomSentences(fetchFn)).rejects.toThrow(TatoebaError)
  })
})
