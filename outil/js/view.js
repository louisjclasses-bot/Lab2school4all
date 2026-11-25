// Modèle de vue : ce que la scène doit afficher, dérivé de l'état. Sérialisable (envoyé à la scène).
// La scène ne reçoit jamais d'effectifs, de compteurs, ni d'identifiant à afficher.
import { currentPhase, phaseCardId, placedTokens, CALIB } from "./state.js";

export function sceneView(s, lang) {
  const p = currentPhase(s);
  const v = { lang, mode: "wait", phase: p ? p.id : null, card: null, tri: [], adapt: [], zoom: { niveau: s.zoom.niveau, region: s.zoom.region }, ghost: false, ended: s.status === "ended" };
  if (s.status === "setup" || !p) return v;
  if (s.status === "ended") { v.mode = "plain"; return v; }
  v.mode = p.module === "plain" ? "plain" : p.module;
  const id = phaseCardId(s, p.id);
  if (p.module === "tutoriel") {
    v.card = CALIB;
  } else if (p.module === "tri" && id) {
    v.card = id;
    v.tri = placedTokens(s.cards[id]).map(t => ({ id: t.id, case: t.case }));
  } else if ((p.module === "discussion" || p.module === "jugement") && id) {
    v.card = id;
    if (p.module === "jugement" && s.adapt[id]) {
      v.adapt = s.adapt[id].tokens.map(t => ({ id: t.id, kind: t.kind, case: t.case, zone: t.zone, validated: t.validated }));
          }
  }
  return v;
}

// Vue console : ajoute le repère fantôme (visible uniquement sur la console, jamais envoyé à la scène) et la miniature active
export function consoleView(s, lang, ui) {
  const v = sceneView(s, lang);
  v.ghost = true; v.active = ui.active || null; v.consoleOnly = true;
  return v;
}
