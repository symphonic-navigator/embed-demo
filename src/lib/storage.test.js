import 'fake-indexeddb/auto'
import { describe, expect, test } from 'vitest'
import { openStore } from './storage.js'

let n = 0
const fresh = () => `test-${n++}`
const vec = (x) => new Float32Array([x, x, x])

describe('openStore', () => {
  test('add then list returns the text and a Float32Array vector', async () => {
    const store = await openStore(fresh())
    const id = await store.add('my-texts', { text: 'Autumn moonlight', vector: vec(0.5) })
    const [entry] = await store.list('my-texts')
    expect(entry.id).toBe(id)
    expect(entry.text).toBe('Autumn moonlight')
    expect(entry.vector).toBeInstanceOf(Float32Array)
    expect([...entry.vector]).toEqual([0.5, 0.5, 0.5])
  })
  test('lists in insertion order and keeps collections apart', async () => {
    const store = await openStore(fresh())
    await store.add('my-texts', { text: 'a', vector: vec(1) })
    await store.add('tatoeba', { text: 'b', lang: 'jpn', sourceId: 7, vector: vec(2) })
    await store.add('my-texts', { text: 'c', vector: vec(3) })
    expect((await store.list('my-texts')).map((e) => e.text)).toEqual(['a', 'c'])
    expect((await store.list('tatoeba')).map((e) => e.text)).toEqual(['b'])
  })
  test('remove deletes one entry', async () => {
    const store = await openStore(fresh())
    const a = await store.add('my-texts', { text: 'a', vector: vec(1) })
    await store.add('my-texts', { text: 'b', vector: vec(2) })
    await store.remove(a)
    expect((await store.list('my-texts')).map((e) => e.text)).toEqual(['b'])
  })
  test('clear empties one collection only', async () => {
    const store = await openStore(fresh())
    await store.add('my-texts', { text: 'a', vector: vec(1) })
    await store.add('tatoeba', { text: 'b', vector: vec(2) })
    await store.clear('my-texts')
    expect(await store.list('my-texts')).toEqual([])
    expect(await store.list('tatoeba')).toHaveLength(1)
  })
  test('hasSource finds stored Tatoeba sentences', async () => {
    const store = await openStore(fresh())
    await store.add('tatoeba', { text: 'b', sourceId: 42, vector: vec(2) })
    expect(await store.hasSource('tatoeba', 42)).toBe(true)
    expect(await store.hasSource('tatoeba', 43)).toBe(false)
    expect(await store.hasSource('my-texts', 42)).toBe(false)
  })
  test('entries survive reopening the database (a page reload)', async () => {
    const name = fresh()
    const first = await openStore(name)
    await first.add('my-texts', { text: 'kept', vector: vec(1) })
    first.close()
    const second = await openStore(name)
    expect((await second.list('my-texts')).map((e) => e.text)).toEqual(['kept'])
  })
})
