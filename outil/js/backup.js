// Export automatique : fichier réécrit à chaque événement (Chrome/Edge) ou instantanés téléchargés (mode dégradé).
export const canWriteFiles = () => typeof window.showSaveFilePicker === "function";

export class Backup {
  constructor({ getExport, now = () => Date.now(), snapshotIntervalS = 120, staleAfterS = 15, onChange = () => {}, onHandle = null }) {
    Object.assign(this, { getExport, now, snapshotIntervalS, staleAfterS, onChange, onHandle });
    this.mode = null; this.handle = null; this.name = null;
    this.lastSaved = null; this.error = null; this.dirtySince = null;
    this.writing = false; this.dirty = false; this.snapN = 0; this.lastSnapN = 0; this.timer = null; this.writes = 0;
  }
  async chooseFile(suggestedName) {
    const h = await window.showSaveFilePicker({ suggestedName, types: [{ description: "JSON", accept: { "application/json": [".json"] } }] });
    await this.useHandle(h, h.name);
  }
  async useOPFS(name) {                 // dev et tests : même API que showSaveFilePicker, sans boîte de dialogue
    const root = await navigator.storage.getDirectory();
    await this.useHandle(await root.getFileHandle(name, { create: true }), name);
  }
  async useHandle(h, name) {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }   // sortie du mode dégradé
    this.handle = h; this.name = name; this.mode = "continu"; this.error = null;
    this.onHandle && this.onHandle(h);
    await this._write();               // premier état dès le choix : le fichier existe tout de suite
    this.onChange();
  }
  useMemory(name) {                    // entraînement : rien n'est écrit ; une panne peut être simulée
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.mode = "memoire"; this.handle = null; this.name = name; this.error = null;
    this.dirty = false; this.dirtySince = null; this.lastSaved = this.now(); this.onChange();
  }
  simulateFailure(msg) { this.error = msg; this.dirty = true; this.dirtySince = this.dirtySince || this.now(); this.onChange(); }
  useDegraded(baseName) {
    this.mode = "degrade"; this.name = baseName; this.lastSaved = null; this.handle = null; this.error = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => { if (this.dirty) this.snapshot(); }, this.snapshotIntervalS * 1000);
    this.onChange();
  }
  markDirty() {
    if (this.mode === "memoire" && !this.error) { this.lastSaved = this.now(); this.dirty = false; this.dirtySince = null; this.onChange(); return; }
    this.dirty = true; if (!this.dirtySince) this.dirtySince = this.now();
    if (this.mode === "continu" && !this.writing) this._write();
    this.onChange();
  }
  async _write() {
    if (!this.handle) return;
    this.writing = true;
    try {
      do {
        this.dirty = false;
        const since = this.dirtySince; this.dirtySince = null;
        const w = await this.handle.createWritable();
        await w.write(JSON.stringify(this.getExport()));
        await w.close();
        this.lastSaved = this.now(); this.writes++; this.error = null;
        if (since && this.dirty) this.dirtySince = since;
      } while (this.dirty);
    } catch (e) {
      this.error = String(e && e.message || e); this.dirty = true; this.dirtySince = this.dirtySince || this.now();
      setTimeout(() => { if (!this.writing) this._write(); }, 3000);
    } finally { this.writing = false; this.onChange(); }
  }
  snapshot(final = false) {            // mode dégradé
    if (this.mode !== "degrade") return;
    const n = ++this.snapN;
    const blob = new Blob([JSON.stringify(this.getExport())], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = this.name.replace(/\.json$/, "") + (final ? "_final" : "_snap" + String(n).padStart(3, "0")) + ".json";
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    this.dirty = false; this.dirtySince = null; this.lastSaved = this.now(); this.onChange();
  }
  phaseEnd() { if (this.mode === "degrade") this.snapshot(); }
  async final() {
    if (this.mode === "continu") {            // attend l'écriture finale, au plus 10 s si le fichier est en échec
      this.markDirty(); const t0 = Date.now();
      while ((this.writing || this.dirty) && Date.now() - t0 < 10000) await new Promise(r => setTimeout(r, 30));
    }
    else if (this.mode === "degrade") this.snapshot(true);
  }
  status() {                           // ok | none | stale | error | off
    if (!this.mode) return "off";
    if (this.error) return "error";
    const lim = this.mode === "degrade" ? this.snapshotIntervalS * 1500 : this.staleAfterS * 1000;
    if (this.dirtySince && this.now() - this.dirtySince > lim) return "stale";
    return this.lastSaved ? "ok" : "none";
  }
}
