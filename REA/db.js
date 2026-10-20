// Armazenamento local (IndexedDB): mapas importados e itens (marcas, trilhas, medições).
const DB = (() => {
  let dbp;
  const open = () => dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('mapacampo', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('maps', { keyPath: 'id' });
      r.result.createObjectStore('features', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = async (store, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode), out = fn(t.objectStore(store));
      t.oncomplete = () => res(out.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    all: s => tx(s, 'readonly', o => o.getAll()),
    put: (s, v) => tx(s, 'readwrite', o => o.put(v)),
    del: (s, id) => tx(s, 'readwrite', o => o.delete(id)),
  };
})();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
