// Console du modérateur : tient l'état, le journal, les minuteurs, la sauvegarde. Tous les textes viennent de i18n.
import { loadStrings, applyI18n, t, lang as curLangFn } from "./i18n.js";
import { CardLibrary, cardsBase, fetchJSON } from "./cards.js";
import { Link } from "./link.js";
import { Stage } from "./stage.js";
import { Store } from "./store.js";
import { Backup, canWriteFiles } from "./backup.js";
import { Session } from "./session.js";
import { sceneView, consoleView } from "./view.js";
import { currentPhase, phaseCardId, presentCount, placedTokens, effectifsEffectifs, CALIB } from "./state.js";
import { timing } from "./timers.js";
import { el, CASES, seededShuffle, sha256Text, displayInfo, fmtHM, fmtMS, fmtClock, pad2 } from "./util.js";
import { Trainer, loadScenario } from "./training.js";
import { Tour } from "./tour.js";

const Q = new URLSearchParams(location.search);
const DEV = Q.has("dev");
const app = document.getElementById("app");
const store = new Store();
let outil, manifest, schema, fgList = [];
let cfg = null, lib = null, session = null, backup = null, header = null, resumeList = [];
let sceneWin = null, sceneSeen = 0, sceneInfo = null, lastLogged = null, rev = 0;
const epoch = Math.random().toString(36).slice(2);
const ui = { active: null, countsDraft: null, countsTimer: null, toast: null, loading: null, tick: [] };
let stage = null;
let trainer = null, tour = null;                 // entraînement (FG simulé) et visite guidée
const toured = new Set();
const TRAINING = () => !!(cfg && cfg.entrainement);
const previewBox = el("div", { class: "preview-box" });
const notesBox = el("div", { class: "card notes-card" });
const presentsBox = el("div", { class: "card presents-card" });

const link = new Link(m => {
  if (m.k === "hello") {
    sceneSeen = Date.now(); sceneInfo = m;
    pushView(); checkLiaison(); renderIf();
  }
});

// ------------------------------------------------------------------ démarrage
async function boot() {
  outil = await fetchJSON("config/outil.json");
  manifest = await fetchJSON(outil.manifest);
  schema = await fetchJSON("data/schema/events.json");
  await loadStrings("fr"); applyI18n();
  for (const p of outil.fg_configs) { try { fgList.push({ path: p, cfg: await fetchJSON(p) }); } catch (e) { /* ignoré */ } }
  try { resumeList = (await store.list()).filter(r => r.status === "en_cours"); } catch (e) { resumeList = []; }
  store.onState = () => updateIndicators();
  document.addEventListener("keydown", onKey);
  setInterval(tick, 250);
  renderSetup();
  if (DEV) window.__fg = { get session() { return session; }, get backup() { return backup; }, store, get lib() { return lib; }, get stage() { return stage; }, ui, boot: { selectConfig, validateEvent }, get cfg() { return cfg; }, setClock: f => { if (session) session.clock = f; } };
}

function validateEvent(ev) {       // contrôle du dictionnaire (développement et tests)
  const d = schema.types[ev.type];
  if (!d) throw new Error("type absent du dictionnaire : " + ev.type);
  for (const [k, ty] of Object.entries(d.fields)) {
    const opt = ty.endsWith("?"), base = ty.replace("?", "");
    const v = ev.data[k];
    if (v == null) { if (!opt) throw new Error(ev.type + ": champ manquant " + k); continue; }
    const ok = base === "array" ? Array.isArray(v) : base === "object" ? (typeof v === "object" && !Array.isArray(v)) : typeof v === base;
    if (!ok) throw new Error(ev.type + ": type invalide pour " + k);
  }
  for (const k of Object.keys(ev.data)) if (!(k in d.fields)) throw new Error(ev.type + ": champ hors dictionnaire " + k);
}

async function selectConfig(config, langOverride) {
  if (session && session.s.status !== "setup") return;
  if (session) await store.remove(header.session_id);      // changement de configuration avant le Go
  session = null; backup && backup.timer && clearInterval(backup.timer); backup = null;
  if (trainer && !config.entrainement) { trainer.stop(); trainer = null; }
  cfg = { ...config, language: langOverride || config.language };
  await loadStrings(cfg.language); applyI18n();
  ui.loading = { n: 0, total: 0 }; renderSetup();
  lib = new CardLibrary(cardsBase(outil), manifest, cfg.language);
  await lib.preload((n, total) => { ui.loading = { n, total }; updateIndicators(); });
  ui.loading = null;
  await createSession();
  renderSetup();
}

async function createSession(extra = {}) {
  const ids = cfg.cards === "all" || !cfg.cards ? lib.ids() : cfg.cards.filter(id => lib.ids().includes(id));
  const { order, info: orderInfo } = await resolveOrder(ids);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const cardsHdr = lib.headerCards(order);
  header = {
    fg_id: cfg.fg_id, session_id: cfg.fg_id + "_" + stamp, country: cfg.country, language: cfg.language, population: cfg.population,
    tool_version: outil.tool_version, guide_version: cfg.guide_version, order_seed: String(cfg.order_seed),
    order_source: orderInfo.source, order_sequence: orderInfo.sequence || null, order_issue: orderInfo.issue || null,
    config_hash: await sha256Text(JSON.stringify(cfg)), deck_hash: await sha256Text(JSON.stringify(cardsHdr.map(c => [c.id, c.png?.sha256, c.html?.sha256]))),
    reference_profile: outil.reference_profile, display: displayInfo(), cards_base: lib.base,
    order, participants: outil.participants, config: cfg, cards: cardsHdr, dictionary_version: schema.dictionary_version,
    started_at: new Date().toISOString(), entrainement: !!cfg.entrainement, ...extra
  };
  attach(new Session({ header, cfg, order, participants: outil.participants, validator: DEV ? validateEvent : null }));
  session.create();
}

// ---- entraînement : FG simulé, sauvegarde en mémoire, participants simulés, visite guidée
async function startTraining(lng, keepTours = false) {
  const tcfg = await fetchJSON(outil.training_configs[lng]);
  if (!keepTours) toured.clear();
  tour && tour.end(); tour = null;
  if (session && session.s.status !== "setup") return;
  await selectConfig(tcfg);
  backup.useMemory(cfg.fg_id); session.setBackup("memoire", null);
  const { scenario, texts } = await loadScenario(cfg.language);
  trainer && trainer.stop();
  trainer = new Trainer({ scenario, texts, lang: cfg.language, session, label: id => lib.label(id),
    hooks: { closeScene: () => { if (sceneWin && !sceneWin.closed) { sceneWin.close(); return true; } return false; },
             failBackup: () => backup.simulateFailure(t("train.sys")), onLine: () => {} } });
  renderSetup();
}
function quitTraining() { trainer && trainer.stop(); location.href = location.pathname + (DEV ? "?dev=1" : ""); }
function trainingBanner() {
  if (!TRAINING()) return null;
  return el("div", { class: "training-banner", role: "note" }, el("strong", {}, t("train.banner")), el("span", { class: "grow" }),
    btn("train.tour", () => startTour(tourName(), true), { data: { act: "replay-tour" } }), btn("train.quit", quitTraining, { data: { act: "quit-training" } }));
}
// visite guidée : un jeu d'étapes par écran, lancé une fois par entraînement (et à la demande)
function tourName() {
  if (!session || session.s.status === "setup") return "setup";
  if (session.s.status === "ended") return "fin";
  if ($(".alerts .alert") && !toured.has("alerte")) return "alerte";
  const p = currentPhase(session.s);
  if (!p || p.module === "plain") return "run";
  return toured.has("run") ? p.module : "run";
}
function startTour(name, force) {
  if (tour && tour.active) { if (!force) return; tour.end(); }
  if (document.querySelector("dialog[open]")) return;
  toured.add(name);
  tour = new Tour(name, () => { tour = null; }).start(!!force);
}
function maybeTour() {
  if (!TRAINING() || (tour && tour.active)) { tour && tour.place(); return; }
  const n = tourName(); if (!toured.has(n)) startTour(n);
}

// Ordre du tri : séquence pré-générée (config/sequences.json, plan équilibré), sinon ordre fixé dans la configuration, sinon mélange par graine.
async function resolveOrder(ids) {
  const seed = () => seededShuffle(ids, cfg.order_seed);
  const same = seq => Array.isArray(seq) && seq.length === ids.length && ids.every(id => seq.includes(id));
  if (cfg.order_sequence) {
    let seq = null;
    try { seq = (await fetchJSON(outil.sequences || "config/sequences.json")).sequences[cfg.order_sequence]; } catch (e) { seq = null; }
    if (same(seq)) return { order: [...seq], info: { source: "sequence", sequence: cfg.order_sequence } };
    return { order: seed(), info: { source: "graine", sequence: cfg.order_sequence, issue: seq ? "sequence_cartes_differentes" : "sequence_introuvable" } };
  }
  if (cfg.order) {
    if (same(cfg.order)) return { order: [...cfg.order], info: { source: "config" } };
    return { order: seed(), info: { source: "graine", issue: "ordre_cartes_differentes" } };
  }
  return { order: seed(), info: { source: "graine" } };
}

function attach(sess) {
  session = sess;
  backup = new Backup({ getExport: () => session.exportObject(), snapshotIntervalS: outil.backup.snapshot_interval_s, staleAfterS: outil.backup.stale_after_s, onChange: () => updateIndicators(), onHandle: h => store.saveHandle(header.session_id, h) });
  if (!header.entrainement) {
    store.putSession({ id: header.session_id, header, status: "en_cours", updated: Date.now() });
    session.events.forEach(ev => store.appendEvent(header.session_id, ev));
  }
  session.onEvent(onEvent);
  previewBox.replaceChildren();
  stage = new Stage(previewBox, { cards: lib, interactive: true, fit: "container", onAction: onStageAction });
}

function onEvent(ev) {
  if (!header.entrainement) store.appendEvent(header.session_id, ev);
  backup.markDirty();
  if (ev.type === "phase_fin") backup.phaseEnd();
  if (ev.type === "carte_debut") { ui.active = null; ui.countsDraft = null; }
  if (ev.type === "fin_seance") finishSession();
  pushView(); renderIf();
}
async function finishSession() {
  if (header.entrainement) { trainer && trainer.stop(); return; }
  await backup.final();
  // Fichier en échec ou absent à la fin : téléchargement de secours du journal complet, avant de clore la séance dans le stockage de reprise.
  if (backup.mode !== "degrade" && backup.status() !== "ok") downloadJSON(session.exportObject(), header.session_id + "_final_secours.json");
  await store.putSession({ id: header.session_id, header, status: "terminee", updated: Date.now() });
}

// ------------------------------------------------------------------ liaison scène
function pushView() {
  if (!session) return;
  link.send({ k: "view", epoch, rev: ++rev, view: { ...sceneView(session.s, cfg.language), entrainement: TRAINING() } });
  if (stage) stage.update(consoleView(session.s, cfg.language, ui));
}
function sceneAlive() { return Date.now() - sceneSeen < 6000; }
function sceneSame() {
  if (!sceneInfo || !sceneInfo.hashes) return null;
  const mine = lib.hashes(), theirs = sceneInfo.hashes;
  const diff = Object.keys(mine).filter(k => mine[k] !== theirs[k]);
  return diff;
}
function checkLiaison() {
  if (!session) return;
  const alive = sceneAlive(), diff = alive ? sceneSame() : null;
  const key = alive + ":" + (diff ? diff.join(",") : "");
  if (key === lastLogged || (diff === null && alive && !sceneInfo?.hashes)) return;
  lastLogged = key;
  session.dispatch("scene_liaison", { connectee: alive, cartes_identiques: diff ? diff.length === 0 : null, ecarts: diff || [] });
}
function openScene() {
  // la scène lit les cartes à la même adresse que la console, y compris quand elle est forcée par ?cards=
  sceneWin = window.open("scene.html" + (Q.get("cards") ? "?cards=" + encodeURIComponent(Q.get("cards")) : ""), "fg-scene", "popup,width=1280,height=720");
  link.win = sceneWin;
}

// ------------------------------------------------------------------ rendu
function renderIf() { if (session && session.s.status !== "setup") renderRun(); else if (app.dataset.view === "setup") renderSetup(); }
const $ = (s, r = app) => r.querySelector(s);
function btn(textKey, onclick, opts = {}) {
  return el("button", { type: "button", class: "btn " + (opts.cls || ""), onclick, disabled: opts.disabled, title: opts.title, dataset: opts.data }, opts.raw ?? t(textKey), opts.key ? el("kbd", {}, opts.key) : null);
}
function toast(text) {
  clearTimeout(ui.toastT);
  let n = document.querySelector(".toast"); if (!n) { n = el("div", { class: "toast", role: "status" }); document.body.append(n); }
  n.textContent = text; n.hidden = false; ui.toastT = setTimeout(() => { n.hidden = true; }, 3500);
}
function res(r) { if (r && !r.ok) toast(t("err." + r.raison)); return r; }
function popLabel(code) { const k = "pop." + code; const v = t(k); return v.startsWith("[") ? code : v; }

// ---- démarrage de la séance
function renderSetup() {
  app.dataset.view = "setup";
  app.replaceChildren();
  const head = el("header", { class: "bar" }, el("strong", {}, cfg ? cfg.fg_id : t("setup.nofg")));
  const left = el("section", { class: "card" }, el("h2", {}, t("setup.title")));
  const sel = el("select", { id: "fg-select", "aria-label": t("setup.fg") },
    el("option", { value: "" }, t("setup.choose")),
    ...fgList.map((f, i) => el("option", { value: i, selected: cfg && cfg.fg_id === f.cfg.fg_id }, `${f.cfg.fg_id} · ${f.cfg.country} · ${popLabel(f.cfg.population)}`)));
  sel.addEventListener("change", () => { if (sel.value !== "") selectConfig(fgList[+sel.value].cfg); });
  if (TRAINING()) left.append(el("p", { class: "sim-info" }, t("learn.sim.info")));
  else left.append(el("label", { for: "fg-select" }, t("setup.fg")), sel);
  const file = el("input", { type: "file", accept: "application/json", hidden: true, id: "cfg-file" });
  file.addEventListener("change", async () => { const f = file.files[0]; if (f) selectConfig(JSON.parse(await f.text())); });
  if (!TRAINING()) left.append(file, btn("setup.loadfile", () => file.click(), { cls: "link" }));
  left.append(el("div", { class: "lbl" }, t("setup.lang")));
  const langRow = el("div", { class: "seg" }, ...["fr", "en"].map(l => el("button", { type: "button", class: "btn" + (cfg && cfg.language === l ? " on" : ""), dataset: { lang: l }, disabled: !cfg || TRAINING(),
    onclick: () => selectConfig(cfg, l) }, l.toUpperCase())));
  left.append(langRow);
  if (cfg) left.append(el("p", { class: "meta" }, t("setup.versions", { tool: outil.tool_version, guide: cfg.guide_version })));
  if (session) left.append(el("div", { class: "lbl" }, t("setup.present")), presentsRow());
  const right = el("section", { class: "card" }, el("h2", {}, t("setup.checks")), checksTable());
  const main = el("main", { class: "setup" });
  if (resumeList.length && !session) main.append(resumePanel());
  main.append(el("div", { class: "setup-left" }, left, TRAINING() ? null : learnCard()), right, setupFooter());
  app.append(...[head, trainingBanner(), main].filter(Boolean));
  setTimeout(maybeTour, 0);
  updateIndicators();
}
function learnCard() {
  const lg = curLangFn();
  const link = (key, href, act) => el("a", { class: "btn", href, target: "_blank", rel: "noopener", dataset: { act } }, t(key));
  return el("section", { class: "card learn-card" }, el("h2", {}, t("learn.title")), el("p", { class: "hint" }, t("learn.hint")),
    el("div", { class: "row-btns" }, btn("learn.train.fr", () => startTraining("fr"), { cls: "primary", data: { act: "train-fr" } }), btn("learn.train.en", () => startTraining("en"), { cls: "primary", data: { act: "train-en" } })),
    el("div", { class: "row-btns" }, link("learn.pres", "presentation.html?lang=" + lg, "presentation"), link("learn.memo", "aide-memoire.html?lang=" + lg, "memo")));
}
function resumePanel() {
  const box = el("section", { class: "card resume wide" }, el("h2", {}, t("resume.title")));
  resumeList.forEach(r => {
    box.append(el("div", { class: "resume-row" },
      el("span", {}, t("resume.info", { fg: r.header.fg_id, n: "…", at: fmtClock(r.updated) })),
      btn("resume.resume", () => resumeSession(r.id), { cls: "primary", data: { sid: r.id } }),
      btn("resume.export", () => exportOld(r.id), {}),
      btn("resume.ignore", async () => { await store.putSession({ ...r, status: "ignoree" }); resumeList = resumeList.filter(x => x.id !== r.id); renderSetup(); }, {})));
  });
  return box;
}
function row(status, name, detail, extra) {
  const icon = { ok: "check", ko: "cross", todo: "circle", warn: "warn", wait: "circle" }[status];
  return el("tr", { class: "chk " + status, dataset: { status } },
    el("td", {}, el("span", { class: "ico " + icon, "aria-hidden": "true" }), el("span", {}, t("check.st." + status))),
    el("th", { scope: "row" }, name), el("td", {}, el("div", { class: "chk-detail" }, detail), extra ? el("div", { class: "chk-act" }, extra) : null));
}
function checksTable() {
  const tb = el("table", { class: "checks" });
  const s = session ? session.s : null, d = displayInfo();
  const sect = txt => el("tr", { class: "chk-sect" }, el("th", { colspan: 3, scope: "colgroup" }, txt));
  const step = (n, txt) => el("span", { class: "stepname" }, el("span", { class: "stepn", "aria-hidden": "true" }, String(n)), txt);
  // 1. Étapes à faire par le modérateur, dans l'ordre
  tb.append(sect(t("setup.steps")));
  const alive = sceneAlive();
  const tagged = (r, k) => { r.dataset.check = k; return r; };
  tb.append(tagged(row(alive ? "ok" : "todo", step(1, t("check.link")),
    el("span", {}, t(alive ? (sceneSame()?.length ? "check.link.diff" : "check.link.ok") : "check.link.todo"), el("span", { class: "hint block" }, t("check.link.share"))),
    btn("check.link.open", openScene, { disabled: !session, data: { act: "open-scene" } })), "link"));
  const bk = s && s.backup.mode;
  const bkDetail = el("span", {}, bk === "memoire" ? t("train.backup") : bk === "continu" ? t("check.backup.continu", { name: backup.name }) : bk === "degrade" ? t("check.backup.degrade.on") : t("check.backup.todo"));
  const bkBtns = el("div", { class: "row-btns" },
    btn("check.backup.choose", async () => { try { await backup.chooseFile(`${cfg.fg_id}_${new Date().toISOString().slice(0, 10)}.json`); session.setBackup("continu", backup.name); renderSetup(); } catch (e) { if (e.name !== "AbortError") toast(t("err.sauvegarde_fichier")); } }, { disabled: !session || !canWriteFiles(), data: { act: "choose-file" }, cls: canWriteFiles() ? "" : "" }),
    btn("check.backup.degrade", () => { backup.useDegraded(`${cfg.fg_id}_${new Date().toISOString().slice(0, 10)}`); session.setBackup("degrade", null); renderSetup(); }, { disabled: !session, data: { act: "degrade" } }),
    DEV ? btn("check.backup.opfs", async () => { await backup.useOPFS(`${cfg.fg_id}_test.json`); session.setBackup("continu", backup.name); renderSetup(); }, { data: { act: "opfs" } }) : null);
  tb.append(tagged(row(bk ? (bk === "degrade" ? "warn" : "ok") : "todo", step(2, t("check.backup")), bkDetail, TRAINING() ? null : bkBtns), "backup"));
  tb.append(tagged(row(s && s.sync.audio ? "ok" : "todo", step(3, t("check.sync")), s && s.sync.audio ? t("check.sync.done", { at: fmtClock(s.sync.audio) }) : t("check.sync.todo"),
    btn("check.sync.btn", () => { session.syncAudio(); renderSetup(); }, { disabled: !session, data: { act: "sync" } })), "sync"));
  // 2. Contrôles faits par l'outil
  tb.append(sect(t("setup.auto")));
  const cardsSt = ui.loading ? "wait" : !lib ? "todo" : lib.errors.length ? "ko" : "ok";
  tb.append(row(cardsSt, t("check.cards"), ui.loading ? t("check.cards.loading", ui.loading) : !lib ? t("check.cards.none") : lib.errors.length ? t("check.cards.err", { n: lib.errors.length, ids: lib.errors.map(e => e.id).join(", ") }) : t("check.cards.ok", { n: lib.loaded.size, total: lib.defs.length })));
  if (header) {
    const o = { source: header.order_source, seq: header.order_sequence, issue: header.order_issue };
    const txt = o.issue ? t("check.order." + o.issue, { id: o.seq || "", seed: cfg.order_seed }) : o.source === "sequence" ? t("check.order.seq", { id: o.seq }) : o.source === "config" ? t("check.order.config") : t("check.order.seed", { seed: cfg.order_seed });
    tb.append(row(o.issue ? "warn" : "ok", t("check.order"), txt));
  }
  tb.append(row(d.arial_available ? "ok" : "warn", t("check.arial"), t(d.arial_available ? "check.arial.ok" : "check.arial.ko")));
  tb.append(row(d.window_w >= 1280 && d.window_h >= 720 ? "ok" : "warn", t("check.display"), t("check.display.detail", { w: d.window_w, h: d.window_h, r: d.pixel_ratio })));
  tb.append(row(typeof indexedDB !== "undefined" ? "ok" : "ko", t("check.store"), t(resumeList.length ? "check.store.resume" : "check.store.ok")));
  return tb;
}
function missing() {
  const m = [];
  if (!session) m.push("setup.miss.fg");
  else {
    if (!lib || lib.errors.length || ui.loading) m.push("setup.miss.cards");
    if (!session.s.backup.mode) m.push("setup.miss.backup");
  }
  return m;
}
function setupFooter() {
  const m = missing();
  const f = el("section", { class: "card footer-card wide" },
    el("span", { class: "ico " + (m.length ? "circle" : "check"), "aria-hidden": "true" }),
    el("strong", { class: "msg" }, m.length ? t("setup.blocked", { what: m.map(k => t(k)).join(", ") }) : t(sceneAlive() ? "setup.ready" : "setup.ready.noscene")),
    el("span", { class: "grow" }),
    btn("setup.go", () => { res(session.go()); }, { cls: "primary big", disabled: m.length > 0, data: { act: "go" } }));
  return f;
}
function presentsRow() {
  const s = session.s;
  return el("div", { class: "presents" }, ...outil.participants.map(p => {
    const on = s.present[p];
    return el("button", { type: "button", class: "chip " + (on ? "on" : "off"), "aria-pressed": on, dataset: { p }, onclick: () => session.setPresent(p, !on) },
      el("span", { class: "ico " + (on ? "check" : "cross"), "aria-hidden": "true" }), p);
  }));
}

// ---- reprise et export d'une séance non terminée
async function resumeSession(sid) {
  const { rec, events, handle } = await store.load(sid);
  // Autorisation d'écriture demandée avant tout chargement : le navigateur l'exige pendant le geste de l'utilisateur (clic sur Reprendre).
  let perm = "granted";
  if (handle && handle.requestPermission) { try { perm = await handle.requestPermission({ mode: "readwrite" }); } catch (e) { perm = "error"; } }
  header = rec.header; cfg = header.config;
  await loadStrings(cfg.language); applyI18n();
  lib = new CardLibrary(header.cards_base, manifest, cfg.language);
  await lib.preload();
  const sess = Session.restore(header, events, { validator: DEV ? validateEvent : null });
  const last = Date.parse(events[events.length - 1].t);
  const diff = header.cards.filter(c => lib.hashes()[c.id] !== (c.png?.sha256 + ":" + c.html?.sha256)).map(c => c.id);
  attach(sess);
  resumeList = resumeList.filter(r => r.id !== sid);
  if (handle && perm === "granted") { try { await backup.useHandle(handle, handle.name); } catch (e) { toast(t("err.sauvegarde_reprise")); } }
  else if (handle) toast(t("err.sauvegarde_reprise"));
  else if (sess.s.backup.mode === "degrade") backup.useDegraded(sess.header.fg_id + "_" + sid.slice(-15));
  session.dispatch("reprise", { depuis_n: events.length, interruption_ms: Date.now() - last, ecarts: diff });
  renderIf(); if (session.s.status === "setup") renderSetup();
}
function downloadJSON(obj, name) {
  const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: "application/json" })), download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function rechooseFile() {
  try { await backup.chooseFile(`${cfg.fg_id}_${new Date().toISOString().slice(0, 10)}_suite.json`); session.setBackup("continu", backup.name); }
  catch (e) { if (e.name !== "AbortError") toast(t("err.sauvegarde_fichier")); }
}
async function exportOld(sid) {
  const { rec, events } = await store.load(sid);
  const sess = Session.restore(rec.header, events);
  const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(sess.exportObject())], { type: "application/json" })), download: sid + "_export.json" });
  document.body.append(a); a.click(); a.remove();
}

// ---- séance en cours
function timeBlock(id) { return el("div", { class: "tb", dataset: { tb: id } }, el("div", { class: "tb-label" }, t("time." + id)), el("div", { class: "tb-digits" }), el("div", { class: "tb-bar" }, el("div", { class: "tb-fill" })), el("div", { class: "tb-state" })); }
function renderRun() {
  const s = session.s, p = currentPhase(s);
  app.dataset.view = "run";
  const cid = p ? phaseCardId(s, p.id) : null;
  const seqN = p && s.seq[p.id] ? s.seq[p.id].length : 0;
  const head = el("header", { class: "bar" },
    el("strong", {}, cfg.fg_id),
    el("span", { class: "phase-name" }, t("console.phase", { name: s.status === "ended" ? t("phase.end") : p ? t("phase." + p.id) : "" })),
    cid && p.module !== "tutoriel" && s.status !== "ended" ? el("span", { class: "counter" }, t("console.card", { n: s.cursor[p.id] + 1, total: seqN })) : null,
    el("span", { class: "grow" }),
    btn("console.progress", showProgress, { data: { act: "progress" } }),
    btn(s.status === "paused" ? "console.resume" : "console.pause", () => res(s.status === "paused" ? session.resume() : session.pause()), { data: { act: "pause" }, cls: s.status === "paused" ? "warn" : "", disabled: s.status === "ended" }),
    btn("console.incident", () => { session.incident("technique"); toast(t("console.incident.logged", { at: fmtClock(Date.now()) })); }, { cls: "danger", data: { act: "incident" } }));
  const times = el("div", { class: "timebar" },
    el("div", { class: "tb elapsed", dataset: { tb: "elapsed" } }, el("div", { class: "tb-label" }, t("time.elapsed")), el("div", { class: "tb-digits" })),
    timeBlock("step"), timeBlock("global"), el("div", { class: "indicators" }, el("div", { class: "ind save" }), el("div", { class: "ind scene" })));
  const sim = trainer && TRAINING() && s.status !== "ended" ? trainer.panel() : null;     // en entraînement, les répliques passent en premier
  const left = el("div", { class: "col-left" }, sim, el("section", { class: "card" }, el("h2", {}, t("console.preview")), previewBox), zoomPanel(), keysHelp());
  presentsBox.replaceChildren(el("h2", {}, t("console.present"), el("span", { class: "n" }, t("console.present.n", { n: presentCount(s), total: outil.participants.length }))), presentsRow());
  notesBox.replaceChildren(...notesContent());
  const right = el("div", { class: "col-right" }, phasePanel(), presentsBox, notesBox);
  app.replaceChildren(...[head, trainingBanner(), times, el("div", { class: "alerts", "aria-live": "assertive" }), el("main", { class: "run" }, left, right)].filter(Boolean));
  applyI18n(app); tick(); updateIndicators();
  stage && stage._scale();
  setTimeout(maybeTour, 0);
}
// Rappel des seules touches utiles dans la phase en cours
function keysHelp() {
  const s = session.s, p = currentPhase(s); if (!p || s.status === "ended") return null;
  const R = t("keyhelp.range"), DEL = t("key.del"), ENT = t("key.enter");
  const sets = {
    tri: [[[R], "place"], [["S"], "second"], [["X"], "cycle"], [[DEL], "remove"], [["Q"], "question"], [["N"], "next"], [["Z"], "zoom"]],
    demo: [[[R], "place"], [["S"], "second"], [["X"], "cycle"], [[DEL], "remove"], [["Z"], "zoom"]],
    discussion: [[["N"], "next"], [["Z"], "zoom"]],
    jugement: [[["←", "→"], "shift"], [[R], "place"], [[ENT], "validate"], [["X"], "cycle"], [["D"], "dup"], [[DEL], "remove"], [["R"], "ghost"], [["N"], "next"], [["Z"], "zoom"]]
  };
  const set = p.module === "tutoriel" ? (s.tuto.etape === "demo" ? sets.demo : null) : sets[p.module];
  if (!set) return null;
  return el("section", { class: "keys", "aria-labelledby": "keys-h" }, el("h2", { id: "keys-h" }, t("console.keys.title")),
    el("ul", { class: "keylist" }, ...set.map(([ks, a]) => el("li", {}, ...ks.map(k => el("kbd", {}, k)), el("span", {}, t("keyhelp." + a))))));
}
function notesContent() {
  const ta = ui.noteTA || (ui.noteTA = el("textarea", { rows: 2, placeholder: t("console.note.ph"), id: "note-ta", "aria-labelledby": "notes-h" }));
  ta.placeholder = t("console.note.ph");
  return [el("h2", {}, el("span", { id: "notes-h" }, t("console.notes")), el("span", { class: "warnmsg" }, el("span", { class: "ico warn", "aria-hidden": "true" }), t("console.note.warn"))), ta,
    btn("console.note.add", () => { if (res(session.addNote(ta.value)).ok) { ta.value = ""; toast(t("console.note.saved")); } }, { data: { act: "note" } })];
}
function zoomPanel() {
  const s = session.s, p = currentPhase(s);
  const on = p && ["tri", "discussion", "jugement", "tutoriel"].includes(p.module) && phaseCardId(s, p.id);
  const grid = el("div", { class: "zgrid", role: "group", "aria-label": t("zoom.grid") }, ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => el("button", { type: "button", class: "zcell" + (s.zoom.region === i && s.zoom.niveau > 100 ? " on" : ""), disabled: !on, "aria-label": t("zoom.region", { n: i + 1 }), dataset: { region: i },
    onclick: () => res(session.setZoom(s.zoom.niveau === 100 ? 150 : s.zoom.niveau, i)) })));
  return el("section", { class: "card zoom-card" }, el("div", { class: "zoom-row" }, el("strong", {}, t("zoom.title")),
    ...[100, 150, 200].map(n => el("button", { type: "button", class: "btn" + (s.zoom.niveau === n ? " on" : ""), disabled: !on, dataset: { zoom: n }, onclick: () => res(session.setZoom(n, s.zoom.region)) }, n + " %")), grid));
}

// ---- panneaux par phase
function phasePanel() {
  const s = session.s, p = currentPhase(s);
  const box = el("section", { class: "card phase-card", dataset: { module: p ? p.module : "" } });
  if (s.status === "ended" && TRAINING() && trainer) return bilanPanel(box);
  if (s.status === "ended") { box.append(el("h2", {}, t("console.ended")), btn("console.export.restricted", exportRestricted, { data: { act: "export-restricted" } })); return box; }
  if (!p) return box;
  if (p.module === "plain") box.append(el("h2", {}, t("phase." + p.id)), el("p", {}, t("plain.hint." + p.id)));
  if (p.module === "tutoriel") panelTuto(box);
  if (p.module === "tri") panelTri(box);
  if (p.module === "discussion") panelDisc(box);
  if (p.module === "jugement") panelJuge(box);
  box.append(nextPhaseRow());
  return box;
}
function bilanPanel(box) {
  const items = trainer.bilan(), scored = items.filter(x => x.ok !== null), n = scored.filter(x => x.ok).length;
  box.classList.add("bilan");
  box.append(el("h2", {}, t("train.bilan")), el("p", { class: "bilan-score" }, t("train.bilan.score", { n, total: scored.length })),
    el("ul", { class: "bilan-list" }, ...items.map(x => el("li", { class: x.ok === null ? "info" : x.ok ? "ok" : "ko" },
      el("span", { class: "ico " + (x.ok === null ? "circle" : x.ok ? "check" : "cross"), "aria-hidden": "true" }),
      el("div", {}, el("span", { class: "sr-only" }, t(x.ok === null ? "train.b.info" : x.ok ? "train.b.ok" : "train.b.ko") + " : "), el("span", {}, x.text),
        !x.ok && x.tip ? el("span", { class: "bilan-tip" }, x.tip) : null)))),
    el("div", { class: "row" }, btn("train.restart", () => { const l = cfg.language; session = null; startTraining(l, true); }, { cls: "primary", data: { act: "restart-training" } }), btn("train.quit", quitTraining, {})));
  return box;
}
function nextPhaseRow() {
  const s = session.s, last = session.isLastPhase();
  const nxt = last ? t("phase.end") : t("phase." + s.phases[s.phaseIdx + 1].id);
  return el("div", { class: "phase-next" }, el("span", { class: "phase-next-l" }, t("console.nextphase.hint")), btn("", askNextPhase, { raw: t(last ? "console.finish" : "console.nextphase", { name: nxt }), data: { act: "next-phase" }, disabled: s.status !== "running" }));
}
function askNextPhase() {
  const un = session.untreated();
  if (!un.length) return res(session.nextPhase());
  dialog({ title: t("dlg.next.title"), body: t("dlg.next.body", { n: un.length }), ok: "dlg.next.ok", onOk: () => res(session.nextPhase()) });
}
function cardInfo(box, id) {
  box.append(el("div", { class: "cardinfo" }, el("strong", {}, t("console.internal", { id })), " · ", el("span", { class: "label" }, lib.label(id))));
}
function tokenControls(box, tokens, kind) {
  const s = session.s;
  if (!ui.active || (ui.active !== "new" && !tokens.find(x => x.id === ui.active))) ui.active = tokens.length ? tokens[0].id : null;
  const list = el("div", { class: "toklist" }, ...tokens.map((tk, i) => el("button", { type: "button", class: "btn tk" + (ui.active === tk.id ? " on" : ""), dataset: { tok: tk.id }, onclick: () => { ui.active = tk.id; pushView(); renderRun(); } },
    t("tri.token", { i: i + 1, etat: tk.case ? t("case." + tk.case) : t("tri.unplaced") }))));
  list.append(btn("tri.second", () => { if (tokens.length < 4) { ui.active = "new"; pushView(); renderRun(); } }, { key: "S", disabled: !tokens.length || tokens.length >= 4, data: { act: "second" }, cls: ui.active === "new" ? "on" : "" }));
  box.append(list);
  box.append(caseButtons(tokens.find(x => x.id === ui.active)?.case));
  list.append(btn("tri.remove", () => ui.active && ui.active !== "new" && res(session.removeToken(ui.active)), { key: t("key.del"), disabled: !tokens.length, data: { act: "remove" } }));
}
function caseButtons(cur) {       // couleur de la case reprise de la scène ; case de la miniature active marquée
  return el("div", { class: "casebtns" }, ...CASES.map((c, i) => btn("", () => placeActive(c), { raw: t("case." + c), key: String(i + 1), data: { case: c }, cls: "case-btn" + (c === cur ? " cur" : "") })));
}
function placeActive(c) {
  const s = session.s, p = currentPhase(s); if (!p) return;
  if (p.module === "jugement") {
    const id = phaseCardId(s, p.id), a = s.adapt[id]; const tk = a.tokens.find(x => x.id === ui.active && x.kind === "adapted") || a.tokens.find(x => x.kind === "adapted");
    return res(session.moveAdapted(tk.id, c, 1));
  }
  const id = phaseCardId(s, p.id), card = s.cards[id];
  const tokId = ui.active && ui.active !== "new" ? ui.active : null;
  const r = res(session.placeToken(tokId, c));
  if (r.ok) { const cur = session.s.cards[id].tokens.find(x => x.case === c); ui.active = cur ? cur.id : ui.active; pushView(); renderRun(); }
}
function panelTri(box) {
  const s = session.s, id = phaseCardId(s, "tri");
  if (!id) { box.append(el("h2", {}, t("phase.tri")), el("p", {}, t("disc.none"))); return; }
  const card = s.cards[id];
  box.append(el("h2", {}, t("phase.tri")));
  cardInfo(box, id);
  const tokens = card.tokens.filter(x => x.case);
  tokenControls(box, tokens, "tri");
  if (tokens.length >= 2) box.append(countsBlock(card));
  const q = card.question;
  const qb = el("div", { class: "question" },
    el("p", { class: "qtext" }, t("tri.question.text")),
    el("div", { class: "row" }, btn("tri.question.done", () => { flushCounts(); res(session.confirmQuestion()); }, { cls: "primary big", key: "Q", disabled: !!q.statut || !tokens.length, data: { act: "question" } }),
      btn("tri.next", () => { flushCounts(); res(session.nextCard()); }, { cls: "primary big", key: "N", disabled: !session.canNext(), data: { act: "next" } })),
    q.statut ? el("p", { class: "qstate ok" }, el("span", { class: "ico check" }), t(q.statut === "posee" ? "tri.question.confirmed" : "tri.question.skipped", { at: fmtClock(q.at), motif: q.motif ? t("motif." + q.motif) : "" })) : el("p", { class: "qstate" }, t("tri.question.pending")),
    el("div", { class: "row" }, btn("tri.skipq", () => askMotif("dlg.skipq", m => res(session.skipQuestion(m))), { disabled: !!q.statut || !tokens.length, data: { act: "skip-question" } }),
      btn("tri.skipcard", () => askMotif("dlg.skipcard", m => res(session.skipCard(m))), { data: { act: "skip-card" } })));
  box.append(qb);
}
function countsBlock(card) {
  const n = presentCount(session.s);
  const cur = ui.countsDraft || curCounts(card);
  const total = Object.values(cur).reduce((a, b) => a + b, 0), okTotal = total === n, none = total === 0;
  const cells = [...CASES, "abstention"].map(k => el("div", { class: "cnt", dataset: { cnt: k } }, el("div", { class: "cnt-l" }, t(k === "abstention" ? "tri.abstention" : "case." + k)),
    el("div", { class: "stepper" }, el("button", { type: "button", class: "btn", "aria-label": t("tri.minus"), onclick: () => bump(k, -1) }, "-"),
      el("output", { class: "cnt-v" }, String(cur[k] || 0)), el("button", { type: "button", class: "btn", "aria-label": t("tri.plus"), onclick: () => bump(k, 1) }, "+"))));
  return el("div", { class: "counts" }, el("h3", {}, t("tri.counts")), el("div", { class: "cnt-row" }, ...cells),
    none ? el("p", { class: "total none" }, t("tri.total.none"))
      : el("p", { class: "total " + (okTotal ? "ok" : "warn") }, el("span", { class: "ico " + (okTotal ? "check" : "warn") }), t(okTotal ? "tri.total.ok" : "tri.total.diff", { total, n })));
}
function curCounts(card) { return card.counts ? { ...card.counts } : { facile: 0, moyen: 0, difficile: 0, impossible: 0, abstention: 0 }; }
function bump(k, d) {
  const s = session.s; ui.countsDraft = ui.countsDraft || curCounts(s.cards[phaseCardId(s, "tri")]);
  ui.countsDraft[k] = Math.max(0, (ui.countsDraft[k] || 0) + d);
  clearTimeout(ui.countsTimer); ui.countsTimer = setTimeout(flushCounts, 900);
  renderRun();
}
function flushCounts() {
  clearTimeout(ui.countsTimer);
  if (!ui.countsDraft) return;
  const d = ui.countsDraft; ui.countsDraft = null;
  const s = session.s, id = phaseCardId(s, currentPhase(s)?.id);
  if (id && JSON.stringify(s.cards[id].counts) !== JSON.stringify({ ...d })) session.setCounts(d);
}
function panelDisc(box) {
  const s = session.s, id = phaseCardId(s, "discussion");
  box.append(el("h2", {}, t("phase.discussion")));
  if (!id) { box.append(el("p", {}, t("disc.none"))); return; }
  cardInfo(box, id);
  const det = s.selection.detail.find(d => d.carte === id);
  box.append(el("p", { class: "seldetail" }, t("disc.detail", { imp: det.impossible, diff: det.difficile })),
    el("p", { class: "relance" }, t("disc.relance")));
  box.append(selList(s.selection.cartes, id));
  box.append(el("div", { class: "row" }, btn(session.isLastCard() ? "tri.finish" : "tri.next", () => res(session.nextCard()), { cls: "primary big", key: "N", disabled: !session.canNext(), data: { act: "next" } }),
    btn("tri.skipcard", () => askMotif("dlg.skipcard", m => res(session.skipCard(m))), { data: { act: "skip-card" } })));
}
function selList(ids, cur) {
  return el("ol", { class: "sellist" }, ...ids.map(i => el("li", { class: i === cur ? "cur" : "" }, lib.label(i))));
}
function panelJuge(box) {
  const s = session.s, id = phaseCardId(s, "jugement");
  box.append(el("h2", {}, t("phase.jugement")));
  if (!id) { box.append(el("p", {}, t("disc.none"))); return; }
  cardInfo(box, id);
  const a = s.adapt[id], ad = a.tokens.filter(x => x.kind === "adapted");
  if (!ui.active || !ad.find(x => x.id === ui.active)) ui.active = ad.length ? ad[0].id : null;
  box.append(el("div", { class: "toklist" }, ...ad.map((tk, i) => el("button", { type: "button", class: "btn tk" + (ui.active === tk.id ? " on" : "") + (tk.validated ? " valid" : ""), dataset: { tok: tk.id }, onclick: () => { ui.active = tk.id; pushView(); renderRun(); } },
    t("juge.token", { i: i + 1, etat: t("case." + tk.case) + " " + t("juge.zone." + tk.zone) + (tk.validated ? " " + t("juge.valid") : "") })))));
  const tk = ad.find(x => x.id === ui.active);
  const startDefault = tk && tk.default_start;
  if (tk) box.append(el("p", { class: "hint" }, t(startDefault ? "juge.start.default" : "juge.start.moved")));
  box.append(el("div", { class: "row" },
    btn("juge.left", () => tk && res(session.shiftAdapted(tk.id, -1)), { key: "←", data: { act: "left" } }),
    btn("juge.right", () => tk && res(session.shiftAdapted(tk.id, 1)), { key: "→", data: { act: "right" } }),
    btn("juge.validate", () => tk && res(session.validateAdapted(tk.id)), { cls: "primary", key: t("key.enter"), disabled: !tk || tk.validated, data: { act: "validate" } })));
  box.append(caseButtons(tk && tk.case));
  box.append(el("div", { class: "row" }, btn("juge.dup", () => tk && dupActive(tk.id), { key: "D", disabled: !tk, data: { act: "dup" } }),
    btn("juge.undup", () => tk && res(session.removeAdapted(tk.id)), { key: t("key.del"), disabled: !tk || !tk.duplique_de, data: { act: "undup" } }),
    btn("", () => res(session.setGhost(!a.ghost)), { raw: t(a.ghost ? "juge.ghost.hide" : "juge.ghost.show"), key: "R", data: { act: "ghost" } })));
  box.append(el("p", { class: "ghoststate" }, t(a.ghost ? "juge.ghost.on" : "juge.ghost.off")));
  box.append(el("div", { class: "row" }, btn(session.isLastCard() ? "tri.finish" : "tri.next", () => res(session.nextCard()), { cls: "primary big", key: "N", disabled: !session.canNext(), data: { act: "next" } }),
    btn("tri.skipcard", () => askMotif("dlg.skipcard", m => res(session.skipCard(m))), { data: { act: "skip-card" } })));
}
function dupActive(id) {
  const r = res(session.duplicateAdapted(id));
  if (r.ok) { const a = session.s.adapt[phaseCardId(session.s, "jugement")]; ui.active = "a" + (a.nextA - 1); pushView(); renderRun(); }
}
function cycleActive() {
  const s = session.s, p = currentPhase(s), id = phaseCardId(s, p.id);
  const ids = p.module === "jugement" ? s.adapt[id].tokens.filter(x => x.kind === "adapted").map(x => x.id) : s.cards[id].tokens.filter(x => x.case).map(x => x.id);
  if (!ids.length) return;
  ui.active = ids[(ids.indexOf(ui.active) + 1) % ids.length]; pushView(); renderRun();
}
function panelTuto(box) {
  const s = session.s, steps = ["vocab", "demo", "releve"];
  box.append(el("h2", {}, t("phase.tutoriel")),
    el("div", { class: "seg steps" }, ...steps.map(e => el("button", { type: "button", class: "btn" + (s.tuto.etape === e ? " on" : ""), dataset: { step: e }, onclick: () => session.setTutoEtape(e) }, t("tuto.step." + e)))));
  box.append(el("p", { class: "hint" }, t("tuto.console." + s.tuto.etape)));
  if (s.tuto.etape === "demo") tokenControls(box, s.cards[CALIB].tokens.filter(x => x.case), "tri");
  if (s.tuto.etape === "releve") box.append(releveTable());
}
const RELEVE = {
  appareil: ["ordinateur", "tablette", "telephone", "autre"],
  taille: ["petit", "moyen", "grand", "inconnu"],
  ligne: ["1", "2", "3", "4", "5", "6", "7", "8", "aucune"],
  zoom: ["non", "150", "200"]
};
function releveTable() {
  const s = session.s;
  const tb = el("table", { class: "releve" }, el("thead", {}, el("tr", {}, el("th", {}, t("releve.p")), ...Object.keys(RELEVE).map(k => el("th", {}, t("releve." + k))))));
  const body = el("tbody");
  outil.participants.forEach(p => {
    const tr = el("tr", { class: s.present[p] ? "" : "absent" }, el("th", { scope: "row" }, p));
    Object.entries(RELEVE).forEach(([champ, opts]) => {
      const sel = el("select", { "aria-label": p + " " + t("releve." + champ), dataset: { p, champ } }, el("option", { value: "" }, t("releve.todo")),
        ...opts.map(o => el("option", { value: o, selected: s.releve[p][champ] === o }, t("releve." + champ + "." + o))));
      sel.addEventListener("change", () => session.setReleve(p, champ, sel.value));
      tr.append(el("td", {}, sel));
    });
    body.append(tr);
  });
  tb.append(body); return el("div", { class: "releve-wrap" }, tb, el("p", { class: "hint" }, t("releve.note")));
}

function exportRestricted() {         // copie sans le texte des notes libres (elles peuvent contenir des noms)
  const o = session.exportObject();
  o.header = { ...o.header, export_scope: "restreint" };
  o.events = o.events.map(e => (e.type === "note" ? { ...e, data: { ...e.data, texte: "" } } : e));
  o.state.notes = o.state.notes.map(n => ({ ...n, texte: "" }));
  const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(o)], { type: "application/json" })), download: header.session_id + "_restreint.json" });
  document.body.append(a); a.click(); a.remove();
}

// ---- avancement (console seulement)
function showProgress() {
  const s = session.s;
  const rows = s.order.map(id => {
    const c = s.cards[id];
    const st = c.skipped ? "skipped" : c.done ? "done" : c.entered ? "current" : "todo";
    const pl = placedTokens(c).map(x => t("case." + x.case)).join(" + ");
    return el("tr", {}, el("td", {}, String(c.rang)), el("td", {}, lib.label(id)), el("td", {}, t("progress.st." + st)), el("td", {}, pl || "-"), el("td", {}, c.spent_ms ? fmtMS(c.spent_ms) : "-"));
  });
  dialog({ title: t("progress.title"), wide: true, ok: "dlg.close", body: el("table", { class: "progress" }, el("thead", {}, el("tr", {}, ...["n", "card", "status", "placements", "time"].map(k => el("th", {}, t("progress.h." + k))))), el("tbody", {}, ...rows)) });
}

// ---- boîtes de dialogue
function dialog({ title, body, ok = "dlg.ok", onOk, wide, content }) {
  const d = el("dialog", { class: "dlg" + (wide ? " wide" : "") }, el("h2", {}, title), typeof body === "string" ? el("p", {}, body) : body, content || null);
  const row = el("div", { class: "dlg-row" });
  if (onOk) row.append(el("button", { type: "button", class: "btn", dataset: { act: "dlg-cancel" }, onclick: () => d.close() }, t("dlg.cancel")));
  row.append(el("button", { type: "button", class: "btn primary", dataset: { act: "dlg-ok" }, onclick: () => { d.close(); onOk && onOk(); } }, t(ok)));
  d.append(row); d.addEventListener("close", () => d.remove());
  document.body.append(d); d.showModal(); return d;
}
function askMotif(titleKey, cb) {
  let val = "temps";
  const group = el("div", { class: "motifs", role: "radiogroup" }, ...["temps", "incident", "autre"].map((m, i) => el("label", { class: "radio" },
    el("input", { type: "radio", name: "motif", value: m, checked: i === 0, onchange: () => { val = m; } }), t("motif." + m))));
  dialog({ title: t(titleKey), body: el("div", {}, el("p", {}, t("dlg.motif")), group), ok: "dlg.confirm", onOk: () => cb(val) });
}

// ------------------------------------------------------------------ interactions
function onStageAction(a) {
  if (!session || session.s.status !== "running") return;
  const p = currentPhase(session.s);
  if (a.type === "select") { ui.active = a.token; pushView(); renderRun(); }
  else if (a.type === "place") res(session.placeToken(a.token, a.case));
  else if (a.type === "move") res(session.moveAdapted(a.token.split(",")[0], a.case, a.zone));
  else if (a.type === "click") {
    if (p.module === "jugement") { const ad = session.s.adapt[phaseCardId(session.s, "jugement")].tokens.find(x => x.id === ui.active) || null; if (ad && a.zone != null) res(session.moveAdapted(ad.id, a.case, a.zone)); }
    else placeActive(a.case);
  }
}
function onKey(e) {
  if (e.target.closest && e.target.closest("input, textarea, select, dialog, .tour-bubble")) return;
  if (e.ctrlKey || e.metaKey || e.altKey || !session || session.s.status !== "running") return;
  const s = session.s, p = currentPhase(s); if (!p) return;
  const k = e.key.toLowerCase();
  const tri = p.module === "tri" || (p.module === "tutoriel" && s.tuto.etape === "demo"), jug = p.module === "jugement";
  if (/^[1-4]$/.test(k) && (tri || jug)) placeActive(CASES[+k - 1]);
  else if ((k === "arrowleft" || k === "arrowright") && jug) { const id = ui.active; if (id) res(session.shiftAdapted(id, k === "arrowleft" ? -1 : 1)); }
  else if (k === "enter" && jug) { if (ui.active) res(session.validateAdapted(ui.active)); }
  else if (k === "q" && p.module === "tri") { flushCounts(); res(session.confirmQuestion()); }
  else if (k === "n" && ["tri", "discussion", "jugement"].includes(p.module)) { flushCounts(); res(session.nextCard()); }
  else if (k === "s" && tri) { const toks = placedTokens(s.cards[phaseCardId(s, p.id)]); if (toks.length && toks.length < 4) { ui.active = "new"; pushView(); renderRun(); } }
  else if (k === "r" && jug) res(session.setGhost(!s.adapt[phaseCardId(s, p.id)].ghost));
  else if (k === "d" && jug && ui.active) dupActive(ui.active);
  else if (k === "x" && (tri || jug)) cycleActive();
  else if ((k === "delete" || k === "backspace") && tri && ui.active && ui.active !== "new") res(session.removeToken(ui.active));
  else if ((k === "delete" || k === "backspace") && jug && ui.active) res(session.removeAdapted(ui.active));
  else if (k === "z") { const lv = s.zoom.niveau === 100 ? 150 : s.zoom.niveau === 150 ? 200 : 100; res(session.setZoom(lv, s.zoom.region)); }
  else return;
  e.preventDefault();
}

// ------------------------------------------------------------------ minuteurs et indicateurs
function tick() {
  if (!session) return;
  const s = session.s;
  checkLiaisonLoss();
  if (app.dataset.view === "setup") { const f = $(".footer-card .msg"); updateIndicators(); return; }
  if (trainer && TRAINING() && trainer.update()) trainer.sync($(".sim-card"));
  if (tour && tour.active) tour.place();
  const tm = timing(s, session.now(), { total_work_min: cfg.total_work_min || outil.total_work_min, warn_ratio: outil.alerts.warn_ratio });
  if (!tm) return;
  $("[data-tb=elapsed] .tb-digits") && ($("[data-tb=elapsed] .tb-digits").textContent = fmtHM(tm.elapsed));
  for (const [id, b] of [["step", tm.step], ["global", tm.global]]) {
    const n = $(`[data-tb=${id}]`); if (!n) continue;
    if (!b) { n.querySelector(".tb-digits").textContent = "--:--"; n.querySelector(".tb-state").textContent = ""; n.querySelector(".tb-fill").style.width = "0"; n.className = "tb"; continue; }
    n.className = "tb " + b.level + (tm.paused ? " paused" : "");
    n.querySelector(".tb-digits").textContent = b.level === "over" ? t("time.overfmt", { t: fmtMS(b.overMs) }) : fmtMS(b.remaining);
    n.querySelector(".tb-fill").style.width = (b.ratio * 100) + "%";
    n.querySelector(".tb-state").textContent = tm.paused ? t("time.paused") : t("time.lvl." + b.level);
  }
  updateIndicators();
}
let lostSince = null;
function checkLiaisonLoss() { if (session && session.s.status !== "setup") { if (!sceneAlive() && sceneSeen) checkLiaison(); } }
function updateIndicators() {
  const save = $(".ind.save"), scn = $(".ind.scene");
  if (backup && save) {
    const st = backup.status();
    save.className = "ind save " + st;
    const ico = st === "ok" ? "check" : st === "off" || st === "none" ? "circle" : "warn";
    const txt = st === "ok" ? t("save.ok", { at: fmtClock(backup.lastSaved) }) : st === "none" ? t("save.none") : st === "error" ? t("save.error", { msg: backup.error }) : st === "stale" ? t("save.stale") : t("save.off");
    save.replaceChildren(el("span", { class: "ico " + ico, "aria-hidden": "true" }), el("span", { class: "save-txt" }, txt + (backup.mode ? " (" + t("save.mode." + backup.mode) + ")" : "")));
  }
  if (scn) {
    const al = sceneAlive(); scn.className = "ind scene " + (al ? "ok" : "warn");
    scn.replaceChildren(el("span", { class: "ico " + (al ? "check" : "warn"), "aria-hidden": "true" }), el("span", {}, t(al ? "scene.on" : "scene.off")));
  }
  // Bandeau d'alertes en cours de séance, avec les boutons de réparation. Reconstruit seulement au changement d'état (un clic n'est jamais perdu).
  const box = $(".alerts");
  if (box && session && backup) {
    const st = backup.status(), live = session.s.status === "running" || session.s.status === "paused";
    const saveNeed = session.s.status !== "setup" && ["error", "off", "stale"].includes(st), sceneNeed = live && !sceneAlive();
    const sig = [saveNeed, st, backup.mode, sceneNeed].join(":");
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      const items = [];
      if (saveNeed) items.push(el("div", { class: "alert bad", role: "alert" }, el("span", { class: "ico warn", "aria-hidden": "true" }),
        el("div", { class: "alert-txt" }, el("strong", {}, $(".ind.save .save-txt")?.textContent || ""), el("span", {}, t("alert.save.hint"))),
        el("div", { class: "alert-act" },
          TRAINING() ? btn("save.rechoose", () => { backup.useMemory(cfg.fg_id); session.setBackup("memoire", null); }, { cls: "primary", data: { act: "rechoose-file" } }) :
          canWriteFiles() ? btn("save.rechoose", rechooseFile, { cls: "primary", data: { act: "rechoose-file" } }) : null,
          DEV && !TRAINING() ? btn("check.backup.opfs", async () => { await backup.useOPFS(`${cfg.fg_id}_test2.json`); session.setBackup("continu", backup.name); }, { data: { act: "rechoose-opfs" } }) : null,
          TRAINING() ? btn("check.backup.degrade", () => { backup.useMemory(cfg.fg_id); session.setBackup("memoire", null); }, { data: { act: "to-degrade" } }) :
          backup.mode !== "degrade" ? btn("check.backup.degrade", () => { backup.useDegraded(`${cfg.fg_id}_${header.session_id.slice(-15)}`); session.setBackup("degrade", null); backup.snapshot(); }, { data: { act: "to-degrade" } }) : null)));
      if (sceneNeed) items.push(el("div", { class: "alert warn", role: "alert" }, el("span", { class: "ico warn", "aria-hidden": "true" }),
        el("div", { class: "alert-txt" }, el("strong", {}, t("alert.scene"))),
        el("div", { class: "alert-act" }, btn("scene.reopen", openScene, { cls: "primary", data: { act: "reopen-scene" } }))));
      box.replaceChildren(...items);
    }
  }
  const chk = $(".checks");
  if (chk && app.dataset.view === "setup") {
    const sig = JSON.stringify([ui.loading, lib && lib.errors.length, session && session.s.backup.mode, session && session.s.sync.audio, sceneAlive(), backup && backup.name, sceneInfo && sceneInfo.hashes ? 1 : 0]);
    if (sig === ui.sig) return;
    ui.sig = sig;
    chk.replaceWith(checksTable());
    const f = $(".footer-card"); if (f) f.replaceWith(setupFooter());
  }
}
boot();
