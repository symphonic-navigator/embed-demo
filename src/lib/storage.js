// Texts and their vectors, kept in this browser's IndexedDB. Nothing is sent
// anywhere, nothing is backed up and nothing is encrypted; the UI says so.
//
// One object store, `entries`, with an index on `collection`
// ('my-texts' or 'tatoeba'). Float32Array vectors are stored as they are.

const STORE = 'entries'

const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

export async function openStore(name = 'embed-demo') {
  const open = indexedDB.open(name, 1)
  open.onupgradeneeded = () => {
    const store = open.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    store.createIndex('collection', 'collection')
  }
  const db = await request(open)

  const objects = (mode) => db.transaction(STORE, mode).objectStore(STORE)
  const inCollection = (collection) => request(objects('readonly').index('collection').getAll(collection))

  return {
    add: (collection, entry) => request(objects('readwrite').add({ ...entry, collection })),
    // getAll on the index returns entries in key order, i.e. insertion order.
    list: inCollection,
    remove: (id) => request(objects('readwrite').delete(id)),
    async clear(collection) {
      const keys = await request(objects('readonly').index('collection').getAllKeys(collection))
      const store = objects('readwrite')
      await Promise.all(keys.map((key) => request(store.delete(key))))
    },
    async hasSource(collection, sourceId) {
      return (await inCollection(collection)).some((e) => e.sourceId === sourceId)
    },
    close: () => db.close(),
  }
}
