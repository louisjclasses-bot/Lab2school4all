// Rendu de la scène (1920 x 1080 logique, échelle uniforme). Utilisé par scene.html (plein écran, passif)
// et par la console (aperçu interactif, avec repère fantôme). Tous les textes viennent de i18n.
import { t } from "./i18n.js";
import { CASES, el } from "./util.js";
import { bord, fond, pasCentre } from "./palette.js";
import { CALIB } from "./state.js";

export const LW = 1920, LH = 1080;
const FRAME_W = 1834, FRAME_H = 514;           // zone utile du cadre de 1840 x 520 (bordure 3 px)
const FRAME_H_DISCUSSION = 960;

export class Stage {
  constructor(root, { cards, interactive = false, onAction = null, fit = "window" }) {
    this.root = root; this.cards = cards; this.interactive = interactive; this.onAction = onAction; this.fit = fit;
    this.view = null; this.frameKey = null; this.drag = null;
    this.stage = el("div", { class: "stage" });
    this.head = el("div", { class: "stage-head" });
    this.frame = el("div", { class: "frame" });
    this.inner = el("div", { class: "frame-inner" });
    this.content = el("div", { class: "frame-content" });
    this.mini = el("div", { class: "minimap", hidden: true });
    this.note = el("div", { class: "frame-note", hidden: true });
    this.inner.append(this.content); this.frame.append(this.inner, this.mini, this.note);
    this.cols = el("div", { class: "cols" });
    this.colEls = CASES.map((c, i) => this._buildCol(c, i));
    this.cols.append(...this.colEls.map(x => x.col));
    this.badge = el("div", { class: "train-badge", hidden: true });
    this.stage.append(this.head, this.frame, this.cols, this.badge);
    root.append(this.stage);
    this._scale();
    addEventListener("resize", () => this._scale());
    if (fit === "container" && window.ResizeObserver) new ResizeObserver(() => this._scale()).observe(root);
    if (interactive) this._wireDrag();
  }
  _scale() {
    const w = this.fit === "window" ? innerWidth : this.root.clientWidth, h = this.fit === "window" ? innerHeight : this.root.clientHeight;
    if (!w || !h) return;
    const k = Math.min(w / LW, h / LH);
    this.k = k;
    this.stage.style.transform = `translate(${(w - LW * k) / 2}px, ${(h - LH * k) / 2}px) scale(${k})`;
  }
  _buildCol(c, i) {
    const col = el("div", { class: "col", dataset: { case: c } });
    const label = el("div", { class: "col-label" }, t("case." + c));
    const legend = el("div", { class: "col-legend" }, el("span", { class: "tri-left" }), el("span", {}, t("stage.easier")), el("span", { class: "sp" }), el("span", {}, t("stage.harder")), el("span", { class: "tri-right" }));
    const zones = el("div", { class: "zones" });
    for (let z = 0; z < 3; z++) {
      const pas = i * 3 + z + 1;
      const zone = el("div", { class: "zone", dataset: { zone: z, pas } });
      zone.style.setProperty("--bord", bord(pas)); zone.style.setProperty("--fond", fond(pas));
      zone.append(el("div", { class: "zone-band" }), el("div", { class: "zone-mark mark-" + ["l", "c", "r"][z] }), el("div", { class: "zone-toks" }));
      zones.append(zone);
    }
    const area = el("div", { class: "tri-toks" });
    const pc = pasCentre(i);
    col.style.setProperty("--bord", bord(pc)); col.style.setProperty("--fond", fond(pc));
    col.append(el("div", { class: "col-band" }), label, legend, zones, area);
    return { col, area, zones, c };
  }

  async update(view) {
    if (this.drag) { this.pending = view; return; }
    const v = this.view = view;
    this.stage.className = "stage mode-" + v.mode + (v.consoleOnly ? " console-preview" : "") + (this.interactive ? " interactive" : "");
    this.head.textContent = v.mode === "wait" ? t("stage.title.wait") : (v.mode === "plain" ? t("stage.title.plain." + (v.ended ? "end" : v.phase)) : t("stage.title." + v.mode));
    this.badge.hidden = !v.entrainement; if (v.entrainement) this.badge.textContent = t("stage.training");
    this._frame(v);
    this._tokens(v);
  }

  // ----- cadre de la carte -----
  _frame(v) {
    const tall = v.mode === "discussion" || v.mode === "wait" || v.mode === "plain";   // pas de cases : le cadre occupe toute la hauteur
    this.fw = FRAME_W; this.fh = tall ? FRAME_H_DISCUSSION : FRAME_H;
    this.frame.style.height = (this.fh + 6) + "px"; this.inner.style.height = this.fh + "px";
    const showCards = ["tri", "discussion", "jugement", "tutoriel"].includes(v.mode);
    const kind = v.mode === "tri" ? "png" : (v.mode === "tutoriel" ? "calib" : (showCards ? "html" : "none"));
    const key = kind + ":" + v.card + ":" + v.lang + ":" + (kind === "html" && this.interactive ? "ph" : "");
    if (key !== this.frameKey) {
      this.frameKey = key; this.content.replaceChildren(); this.nat = null;
      if (kind === "png") {
        const c = this.cards.get(v.card);
        if (c) { this.content.append(el("img", { src: c.png.url, alt: "", draggable: "false" })); this.nat = { w: c.png.w, h: c.png.h }; }
      } else if (kind === "html") {
        const c = this.cards.get(v.card);
        if (c && !this.interactive) { this.content.append(el("iframe", { src: c.html.url, title: t("stage.frame.title"), scrolling: "auto" })); }
        else if (c) this.content.append(el("div", { class: "html-ph" }, t("console.preview.adaptation")));
        this.nat = { w: this.fw, h: this.fh };
      } else if (kind === "calib") {
        this.content.append(this._calib()); this.nat = { w: FRAME_W, h: FRAME_H };
      }
      if (this.nat) { this.content.style.width = this.nat.w + "px"; this.content.style.height = this.nat.h + "px"; }
    }
    this.note.hidden = true;
    if (v.mode === "wait" || v.mode === "plain") {
      this.content.replaceChildren(); this.frameKey = null; this.nat = null;
      this.note.hidden = false; this.note.textContent = t(v.mode === "wait" ? "stage.wait.text" : "stage.plain.text." + (v.ended ? "end" : v.phase));
    }
    if ((v.mode === "discussion" || v.mode === "jugement") && !v.card) { this.note.hidden = false; this.note.className = "frame-note"; this.note.textContent = t("stage.empty"); }
    else if (v.mode === "tutoriel" && v.tuto === "vocab") {
      this.note.hidden = false; this.note.className = "frame-note vocab";
      this.note.replaceChildren(el("h2", {}, t("tuto.vocab.title")), el("ul", {}, ...["cases", "critere", "miniature", "grande"].map(k => el("li", {}, t("tuto.vocab." + k)))));
    } else if (v.mode === "tutoriel" || v.mode === "tri") { this.note.className = "frame-note"; this.note.hidden = true; }
    else this.note.className = "frame-note";
    this._zoom(v);
  }
  _calib() {
    const sizes = [40, 34, 29, 25, 21, 18, 15, 12];
    const lines = el("div", { class: "calib-lines" }, ...sizes.map((px, i) => el("div", { class: "calib-line" },
      el("span", { class: "calib-n" }, String(i + 1)), el("span", { style: `font-size:${px}px` }, t("calib.line")))));
    const grid = el("div", { class: "calib-gridwrap" }, el("div", { class: "calib-grid" }), el("div", { class: "calib-cap" }, t("calib.grid")));
    return el("div", { class: "calib" }, lines, grid);
  }
  _zoom(v) {
    const z = v.zoom || { niveau: 100, region: 4 };
    if (!this.nat) { this.content.style.transform = ""; this.mini.hidden = true; return; }
    const { w: nw, h: nh } = this.nat, W = this.fw, H = this.fh;
    const fit = v.mode === "tri" || v.mode === "tutoriel" ? Math.min(W / nw, H / nh) : 1;
    const sc = fit * z.niveau / 100;
    const vw = W / sc, vh = H / sc;
    const r = Math.floor(z.region / 3), c = z.region % 3;
    const place = (cell, nat, view) => view >= nat ? (nat - view) / 2 : Math.max(0, Math.min(nat - view, (cell + .5) / 3 * nat - view / 2));
    const x0 = place(c, nw, vw), y0 = place(r, nh, vh);
    this.content.style.transform = `scale(${sc}) translate(${-x0}px, ${-y0}px)`;
    this.content.style.transformOrigin = "0 0";
    if (z.niveau > 100) {
      const MW = 220, MH = Math.round(220 * nh / nw);
      this.mini.hidden = false; this.mini.replaceChildren(
        el("div", { class: "mini-plan", style: `width:${MW}px;height:${MH}px` },
          el("div", { class: "mini-rect", style: `left:${Math.max(0, x0 / nw) * 100}%;top:${Math.max(0, y0 / nh) * 100}%;width:${Math.min(1, vw / nw) * 100}%;height:${Math.min(1, vh / nh) * 100}%` })),
        el("div", { class: "mini-txt" }, t("stage.zoom", { n: z.niveau })));
    } else this.mini.hidden = true;
  }

  // ----- miniatures -----
  _thumb(extra = "") {
    const v = this.view, c = this.cards.get(v.card);
    if (v.card === CALIB) return el("div", { class: "thumb calib-thumb " + extra }, ...[0, 1, 2, 3, 4].map(i => el("i", { style: `width:${90 - i * 12}%` })));
    return c ? el("img", { class: "thumb " + extra, src: c.png.url, alt: "", draggable: "false" }) : el("div", { class: "thumb" });
  }
  _tokens(v) {
    this.colEls.forEach(x => { x.area.replaceChildren(); x.zones.querySelectorAll(".zone-toks").forEach(n => n.replaceChildren()); });
    const jug = v.mode === "jugement";
    this.cols.hidden = v.mode === "discussion" || v.mode === "wait" || v.mode === "plain";
    this.cols.classList.toggle("jugement", jug);
    if (v.mode === "tri" || v.mode === "tutoriel") {
      const n = v.tri.length;
      v.tri.forEach((tk, i) => {
        const ci = CASES.indexOf(tk.case);
        const node = el("div", { class: "tok orig tri" + (v.active === tk.id ? " active" : ""), dataset: { token: tk.id } }, this._thumb());
        node.style.setProperty("--bord", bord(pasCentre(ci)));
        if (n > 1) node.append(el("div", { class: "badge" }, t("stage.badge", { i: i + 1, n })));
        this.colEls[ci].area.append(node);
      });
    }
    if (jug) {
      const groups = new Map();
      v.adapt.forEach(tk => { const k = tk.kind + tk.case + tk.zone; (groups.get(k) || groups.set(k, []).get(k)).push(tk); });
      const origs = v.adapt.filter(x => x.kind === "original");
      [...groups.values()].sort((a, b) => (a[0].kind === "original" ? 0 : 1) - (b[0].kind === "original" ? 0 : 1)).forEach(g => {
        const tk = g[0], ci = CASES.indexOf(tk.case), pas = ci * 3 + tk.zone + 1;
        const adapted = tk.kind === "adapted";
        const all = g.every(x => x.validated);
        const node = el("div", { class: "tok " + (adapted ? "adapt" : "orig") + (g.some(x => x.id === v.active) ? " active" : "") + (all && adapted ? " validated" : ""), dataset: { token: g.find(x => x.id === v.active)?.id || tk.id } },
          this._thumb(adapted ? "round" : ""));
        if (adapted) node.style.setProperty("--bord", bord(pas));
        node.append(el("div", { class: "tok-label" }, t(adapted ? "stage.tok.adapted" : "stage.tok.original")));
        if (g.length > 1) node.append(el("div", { class: "badge" }, t("stage.badge.x", { n: g.length })));
        if (adapted && all) node.append(el("div", { class: "tok-valid" }, t("stage.validated")));
        if (adapted && this.interactive) node.dataset.group = g.map(x => x.id).join(",");
        const zEl = this.colEls[ci].zones.children[tk.zone].querySelector(".zone-toks");
        zEl.append(node);
        if (!adapted && v.ghost) node.classList.add("ghost");
      });
    }
  }

  // ----- interactions (aperçu de la console) -----
  _wireDrag() {
    this.stage.addEventListener("pointerdown", e => {
      const tok = e.target.closest(".tok");
      if (!tok || (!tok.classList.contains("tri") && !tok.classList.contains("adapt"))) return;
      const id = tok.dataset.token;
      this.onAction && this.onAction({ type: "select", token: id });
      this.drag = { id, kind: tok.classList.contains("adapt") ? "adapt" : "tri", moved: false, sx: e.clientX, sy: e.clientY };
      tok.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    this.stage.addEventListener("pointermove", e => {
      if (!this.drag) return;
      if (Math.abs(e.clientX - this.drag.sx) + Math.abs(e.clientY - this.drag.sy) > 6) this.drag.moved = true;
    });
    this.stage.addEventListener("pointerup", e => {
      const d = this.drag; if (!d) return;
      this.drag = null;
      if (d.moved) {
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const col = under && under.closest(".col");
        if (col) {
          const zone = under.closest(".zone");
          if (d.kind === "adapt" && zone) this.onAction({ type: "move", token: d.id, case: col.dataset.case, zone: +zone.dataset.zone });
          else if (d.kind === "tri") this.onAction({ type: "place", token: d.id, case: col.dataset.case });
        }
      }
      if (this.pending) { const p = this.pending; this.pending = null; this.update(p); }
    });
    this.cols.addEventListener("click", e => {
      if (e.detail === 0) return;
      const col = e.target.closest(".col"); if (!col || e.target.closest(".tok")) return;
      const zone = e.target.closest(".zone");
      this.onAction && this.onAction({ type: "click", case: col.dataset.case, zone: zone ? +zone.dataset.zone : null });
    });
  }
}
