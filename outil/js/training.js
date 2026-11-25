// Mode entraînement : participants simulés (répliques écrites, lecture vocale facultative), incidents provoqués, bilan.
// Scénario : data/entrainement/scenario.json ; textes : i18n/entrainement-<langue>.json (procédure TRAPD).
import { el, CASES } from "./util.js";
import { t } from "./i18n.js";
import { currentPhase, phaseCardId, placedTokens, RELEVE_DEFAUT, groupZoom } from "./state.js";

export async function loadScenario(lang) {
  const get = async p => (await fetch(new URL("../" + p, import.meta.url), { cache: "no-cache" })).json();
  const [scenario, texts] = await Promise.all([get("data/entrainement/scenario.json"), get("i18n/entrainement-" + lang + ".json")]);
  return { scenario, texts: texts.strings };
}

export class Trainer {
  constructor({ scenario, texts, lang, session, hooks, label }) {
    Object.assign(this, { sc: scenario, texts, lang, session, hooks, label });
    this.key = null; this.shown = []; this.queue = []; this.nextAt = 0; this.timers = []; this.log = {}; this.tts = false; this.seq = 0;
    this.ttsAvailable = typeof window !== "undefined" && "speechSynthesis" in window;
  }
  txt(id) { return this.texts[id] ? this.texts[id].text : "[" + id + "]"; }
  // moment de la séance : clé du scénario
  moment() {
    const s = this.session.s, p = currentPhase(s);
    if (s.status === "setup") return { key: "setup", lines: [] };
    if (s.status === "ended" || !p) return { key: "fin", lines: [] };
    const L = this.sc.lines;
    if (p.module === "plain") return { key: p.id, lines: L[p.id] || [] };
    if (p.module === "tutoriel") return { key: "tutoriel", lines: L.tutoriel || [] };
    const id = phaseCardId(s, p.id); if (!id) return { key: p.id, lines: [] };
    const first = s.cursor[p.id] === 0 ? (L[p.id] || []) : [];
    return { key: p.id + ":" + id, rank: p.id + ":" + (s.cursor[p.id] + 1), lines: [...first, ...(L[p.id + ":" + id] || L[p.id + ":*"] || [])] };
  }
  // appelé à chaque tic : révèle la réplique suivante, déclenche les incidents ; renvoie vrai si l'affichage change
  update(now = Date.now()) {
    const m = this.moment(); let changed = false;
    if (m.key !== this.key) {
      this.key = m.key; this.shown = []; this.queue = m.lines.map(l => ({ ...l })); this.nextAt = now; changed = true;
      this.timers.forEach(clearTimeout); this.timers = [];
      for (const inc of this.sc.incidents) {
        if (this.log[inc.id] || (inc.at !== m.key && inc.at !== m.rank)) continue;
        this.timers.push(setTimeout(() => this.fire(inc), inc.after_ms));
      }
    }
    if (this.queue.length && now >= this.nextAt) {
      const l = this.queue.shift(); this.reveal(l); this.nextAt = now + this.sc.reveal_ms; changed = true;
    }
    return changed;
  }
  reveal(l) {
    const line = { who: l.who, text: this.txt(l.id), n: ++this.seq };
    this.shown.push(line);
    if (this.tts && this.ttsAvailable) {
      const u = new SpeechSynthesisUtterance((l.who.startsWith("P") ? l.who + ". " : "") + line.text);
      u.lang = this.lang === "en" ? "en-GB" : "fr-FR"; window.speechSynthesis.speak(u);
    }
    this.hooks.onLine && this.hooks.onLine(line);
  }
  fire(inc) {
    if (this.log[inc.id]) return;
    let done = true;
    if (inc.type === "scene_fermee") done = this.hooks.closeScene();
    if (inc.type === "sauvegarde") this.hooks.failBackup();
    this.log[inc.id] = { t: new Date().toISOString(), done };
    if (done) this.reveal(inc.line);
  }
  whoLabel(w) { return w === "coach" ? t("train.coach") : w === "sys" ? t("train.sys") : w; }
  // panneau des répliques
  panel() {
    const list = el("ol", { class: "sim-lines", "aria-live": "polite" }, ...this.shown.map(l => this.item(l)));
    const box = el("section", { class: "card sim-card", "aria-labelledby": "sim-h" },
      el("div", { class: "sim-head" }, el("h2", { id: "sim-h" }, t("train.panel")),
        this.ttsAvailable ? el("label", { class: "sim-tts" }, el("input", { type: "checkbox", checked: this.tts, onchange: e => { this.tts = e.target.checked; if (!this.tts) window.speechSynthesis.cancel(); } }), t("train.tts")) : null),
      this.shown.length ? list : el("p", { class: "hint sim-empty" }, t("train.panel.empty")), this.queue.length ? el("p", { class: "hint sim-more" }, t("train.panel.more")) : null);
    if (!this.shown.length) box.append(list);
    return box;
  }
  item(l) { return el("li", { class: "sim-" + (l.who.startsWith("P") ? "p" : l.who) }, el("strong", {}, this.whoLabel(l.who)), el("span", {}, l.text)); }
  // mise à jour en place (pas de rendu complet : le focus et le défilement sont conservés)
  sync(box) {
    if (!box) return;
    const list = box.querySelector(".sim-lines"); const have = list.children.length;
    if (have > this.shown.length) list.replaceChildren();
    this.shown.slice(list.children.length).forEach(l => list.append(this.item(l)));
    box.querySelector(".sim-empty")?.remove();
    const more = box.querySelector(".sim-more");
    if (this.queue.length && !more) box.append(el("p", { class: "hint sim-more" }, t("train.panel.more")));
    if (!this.queue.length && more) more.remove();
  }

  // ---------- bilan, calculé à partir du journal ----------
  bilan() {
    const s = this.session.s, ev = this.session.events, X = this.sc.expect, out = [];
    const after = (iso, pred) => ev.find(e => e.t >= iso && pred(e));
    const secs = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 1000));
    const name = id => this.label(id);
    // calibration : exceptions du relevé et zoom du groupe
    const participants = Object.keys(s.releve);
    const nRel = participants.filter(p => Object.keys(RELEVE_DEFAUT).every(k => s.releve[p][k].valeur === ((X.releve[p] || {})[k] ?? RELEVE_DEFAUT[k]))).length;
    out.push({ ok: nRel === participants.length, text: t("train.b.releve", { n: nRel, total: participants.length }), tip: t("train.tip.releve") });
    out.push({ ok: groupZoom(s) === X.zoom_groupe, text: t("train.b.zoomg", { n: groupZoom(s) }), tip: t("train.tip.zoomg") });
    // question rituelle
    const tri = s.seq.tri, posed = tri.filter(id => s.cards[id].question.statut === "posee").length;
    out.push({ ok: posed === tri.length, text: t("train.b.question", { n: posed, total: tri.length }), tip: t("train.tip.question") });
    // fidélité des placements
    const bad = [];
    for (const [id, e] of Object.entries(X.tri)) {
      if (!s.cards[id]) continue;
      const got = placedTokens(s.cards[id]).map(x => x.case).sort(), exp = [...e.cases].sort();
      if (got.join() !== exp.join()) bad.push(t("train.b.mismatch", { card: name(id), got: got.map(c => t("case." + c)).join(" + ") || t("tri.unplaced"), exp: exp.map(c => t("case." + c)).join(" + ") }));
    }
    const nTri = Object.keys(X.tri).length;
    out.push({ ok: !bad.length, text: t("train.b.placements", { n: nTri - bad.length, total: nTri }), tip: bad.join(" ") || null });
    // effectifs du désaccord
    for (const [id, e] of Object.entries(X.tri)) {
      if (!e.counts || !s.cards[id]) continue;
      const c = s.cards[id].counts, exp = { facile: 0, moyen: 0, difficile: 0, impossible: 0, abstention: 0, ...e.counts };
      const ok = !!c && Object.keys(exp).every(k => (c[k] || 0) === exp[k]);
      out.push({ ok, text: t(ok ? "train.b.counts.ok" : c ? "train.b.counts.diff" : "train.b.counts.none", { card: name(id) }), tip: ok ? null : t("train.tip.counts", { exp: CASES.filter(k => exp[k]).map(k => t("case." + k) + " " + exp[k]).join(", ") }) });
    }
    // incidents
    const inc = id => this.sc.incidents.find(x => x.id === id);
    const dep = this.log.depart;
    if (dep) {
      const p = inc("depart").participant, e = after(dep.t, x => x.type === "presents" && x.data.participant === p && !x.data.present);
      out.push({ ok: !!e, text: e ? t("train.b.absent.ok", { p, s: secs(dep.t, e.t) }) : t("train.b.absent.ko", { p }), tip: e ? null : t("train.tip.absent") });
    }
    const sc = this.log.scene;
    if (!sc || !sc.done) out.push({ ok: false, text: t("train.b.scene.never"), tip: t("train.tip.scene") });
    else {
      const e = after(sc.t, x => x.type === "scene_liaison" && x.data.connectee);
      out.push({ ok: !!e, text: e ? t("train.b.scene.ok", { s: secs(sc.t, e.t) }) : t("train.b.scene.ko"), tip: e ? null : t("train.tip.scene") });
    }
    const sv = this.log.sauvegarde;
    if (sv) {
      const e = after(sv.t, x => x.type === "sauvegarde_choisie");
      out.push({ ok: !!e, text: e ? t("train.b.save.ok", { s: secs(sv.t, e.t) }) : t("train.b.save.ko"), tip: e ? null : t("train.tip.save") });
    }
    // jugement des adaptations
    const jb = [];
    let nJ = 0;
    for (const [id, e] of Object.entries(X.jugement)) {
      if (!s.adapt[id]) continue; nJ++;
      const ad = s.adapt[id].tokens.filter(x => x.kind === "adapted" && x.validated);
      if (!ad.some(x => x.case === e.case)) jb.push(t("train.b.mismatch", { card: name(id), got: ad.map(x => t("case." + x.case)).join(" + ") || t("tri.unplaced"), exp: t("case." + e.case) + " " + t("juge.zone." + e.zone) }));
    }
    if (nJ) out.push({ ok: !jb.length, text: t("train.b.jugement", { n: nJ - jb.length, total: nJ }), tip: jb.join(" ") || null });
    // temps (information)
    const over = ev.filter(e => e.type === "phase_fin" && e.data.depassement_ms > 0).map(e => t("phase." + e.data.phase) + " + " + Math.round(e.data.depassement_ms / 1000) + " s");
    out.push({ ok: null, text: over.length ? t("train.b.time.over", { list: over.join(", ") }) : t("train.b.time.ok") });
    return out;
  }
  stop() { this.timers.forEach(clearTimeout); this.timers = []; if (this.ttsAvailable) window.speechSynthesis.cancel(); }
}
