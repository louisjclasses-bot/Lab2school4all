// Scène : pure vue. Elle affiche la dernière vue reçue de la console ; aucune donnée n'y est saisie.
import { loadStrings, applyI18n } from "./i18n.js";
import { CardLibrary, cardsBase, fetchJSON } from "./cards.js";
import { Link } from "./link.js";
import { Stage } from "./stage.js";
import { displayInfo } from "./util.js";

const outil = await fetchJSON("config/outil.json");
const manifest = await fetchJSON(outil.manifest);
const root = document.getElementById("root");
await loadStrings("fr"); applyI18n();

let lib = null, stage = null, curLang = null, epoch = null, lastRev = -1, latest = null, busy = false, lastApplied = "";
const link = new Link(m => {
  if (m.k === "view") {
    if (m.epoch !== epoch) { epoch = m.epoch; lastRev = -1; }
    if (m.rev <= lastRev) return;
    lastRev = m.rev; latest = m.view; apply();
  }
  if (m.k === "ping_scene") hello();
});
function hello() {
  link.send({ k: "hello", hashes: lib ? lib.hashes() : null, lang: curLang, errors: lib ? lib.errors : [], display: displayInfo(), total: lib ? lib.defs.length : 0, epoch, rev: lastRev, visible: document.visibilityState === "visible" });
}
async function apply() {
  if (busy || !latest) return;
  busy = true;
  try {
    while (latest) {
      const v = latest; latest = null;
      if (v.lang !== curLang) {
        await loadStrings(v.lang); applyI18n(); curLang = v.lang;
        lib = new CardLibrary(cardsBase(outil), manifest, v.lang, { descriptions: false });
        await lib.preload();
        root.replaceChildren(); stage = new Stage(root, { cards: lib }); lastApplied = "";
        hello();
      }
      const sj = JSON.stringify(v); if (sj === lastApplied) continue; lastApplied = sj;      // vue identique : rien à redessiner
      await stage.update(v);
    }
  } finally { busy = false; }
}
hello();
setInterval(hello, 2000);
document.addEventListener("visibilitychange", hello);     // la console est prévenue tout de suite si la fenêtre de scène est recouverte ou réaffichée
if (new URLSearchParams(location.search).get("diag") === "1") {      // diagnostic (console du navigateur seulement) : vues reçues et visibilité
  document.addEventListener("visibilitychange", () => console.info("[diag scene] visibility", document.visibilityState, "last rev", lastRev));
  const old = link.onMessage; link.onMessage = m => { if (m.k === "view") console.info("[diag scene] view received, rev", m.rev, "visibility", document.visibilityState); old(m); };
}          // signal de présence pour la console
