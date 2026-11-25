// Moteur : état dérivé du journal. reduce(state, event) est la seule façon de modifier l'état.
// Aucun texte visible ici.
import { CASES } from "./util.js";

export const CALIB = "__calibration__";
export const PARTICIPANTS_DEFAUT = ["P1", "P2", "P3", "P4", "P5", "P6"];

export function newCardState(id, rang) {
  return { id, rang, entered: null, left: null, spent_ms: 0, tokens: [], counts: null,
    question: { statut: null, motif: null, at: null }, skipped: null, done: false };
}

export function initState(cfg, order, participants = PARTICIPANTS_DEFAUT) {
  const cards = {};
  order.forEach((id, i) => { cards[id] = newCardState(id, i + 1); });
  cards[CALIB] = newCardState(CALIB, 0);
  const present = {}, releve = {};
  participants.forEach(p => { present[p] = true; releve[p] = { appareil: null, taille: null, ligne: null, zoom: null }; });
  return {
    schema: 1,
    status: "setup",                 // setup | running | paused | ended
    phases: cfg.phases.map(p => ({ id: p.id, module: p.module, planned_min: p.planned_min, started: null, ended: null,
      paused_at_start: 0, active_ms: null, overrun_ms: null })),
    phaseIdx: -1,
    go: null, endMs: null, pausedSince: null, pausedTotalMs: 0,
    present,
    backup: { mode: null, file: null },
    order: [...order],
    cards,
    seq: { tutoriel: [CALIB], tri: [...order], discussion: [], jugement: [] },
    cursor: { tutoriel: -1, tri: -1, discussion: -1, jugement: -1 },
    selection: null,
    adapt: {},
    zoom: { niveau: 100, region: 4, since: null, card: null },
    tuto: { etape: "vocab" },
    releve,
    notes: [], incidents: [], sync: { audio: null }, scene: { liaison: null },
    resumes: 0, lastN: 0
  };
}

export const currentPhase = s => (s.phaseIdx >= 0 ? s.phases[s.phaseIdx] : null);
export const phaseCardId = (s, phaseId = currentPhase(s)?.id) => {
  const c = s.cursor[phaseId]; return c >= 0 && s.seq[phaseId] ? s.seq[phaseId][c] ?? null : null;
};
export const presentCount = s => Object.values(s.present).filter(Boolean).length;
export const placedTokens = card => card.tokens.filter(t => t.case);

// Effectif de chaque case pour une carte au tri (règle : voir DECISIONS_A_VALIDER)
//  - effectifs saisis : on les utilise
//  - un seul placement sans effectifs : tous les présents
//  - plusieurs placements sans effectifs : 1 par placement (seuil n = 1)
export function effectifsEffectifs(card, nPresents) {
  const out = { facile: 0, moyen: 0, difficile: 0, impossible: 0 };
  if (card.counts) { CASES.forEach(c => { out[c] = card.counts[c] || 0; }); return out; }
  const pl = placedTokens(card);
  if (pl.length === 1) out[pl[0].case] = nPresents;
  else pl.forEach(t => { out[t.case] += 1; });
  return out;
}

// Règle de sélection (section 7) : au moins un placement final en Difficile ou Impossible ;
// ordre : effectif en Impossible (décroissant), puis en Difficile, puis ordre du tri.
export function computeSelection(s) {
  const n = presentCount(s);
  const detail = [];
  s.order.forEach((id, idx) => {
    const c = s.cards[id];
    const pl = placedTokens(c);
    if (!pl.some(t => t.case === "difficile" || t.case === "impossible")) return;
    const e = effectifsEffectifs(c, n);
    detail.push({ carte: id, rang_tri: idx + 1, impossible: e.impossible, difficile: e.difficile, cases: pl.map(t => t.case) });
  });
  detail.sort((a, b) => b.impossible - a.impossible || b.difficile - a.difficile || a.rang_tri - b.rang_tri);
  return detail;
}

// --- Adaptations : 12 pas (case x zone) ---
export const pas = (caseName, zone) => CASES.indexOf(caseName) * 3 + zone + 1;
export function shiftPos(caseName, zone, dir) {
  const i = Math.max(0, Math.min(11, CASES.indexOf(caseName) * 3 + zone + dir));
  return { case: CASES[Math.floor(i / 3)], zone: i % 3 };
}

function initAdapt(s, id, ms) {
  const tri = s.cards[id];
  const toks = [];
  placedTokens(tri).forEach(t => toks.push({ id: "o" + t.id, kind: "original", case: t.case, zone: 1, validated: true, moved: false, default_start: true }));
  placedTokens(tri).forEach(t => toks.push({ id: "a" + t.id, kind: "adapted", case: t.case, zone: 1, validated: false, moved: false, default_start: true }));
  s.adapt[id] = { tokens: toks, ghost: false, nextA: placedTokens(tri).length + 1, entered: ms, left: null };
}

export function reduce(s, ev) {
  const ms = Date.parse(ev.t), d = ev.data;
  s.lastN = ev.n;
  const card = d && d.carte ? s.cards[d.carte] : null;
  switch (ev.type) {
    case "session_creee": break;
    case "reprise": s.resumes++; break;
    case "sauvegarde_choisie": s.backup = { mode: d.mode, file: d.fichier ?? null }; break;
    case "sauvegarde_echec": case "sauvegarde_retablie": break;
    case "scene_liaison": s.scene.liaison = { connectee: d.connectee, cartes_identiques: d.cartes_identiques }; break;
    case "sync_audio": s.sync.audio = ms; break;
    case "go": s.go = ms; s.status = "running"; break;
    case "pause_debut": s.pausedSince = ms; s.status = "paused"; break;
    case "pause_fin": s.pausedTotalMs += d.duree_ms; s.pausedSince = null; s.status = "running"; break;
    case "fin_seance": s.status = "ended"; s.endMs = ms; break;
    case "presents": s.present[d.participant] = d.present; break;
    case "incident": s.incidents.push({ t: ev.t, type: d.type }); break;
    case "note": s.notes.push({ t: ev.t, texte: d.texte, carte: d.carte ?? null }); break;
    case "phase_debut": {
      s.phaseIdx = d.rang;
      const p = s.phases[d.rang];
      p.started = ms; p.paused_at_start = s.pausedTotalMs + (s.pausedSince ? ms - s.pausedSince : 0);
      break;
    }
    case "phase_fin": {
      const p = s.phases.find(x => x.id === d.phase);
      p.ended = ms; p.active_ms = d.duree_ms; p.overrun_ms = d.depassement_ms;
      closeCardTiming(s, ms);
      break;
    }
    case "selection": {
      s.selection = { cartes: d.cartes, detail: d.detail };
      s.seq.discussion = [...d.cartes]; s.seq.jugement = [...d.cartes];
      break;
    }
    case "carte_debut": {
      closeCardTiming(s, ms);
      const c = s.cards[d.carte];
      s.cursor[d.phase] = s.seq[d.phase].indexOf(d.carte);
      if (d.phase === "tri" || d.phase === "tutoriel") { c.entered = ms; c.left = null; }
      else if (d.phase === "discussion") { s.cards[d.carte].disc = { entered: ms, left: null, skipped: null, done: false }; }
      else if (d.phase === "jugement") { initAdapt(s, d.carte, ms); }
      s.zoom = { niveau: 100, region: 4, since: ms, card: d.carte };   // remise à zéro à chaque carte
      break;
    }
    case "carte_suivante": case "carte_sautee": {
      const c = s.cards[d.carte];
      if (d.phase === "tri" || d.phase === "tutoriel") {
        c.left = ms; c.spent_ms += d.duree_ms; c.done = true;
        if (ev.type === "carte_sautee") c.skipped = { motif: d.motif };
      } else if (d.phase === "discussion") {
        Object.assign(c.disc, { left: ms, done: true, skipped: ev.type === "carte_sautee" ? d.motif : null, spent_ms: d.duree_ms });
      } else if (d.phase === "jugement") {
        const a = s.adapt[d.carte]; a.left = ms; a.done = true; a.spent_ms = d.duree_ms;
        a.skipped = ev.type === "carte_sautee" ? d.motif : null;
      }
      break;
    }
    case "placement": {
      let t = card.tokens.find(x => x.id === d.miniature);
      if (!t) { t = { id: d.miniature, case: null, history: [] }; card.tokens.push(t); }
      t.case = d.case; t.history.push({ t: ev.t, case: d.case, source: d.source });
      break;
    }
    case "retrait": card.tokens = card.tokens.filter(x => x.id !== d.miniature); card.counts = null; break;
    case "effectifs": card.counts = { ...d.effectifs }; break;
    case "question_rituelle": card.question = { statut: d.statut, motif: d.motif ?? null, at: ms }; break;
    case "zoom": s.zoom = { niveau: d.niveau, region: d.region, since: ms, card: d.carte }; break;
    case "tutoriel_etape": s.tuto.etape = d.etape; break;
    case "releve": s.releve[d.participant][d.champ] = d.valeur; break;
    case "adaptation_placement": {
      const t = s.adapt[d.carte].tokens.find(x => x.id === d.miniature);
      t.case = d.case; t.zone = d.zone; t.moved = true; t.default_start = false; t.validated = false;
      break;
    }
    case "adaptation_duplication": {
      const a = s.adapt[d.carte];
      a.tokens.push({ id: d.miniature, kind: "adapted", case: d.case, zone: d.zone, validated: false, moved: false, default_start: false, duplique_de: d.depuis });
      a.nextA++;
      break;
    }
    case "adaptation_retrait": { const a = s.adapt[d.carte]; a.tokens = a.tokens.filter(x => x.id !== d.miniature); break; }
    case "repere_fantome": s.adapt[d.carte].ghost = d.visible; break;
    case "validation_adaptation": {
      const t = s.adapt[d.carte].tokens.find(x => x.id === d.miniature); t.validated = true; break;
    }
    default: throw new Error("unknown event type: " + ev.type);
  }
  return s;
}

function closeCardTiming(s, ms) { /* le temps par carte est fourni par les événements (duree_ms) */ }

export function replay(cfg, order, events, participants) {
  const s = initState(cfg, order, participants);
  events.forEach(e => reduce(s, e));
  return s;
}
