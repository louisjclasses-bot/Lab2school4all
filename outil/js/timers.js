// Indicateurs de temps : toujours calculés à partir des horodatages (jamais par incrément).
import { currentPhase } from "./state.js";

function level(remaining, planned, warnRatio) {
  if (remaining < 0) return "over";
  return remaining <= planned * warnRatio ? "warn" : "ok";
}
function block(plannedMs, activeMs, warnRatio) {
  const remaining = plannedMs - activeMs;
  return { planned: plannedMs, active: activeMs, remaining, overMs: Math.max(0, -remaining), level: level(remaining, plannedMs, warnRatio),
    ratio: plannedMs > 0 ? Math.max(0, Math.min(1, remaining / plannedMs)) : 0 };
}
export function timing(s, nowMs, opts) {
  if (!s.go) return null;
  const end = s.endMs ?? nowMs;
  const now = Math.min(nowMs, end);
  const paused = s.pausedTotalMs + (s.pausedSince ? now - s.pausedSince : 0);
  const elapsed = now - s.go;                          // horloge continue, pauses comprises
  const warn = opts.warn_ratio ?? 0.15;
  const glob = block(opts.total_work_min * 60000, elapsed - paused, warn);
  const p = currentPhase(s);
  let step = null;
  if (p && p.started && !p.ended) step = block(p.planned_min * 60000, (now - p.started) - (paused - p.paused_at_start), warn);
  return { elapsed, global: glob, step, paused: s.status === "paused" };
}
export function phaseActiveMs(s, nowMs) {
  const p = currentPhase(s);
  const paused = s.pausedTotalMs + (s.pausedSince ? nowMs - s.pausedSince : 0);
  return (nowMs - p.started) - (paused - p.paused_at_start);
}
