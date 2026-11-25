// Visite guidée : bulles qui pointent les éléments réels de l'interface, une étape après l'autre.
// Non bloquante (l'outil reste utilisable), au clavier (Suivant a le focus, Échap ferme), textes par les chaînes (TRAPD).
import { el } from "./util.js";
import { t } from "./i18n.js";

// Jeux d'étapes : [sélecteur de la cible, clé de chaîne]
export const TOURS = {
  setup: [[".training-banner", "tour.setup.1"], ["[data-check=link]", "tour.setup.2"], ["[data-check=backup]", "tour.setup.3"], ["[data-check=sync]", "tour.setup.4"], ["[data-act=go]", "tour.setup.5"]],
  run: [[".timebar", "tour.run.1"], [".sim-card", "tour.run.2"], [".presents-card", "tour.run.3"], ["[data-act=incident]", "tour.run.4"], [".phase-next", "tour.run.5"]],
  tutoriel: [[".releve-wrap", "tour.tuto.1"], [".preview-box", "tour.tuto.2"]],
  tri: [[".casebtns", "tour.tri.1"], ["[data-act=second]", "tour.tri.2"], ["[data-act=question]", "tour.tri.3"], [".zoom-card", "tour.tri.4"], [".keys", "tour.tri.5"]],
  discussion: [[".seldetail", "tour.disc.1"], [".phase-card [data-act=next]", "tour.disc.2"]],
  jugement: [[".phase-card .toklist", "tour.jug.1"], ["[data-act=left]", "tour.jug.2"], ["[data-act=validate]", "tour.jug.3"]],
  alerte: [[".alerts .alert", "tour.alert.1"]],
  fin: [[".bilan", "tour.fin.1"]]
};

export class Tour {
  constructor(name, onEnd) {
    this.name = name; this.steps = TOURS[name] || []; this.i = 0; this.onEnd = onEnd; this.bubble = null; this.target = null;
  }
  // focus : vrai quand la visite est demandée ; une visite automatique ne prend pas le clavier (les raccourcis restent actifs)
  start(focus = false) { this.i = 0; this.focus = focus; this.show(); return this; }
  avail() { return this.steps.map(([sel]) => !!document.querySelector(sel)); }
  show(dir = 1) {
    const ok = this.avail();
    while (this.i >= 0 && this.i < this.steps.length && !ok[this.i]) this.i += dir;      // cible absente : étape sautée
    if (this.i < 0) { this.i = ok.indexOf(true); }
    if (this.i < 0 || this.i >= this.steps.length) return this.end();
    const vis = ok.map((v, k) => v ? k : -1).filter(k => k >= 0), n = vis.indexOf(this.i) + 1, last = n === vis.length;
    const [, key] = this.steps[this.i];
    this.bubble?.remove();
    const prev = el("button", { type: "button", class: "btn", disabled: n === 1, dataset: { tour: "prev" }, onclick: () => { this.i--; this.show(-1); } }, t("tour.prev"));
    const next = el("button", { type: "button", class: "btn primary", dataset: { tour: "next" }, onclick: () => { if (last) this.end(); else { this.i++; this.show(1); } } }, t(last ? "tour.done" : "tour.next"));
    this.bubble = el("div", { class: "tour-bubble", role: "dialog", "aria-modal": "false", "aria-labelledby": "tour-p", "aria-describedby": "tour-b" },
      el("div", { class: "tour-top" }, el("span", { id: "tour-p", class: "tour-p" }, t("tour.progress", { n, total: vis.length })),
        el("button", { type: "button", class: "btn link tour-close", dataset: { tour: "close" }, onclick: () => this.end() }, t("tour.close"))),
      el("p", { id: "tour-b", class: "tour-b", "aria-live": "polite" }, t(key)), el("div", { class: "tour-act" }, prev, next));
    this.bubble.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); this.end(); } });
    document.body.append(this.bubble);
    this.place(true);
    if (this.focus || this.i > 0 || dir < 0) next.focus({ preventScroll: true });
  }
  // recalcule la cible (le DOM de la console est reconstruit à chaque événement) et la position de la bulle
  place(scroll = false) {
    if (!this.bubble) return;
    const sel = this.steps[this.i] && this.steps[this.i][0], tg = sel && document.querySelector(sel);
    if (this.target && this.target !== tg) this.target.classList.remove("tour-target");
    this.target = tg; if (!tg) return;
    tg.classList.add("tour-target");
    if (scroll) tg.scrollIntoView({ block: "center", inline: "nearest" });
    // la bulle se range dans un coin de la fenêtre qui ne recouvre pas la cible (la cible est entourée en orange)
    const r = tg.getBoundingClientRect(), b = this.bubble.getBoundingClientRect(), m = 16, W = innerWidth, H = innerHeight;
    const corners = [[W - b.width - m, H - b.height - m], [m, H - b.height - m], [W - b.width - m, m + 60], [m, m + 60]];
    const free = ([x, y]) => x + b.width + 8 < r.left || x - 8 > r.right || y + b.height + 8 < r.top || y - 8 > r.bottom;
    const [x, y] = corners.find(free) || corners[0];
    const L = Math.round(x) + "px", T = Math.round(y) + "px";
    if (this.bubble.style.left !== L) this.bubble.style.left = L;
    if (this.bubble.style.top !== T) this.bubble.style.top = T;
  }
  end() {
    this.bubble?.remove(); this.bubble = null;
    this.target?.classList.remove("tour-target"); this.target = null;
    this.onEnd && this.onEnd(this.name);
  }
  get active() { return !!this.bubble; }
}
