// Console du modérateur : tient l'état, le journal, les minuteurs, la sauvegarde. Tous les textes viennent de i18n.
import { loadStrings, applyI18n, t, lang as curLangFn } from "./i18n.js";
import { CardLibrary, cardsBase, fetchJSON } from "./cards.js";
import { Link } from "./link.js";
import { Stage } from "./stage.js";
import { Store } from "./store.js";
import { Backup, canWriteFiles } from "./backup.js";
import { Session } from "./session.js";
import { sceneView, consoleView } from "./view.js";
import { currentPhase, phaseCardId, presentCount, placedTokens, effectifsEffectifs, CALIB, groupZoom, needsZoom } from "./state.js";
import { timing } from "./timers.js";
import { el, CASES, seededShuffle, sha256Text, displayInfo, fmtHM, fmtMS, fmtClock, pad2 } from "./util.js";
import { Trainer, loadScenario } from "./training.js";
import { Tour } from "./tour.js";
import { ObsRecorder } from "./obs_rec.js";

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
let obs = null;                                  // enregistrement de secours via OBS (absent en entraînement)
const toured = new Set();
const TRAINING = () => !!(cfg && cfg.entrainement);
const previewBox = el("div", { class: "preview-box" });
const notesBox = el("div", { class: "card notes-card" });
const presentsBox = el("div", { class: "card presents-card" });

// Signal de présence de la scène (toutes les 2 s). Il ne doit jamais reconstruire l'interface : seuls les voyants sont mis à jour en place.
// La vue n'est renvoyée à la scène que si ce qu'elle annonce a changé (nouvelle scène, langue, cartes) ou si elle était absente.
let helloSig = "";
const link = new Link(m => {
  if (m.k === "hello") {
    const wasAlive = sceneAlive(); sceneSeen = Date.now(); sceneInfo = m;
    const sig = JSON.stringify([m.hashes, m.lang, m.errors && m.errors.length, m.total]);
    // La scène annonce la dernière vue reçue : si elle n'est pas la dernière envoyée (message perdu ou retardé), elle est renvoyée sans attendre un changement.
    const behind = rev > 0 && (m.epoch !== epoch || m.rev !== rev);
    if (sig !== helloSig || !wasAlive || behind) { helloSig = sig; pushView(true); }
    checkLiaison(); updateIndicators();
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
  if (Q.has("diag")) import("./diag.js").then(m => m.startDiag(() => stats));          // ?diag=1 : journal des rechargements, du focus et des reconstructions
  // Fermer la console pendant que l'enregistrement de secours tourne : le navigateur demande confirmation (texte imposé par le navigateur).
  window.addEventListener("beforeunload", e => { if (obs && obs.recording) { e.preventDefault(); e.returnValue = ""; } });
  setInterval(tick, 250);
  renderSetup();
  if (DEV) window.__fg = { get session() { return session; }, get backup() { return backup; }, store, get lib() { return lib; }, get stage() { return stage; }, ui, boot: { selectConfig, validateEvent }, get cfg() { return cfg; }, get obs() { return obs; }, stats, setClock: f => { if (session) session.clock = f; } };
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
    reference_profile: outil.reference_profile, display: displayInfo(), cards_base: lib.base, descriptions: lib.descriptionsInfo,
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
  lastSceneView = lastConsoleView = "";
  obs && obs.dispose();
  obs = header.entrainement ? null : new ObsRecorder({ session: sess, host: outil.obs.host, port: outil.obs.port, pollMs: outil.obs.poll_s * 1000, reconnectMs: outil.obs.reconnect_s * 1000, onChange: obsChanged,
    onConnected: o => { if (!header.entrainement && session.s.status !== "ended") store.putSession({ id: header.session_id, header, status: "en_cours", updated: Date.now(), obs: o }); } });
  previewBox.replaceChildren();
  stage = new Stage(previewBox, { cards: lib, interactive: true, fit: "container", onAction: onStageAction });
}

function onEvent(ev) {
  if (!header.entrainement) store.appendEvent(header.session_id, ev);
  // Description de l'exercice : consignée (carte, langue, heure d'affichage) quand la carte originale est présentée au tri.
  if (ev.type === "carte_debut" && ev.data.phase === "tri" && lib && lib.description(ev.data.carte)) session.dispatch("description_affichee", { carte: ev.data.carte, langue: lib.description(ev.data.carte).lang });
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
let lastSceneView = "", lastConsoleView = "";
function pushView(force = false) {
  if (!session) return;
  const v = { ...sceneView(session.s, cfg.language), entrainement: TRAINING() }, sj = JSON.stringify(v);
  if (force || sj !== lastSceneView) { lastSceneView = sj; link.send({ k: "view", epoch, rev: ++rev, view: v }); }
  if (stage) { const cv = consoleView(session.s, cfg.language, ui), cj = JSON.stringify(cv); if (force || cj !== lastConsoleView) { lastConsoleView = cj; stage.update(cv); } }
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
  startRecordingOnOpen();
}
// Première ouverture de la scène : connexion si besoin, puis StartRecord. Ne bloque jamais l'ouverture.
async function startRecordingOnOpen() {
  if (!obs || obs.used || obs.without) return;
  if (!obs.client.connected && obs.link === "idle") await obs.connect();
  if (obs.client.connected && !obs.used) { const r = await obs.start(); if (!r.ok && r.reason === "deja_en_cours") renderIf(); }
}
// Bandeau d'alerte OBS : arrêt inattendu, démarrage manqué ou OBS injoignable. Le champ de mot de passe n'apparaît que si la liaison en a besoin.
function obsAlert(kind) {
  const needPw = !obs.client.connected && (!obs.hasPassword || obs.link === "auth");
  const msg = kind === "arrete" ? "obs.alert.arrete" : kind === "pas_demarre" ? "obs.alert.pas_demarre" : needPw ? "obs.alert.auth" : "obs.alert.injoignable";
  const hint = kind === "arrete" ? "obs.alert.arrete.hint" : kind === "injoignable" && !needPw ? "obs.alert.injoignable.hint" : null;
  const shortMsg = msg + ".short";
  const pw = el("input", { id: "obs-alert-pw", type: "password", autocomplete: "off", "aria-label": t("obs.alert.password"), placeholder: t("obs.alert.password"), onkeydown: e => { if (e.key === "Enter") reconnect(); } });
  const reconnect = () => obs.connect(pw.value);
  const act = [];
  if (needPw) act.push(pw, btn("obs.reconnect", reconnect, { cls: "primary", data: { act: "obs-reconnect" } }));
  if (kind !== "injoignable" || obs.client.connected) act.push(btn("obs.relaunch", async () => { await obs.start(); obsChanged(); }, { cls: "primary", disabled: !obs.client.connected, data: { act: "obs-relaunch" } }));
  return el("div", { class: "alert " + (kind === "arrete" ? "bad" : "warn"), role: "alert", dataset: { obs: kind }, title: t(msg) + (hint ? " " + t(hint) : "") }, el("span", { class: "ico warn", "aria-hidden": "true" }),
    el("div", { class: "alert-txt" }, el("strong", {}, t(shortMsg))), el("div", { class: "alert-act" }, ...act));
}
function obsChanged() {
  if (!session) return;
  updateIndicators();
  const sig = obs ? [obs.recording, obs.used, obs.client.connected, session.s.status].join(":") : "";
  if (session.s.status === "ended" && sig !== ui.obsEndSig) { ui.obsEndSig = sig; renderRun(); }
}

// ------------------------------------------------------------------ rendu
// Rendu complet de la console. Garde-fous : jamais entre le mousedown et le mouseup (le clic serait perdu), et le focus, la position du curseur
// et le défilement sont restitués. Les compteurs servent aux tests de stabilité (__fg.stats).
const stats = { renders: 0, setups: 0, deferred: 0 };
let pointerDown = false, renderPending = false, downAt = 0;
const pressed = () => pointerDown && performance.now() - downAt < 3000;        // un appui jamais relâché ne doit pas bloquer l'affichage
const releasePointer = () => { if (!pointerDown) return; pointerDown = false; if (renderPending) { renderPending = false; setTimeout(() => renderIf(), 0); } };
document.addEventListener("pointerdown", () => { pointerDown = true; downAt = performance.now(); }, true);
document.addEventListener("pointerup", releasePointer, true); document.addEventListener("pointercancel", releasePointer, true); window.addEventListener("blur", releasePointer);
const kebab = s => s.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
function focusKey(e) {
  if (e.id) return "#" + e.id;
  const d = Object.entries(e.dataset || {}); if (!d.length) return null;
  return e.tagName.toLowerCase() + d.map(([k, v]) => `[data-${kebab(k)}="${String(v).replace(/"/g, '\\"')}"]`).join("");
}
function keepState(fn) {
  const a = document.activeElement, key = a && a !== document.body ? focusKey(a) : null;
  const sel = a && typeof a.selectionStart === "number" ? [a.selectionStart, a.selectionEnd] : null;
  const sy = [window.scrollX, window.scrollY], sim = document.querySelector(".sim-lines");
  const simTop = sim ? sim.scrollTop : null, simAtEnd = sim ? sim.scrollHeight - sim.scrollTop - sim.clientHeight < 4 : false;
  fn();
  const sim2 = document.querySelector(".sim-lines"); if (sim2 && simTop !== null) sim2.scrollTop = simAtEnd ? sim2.scrollHeight : simTop;
  const b = key && document.querySelector(key);
  if (b && b !== document.activeElement) { b.focus({ preventScroll: true }); if (sel && typeof b.setSelectionRange === "function") { try { b.setSelectionRange(sel[0], sel[1]); } catch (e) { /* champ sans curseur */ } } }
  if (sy[0] || sy[1]) window.scrollTo(sy[0], sy[1]);          // en dernier : rendre le focus ou le curseur visible peut faire défiler la page
}
// ---- ajustement de l'échelle : toute l'interface est en rem, donc changer la taille de police de la page la redimensionne d'un bloc.
// On cherche la plus grande échelle pour laquelle la console tient dans la fenêtre sans défilement (recherche dichotomique, une seule peinture).
const FIT = { max: 1.25, min: 0.6, step: 0.025 };
function fitUi() {
  const root = document.documentElement;
  const fits = z => { root.style.fontSize = (16 * z) + "px"; return root.scrollHeight <= window.innerHeight && root.scrollWidth <= window.innerWidth; };
  const n = Math.round((FIT.max - FIT.min) / FIT.step); let lo = 0, hi = n;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (fits(FIT.max - mid * FIT.step)) hi = mid; else lo = mid + 1; }
  const z = FIT.max - lo * FIT.step; fits(z); ui.zoomUi = Math.round(z * 1000) / 1000;
  stage && stage._scale();
}
let fitRaf = 0;
function scheduleFit() { if (fitRaf) return; fitRaf = requestAnimationFrame(() => { fitRaf = 0; fitUi(); }); }
window.addEventListener("resize", scheduleFit);
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
function renderSetup() { if (pressed()) { renderPending = true; stats.deferred++; return; } stats.setups++; keepState(doRenderSetup); fitUi(); }
function doRenderSetup() {
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
  const langRow = el("div", { class: "seg" }, ...["fr", "en"].map(l => el("button", { type: "button", class: "btn" + (cfg && cfg.language === l ? " on" : ""), dataset: { lang: l }, disabled: !cfg || TRAINING(),
    onclick: () => selectConfig(cfg, l) }, l.toUpperCase())));
  left.append(el("div", { class: "lang-row" }, el("span", { class: "lbl" }, t("setup.lang")), langRow));
  if (cfg) left.append(el("p", { class: "meta" }, t("setup.versions", { tool: outil.tool_version, guide: cfg.guide_version })));
  if (session) left.append(el("div", { class: "lbl" }, t("setup.present")), presentsRow());
  const right = el("section", { class: "card checks-card" }, el("h2", {}, t("setup.checks")), checksTable());
  const main = el("main", { class: "setup" });
  if (resumeList.length && !session) main.append(resumePanel());
  main.append(el("div", { class: "setup-a" }, left, TRAINING() ? null : learnCard()), el("div", { class: "setup-b" }, right, obs ? obsCard() : null), setupFooter());
  app.append(...[head, trainingBanner(), main].filter(Boolean));
  setTimeout(maybeTour, 0);
  updateIndicators();
}
// ---- enregistrement de secours (OBS) : carte de démarrage, construite une fois par affichage (les champs gardent leur saisie)
function obsReasonText(reason) { return t("check.obs.err." + (reason || "unreachable")); }
function obsCard() {
  const host = el("input", { id: "obs-host", type: "text", value: obs.host, autocomplete: "off", spellcheck: "false", oninput: e => obs.setSettings({ host: e.target.value }) });
  const port = el("input", { id: "obs-port", type: "number", value: String(obs.port), min: "1", max: "65535", oninput: e => obs.setSettings({ port: e.target.value }) });
  const pw = el("input", { id: "obs-pw", type: "password", value: "", autocomplete: "off", "aria-describedby": "obs-pw-hint", oninput: e => obs.setPassword(e.target.value),
    onkeydown: e => { if (e.key === "Enter") obsConnect(); } });
  const card = el("section", { class: "card obs-card", dataset: { check: "obs" } }, el("h2", {}, t("obs.card.title")), el("p", { class: "hint" }, t("obs.card.intro")),
    el("div", { class: "obs-form" }, el("div", {}, el("label", { for: "obs-host" }, t("obs.host")), host), el("div", { class: "obs-port" }, el("label", { for: "obs-port" }, t("obs.port")), port),
      el("div", {}, el("label", { for: "obs-pw" }, t("obs.password")), pw), btn("obs.connect", obsConnect, { cls: "primary", data: { act: "obs-connect" } })),
    el("p", { id: "obs-pw-hint", class: "hint" }, t("obs.password.hint")),
    el("div", { class: "obs-state" }, el("p", { class: "obs-status", role: "status", "aria-live": "polite" }), el("div", { class: "row obs-more" })));
  updateObsCard(card);
  return card;
}
async function obsConnect() { await obs.connect(); }
function askWithout(onOk) { dialog({ title: t("obs.without.title"), body: t("obs.without.body"), ok: "obs.without.ok", onOk }); }
function updateObsCard(card = $(".obs-card")) {
  if (!card || !obs) return;
  const st = card.querySelector(".obs-status"), more = card.querySelector(".obs-more"), ck = obs.check, sig = [obs.link, ck.joignable, ck.reason, ck.dejaEnCours, obs.without, obs.used].join("|");
  card.querySelector("[data-act=obs-connect]").disabled = obs.link === "connecting" || obs.without || obs.used;
  if (more.dataset.sig === sig) return;
  more.dataset.sig = sig;
  const failed = ck.joignable === false, busy = ck.joignable && ck.dejaEnCours;
  let text = "", ico = "circle";
  if (obs.without) { text = t("obs.without.done"); }
  else if (obs.used) { text = t("check.obs.idle.started"); ico = "check"; }
  else if (obs.link === "connecting") text = t("obs.connecting");
  else if (failed) { text = obsReasonText(ck.reason); ico = "warn"; }
  else if (busy) { text = t("check.obs.idle.busy"); ico = "warn"; }
  else if (ck.joignable) { text = ck.version ? t("check.obs.link.ok", { v: ck.version }) : t("check.obs.link.ok.nov"); ico = "check"; }
  st.replaceChildren(...(text ? [el("span", { class: "ico " + ico, "aria-hidden": "true" }), el("span", {}, text)] : [])); scheduleFit();
  more.replaceChildren(...[(failed || busy) && !obs.without && !obs.used ? btn("", () => askWithout(() => obs.chooseWithout("injoignable")), { raw: t("obs.without"), data: { act: "obs-without" } }) : null,
    busy && !obs.without ? btn("obs.recheck", () => obs.recheck(), { data: { act: "obs-recheck" } }) : null].filter(Boolean));
}
function learnCard() {
  const lg = curLangFn();
  const link = (key, href, act) => el("a", { class: "btn", href, target: "_blank", rel: "noopener", dataset: { act } }, t(key));
  return el("section", { class: "card learn-card" }, el("h2", { title: t("learn.hint") }, t("learn.title")),
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
  return el("div", { class: "chk " + status, role: "group", dataset: { status } },
    el("span", { class: "chk-st" }, el("span", { class: "ico " + icon, "aria-hidden": "true" }), el("span", {}, t("check.st." + status))),
    el("span", { class: "chk-name" }, name), el("div", { class: "chk-body" }, el("div", { class: "chk-detail" }, detail), extra ? el("div", { class: "chk-act" }, extra) : null));
}
function checksTable() {
  const tb = el("div", { class: "checks" }), steps = el("div", { class: "chk-group steps" }), auto = el("div", { class: "chk-group auto" });
  const s = session ? session.s : null, d = displayInfo();
  const sect = txt => el("h3", { class: "chk-sect" }, txt);
  const step = (n, txt) => el("span", { class: "stepname" }, el("span", { class: "stepn", "aria-hidden": "true" }, String(n)), txt);
  // 1. Étapes à faire par le modérateur, dans l'ordre
  tb.append(steps); steps.append(sect(t("setup.steps")));
  const alive = sceneAlive();
  const tagged = (r, k) => { r.dataset.check = k; return r; };
  steps.append(tagged(row(alive ? "ok" : "todo", step(1, t("check.link")),
    el("span", {}, t(alive ? (sceneSame()?.length ? "check.link.diff" : "check.link.ok") : "check.link.todo"), el("span", { class: "hint block" }, t("check.link.share"))),
    btn("check.link.open", openScene, { disabled: !session, data: { act: "open-scene" } })), "link"));
  const bk = s && s.backup.mode;
  const bkDetail = el("span", {}, bk === "memoire" ? t("train.backup") : bk === "continu" ? t("check.backup.continu", { name: backup.name }) : bk === "degrade" ? t("check.backup.degrade.on") : t("check.backup.todo"));
  const bkBtns = el("div", { class: "row-btns" },
    btn("check.backup.choose", async () => { try { await backup.chooseFile(`${cfg.fg_id}_${new Date().toISOString().slice(0, 10)}.json`); session.setBackup("continu", backup.name); renderSetup(); } catch (e) { if (e.name !== "AbortError") toast(t("err.sauvegarde_fichier")); } }, { disabled: !session || !canWriteFiles(), data: { act: "choose-file" }, cls: canWriteFiles() ? "" : "" }),
    btn("check.backup.degrade", () => { backup.useDegraded(`${cfg.fg_id}_${new Date().toISOString().slice(0, 10)}`); session.setBackup("degrade", null); renderSetup(); }, { disabled: !session, data: { act: "degrade" } }),
    DEV ? btn("check.backup.opfs", async () => { await backup.useOPFS(`${cfg.fg_id}_test.json`); session.setBackup("continu", backup.name); renderSetup(); }, { data: { act: "opfs" } }) : null);
  steps.append(tagged(row(bk ? (bk === "degrade" ? "warn" : "ok") : "todo", step(2, t("check.backup")), bkDetail, TRAINING() ? null : bkBtns), "backup"));
  steps.append(tagged(row(s && s.sync.audio ? "ok" : "todo", step(3, t("check.sync")), s && s.sync.audio ? t("check.sync.done", { at: fmtClock(s.sync.audio) }) : t("check.sync.todo"),
    btn("check.sync.btn", () => { session.syncAudio(); renderSetup(); }, { disabled: !session, data: { act: "sync" } })), "sync"));
  // 2. Contrôles faits par l'outil
  tb.append(auto); auto.append(sect(t("setup.auto")));
  const cardsSt = ui.loading ? "wait" : !lib ? "todo" : lib.errors.length ? "ko" : "ok";
  auto.append(row(cardsSt, t("check.cards"), ui.loading ? t("check.cards.loading", ui.loading) : !lib ? t("check.cards.none") : lib.errors.length ? t("check.cards.err", { n: lib.errors.length, ids: lib.errors.map(e => e.id).join(", ") }) : t("check.cards.ok", { n: lib.loaded.size, total: lib.defs.length })));
  if (header) {
    const o = { source: header.order_source, seq: header.order_sequence, issue: header.order_issue };
    const txt = o.issue ? t("check.order." + o.issue, { id: o.seq || "", seed: cfg.order_seed }) : o.source === "sequence" ? t("check.order.seq", { id: o.seq }) : o.source === "config" ? t("check.order.config") : t("check.order.seed", { seed: cfg.order_seed });
    auto.append(row(o.issue ? "warn" : "ok", t("check.order"), txt));
  }
  if (obs) for (const r of obsRows()) auto.append(r);
  auto.append(row(d.arial_available ? "ok" : "warn", t("check.arial"), t(d.arial_available ? "check.arial.ok" : "check.arial.ko")));
  auto.append(row(d.window_w >= 1280 && d.window_h >= 600 ? "ok" : "warn", t("check.display"), t("check.display.detail", { w: d.window_w, h: d.window_h, r: d.pixel_ratio })));
  auto.append(row(typeof indexedDB !== "undefined" ? "ok" : "ko", t("check.store"), t(resumeList.length ? "check.store.resume" : "check.store.ok")));
  return tb;
}
function obsRows() {
  const ck = obs.check, v = obs.link;
  const linkSt = obs.without ? "warn" : v === "connecting" ? "wait" : ck.joignable === true ? "ok" : ck.joignable === false ? "ko" : "todo";
  const linkTxt = obs.without ? t("check.obs.link.none") : v === "connecting" ? t("check.obs.link.wait") : ck.joignable === true ? (ck.version ? t("check.obs.link.ok", { v: ck.version }) : t("check.obs.link.ok.nov")) : ck.joignable === false ? t("check.obs.short." + (ck.reason || "unreachable")) : t("check.obs.link.todo");
  const idleSt = obs.used ? "ok" : ck.joignable !== true ? "todo" : ck.dejaEnCours ? "warn" : "ok";
  const idleTxt = obs.used ? t("check.obs.idle.started") : ck.joignable !== true ? t("check.obs.idle.todo") : ck.dejaEnCours ? t("check.obs.idle.busy.short") : t("check.obs.idle.ok");
  return [row(linkSt, t("check.obs.link"), linkTxt), row(idleSt, t("check.obs.idle"), idleTxt)];
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
    btn("setup.go", goClicked, { cls: "primary big", disabled: m.length > 0, data: { act: "go" } }));
  return f;
}
// Go : si OBS ne l'enregistre pas encore, on tente de démarrer ; sinon le modérateur confirme explicitement de continuer sans (consigné).
async function goClicked() {
  if (obs && !obs.without && !obs.used) {
    if (!obs.client.connected && obs.link === "idle") await obs.connect();
    if (obs.client.connected) await obs.start();
    if (!obs.used) return dialog({ title: t("obs.go.title"), body: t("obs.go.body"), ok: "obs.without.ok", onOk: () => { obs.chooseWithout("go"); res(session.go()); } });
  }
  res(session.go());
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
  if (obs && rec.obs) obs.setSettings(rec.obs);     // adresse et port d'OBS avant le plantage (jamais le mot de passe)
  if (obs && obs.recording) obs.connect();         // sans mot de passe en mémoire : réussit seulement si OBS n'en demande pas ; sinon le bandeau le redemande
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
function renderRun() { if (pressed()) { renderPending = true; stats.deferred++; return; } stats.renders++; keepState(doRenderRun); fitUi(); }
function doRenderRun() {
  const s = session.s, p = currentPhase(s);
  app.dataset.view = "run";
  const cid = p ? phaseCardId(s, p.id) : null;
  const seqN = p && s.seq[p.id] ? s.seq[p.id].length : 0;
  const head = el("header", { class: "bar" },
    el("strong", {}, cfg.fg_id),
    el("span", { class: "phase-name" }, t("console.phase", { name: s.status === "ended" ? t("phase.end") : p ? t("phase." + p.id) : "" })),
    cid && p.module !== "tutoriel" && s.status !== "ended" ? el("span", { class: "counter" }, t("console.card", { n: s.cursor[p.id] + 1, total: seqN })) : null,
    groupZoom(s) > 100 && s.status !== "ended" ? el("span", { class: "counter zoomg-badge", role: "status" }, t("zoomg.badge", { n: groupZoom(s) })) : null,
    el("span", { class: "grow" }),
    btn("console.progress", showProgress, { data: { act: "progress" } }),
    btn(s.status === "paused" ? "console.resume" : "console.pause", () => res(s.status === "paused" ? session.resume() : session.pause()), { data: { act: "pause" }, cls: s.status === "paused" ? "warn" : "", disabled: s.status === "ended" }),
    btn("console.incident", () => { session.incident("technique"); toast(t("console.incident.logged", { at: fmtClock(Date.now()) })); }, { cls: "danger", data: { act: "incident" } }));
  const times = el("div", { class: "timebar" },
    el("div", { class: "tb elapsed", dataset: { tb: "elapsed" } }, el("div", { class: "tb-label" }, t("time.elapsed")), el("div", { class: "tb-digits" })),
    timeBlock("step"), timeBlock("global"), el("div", { class: "indicators" }, el("div", { class: "ind save" }), el("div", { class: "ind scene" }), obs ? el("div", { class: "ind obs" }) : null));
  const sim = trainer && TRAINING() && s.status !== "ended" ? trainer.panel() : null;     // en entraînement, les répliques passent en premier
  const left = el("div", { class: "col-left" }, el("section", { class: "card preview-card" }, el("h2", {}, t("console.preview")), previewBox), descriptionCard(s, p), zoomPanel());
  presentsBox.replaceChildren(el("h2", {}, t("console.present"), el("span", { class: "n" }, t("console.present.n", { n: presentCount(s), total: outil.participants.length }))), presentsRow());
  notesBox.replaceChildren(...notesContent());
  const mid = el("div", { class: "col-mid" }, phasePanel()), right = el("div", { class: "col-right" }, sim, presentsBox, notesBox, keysHelp());
  app.replaceChildren(...[head, trainingBanner(), times, el("div", { class: "alerts", "aria-live": "assertive" }), el("main", { class: "run" }, left, mid, right)].filter(Boolean));
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
    tutoriel: [[["Z"], "zoom"]],
    discussion: [[["N"], "next"], [["Z"], "zoom"]],
    jugement: [[["←", "→"], "shift"], [[R], "place"], [[ENT], "validate"], [["X"], "cycle"], [["D"], "dup"], [[DEL], "remove"], [["N"], "next"], [["Z"], "zoom"]]
  };
  const set = sets[p.module];
  if (!set) return null;
  return el("section", { class: "keys", "aria-labelledby": "keys-h" }, el("h2", { id: "keys-h" }, t("console.keys.title")),
    el("ul", { class: "keylist" }, ...set.map(([ks, a]) => el("li", {}, ...ks.map(k => el("kbd", {}, k)), el("span", {}, t("keyhelp." + a))))));
}
// Ce que l'exercice implique pour l'élève : à lire à voix haute, au tri seulement (jamais pour un exercice adapté). Les textes viennent de descriptions.json.
function descriptionCard(s, p) {
  if (!p || p.module !== "tri" || s.status === "ended") return null;
  const id = phaseCardId(s, "tri"), d = id && lib.description(id);
  if (!d) return null;
  return el("section", { class: "card desc-card", "aria-labelledby": "desc-h" }, el("h2", { id: "desc-h" }, t("desc.title")), el("p", { class: "desc-text", lang: d.lang }, d.text));
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
  if (s.status === "ended") { box.append(el("h2", {}, t("console.ended")), btn("console.export.restricted", exportRestricted, { data: { act: "export-restricted" } }), obsEndBlock() || ""); return box; }
  if (!p) return box;
  if (p.module === "plain") box.append(el("h2", {}, t("phase." + p.id)), el("p", {}, t("plain.hint." + p.id)));
  if (p.module === "tutoriel") panelTuto(box);
  if (p.module === "tri") panelTri(box);
  if (p.module === "discussion") panelDisc(box);
  if (p.module === "jugement") panelJuge(box);
  box.append(nextPhaseRow());
  return box;
}
// Fin de séance : l'enregistrement de secours ne s'arrête jamais tout seul, seulement par ce bouton, avec confirmation.
function obsEndBlock() {
  if (!obs || TRAINING()) return null;
  const o = session.s.enregistrement_secours, box = el("div", { class: "obs-end" }, el("h3", {}, t("obs.end.title")));
  if (!o.segments.length) { box.append(el("p", { class: "hint" }, t("obs.end.none"))); return box; }
  if (obs.recording) {
    box.append(el("p", { class: "hint" }, t("obs.end.running")),
      btn("obs.end.stop", () => dialog({ title: t("obs.end.stop.title"), body: t("obs.end.stop.body"), ok: "obs.end.stop.ok",
        onOk: async () => { const r = await obs.stop(); if (!r.ok) toast(t("obs.end.failed")); obsChanged(); renderRun(); } }), { cls: "primary", disabled: !obs.client.connected, data: { act: "obs-stop" } }));
  } else box.append(el("p", { class: "qstate ok" }, el("span", { class: "ico check", "aria-hidden": "true" }), t("obs.end.stopped")));
  box.append(el("p", {}, t("obs.end.files")), el("ul", { class: "obs-files" }, ...o.segments.map(sg => el("li", {}, t("obs.seg", { n: sg.n }) + " : " + (sg.fichiers.length ? sg.fichiers.join(", ") : t("obs.end.nofile"))))));
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
    btn("juge.undup", () => tk && res(session.removeAdapted(tk.id)), { key: t("key.del"), disabled: !tk || !tk.duplique_de, data: { act: "undup" } })));
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
// Calibration v0.2 : l'écran partagé montre un seul texte ; le modérateur demande à l'oral si on le lit bien et ne clique que pour une exception.
function panelTuto(box) {
  box.append(el("h2", {}, t("phase.tutoriel")), el("p", { class: "hint" }, t("tuto.console.releve")), releveTable());
  if (needsZoom(session.s)) box.append(zoomGroupBlock());
}
// Exceptions seulement : un bouton qui s'allume pour s'écarter de la valeur par défaut, et qui se rééteint (retour au défaut) au second clic.
const RELEVE_EXC = { appareil: [["tablette", "releve.tablette"]], taille: [["petit", "releve.petit"], ["grand", "releve.grand"]], besoin_zoom: [["oui", "releve.zoom.oui"]] };
function zoomGroupBlock() {
  const g = session.s.zoom_groupe;
  return el("div", { class: "zoomg" }, el("strong", {}, t("zoomg.title")),
    el("div", { class: "seg" }, ...[100, 150].map(n => el("button", { type: "button", class: "btn" + (g.niveau === n ? " on" : ""), "aria-pressed": String(g.niveau === n), dataset: { zoomg: n }, onclick: () => res(session.setZoomGroupe(n)) }, n + " %"))),
    el("p", { class: "hint" }, t("zoomg.hint")));
}
function releveTable() {
  const s = session.s;
  const tb = el("table", { class: "releve" }, el("thead", {}, el("tr", {}, el("th", {}, t("releve.p")), el("th", {}, t("releve.appareil")), el("th", {}, t("releve.taille")), el("th", {}, t("releve.zoom")))));
  const body = el("tbody");
  outil.participants.forEach(p => {
    const tr = el("tr", { class: s.present[p] ? "" : "absent" }, el("th", { scope: "row" }, p));
    Object.entries(RELEVE_EXC).forEach(([champ, opts]) => {
      tr.append(el("td", {}, el("div", { class: "tgl-group" }, ...opts.map(([valeur, key]) => {
        const on = s.releve[p][champ].valeur === valeur;
        return el("button", { type: "button", class: "btn tgl" + (on ? " on" : ""), "aria-pressed": String(on), "aria-label": p + " : " + t("releve." + champ) + " : " + t(key), dataset: { p, champ, valeur },
          onclick: () => res(session.setReleve(p, champ, on ? null : valeur)) }, t(key));
      }))));
    });
    body.append(tr);
  });
  tb.append(body); return el("div", { class: "releve-wrap" }, tb, el("p", { class: "hint" }, t("releve.legend")));
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
  const tri = p.module === "tri", jug = p.module === "jugement";
  if (/^[1-4]$/.test(k) && (tri || jug)) placeActive(CASES[+k - 1]);
  else if ((k === "arrowleft" || k === "arrowright") && jug) { const id = ui.active; if (id) res(session.shiftAdapted(id, k === "arrowleft" ? -1 : 1)); }
  else if (k === "enter" && jug) { if (ui.active) res(session.validateAdapted(ui.active)); }
  else if (k === "q" && p.module === "tri") { flushCounts(); res(session.confirmQuestion()); }
  else if (k === "n" && ["tri", "discussion", "jugement"].includes(p.module)) { flushCounts(); res(session.nextCard()); }
  else if (k === "s" && tri) { const toks = placedTokens(s.cards[phaseCardId(s, p.id)]); if (toks.length && toks.length < 4) { ui.active = "new"; pushView(); renderRun(); } }
  else if (k === "d" && jug && ui.active) dupActive(ui.active);
  else if (k === "x" && (tri || jug)) cycleActive();
  else if ((k === "delete" || k === "backspace") && tri && ui.active && ui.active !== "new") res(session.removeToken(ui.active));
  else if ((k === "delete" || k === "backspace") && jug && ui.active) res(session.removeAdapted(ui.active));
  else if (k === "z") { const lv = s.zoom.niveau === 100 ? 150 : s.zoom.niveau === 150 ? 200 : 100; res(session.setZoom(lv, s.zoom.region)); }
  else return;
  e.preventDefault();
}

// ------------------------------------------------------------------ minuteurs et indicateurs
// Écritures du DOM par les minuteries : seulement quand la valeur change (une écriture identique crée quand même une mutation)
const setText = (n, v) => { if (n && n.textContent !== v) n.textContent = v; };
const setClass = (n, v) => { if (n && n.className !== v) n.className = v; };
const setWidth = (n, v) => { if (n && n.style.width !== v) n.style.width = v; };
function setInd(node, cls, ico, text, textCls = "") {   // voyant : icône et texte mis à jour en place
  if (!node) return;
  setClass(node, cls);
  let i = node.firstElementChild, tx = i && i.nextElementSibling;
  if (!i || !tx) { i = el("span", { "aria-hidden": "true" }); tx = el("span", {}); node.replaceChildren(i, tx); }
  setClass(i, "ico " + ico); setClass(tx, textCls); if (!tx.className) tx.removeAttribute("class"); setText(tx, text);
}
function tick() {
  if (!session) return;
  const s = session.s;
  checkLiaisonLoss();
  if (app.dataset.view === "setup") { const f = $(".footer-card .msg"); updateIndicators(); return; }
  if (trainer && TRAINING() && trainer.update()) trainer.sync($(".sim-card"));
  if (tour && tour.active) tour.place();
  const tm = timing(s, session.now(), { total_work_min: cfg.total_work_min || outil.total_work_min, warn_ratio: outil.alerts.warn_ratio });
  if (!tm) return;
  setText($("[data-tb=elapsed] .tb-digits"), fmtHM(tm.elapsed));
  for (const [id, b] of [["step", tm.step], ["global", tm.global]]) {
    const n = $(`[data-tb=${id}]`); if (!n) continue;
    if (!b) { setText(n.querySelector(".tb-digits"), "--:--"); setText(n.querySelector(".tb-state"), ""); setWidth(n.querySelector(".tb-fill"), "0px"); setClass(n, "tb"); continue; }
    setClass(n, "tb " + b.level + (tm.paused ? " paused" : ""));
    setText(n.querySelector(".tb-digits"), b.level === "over" ? t("time.overfmt", { t: fmtMS(b.overMs) }) : fmtMS(b.remaining));
    setWidth(n.querySelector(".tb-fill"), Math.round(b.ratio * 1000) / 10 + "%");
    setText(n.querySelector(".tb-state"), tm.paused ? t("time.paused") : t("time.lvl." + b.level));
  }
  updateIndicators();
}
let lostSince = null;
function checkLiaisonLoss() { if (session && session.s.status !== "setup") { if (!sceneAlive() && sceneSeen) checkLiaison(); } }
function updateIndicators() {
  const save = $(".ind.save"), scn = $(".ind.scene");
  if (backup && save) {
    const st = backup.status();
    const ico = st === "ok" ? "check" : st === "off" || st === "none" ? "circle" : "warn";
    const txt = st === "ok" ? t("save.ok", { at: fmtClock(backup.lastSaved) }) : st === "none" ? t("save.none") : st === "error" ? t("save.error", { msg: backup.error }) : st === "stale" ? t("save.stale") : t("save.off");
    setInd(save, "ind save " + st, ico, txt + (backup.mode ? " (" + t("save.mode." + backup.mode) + ")" : ""), "save-txt");
  }
  if (scn) { const al = sceneAlive(), cov = al && sceneInfo && sceneInfo.visible === false; setInd(scn, "ind scene " + (al && !cov ? "ok" : "warn"), al && !cov ? "check" : "warn", t(cov ? "scene.hidden" : al ? "scene.on" : "scene.off")); }
  const ov = $(".ind.obs");
  if (ov && obs) {           // voyant de l'enregistrement de secours : texte et icône, sans couleur seule, sans animation
    const k = obs.view, good = k === "en_cours" || k === "termine";
    setInd(ov, "ind obs " + (good ? "ok" : k === "sans" ? "off" : "warn"), good ? "check" : k === "sans" ? "circle" : "warn", t("obs.v." + k));
  }
  // Bandeau d'alertes en cours de séance, avec les boutons de réparation. Reconstruit seulement au changement d'état (un clic n'est jamais perdu).
  const box = $(".alerts");
  if (box && session && backup) {
    const st = backup.status(), live = session.s.status === "running" || session.s.status === "paused";
    const saveNeed = session.s.status !== "setup" && ["error", "off", "stale"].includes(st), sceneNeed = live && !sceneAlive();
    const ov = obs && !TRAINING() && session.s.status !== "setup" ? obs.view : null;
    const obsNeed = ov === "injoignable" || ov === "arrete" || (ov === "pas_demarre" && live);
    const sig = [saveNeed, st, backup.mode, sceneNeed, obsNeed ? [ov, obs.client.connected, obs.hasPassword, obs.link === "auth"].join("/") : ""].join(":");
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      const items = [];
      if (saveNeed) items.push(el("div", { class: "alert bad", role: "alert", title: ($(".ind.save .save-txt")?.textContent || "") + " " + t("alert.save.hint") }, el("span", { class: "ico warn", "aria-hidden": "true" }),
        el("div", { class: "alert-txt" }, el("strong", {}, t("alert.save.short"))),
        el("div", { class: "alert-act" },
          TRAINING() ? btn("save.rechoose", () => { backup.useMemory(cfg.fg_id); session.setBackup("memoire", null); }, { cls: "primary", data: { act: "rechoose-file" } }) :
          canWriteFiles() ? btn("save.rechoose", rechooseFile, { cls: "primary", data: { act: "rechoose-file" } }) : null,
          DEV && !TRAINING() ? btn("check.backup.opfs", async () => { await backup.useOPFS(`${cfg.fg_id}_test2.json`); session.setBackup("continu", backup.name); }, { data: { act: "rechoose-opfs" } }) : null,
          TRAINING() ? btn("check.backup.degrade", () => { backup.useMemory(cfg.fg_id); session.setBackup("memoire", null); }, { data: { act: "to-degrade" } }) :
          backup.mode !== "degrade" ? btn("check.backup.degrade", () => { backup.useDegraded(`${cfg.fg_id}_${header.session_id.slice(-15)}`); session.setBackup("degrade", null); backup.snapshot(); }, { data: { act: "to-degrade" } }) : null)));
      if (sceneNeed) items.push(el("div", { class: "alert warn", role: "alert", title: t("alert.scene") }, el("span", { class: "ico warn", "aria-hidden": "true" }),
        el("div", { class: "alert-txt" }, el("strong", {}, t("alert.scene.short"))),
        el("div", { class: "alert-act" }, btn("scene.reopen", openScene, { cls: "primary", data: { act: "reopen-scene" } }))));
      if (obsNeed) items.push(obsAlert(ov));
      box.replaceChildren(...items); scheduleFit();
    }
  }
  const chk = $(".checks");
  if (chk && app.dataset.view === "setup") {
    const sig = JSON.stringify([ui.loading, lib && lib.errors.length, session && session.s.backup.mode, session && session.s.sync.audio, sceneAlive(), backup && backup.name, sceneInfo && sceneInfo.hashes ? 1 : 0, obs ? [obs.link, obs.check.joignable, obs.check.dejaEnCours, obs.without, obs.used] : null]);
    if (sig === ui.sig) return;
    ui.sig = sig;
    chk.replaceWith(checksTable());
    updateObsCard(); scheduleFit();
    const f = $(".footer-card"); if (f) f.replaceWith(setupFooter());
  }
}
boot();
