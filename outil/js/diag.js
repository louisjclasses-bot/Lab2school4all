// Interaction diagnostics (open the page with ?diag=1). Nothing is sent anywhere: everything stays in the browser console (Cmd+Option+J).
// It answers: does the page reload? does the window lose focus? is the interface rebuilt? Summary at any time: window.__diag.report()
export function startDiag(getStats) {
  const log = [], t0 = performance.now(), now = () => Math.round(performance.now() - t0);
  const note = (kind, extra = "") => { const l = `[diag] ${now()} ms ${kind} ${extra}`.trim(); log.push(l); console.info(l); };
  let loads = 0; try { loads = Number(sessionStorage.getItem("diag_loads") || 0) + 1; sessionStorage.setItem("diag_loads", String(loads)); } catch (e) { /* stockage indisponible */ }
  const nav = performance.getEntriesByType("navigation")[0];
  note("page load", `number ${loads || "?"} in this tab, type ${nav ? nav.type : "?"} (reload or navigate means the page was reloaded)`);
  window.addEventListener("blur", () => note("window loses focus"));
  window.addEventListener("focus", () => note("window regains focus"));
  document.addEventListener("visibilitychange", () => note("visibility", document.visibilityState));
  window.addEventListener("beforeunload", () => note("page unload"));
  let rebuilt = 0, last = { ...getStats() };
  new MutationObserver(list => { for (const m of list) if (m.type === "childList" && m.addedNodes.length && !m.target.closest?.(".tb, .ind, .indicators")) rebuilt++; })
    .observe(document.getElementById("app"), { subtree: true, childList: true });
  setInterval(() => { const s = getStats(); if (s.renders !== last.renders || s.setups !== last.setups) note("interface rebuilds", `console +${s.renders - last.renders}, start screen +${s.setups - last.setups}, deferred during a press ${s.deferred}`); last = { ...s }; }, 2000);
  window.__diag = { log, report: () => ({ chargements: loads, reconstructions_interface: rebuilt, stats: { ...getStats() }, evenements: log.slice(-30) }) };
}
