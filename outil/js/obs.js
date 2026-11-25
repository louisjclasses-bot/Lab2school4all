// Client obs-websocket v5 (OBS Studio 28 et plus), sans dépendance : WebSocket du navigateur et Web Crypto.
// Protocole : Hello (op 0), Identify (op 1) avec authentification SHA256 en base64, Identified (op 2), Event (op 5), Request (op 6), Response (op 7).
// Le mot de passe n'est conservé ni ici ni ailleurs : il est passé à connect() et sert seulement à calculer la réponse au défi.
// Aucun texte visible dans ce fichier : les raisons d'échec sont des identifiants que la console traduit.

const SUBPROTOCOL = "obswebsocket.json";
const RPC_VERSION = 1;
const INTENT_OUTPUTS = 64;               // abonnement aux événements de sortie (RecordStateChanged)
const CLOSE_AUTH_FAILED = 4009;

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const sha256 = async s => crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
export async function obsAuth(password, salt, challenge) {
  const secret = b64(await sha256(password + salt));
  return b64(await sha256(secret + challenge));
}

// Nom du fichier seulement : le chemin complet peut contenir un nom de personne (dossier utilisateur).
export function baseName(path) {
  if (typeof path !== "string" || !path) return null;
  const n = path.split(/[\\/]/).filter(Boolean).pop();
  return n || null;
}

// Navigateurs qui bloquent une connexion ws://localhost depuis une page en https (Safari).
export function likelyBlocksLocalWs(ua = navigator.userAgent, protocol = location.protocol) {
  if (protocol !== "https:") return false;
  return /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\/|Firefox\//.test(ua);
}

export class ObsClient {
  constructor({ host = "localhost", port = 4455, WS = (typeof WebSocket !== "undefined" ? WebSocket : null), timeoutMs = 8000, protocol = (typeof location !== "undefined" ? location.protocol : "http:"), ua = (typeof navigator !== "undefined" ? navigator.userAgent : "") } = {}) {
    Object.assign(this, { host, port, WS, timeoutMs, protocol, ua });
    this.ws = null; this.state = "idle";       // idle | connecting | connected | closed
    this.listeners = { event: new Set(), lost: new Set() };
    this.pending = new Map(); this.seq = 0; this.manualClose = false; this.info = null;
  }
  on(name, fn) { this.listeners[name].add(fn); return () => this.listeners[name].delete(fn); }
  emit(name, arg) { this.listeners[name].forEach(fn => { try { fn(arg); } catch (e) { /* un écouteur ne doit pas casser le client */ } }); }
  url() { return `ws://${this.host}:${this.port}`; }

  // Résultat : { ok: true, info } ou { ok: false, reason } avec reason parmi unreachable, timeout, auth, blocked, protocol.
  connect(password = "") {
    this.close(true);
    this.manualClose = false;
    return new Promise(resolve => {
      let done = false, identified = false, opened = false;
      const finish = r => { if (done) return; done = true; clearTimeout(timer); if (!r.ok) { this.state = "closed"; try { ws && ws.close(); } catch (e) { /* déjà fermé */ } } resolve(r); };
      let ws;
      try { ws = new this.WS(this.url(), SUBPROTOCOL); }
      catch (e) { return resolve({ ok: false, reason: e && e.name === "SecurityError" ? "blocked" : "unreachable" }); }
      this.ws = ws; this.state = "connecting";
      const timer = setTimeout(() => finish({ ok: false, reason: opened ? "timeout" : (likelyBlocksLocalWs(this.ua, this.protocol) ? "blocked" : "timeout") }), this.timeoutMs);
      ws.onopen = () => { opened = true; };
      ws.onmessage = async ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return finish({ ok: false, reason: "protocol" }); }
        if (m.op === 0) {                                              // Hello
          const d = m.d || {}, id = { rpcVersion: RPC_VERSION, eventSubscriptions: INTENT_OUTPUTS };
          if (d.authentication) {
            if (!password) return finish({ ok: false, reason: "auth" });
            id.authentication = await obsAuth(password, d.authentication.salt, d.authentication.challenge);
          }
          this.info = { obs: d.obsStudioVersion || null, ws: d.obsWebSocketVersion || null };
          ws.send(JSON.stringify({ op: 1, d: id }));
        } else if (m.op === 2) {                                       // Identified
          identified = true; this.state = "connected"; finish({ ok: true, info: this.info });
        } else if (identified) this.handle(m);
      };
      // Une erreur avant l'ouverture veut dire connexion impossible (refusée, bloquée, introuvable). Safari ne signale alors aucune fermeture :
      // sans cette ligne il faudrait attendre le délai de 8 s. Le détail de la cause n'est pas exposé par les navigateurs.
      ws.onerror = () => { if (!opened) finish({ ok: false, reason: likelyBlocksLocalWs(this.ua, this.protocol) ? "blocked" : "unreachable" }); };
      ws.onclose = ev => {
        const wasConnected = identified && this.state === "connected";
        this.state = "closed"; this.rejectAll();
        if (!identified) return finish({ ok: false, reason: ev.code === CLOSE_AUTH_FAILED ? "auth" : (opened ? "protocol" : (likelyBlocksLocalWs(this.ua, this.protocol) ? "blocked" : "unreachable")) });
        if (wasConnected && !this.manualClose) this.emit("lost", { code: ev.code });
      };
    });
  }
  handle(m) {
    if (m.op === 5) this.emit("event", { type: m.d.eventType, data: m.d.eventData || {} });
    else if (m.op === 7) {
      const p = this.pending.get(m.d.requestId); if (!p) return;
      this.pending.delete(m.d.requestId); clearTimeout(p.timer);
      const st = m.d.requestStatus || {};
      p.resolve({ ok: !!st.result, code: st.code, comment: st.comment || null, data: m.d.responseData || {} });
    }
  }
  // Rejette en échec contrôlé (jamais d'exception non rattrapée) : { ok: false, code: -1 }.
  request(type, data = {}) {
    return new Promise(resolve => {
      if (this.state !== "connected" || !this.ws) return resolve({ ok: false, code: -1, comment: "closed", data: {} });
      const id = "r" + (++this.seq);
      const timer = setTimeout(() => { this.pending.delete(id); resolve({ ok: false, code: -2, comment: "timeout", data: {} }); }, this.timeoutMs);
      this.pending.set(id, { resolve, timer });
      try { this.ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: data } })); }
      catch (e) { this.pending.delete(id); clearTimeout(timer); resolve({ ok: false, code: -1, comment: "send", data: {} }); }
    });
  }
  rejectAll() { for (const [id, p] of this.pending) { clearTimeout(p.timer); p.resolve({ ok: false, code: -1, comment: "closed", data: {} }); } this.pending.clear(); }
  close(silent = false) {
    this.manualClose = true;
    if (this.ws) { try { this.ws.onclose = null; this.ws.close(); } catch (e) { /* déjà fermé */ } this.ws = null; }
    this.rejectAll();
    if (!silent) this.state = "idle"; else if (this.state === "connected") this.state = "idle";
  }
  get connected() { return this.state === "connected"; }
}
