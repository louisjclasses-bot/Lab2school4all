// Liaison console <-> scène sans serveur : BroadcastChannel + window.open/postMessage en repli.
const NAME = "fg-lab2school4all-v1";
export class Link {
  constructor(onMessage) {
    this.onMessage = onMessage; this.win = null; this.seen = new Set();
    try { this.bc = new BroadcastChannel(NAME); this.bc.onmessage = e => this._in(e.data); } catch (e) { this.bc = null; }
    addEventListener("message", e => { if (e.origin === location.origin && e.data && e.data.fg) this._in(e.data); });
  }
  _in(m) { if (!m || !m.fg) return; if (m.id) { if (this.seen.has(m.id)) return; this.seen.add(m.id); if (this.seen.size > 500) this.seen.clear(); } this.onMessage(m); }
  send(msg) {
    const m = { fg: 1, id: Math.random().toString(36).slice(2), ...msg };
    if (this.bc) this.bc.postMessage(m);
    const w = this.win || (window.opener && window.opener !== window ? window.opener : null);
    if (w && !w.closed) { try { w.postMessage(m, location.origin); } catch (e) { /* ignoré */ } }
  }
}
