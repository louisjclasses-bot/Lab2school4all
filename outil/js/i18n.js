// Chaînes : i18n/<langue>.json, entrées {text, context, status, version}.
let dict = {}, current = "fr";
export async function loadStrings(lang) {
  const r = await fetch(new URL("../i18n/" + lang + ".json", import.meta.url), { cache: "no-cache" });
  const j = await r.json();
  dict = j.strings; current = lang;
  document.documentElement.lang = lang;
  return j._meta;
}
export const lang = () => current;
export function t(id, params) {
  const e = dict[id];
  if (!e) return "[" + id + "]";
  return e.text.replace(/\{(\w+)\}/g, (m, k) => (params && k in params ? params[k] : m));
}
export function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(e => { e.textContent = t(e.dataset.i18n); });
  root.querySelectorAll("[data-i18n-title]").forEach(e => { e.title = t(e.dataset.i18nTitle); });
  root.querySelectorAll("[data-i18n-aria]").forEach(e => { e.setAttribute("aria-label", t(e.dataset.i18nAria)); });
  root.querySelectorAll("[data-i18n-ph]").forEach(e => { e.placeholder = t(e.dataset.i18nPh); });
}
