/**
 * OrbitGuard Web Client API Service (frontend/src/services/aiClient.js).
 * ======================================================================
 * Strict Honesty Rule:
 * - In LIVE data mode (default), never falls back silently to mock.
 * - In MOCK data mode, every payload embeds status='mock' and unmissable warning.
 */

import { localDashboard, localExtent, localHealth } from "../data/orbitguardEngine.js";

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const IS_LIVE_MODE = (import.meta.env.VITE_DATA_MODE || "live").toLowerCase() !== "mock";
const TIMEOUT_MS = 4000;

async function getJSON(path, params = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const qs = new URLSearchParams(params).toString();
    const url = `${BASE}${path}${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(errBody.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Dashboard endpoint: fetches real 33-district model predictions. */
export async function fetchDashboard(period = "2022-06", lead = "1_month", day = 1, rainBoost = 0) {
  try {
    return await getJSON("/api/dashboard", { period, lead, day, rain_boost: rainBoost });
  } catch (err) {
    if (IS_LIVE_MODE) {
      console.warn("[OrbitGuard Live Mode] Backend request failed:", err);
      // In live mode, attempt canonical endpoint before failing
      try {
        const ranking = await getJSON("/ranking", { hazard: "flood", period, lead });
        const geom = await getJSON("/geometry", { hazard: "flood" });
        return {
          engine: "fastapi-lgbm",
          period,
          lead_wording: ranking.lead_wording,
          label_source: ranking.label_source,
          warning: ranking.warning,
          districts: ranking.ranking,
          geojson: geom,
          summary: {
            alerts: ranking.ranking.filter((r) => r.priority >= 0.02).length,
            high: ranking.ranking.filter((r) => r.priority >= 0.05).length,
            moderate: ranking.ranking.filter((r) => r.priority >= 0.02 && r.priority < 0.05).length,
            low: ranking.ranking.filter((r) => r.priority < 0.02).length
          }
        };
      } catch (err2) {
        console.error("[OrbitGuard Live Mode Error] Live data request failed:", err2);
        throw new Error(`Live model outputs unreachable at ${BASE}: ${err.message}. (Silent mock fallback disabled in LIVE mode).`);
      }
    }
    // Explicit mock fallback mode
    const mock = localDashboard(day, rainBoost);
    mock.engine = "local-mock";
    mock.label_source = "mock_generator";
    mock.warning = "MOCK DATA - not model output (Offline Demo Mode)";
    return mock;
  }
}

/** Extent GeoJSON layer */
export async function fetchExtent(period = "2019-07", day = 1, rainBoost = 0) {
  try {
    return await getJSON("/extent", { period });
  } catch (err) {
    if (IS_LIVE_MODE) {
      console.warn(`[OrbitGuard Extent] Live extent not found for ${period}:`, err.message);
      return null;
    }
    return localExtent(day, rainBoost);
  }
}

/** Health check */
export async function fetchHealth() {
  try {
    return await getJSON("/health");
  } catch (err) {
    if (IS_LIVE_MODE) {
      return {
        status: "offline",
        service: "orbitguard-early-warning-service",
        data_mode: "live",
        label_source: "none",
        warning: `Backend connection failed (${err.message})`,
        validated_files_count: 0
      };
    }
    return localHealth();
  }
}

/** Multi-Hazard catalog */
export async function fetchHazards() {
  return await getJSON("/hazards");
}

/** Precomputed chronological periods */
export async function fetchPeriods(hazard = "flood") {
  return await getJSON("/periods", { hazard });
}

/** Zone rankings */
export async function fetchRanking(hazard = "flood", period = "2022-06", lead = "1_month") {
  return await getJSON("/ranking", { hazard, period, lead });
}

/** Full operational advisories */
export async function fetchAdvisories(hazard = "flood", period = "2022-06", lead = "1_month") {
  return await getJSON("/advisories", { hazard, period, lead });
}

/** Executive overview */
export async function fetchOverview(hazard = "flood", period = "2022-06", lead = "1_month") {
  return await getJSON("/overview", { hazard, period, lead });
}

/** District or statewide timeline */
export async function fetchTimeline(zoneId = null, hazard = "flood") {
  const params = { hazard };
  if (zoneId) params.zone_id = zoneId;
  return await getJSON("/timeline", params);
}

/** Explainability drivers */
export async function fetchExplain(zoneId, period = "2022-06") {
  return await getJSON(`/explain/${zoneId}`, { period });
}

/** Model validation metrics and pitch deck claims table */
export async function fetchMetrics() {
  return await getJSON("/metrics");
}

/** Dataset provenance & audit findings */
export async function fetchProvenance() {
  return await getJSON("/provenance");
}

/** Canonical 33-district administrative boundaries */
export async function fetchGeometry(hazard = "flood") {
  return await getJSON("/geometry", { hazard });
}
