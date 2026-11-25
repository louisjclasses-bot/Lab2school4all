// Présentation animée de l'outil : une capture réelle par étape et son texte, en français ou en anglais.
// Lecture automatique avec pause, navigation au clavier. Captures et liste des étapes générées par dev/make_presentation.py.
import { loadStrings, applyI18n, t } from "./i18n.js";
import { el } from "./util.js";

const Q = new URLSearchParams(location.search);
const LANG = Q.get("lang") === "en" ? "en" : "fr", VIDEO = Q.has("video");
const root = document.getElementById("pres");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let data, i = 0, playing = !reduce || VIDEO, timer = null, t0 = 0, dur = 0;

const durationOf = s => Math.max(6000, 4500 + 55 * (t("pres." + s.id + ".t") + t("pres." + s.id + ".b")).length);
function go(n, keepPlaying = true) {
  i = Math.max(0, Math.min(data.slides.length - 1, n)); render();
  if (keepPlaying && playing) schedule(); else stop(false);
}
function schedule() {
  clearTimeout(timer); dur = durationOf(data.slides[i]); t0 = performance.now();
  timer = setTimeout(() => { if (i < data.slides.length - 1) go(i + 1); else { stop(); window.__presDone = true; } }, dur);
  requestAnimationFrame(progress);
}
function stop(update = true) { clearTimeout(timer); timer = null; if (update) { playing = false; controls(); } }
function progress() {
  const bar = root.querySelector(".pres-progress span"); if (!bar) return;
  bar.style.width = timer && !reduce ? Math.min(100, (performance.now() - t0) / dur * 100) + "%" : "0";
  if (timer) requestAnimationFrame(progress);
}
function toggle() { playing = !playing; controls(); if (playing) { if (i === data.slides.length - 1) go(0); else schedule(); } else stop(); }

function render() {
  const s = data.slides[i], title = t("pres." + s.id + ".t");
  const figs = s.imgs.map(k => el("figure", { class: "shot shot-" + k },
    el("img", { src: `presentation/img/${LANG}/${s.id}-${k}.jpg`, alt: t("pres.alt." + k), width: k === "console" ? 1440 : 1280, height: k === "console" ? 900 : 720 }),
    el("figcaption", {}, t("pres.cap." + k))));
  // console en grand à gauche ; à droite, le texte puis la scène (sur téléphone : console, texte, scène)
  const text = el("div", { class: "slide-text" }, el("p", { class: "step" }, t("pres.step", { n: i + 1, total: data.slides.length })), el("h2", { id: "slide-h", tabindex: "-1" }, title), el("p", {}, t("pres." + s.id + ".b")));
  root.querySelector(".slide").replaceChildren(el("div", { class: "shots" }, figs[0]), el("div", { class: "slide-side" }, text, ...figs.slice(1)));
  root.querySelectorAll(".dots button").forEach((b, k) => b.setAttribute("aria-current", k === i ? "step" : "false"));
  controls();
}
function controls() {
  const c = root.querySelector(".pres-controls"); if (!c) return;
  c.querySelector("[data-pres=prev]").disabled = i === 0; c.querySelector("[data-pres=next]").disabled = i === data.slides.length - 1;
  const p = c.querySelector("[data-pres=play]"); p.textContent = t(playing ? "pres.pause" : "pres.play"); p.setAttribute("aria-pressed", String(playing));
}
async function boot() {
  await loadStrings(LANG); applyI18n();
  data = await (await fetch("presentation/slides.json", { cache: "no-cache" })).json();
  const other = LANG === "fr" ? "en" : "fr";
  const head = el("header", { class: "pres-head" }, el("div", {}, el("h1", {}, t("pres.title")), el("p", { class: "sub" }, t("pres.sub"))),
    el("nav", { class: "pres-links" },
      el("a", { href: "?lang=fr", "aria-current": LANG === "fr" ? "page" : "false", lang: "fr" }, "FR"), el("a", { href: "?lang=en", "aria-current": LANG === "en" ? "page" : "false", lang: "en" }, "EN"),
      el("span", { class: "video-slot" })));
  const ctl = el("div", { class: "pres-controls" },
    el("button", { type: "button", class: "btn", dataset: { pres: "prev" }, onclick: () => go(i - 1) }, t("pres.prev")),
    el("button", { type: "button", class: "btn primary", dataset: { pres: "play" }, onclick: toggle }),
    el("button", { type: "button", class: "btn", dataset: { pres: "next" }, onclick: () => go(i + 1) }, t("pres.next")),
    el("div", { class: "dots", role: "group" }, ...data.slides.map((s, k) => el("button", { type: "button", "aria-label": t("pres.goto", { n: k + 1, title: t("pres." + s.id + ".t") }), onclick: () => go(k) }))));
  root.className = VIDEO ? "video" : "";
  root.append(...(VIDEO ? [] : [head]), el("main", { class: "slide", "aria-live": "polite", "aria-labelledby": "slide-h" }),
    el("div", { class: "pres-progress", "aria-hidden": "true" }, el("span")), ...(VIDEO ? [] : [ctl, el("p", { class: "kb" }, t("pres.kb"))]));
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") go(i + 1); else if (e.key === "ArrowLeft") go(i - 1);
    else if (e.key === " " && !e.target.closest("button, a")) { e.preventDefault(); toggle(); }
  });
  window.__presTotalMs = data.slides.reduce((a, s) => a + durationOf(s), 0);
  // vidéo : lien affiché seulement si le fichier existe (les vidéos sont produites sur place, hors du dépôt)
  const vurl = `presentation/video/presentation-${LANG}.webm`;
  if (!VIDEO) fetch(vurl, { method: "HEAD" }).then(r => { if (r.ok) root.querySelector(".video-slot")?.replaceWith(el("a", { href: vurl, download: "" }, t("pres.video"))); }).catch(() => {});
  go(0);
}
boot();
