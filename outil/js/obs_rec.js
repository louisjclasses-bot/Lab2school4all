// Enregistrement de secours piloté via OBS. L'outil ne capte aucun son : il commande OBS.
// Ce module relie le client OBS (obs.js) au journal de séance : tout ce qui est consigné passe par session.dispatch,
// et l'état affiché se déduit du journal (state.enregistrement_secours) et de la liaison avec OBS.
// Jamais de mot de passe dans le journal, l'export, le stockage de reprise ou l'adresse : il reste dans le champ #pw, en mémoire.
// Aucun texte visible ici : les états sont des identifiants que la console traduit.
import { ObsClient, baseName } from "./obs.js";

const START_WAIT_MS = 10000;

export class ObsRecorder {
  #pw = "";
  constructor({ session, host = "localhost", port = 4455, pollMs = 5000, reconnectMs = 3000, onChange = () => {}, onConnected = () => {}, WS, timeoutMs, ua, protocol } = {}) {
    Object.assign(this, { session, pollMs, reconnectMs, onChange, onConnected });
    this.client = new ObsClient({ host, port, WS, timeoutMs, ua, protocol });
    this.link = "idle";              // idle | connecting | connected | unreachable | auth | blocked | timeout | protocol
    this.rec = { active: null };     // active : true, false, ou null tant qu'OBS n'a pas répondu
    this.check = { joignable: null, dejaEnCours: null, version: null };
    this.stopping = false; this.starting = false; this.lostLogged = false; this.disposed = false;
    this.pollTimer = null; this.retryTimer = null; this.waiters = new Set();
    this.client.on("event", e => this.onObsEvent(e));
    this.client.on("lost", () => this.onLost());
    this.pollTimer = setInterval(() => this.poll(), this.pollMs);
  }

  // ---------- réglages ----------
  setPollMs(ms) { this.pollMs = ms; clearInterval(this.pollTimer); this.pollTimer = setInterval(() => this.poll(), ms); }
  setSettings({ host, port }) { if (host) this.client.host = host.trim(); if (port) this.client.port = Number(port); }
  setPassword(pw) { this.#pw = pw || ""; }
  get hasPassword() { return !!this.#pw; }
  get host() { return this.client.host; }
  get port() { return this.client.port; }
  get obsState() { return this.session.s.enregistrement_secours; }
  get openSegment() { const sg = this.obsState.segments; const l = sg[sg.length - 1]; return l && !l.fin_iso ? l : null; }
  get used() { return this.obsState.segments.length > 0; }
  get without() { return this.obsState.choix_sans_enregistrement; }
  get recording() { return !!this.openSegment; }
  setLink(l) { if (this.link !== l) { this.link = l; this.onChange(); } }

  // ---------- connexion et vérifications du démarrage ----------
  // Retourne { ok, reason? }. Remplit check.joignable et check.dejaEnCours.
  async connect(password) {
    if (password !== undefined) this.#pw = password;
    this.clearRetry(); this.setLink("connecting"); this.check = { joignable: null, dejaEnCours: null, version: null }; this.onChange();
    const r = await this.client.connect(this.#pw);
    if (this.disposed) return r;
    if (!r.ok) { this.check = { joignable: false, reason: r.reason, dejaEnCours: null, version: null }; this.setLink(r.reason === "auth" || r.reason === "blocked" || r.reason === "timeout" || r.reason === "protocol" ? r.reason : "unreachable"); this.scheduleRetryIfExpected(); return r; }
    this.check = { joignable: true, dejaEnCours: null, version: r.info && r.info.obs };
    this.setLink("connected");
    this.onConnected({ host: this.host, port: this.port });        // adresse et port seulement (pas secrets), pour la reprise après plantage
    await this.refreshStatus();
    this.check.dejaEnCours = !this.recording && this.rec.active === true;
    await this.afterReconnect();
    this.onChange();
    return { ok: true };
  }
  // Après toute (re)connexion pendant une séance : consigner le retour, et détecter un arrêt survenu pendant la coupure.
  async afterReconnect() {
    if (this.lostLogged) { this.lostLogged = false; this.incident("connexion_retablie", this.openSegment ? this.openSegment.n : null); }
    if (this.openSegment && this.rec.active === false && !this.stopping && !this.starting) this.unexpectedStop(null);
  }
  async recheck() { return this.connect(); }
  async refreshStatus() {
    const r = await this.client.request("GetRecordStatus");
    if (r.ok) { const prev = this.rec.active; this.rec.active = !!r.data.outputActive; if (prev !== this.rec.active) this.onChange(); }
    return r;
  }

  // ---------- démarrage, relance, arrêt ----------
  // Première ouverture de la scène : un premier segment. Relance : un nouveau segment (nouveau fichier).
  async start() {
    if (this.starting || this.recording || this.without) return { ok: false, reason: "inutile" };
    if (!this.client.connected) return { ok: false, reason: "non_connecte" };
    await this.refreshStatus();
    if (this.rec.active) return { ok: false, reason: "deja_en_cours" };       // jamais adopter un enregistrement que l'outil n'a pas lancé
    this.starting = true; this.onChange();
    try {
      const startedP = this.waitFor(e => e.type === "RecordStateChanged" && e.data.outputState === "OBS_WEBSOCKET_OUTPUT_STARTED", START_WAIT_MS);
      const r = await this.client.request("StartRecord");
      if (!r.ok) { this.cancelWait(startedP); this.incident("demarrage_echoue"); return { ok: false, reason: "refuse" }; }
      let ev = await startedP.promise;
      if (!ev) { await this.refreshStatus(); if (!this.rec.active) { this.incident("demarrage_echoue"); return { ok: false, reason: "pas_confirme" }; } ev = { data: {} }; }
      this.rec.active = true;
      const n = this.obsState.segments.length + 1;
      this.session.dispatch("obs_debut", { segment: n, fichier: baseName(ev.data.outputPath), horloge_ms: this.session.now() });
      if (n > 1) this.incident("relance", n);
      return { ok: true };
    } finally { this.starting = false; this.onChange(); }
  }
  // Arrêt demandé par le modérateur, à l'étape d'export. Ne jamais l'appeler ailleurs.
  async stop() {
    const seg = this.openSegment; if (!seg) return { ok: false, reason: "rien_a_arreter" };
    if (!this.client.connected) return { ok: false, reason: "non_connecte" };
    this.stopping = true; this.onChange();
    try {
      const stoppedP = this.waitFor(e => e.type === "RecordStateChanged" && e.data.outputState === "OBS_WEBSOCKET_OUTPUT_STOPPED", START_WAIT_MS);
      const r = await this.client.request("StopRecord");
      let path = r.ok && r.data && r.data.outputPath;
      const ev = await stoppedP.promise;
      if (!r.ok && !ev) { this.cancelWait(stoppedP); return { ok: false, reason: "refuse" }; }
      this.rec.active = false;
      this.closeSegment(seg, "moderateur", baseName((ev && ev.data.outputPath) || path));
      return { ok: true };
    } finally { this.stopping = false; this.onChange(); }
  }
  chooseWithout(motif) {
    if (this.without || this.used) return;
    this.session.dispatch("obs_choix", { motif });
    this.clearRetry(); this.onChange();
  }

  // ---------- événements OBS, surveillance, perte de connexion ----------
  onObsEvent(e) {
    this.waiters.forEach(w => { if (w.pred(e)) { clearTimeout(w.timer); this.waiters.delete(w); w.resolve(e); } });
    if (e.type === "RecordFileChanged" && this.openSegment && e.data.newOutputPath) {       // fractionnement de fichier dans OBS : le segment couvre plusieurs fichiers
      this.session.dispatch("obs_fichier", { segment: this.openSegment.n, fichier: baseName(e.data.newOutputPath) }); this.onChange(); return;
    }
    if (e.type !== "RecordStateChanged") return;
    this.rec.active = !!e.data.outputActive;
    const stopped = e.data.outputState === "OBS_WEBSOCKET_OUTPUT_STOPPED";
    if (stopped && this.openSegment && !this.stopping) this.unexpectedStop(baseName(e.data.outputPath));
    else if (e.data.outputState === "OBS_WEBSOCKET_OUTPUT_STARTED" && this.openSegment && !this.openSegment.fichiers.length && e.data.outputPath) {
      this.session.dispatch("obs_fichier", { segment: this.openSegment.n, fichier: baseName(e.data.outputPath) });
    }
    this.onChange();
  }
  async poll() {
    if (this.disposed || !this.client.connected) return;
    const r = await this.refreshStatus();
    if (r.ok && this.openSegment && !this.rec.active && !this.stopping && !this.starting) this.unexpectedStop(null);
  }
  unexpectedStop(fichier) {
    const seg = this.openSegment; if (!seg) return;
    this.closeSegment(seg, "inattendu", fichier);
    this.incident("arret_inattendu", seg.n);
  }
  closeSegment(seg, cause, fichier) {
    this.session.dispatch("obs_fin", { segment: seg.n, fichier: fichier || null, cause, horloge_ms: this.session.now() });
  }
  incident(type, segment = null) { this.session.dispatch("obs_incident", { type, segment }); }
  onLost() {
    this.rec.active = null;
    const expected = this.recording || (this.session.s.status !== "setup" && this.used);
    if (expected && !this.lostLogged) { this.lostLogged = true; this.incident("connexion_perdue", this.openSegment ? this.openSegment.n : null); }
    this.setLink("unreachable"); this.scheduleRetryIfExpected();
  }
  // Reconnexion automatique : seulement si une surveillance est attendue et que le mot de passe est en mémoire (sinon la console le redemande).
  scheduleRetryIfExpected() {
    this.clearRetry();
    if (this.disposed || this.without || !this.used || this.view === "termine") return;
    this.retryTimer = setTimeout(() => this.retry(), this.reconnectMs);
  }
  async retry() {
    if (this.disposed || this.client.connected) return;
    const r = await this.client.connect(this.#pw);
    if (this.disposed) return;
    if (!r.ok) { this.setLink(r.reason === "auth" ? "auth" : "unreachable"); if (r.reason !== "auth") this.scheduleRetryIfExpected(); return; }
    this.setLink("connected");
    await this.refreshStatus();
    await this.afterReconnect();
  }
  clearRetry() { clearTimeout(this.retryTimer); this.retryTimer = null; }

  // ---------- état pour l'affichage ----------
  // en_cours | arrete | injoignable | pas_demarre | sans | termine
  get view() {
    const o = this.obsState, seg = this.openSegment;
    if (seg) return this.client.connected ? (this.rec.active === false ? "arrete" : "en_cours") : "injoignable";
    if (o.segments.length) return o.segments[o.segments.length - 1].cause === "moderateur" ? "termine" : "arrete";
    return o.choix_sans_enregistrement ? "sans" : "pas_demarre";
  }

  // ---------- utilitaires ----------
  waitFor(pred, ms) {
    let w; const promise = new Promise(resolve => { w = { pred, resolve, timer: setTimeout(() => { this.waiters.delete(w); resolve(null); }, ms) }; this.waiters.add(w); });
    return { promise, w };
  }
  cancelWait(h) { clearTimeout(h.w.timer); this.waiters.delete(h.w); }
  dispose() { this.disposed = true; clearInterval(this.pollTimer); this.clearRetry(); this.client.close(); }
}
