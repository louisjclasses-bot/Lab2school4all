// Utilitaires sans texte visible.
export const CASES = ["facile", "moyen", "difficile", "impossible"];
export const ZONES = ["gauche", "centre", "droite"];

export async function sha256Hex(buf) {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export async function sha256Text(s) { return sha256Hex(new TextEncoder().encode(s)); }

// Graine texte -> générateur pseudo-aléatoire (mulberry32)
export function rngFromSeed(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (let i = 0; i < String(seed).length; i++) {
    h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (h = Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) ^ (h >>> 16);
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededShuffle(list, seed) {
  const r = rngFromSeed(seed), a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const pad2 = n => String(n).padStart(2, "0");
export function fmtMS(ms) {           // mm:ss (au moins)
  const s = Math.floor(Math.abs(ms) / 1000);
  return pad2(Math.floor(s / 60)) + ":" + pad2(s % 60);
}
export function fmtHM(ms) {           // hh:mm
  const m = Math.floor(Math.max(0, ms) / 60000);
  return pad2(Math.floor(m / 60)) + ":" + pad2(m % 60);
}
export function fmtClock(ms) {        // heure locale hh:mm:ss
  const d = new Date(ms);
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
}
export function isoNow(ms) { return new Date(ms).toISOString(); }
export function clone(o) { return JSON.parse(JSON.stringify(o)); }
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(e.dataset, v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
export function displayInfo() {
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? "windows" : /Mac OS X|Macintosh/.test(ua) ? "macos" : /Linux/.test(ua) ? "linux" : "autre";
  const br = /Edg\//.test(ua) ? "edge" : /Firefox\//.test(ua) ? "firefox" : /Chrome\//.test(ua) ? "chrome" : /Safari\//.test(ua) ? "safari" : "autre";
  let arial = false;
  try { arial = document.fonts && document.fonts.check ? document.fonts.check("16px Arial") : false; } catch (e) { /* ignoré */ }
  return { window_w: innerWidth, window_h: innerHeight, pixel_ratio: devicePixelRatio, os_family: os, browser_family: br, arial_available: arial };
}
