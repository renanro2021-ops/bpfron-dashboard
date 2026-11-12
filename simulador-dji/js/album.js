// Álbum de fotos e vídeos gravados no simulador (IndexedDB do navegador).
// Se o IndexedDB não estiver disponível, guarda só na memória desta sessão.
const DB = 'djisim-album', STORE = 'media';

export class Album {
  constructor() {
    this.mem = [];
    this.ready = new Promise((res) => {
      try {
        const rq = indexedDB.open(DB, 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore(STORE, { keyPath: 'id' });
        rq.onsuccess = () => { this.db = rq.result; res(); };
        rq.onerror = () => res();
      } catch (e) { res(); }
    });
  }
  async tx(mode, fn) {
    await this.ready;
    if (!this.db) return null;
    return new Promise((res) => {
      try {
        const t = this.db.transaction(STORE, mode), st = t.objectStore(STORE);
        const r = fn(st);
        t.oncomplete = () => res(r && r.result);
        t.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  async add(item) {
    item.id = item.id || Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const ok = await this.tx('readwrite', (st) => st.put(item));
    if (ok === null) this.mem.push(item);
    return item;
  }
  async list() {
    const all = (await this.tx('readonly', (st) => st.getAll())) || [];
    return [...all, ...this.mem].sort((a, b) => b.date - a.date);
  }
  async remove(id) {
    this.mem = this.mem.filter((m) => m.id !== id);
    await this.tx('readwrite', (st) => st.delete(id));
  }
}
