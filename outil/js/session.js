// Session : journal d'événements + commandes (garde-fous). Les commandes retournent {ok, raison?}.
// Les raisons sont des identifiants de chaînes (clé i18n "err.<raison>"), jamais du texte.
import { initState, reduce, replay, currentPhase, phaseCardId, presentCount, placedTokens, computeSelection,
  shiftPos, pas, CALIB } from "./state.js";
import { phaseActiveMs } from "./timers.js";
import { isoNow, clone, CASES } from "./util.js";

const OK = { ok: true };
const KO = raison => ({ ok: false, raison });
const NEXT_REASON_SKIP_MOTIFS = ["temps", "incident", "autre"];

export class Session {
  constructor({ header, cfg, order, participants, events = [], clock = () => Date.now(), validator = null }) {
    this.header = header; this.cfg = cfg; this.order = order; this.participants = participants;
    this.clock = clock; this.validator = validator;
    this.events = []; this.listeners = new Set();
    this.state = initState(cfg, order, participants);
    events.forEach(e => { this.events.push(e); reduce(this.state, e); });
  }
  static restore(header, events, opts = {}) {
    return new Session({ header, cfg: header.config, order: header.order, participants: header.participants, events, ...opts });
  }
  onEvent(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  now() { return this.clock(); }
  get s() { return this.state; }

  dispatch(type, data = {}) {
    const ms = this.now(), s = this.state;
    const p = currentPhase(s);
    const ev = { n: this.events.length + 1, t: isoNow(ms), el: s.go ? ms - s.go : null, phase: p ? p.id : null, type, data };
    if (this.validator) this.validator(ev);
    reduce(s, ev);
    this.events.push(ev);
    this.listeners.forEach(fn => fn(ev));
    return ev;
  }
  exportObject() { return { header: this.header, events: this.events, state: clone(this.state) }; }

  // ---------- séance ----------
  create() { this.dispatch("session_creee", { fg_id: this.header.fg_id, tool_version: this.header.tool_version }); }
  setPresent(pid, present) {
    if (this.s.present[pid] === present) return OK;
    const next = { ...this.s.present, [pid]: present };
    this.dispatch("presents", { participant: pid, present, total_presents: Object.values(next).filter(Boolean).length });
    return OK;
  }
  setBackup(mode, fichier = null) { this.dispatch("sauvegarde_choisie", { mode, fichier }); return OK; }
  syncAudio() { this.dispatch("sync_audio"); return OK; }
  canGo() { return this.s.status === "setup" && !!this.s.backup.mode; }
  go() {
    if (this.s.status !== "setup") return KO("deja_demarre");
    if (!this.s.backup.mode) return KO("sauvegarde_requise");
    this.dispatch("go");
    this.startPhase(0);
    return OK;
  }
  pause() { if (this.s.status !== "running") return KO("pas_en_cours"); this.dispatch("pause_debut"); return OK; }
  resume() {
    if (this.s.status !== "paused") return KO("pas_en_pause");
    this.dispatch("pause_fin", { duree_ms: this.now() - this.s.pausedSince }); return OK;
  }
  addNote(texte) { texte = (texte || "").trim(); if (!texte) return KO("note_vide"); this.dispatch("note", { texte, carte: this.curCard() }); return OK; }
  incident(type = "technique", note) { this.dispatch("incident", { type, note: note || null }); return OK; }

  // ---------- phases ----------
  curPhase() { return currentPhase(this.s); }
  curCard() { const p = this.curPhase(); return p ? phaseCardId(this.s, p.id) : null; }
  untreated() {
    const p = this.curPhase(), s = this.s; if (!p || p.module === "tutoriel") return [];
    const seq = s.seq[p.id] || [], out = [];
    seq.forEach((id, i) => {
      if (!isDone(s, p.id, id)) out.push({ carte: id, rang: i + 1, duree_ms: i === s.cursor[p.id] ? this.cardElapsed() : 0 });
    });
    return out;
  }
  startPhase(i) {
    const s = this.s;
    const p = this.curPhase();
    if (p && p.started && !p.ended) {
      this.leaveZoom();
      const dur = phaseActiveMs(s, this.now()), plan = p.planned_min * 60000;
      this.dispatch("phase_fin", { phase: p.id, prevue_min: p.planned_min, duree_ms: dur, depassement_ms: Math.max(0, dur - plan), non_traitees: this.untreated() });
    }
    if (i >= s.phases.length) { this.dispatch("fin_seance"); return; }
    const np = s.phases[i];
    this.dispatch("phase_debut", { phase: np.id, module: np.module, rang: i, prevue_min: np.planned_min });
    if (np.module === "discussion") {
      const detail = computeSelection(s);
      this.dispatch("selection", { cartes: detail.map(d => d.carte), detail });
    }
    if (["tutoriel", "tri", "discussion", "jugement"].includes(np.module) && s.seq[np.id].length) {
      this.dispatch("carte_debut", { phase: np.id, carte: s.seq[np.id][0], rang: 1 });
    }
  }
  nextPhase() {
    if (this.s.status !== "running") return KO("pas_en_cours");
    this.startPhase(this.s.phaseIdx + 1); return OK;
  }
  isLastPhase() { return this.s.phaseIdx >= this.s.phases.length - 1; }

  // ---------- carte courante ----------
  cardElapsed() {
    const p = this.curPhase(), id = this.curCard(), s = this.s; if (!p || !id) return 0;
    const t0 = p.id === "discussion" ? s.cards[id].disc?.entered : p.id === "jugement" ? s.adapt[id]?.entered : s.cards[id].entered;
    return t0 ? this.now() - t0 : 0;
  }
  leaveZoom() {
    const z = this.s.zoom;
    if (z.niveau !== 100 || z.region !== 4) this.setZoom(100, 4);
  }
  advance(type, extra = {}) {
    const p = this.curPhase(), s = this.s, id = this.curCard();
    const rang = s.cursor[p.id] + 1;
    this.leaveZoom();
    this.dispatch(type, { phase: p.id, carte: id, rang, duree_ms: this.cardElapsed(), ...extra });
    const seq = s.seq[p.id], nxt = s.cursor[p.id] + 1;
    if (nxt < seq.length) this.dispatch("carte_debut", { phase: p.id, carte: seq[nxt], rang: nxt + 1 });
    else this.nextPhase();
  }
  isLastCard() { const p = this.curPhase(); return !!p && this.s.cursor[p.id] >= this.s.seq[p.id].length - 1; }
  canNext() {
    const p = this.curPhase(), id = this.curCard(), s = this.s;
    if (!p || !id || s.status !== "running") return false;
    if (p.module === "tri") return !!s.cards[id].question.statut;
    if (p.module === "jugement") { const a = s.adapt[id]; return a.tokens.filter(t => t.kind === "adapted").every(t => t.validated); }
    return p.module === "discussion";
  }
  nextCard() {
    if (!this.canNext()) {
      const p = this.curPhase();
      return KO(p && p.module === "tri" ? "question_requise" : "validation_requise");
    }
    this.advance("carte_suivante"); return OK;
  }
  skipCard(motif) {
    const p = this.curPhase();
    if (!p || !["tri", "discussion", "jugement"].includes(p.module) || this.s.status !== "running") return KO("pas_de_carte");
    if (!NEXT_REASON_SKIP_MOTIFS.includes(motif)) return KO("motif_requis");
    this.advance("carte_sautee", { motif }); return OK;
  }

  // ---------- tri (et démo du tutoriel) ----------
  inTriLike() { const p = this.curPhase(); return !!p && (p.module === "tri" || p.module === "tutoriel") && this.s.status === "running"; }
  placeToken(tokenId, caseName) {
    if (!this.inTriLike()) return KO("pas_de_tri");
    if (!CASES.includes(caseName)) return KO("case_inconnue");
    const id = this.curCard(), c = this.s.cards[id], z = this.s.zoom;
    const existing = tokenId ? c.tokens.find(t => t.id === tokenId) : null;
    if (existing && existing.case === caseName) return OK;
    if (c.tokens.some(t => t.case === caseName && t !== existing)) return KO("case_occupee");
    if (!existing && c.tokens.length >= CASES.length) return KO("trop_de_miniatures");
    const miniature = existing ? existing.id : String(c.tokens.reduce((m, t) => Math.max(m, +t.id), 0) + 1);
    const source = existing && existing.case ? "repositionne" : (placedTokens(c).length ? "second" : "premier");
    this.dispatch("placement", { carte: id, miniature, case: caseName, source, zoom_niveau: z.niveau, zoom_region: z.region });
    return OK;
  }
  removeToken(tokenId) {
    if (!this.inTriLike()) return KO("pas_de_tri");
    const id = this.curCard(), c = this.s.cards[id];
    if (!c.tokens.some(t => t.id === tokenId)) return KO("miniature_inconnue");
    this.dispatch("retrait", { carte: id, miniature: tokenId }); return OK;
  }
  setCounts(counts) {
    if (!this.inTriLike()) return KO("pas_de_tri");
    const id = this.curCard(), c = this.s.cards[id];
    if (placedTokens(c).length < 2) return KO("effectifs_apres_deux");
    const e = {}; let total = 0;
    [...CASES, "abstention"].forEach(k => { e[k] = Math.max(0, Math.floor(+counts[k] || 0)); total += e[k]; });
    this.dispatch("effectifs", { carte: id, effectifs: e, presents: presentCount(this.s), total });
    return OK;
  }
  confirmQuestion() {
    if (!this.inTriLike() || this.curPhase().module !== "tri") return KO("pas_de_tri");
    const id = this.curCard(), c = this.s.cards[id];
    if (!placedTokens(c).length) return KO("placement_requis");
    if (c.question.statut) return KO("question_deja");
    this.dispatch("question_rituelle", { carte: id, statut: "posee", motif: null, presents: presentCount(this.s) });
    return OK;
  }
  skipQuestion(motif) {
    if (!this.inTriLike() || this.curPhase().module !== "tri") return KO("pas_de_tri");
    const id = this.curCard(), c = this.s.cards[id];
    if (!NEXT_REASON_SKIP_MOTIFS.includes(motif)) return KO("motif_requis");
    if (!placedTokens(c).length) return KO("placement_requis");
    if (c.question.statut) return KO("question_deja");
    this.dispatch("question_rituelle", { carte: id, statut: "passee", motif, presents: presentCount(this.s) });
    return OK;
  }

  // ---------- zoom ----------
  setZoom(niveau, region) {
    const z = this.s.zoom, id = this.curCard();
    if (!id || ![100, 150, 200].includes(niveau) || region < 0 || region > 8) return KO("zoom_invalide");
    if (niveau === 100) region = 4;
    if (z.niveau === niveau && z.region === region) return OK;
    this.dispatch("zoom", { carte: id, niveau, region, niveau_precedent: z.niveau, region_precedente: z.region,
      duree_precedente_ms: z.since ? this.now() - z.since : 0 });
    return OK;
  }

  // ---------- jugement des adaptations ----------
  inJuge() { const p = this.curPhase(); return !!p && p.module === "jugement" && this.s.status === "running"; }
  adaptToken(tokenId) { const a = this.s.adapt[this.curCard()]; return a && a.tokens.find(t => t.id === tokenId && t.kind === "adapted"); }
  moveAdapted(tokenId, caseName, zone) {
    if (!this.inJuge()) return KO("pas_de_jugement");
    const t = this.adaptToken(tokenId); if (!t) return KO("miniature_inconnue");
    if (!CASES.includes(caseName) || zone < 0 || zone > 2) return KO("case_inconnue");
    if (t.case === caseName && t.zone === zone) return OK;
    const z = this.s.zoom;
    this.dispatch("adaptation_placement", { carte: this.curCard(), miniature: tokenId, case: caseName, zone, pas: pas(caseName, zone), zoom_niveau: z.niveau, zoom_region: z.region });
    return OK;
  }
  shiftAdapted(tokenId, dir) {
    const t = this.adaptToken(tokenId); if (!t) return KO("miniature_inconnue");
    const p = shiftPos(t.case, t.zone, dir);
    return this.moveAdapted(tokenId, p.case, p.zone);
  }
  duplicateAdapted(tokenId) {
    if (!this.inJuge()) return KO("pas_de_jugement");
    const t = this.adaptToken(tokenId); if (!t) return KO("miniature_inconnue");
    const a = this.s.adapt[this.curCard()];
    this.dispatch("adaptation_duplication", { carte: this.curCard(), miniature: "a" + a.nextA, depuis: t.id, case: t.case, zone: t.zone, pas: pas(t.case, t.zone) });
    return OK;
  }
  removeAdapted(tokenId) {
    if (!this.inJuge()) return KO("pas_de_jugement");
    const t = this.adaptToken(tokenId); if (!t) return KO("miniature_inconnue");
    if (!t.duplique_de) return KO("retrait_interdit");
    this.dispatch("adaptation_retrait", { carte: this.curCard(), miniature: tokenId }); return OK;
  }
  validateAdapted(tokenId) {
    if (!this.inJuge()) return KO("pas_de_jugement");
    const t = this.adaptToken(tokenId); if (!t) return KO("miniature_inconnue");
    if (t.validated) return OK;
    this.dispatch("validation_adaptation", { carte: this.curCard(), miniature: tokenId, case: t.case, zone: t.zone, pas: pas(t.case, t.zone),
      depart_defaut: t.default_start, position_original: originalPos(this.s.adapt[this.curCard()], t) });
    return OK;
  }
  setGhost(visible) {
    if (!this.inJuge()) return KO("pas_de_jugement");
    const id = this.curCard(); if (this.s.adapt[id].ghost === visible) return OK;
    this.dispatch("repere_fantome", { carte: id, visible }); return OK;
  }

  // ---------- tutoriel ----------
  setTutoEtape(etape) { this.dispatch("tutoriel_etape", { etape }); return OK; }
  setReleve(participant, champ, valeur) { this.dispatch("releve", { participant, champ, valeur: valeur || null }); return OK; }
}

function originalPos(a, t) {
  let cur = t;
  while (cur.duplique_de) cur = a.tokens.find(x => x.id === cur.duplique_de) || { id: cur.duplique_de };
  const o = a.tokens.find(x => x.kind === "original" && x.id === "o" + cur.id.slice(1));
  return o ? o.case + ":centre" : "inconnue";
}
function isDone(s, phaseId, id) {
  if (phaseId === "tri" || phaseId === "tutoriel") return s.cards[id].done;
  if (phaseId === "discussion") return !!s.cards[id].disc?.done;
  return !!s.adapt[id]?.done;
}
export { replay, CALIB };
