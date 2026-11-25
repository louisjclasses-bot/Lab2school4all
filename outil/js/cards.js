// Chargement des cartes depuis le manifeste : empreintes, préchargement, conservation en mémoire.
import { sha256Hex } from "./util.js";

export function cardsBase(outilCfg) {
  const q = new URLSearchParams(location.search).get("cards");
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const raw = q || (isLocal ? outilCfg.cards_base.dev : outilCfg.cards_base.prod);
  const abs = new URL(raw.endsWith("/") ? raw : raw + "/", location.href).href;
  return abs;
}
export async function fetchJSON(path) {
  const r = await fetch(new URL("../" + path, import.meta.url), { cache: "no-cache" });
  if (!r.ok) throw new Error(path + " : " + r.status);
  return r.json();
}

async function loadOne(url, type) {
  const r = await fetch(url, { cache: "no-cache" });          // revalidation : une modification sur GitHub est reprise
  if (!r.ok) throw new Error(r.status + " " + url);
  const buf = await r.arrayBuffer();
  const sha256 = await sha256Hex(buf);
  const blob = new Blob([buf], { type });
  const out = { source_url: url, sha256, bytes: buf.byteLength, etag: r.headers.get("etag"), last_modified: r.headers.get("last-modified"), url: URL.createObjectURL(blob) };
  if (type === "image/png") { const bm = await createImageBitmap(blob); out.w = bm.width; out.h = bm.height; bm.close && bm.close(); }
  return out;
}

export class CardLibrary {
  constructor(base, manifest, lang, { descriptions = true } = {}) {
    this.base = base; this.lang = lang; this.withDescriptions = descriptions;
    this.descriptions = {}; this.descriptionsInfo = { source: "aucune", sha256: null };
    this.defs = manifest.cards.filter(c => c.actif !== false);
    this.loaded = new Map(); this.errors = [];
  }
  ids() { return this.defs.map(c => c.id); }
  def(id) { return this.defs.find(c => c.id === id); }
  get(id) { return this.loaded.get(id); }
  label(id) { const d = this.def(id); return d ? (d.libelle[this.lang] || d.libelle.fr) : ""; }
  // Descriptions de ce que l'exercice implique pour l'élève (console seulement). Source unique : descriptions.json dans le dépôt des cartes (modifications reprises
  // comme pour les cartes). S'il n'y est pas encore, repli sur la copie de data/descriptions.fallback.json. Une carte sans description n'affiche rien, sans erreur.
  async loadDescriptions() {
    const read = async url => { const r = await fetch(url, { cache: "no-cache" }); if (!r.ok) throw new Error(String(r.status)); const buf = await r.arrayBuffer(); return { j: JSON.parse(new TextDecoder().decode(buf)), sha256: await sha256Hex(buf) }; };
    const ok = x => x && x.j && typeof x.j === "object" && !Array.isArray(x.j);
    let res = null, source = "depot";
    try { res = await read(new URL("descriptions.json", this.base).href); } catch (e) { res = null; }
    if (!ok(res)) { try { res = await read(new URL("../data/descriptions.fallback.json", import.meta.url).href); source = "local"; } catch (e) { res = null; } }
    if (!ok(res)) { this.descriptions = {}; this.descriptionsInfo = { source: "aucune", sha256: null }; return; }
    this.descriptions = res.j; this.descriptionsInfo = { source, sha256: res.sha256 };
  }
  description(id) { const d = this.descriptions[id], txt = d && d[this.lang]; return typeof txt === "string" && txt.trim() ? { lang: this.lang, text: txt } : null; }
  async preload(onProgress) {
    this.errors = []; let n = 0;
    const dp = this.withDescriptions ? this.loadDescriptions() : Promise.resolve();
    await Promise.all(this.defs.map(async d => {
      try {
        const f = d[this.lang];
        const [png, html] = await Promise.all([
          loadOne(new URL(f.png, this.base).href, "image/png"),
          loadOne(new URL(f.html, this.base).href, "text/html")]);
        this.loaded.set(d.id, { id: d.id, png, html });
      } catch (e) { this.errors.push({ id: d.id, message: String(e.message || e) }); }
      onProgress && onProgress(++n, this.defs.length);
    }));
    await dp;
    return { ok: this.errors.length === 0, loaded: this.loaded.size, total: this.defs.length, errors: this.errors };
  }
  hashes() {          // empreintes, dans l'ordre du manifeste
    const o = {};
    this.defs.forEach(d => { const c = this.loaded.get(d.id); if (c) o[d.id] = c.png.sha256 + ":" + c.html.sha256; });
    return o;
  }
  headerCards(order) {
    return order.map((id, i) => {
      const c = this.loaded.get(id); if (!c) return { id, rang: i + 1, erreur: true };
      const strip = ({ source_url, sha256, bytes, etag, last_modified }) => ({ source_url, sha256, bytes, etag, last_modified });
      return { id, rang: i + 1, png: strip(c.png), html: strip(c.html) };
    });
  }
}
