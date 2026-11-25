// Sauvegarde de reprise dans IndexedDB (jamais localStorage : les cartes compilées l'effacent à l'ouverture).
const DB = "fg-outil", V = 1;
function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, V);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore("sessions", { keyPath: "id" });
      db.createObjectStore("events", { keyPath: ["sid", "n"] });
      db.createObjectStore("handles", { keyPath: "sid" });
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export class Store {
  constructor() { this.dbp = open(); this.chain = Promise.resolve(); this.pending = 0; this.error = null; this.onState = null; }
  _q(fn) {
    this.pending++;
    this.chain = this.chain.then(async () => { const db = await this.dbp; return fn(db); })
      .then(v => { this.pending--; this.error = null; this.onState && this.onState(); return v; },
            e => { this.pending--; this.error = String(e && e.message || e); this.onState && this.onState(); });
    return this.chain;
  }
  putSession(rec) { return this._q(db => wrap(db.transaction("sessions", "readwrite").objectStore("sessions").put(rec))); }
  appendEvent(sid, ev) { return this._q(db => wrap(db.transaction("events", "readwrite").objectStore("events").put({ sid, n: ev.n, ev }))); }
  saveHandle(sid, handle) { return this._q(db => wrap(db.transaction("handles", "readwrite").objectStore("handles").put({ sid, handle }))); }
  async flush() { await this.chain; }
  async list() {
    const db = await this.dbp;
    return wrap(db.transaction("sessions").objectStore("sessions").getAll());
  }
  async load(sid) {
    const db = await this.dbp;
    const rec = await wrap(db.transaction("sessions").objectStore("sessions").get(sid));
    const range = IDBKeyRange.bound([sid, 0], [sid, Number.MAX_SAFE_INTEGER]);
    const rows = await wrap(db.transaction("events").objectStore("events").getAll(range));
    const h = await wrap(db.transaction("handles").objectStore("handles").get(sid));
    return { rec, events: rows.map(r => r.ev), handle: h ? h.handle : null };
  }
  async remove(sid) {
    await this.flush();
    const db = await this.dbp;
    await wrap(db.transaction("sessions", "readwrite").objectStore("sessions").delete(sid));
    await wrap(db.transaction("handles", "readwrite").objectStore("handles").delete(sid));
    const range = IDBKeyRange.bound([sid, 0], [sid, Number.MAX_SAFE_INTEGER]);
    await wrap(db.transaction("events", "readwrite").objectStore("events").delete(range));
  }
}
