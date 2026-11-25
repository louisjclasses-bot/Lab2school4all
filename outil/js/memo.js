// Aide-mémoire du modérateur : une page A4 à imprimer, en français ou en anglais. Tous les textes viennent des chaînes (TRAPD).
import { loadStrings, applyI18n, t } from "./i18n.js";
import { el } from "./util.js";

const LANG = new URLSearchParams(location.search).get("lang") === "en" ? "en" : "fr";
const root = document.getElementById("memo");
const list = (tag, keys) => el(tag, {}, ...keys.map(k => el("li", {}, t(k))));
const keyRows = rows => el("table", { class: "keys" }, el("tbody", {}, ...rows.map(([ks, a]) => el("tr", {}, el("th", { scope: "row" }, ...ks.map(k => el("kbd", {}, k))), el("td", {}, t("keyhelp." + a))))));

async function boot() {
  await loadStrings(LANG); applyI18n();
  const outil = await (await fetch("config/outil.json", { cache: "no-cache" })).json();
  const R = t("keyhelp.range"), DEL = t("key.del"), ENT = t("key.enter");
  const tri = [[[R], "place"], [["S"], "second"], [["X"], "cycle"], [[DEL], "remove"], [["Q"], "question"], [["N"], "next"], [["Z"], "zoom"]];
  const jug = [[["←", "→"], "shift"], [[R], "place"], [[ENT], "validate"], [["X"], "cycle"], [["D"], "dup"], [[DEL], "remove"], [["R"], "ghost"], [["N"], "next"]];
  const inc = ["scene", "save", "crash", "tech"];
  root.append(
    el("header", {}, el("div", {}, el("h1", {}, t("memo.title")), el("p", { class: "sub" }, t("memo.sub", { v: outil.tool_version }))),
      el("nav", { class: "noprint" }, el("a", { href: "?lang=fr", "aria-current": LANG === "fr" ? "page" : "false", lang: "fr" }, "FR"), el("a", { href: "?lang=en", "aria-current": LANG === "en" ? "page" : "false", lang: "en" }, "EN"),
        el("button", { type: "button", onclick: () => print() }, t("memo.print")))),
    el("main", {},
      el("section", {}, el("h2", {}, t("memo.before")), list("ol", ["memo.before.1", "memo.before.2", "memo.before.3", "memo.before.4"]),
        el("h2", {}, t("memo.during")), list("ul", ["memo.during.1", "memo.during.2", "memo.during.3", "memo.during.4", "memo.during.5"]),
        el("h2", {}, t("memo.after")), list("ul", ["memo.after.1", "memo.after.2"])),
      el("section", {}, el("h2", {}, t("memo.keys")),
        el("div", { class: "keycols" }, el("div", {}, el("h3", {}, t("memo.phase.tri")), keyRows(tri)), el("div", {}, el("h3", {}, t("memo.phase.jug")), keyRows(jug))),
        el("h2", {}, t("memo.incidents")),
        el("table", { class: "inc" }, el("tbody", {}, ...inc.map(k => el("tr", {}, el("th", { scope: "row" }, t("memo.inc." + k)), el("td", {}, t("memo.inc." + k + ".do")))))))));
}
boot();
