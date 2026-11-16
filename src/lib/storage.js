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

  // Writes resolve only once the transaction has committed, so a failure at
  // commit time (for example a full disk quota) is not reported as success.
  const write = (work) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      let result
      Promise.resolve(work(tx.objectStore(STORE))).then((r) => (result = r), reject)
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })

  return {
    add: (collection, entry) => write((store) => request(store.add({ ...entry, collection }))),
    // getAll on the index returns entries in key order, i.e. insertion order.
    list: inCollection,
    remove: (id) => write((store) => store.delete(id)),
    clear: (collection) =>
      write((store) => {
        const cursors = store.index('collection').openKeyCursor(collection)
        cursors.onsuccess = () => {
          const cursor = cursors.result
          if (cursor) {
            store.delete(cursor.primaryKey)
            cursor.continue()
          }
        }
      }),
    async hasSource(collection, sourceId) {
      return (await inCollection(collection)).some((e) => e.sourceId === sourceId)
    },
    close: () => db.close(),
  }
}
