import { localDashboard, localExtent, localHealth } from "../data/orbitguardEngine.js";

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const TIMEOUT_MS = 2000;

async function getJSON(path, params) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Each call tries FastAPI first (2 s hard timeout) and silently falls back to the local engine. */
export async function fetchDashboard(day, rainBoost) {
  try {
    return await getJSON("/api/dashboard", { day, rain_boost: rainBoost });
  } catch {
    return localDashboard(day, rainBoost);
  }
}

export async function fetchExtent(day, rainBoost) {
  try {
    return await getJSON("/api/flood-extent", { day, rain_boost: rainBoost });
  } catch {
    return localExtent(day, rainBoost);
  }
}

export async function fetchHealth() {
  try {
    return await getJSON("/api/health");
  } catch {
    return localHealth();
  }
}
