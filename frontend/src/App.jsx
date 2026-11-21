import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import AssamMap from "./components/AssamMap.jsx";
import PrioritySidebar from "./components/PrioritySidebar.jsx";
import TelemetryCharts from "./components/TelemetryCharts.jsx";
import OrbitalModal from "./components/OrbitalModal.jsx";
import { localDashboard, localExtent } from "./data/orbitguardEngine.js";
import { fetchDashboard, fetchExtent, fetchHealth } from "./services/aiClient.js";
import { ramp } from "./lib/format.js";

const FUTURE = ["DROUGHT", "WILDFIRE", "CYCLONE", "LANDSLIDE"];
const TerrainRelief = lazy(() => import("./components/TerrainRelief.jsx"));

export default function App() {
  const [day, setDay] = useState(1);
  const [rainBoost, setRainBoost] = useState(0);
  const [agency, setAgency] = useState("ALL");
  const [layers, setLayers] = useState({ risk: true, uncertainty: false, extent: true });
  const [playing, setPlaying] = useState(false);
  const [orbital, setOrbital] = useState(false);
  // initialise immediately with local data so the UI never waits on the network
  const [dash, setDash] = useState(() => localDashboard(1, 0));
  const [extent, setExtent] = useState(() => localExtent(1, 0));
  const [health, setHealth] = useState(null);
  const [selectedId, setSelectedId] = useState(() => localDashboard(1, 0).districts[0].id);
  const reqId = useRef(0);

  // debounced backend refresh (250 ms) whenever day or rainBoost changes
  useEffect(() => {
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const [d, e] = await Promise.all([fetchDashboard(day, rainBoost), fetchExtent(day, rainBoost)]);
      if (id !== reqId.current) return; // stale response
      setDash(d);
      setExtent(e);
    }, 250);
    return () => clearTimeout(t);
  }, [day, rainBoost]);

  // instant local preview while the debounce/backend round-trip is in flight
  useEffect(() => {
    setDash((prev) => (prev.day === day && prev.rain_boost === rainBoost ? prev : localDashboard(day, rainBoost)));
    setExtent(localExtent(day, rainBoost));
  }, [day, rainBoost]);

  useEffect(() => {
    fetchHealth().then(setHealth);
  }, []);

  // auto-replay Day 1 -> 2 -> 3
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setDay((d) => (d % 3) + 1), 2500);
    return () => clearInterval(t);
  }, [playing]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT") return;
      if (["1", "2", "3"].includes(e.key)) setDay(Number(e.key));
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = useMemo(() => dash.districts.find((d) => d.id === selectedId) || dash.districts[0], [dash, selectedId]);
  const engineLabel = dash.engine === "fastapi-lgbm" ? "FASTAPI LGBM" : "LOCAL ENGINE";
  const m = health?.metrics;
  const toggle = (k) => setLayers((l) => ({ ...l, [k]: !l[k] }));

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-canvas text-ink">
      {/* TOP COMMAND BAR */}
      <header className="h-[58px] shrink-0 border-b border-line bg-panel flex items-center px-5 gap-5">
        <div className="flex items-baseline gap-3 shrink-0">
          <span className="brand-mark" aria-hidden="true">O</span>
          <span className="font-bold tracking-[0.16em] text-[14px] text-ink">ORBITGUARD</span>
          <span className="lbl max-xl:hidden">EARTH INTELLIGENCE</span>
        </div>
        <nav className="flex items-stretch h-full">
          <button className="px-3 text-[10px] font-semibold tracking-[0.1em] text-ink border-b-2 border-sar">FLOOD MONITOR</button>
          <button onClick={() => setOrbital(true)} className="px-3 text-[10px] tracking-[0.1em] text-dim hover:text-ink">
            ORBITAL CONTINUITY <span className="planned-chip">PLANNED</span>
          </button>
        </nav>
        <div className="flex gap-1 max-lg:hidden">
          {FUTURE.map((f) => (
            <span key={f} className="text-[9px] tracking-wider px-1.5 py-0.5 border border-line text-dim/70 rounded-sm" title="Planned module">
              {f}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4 num text-[11px] shrink-0">
          <span className="text-[9px] tracking-wider px-2 py-1 border border-mod/60 text-mod bg-mod/5">DEMO DATA</span>
          <span className="text-dim max-xl:hidden">ACTIVE ALERTS <b className="text-crit">{dash.summary.alerts}</b></span>
          <span className="px-1.5 py-0.5 border border-line text-dim text-[9px] tracking-wider">{engineLabel}</span>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <PrioritySidebar dash={dash} selectedId={selected.id} onSelect={setSelectedId} agency={agency} onAgency={setAgency} />

        {/* HERO MAP */}
        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-1 relative min-h-0">
            <AssamMap dash={dash} extent={extent} selectedId={selected.id} onSelect={setSelectedId} layers={layers} />
            <Suspense fallback={<div className="terrain-inset terrain-inset--loading"><span className="lbl">Loading 3D terrain view…</span></div>}>
              <TerrainRelief districts={dash.districts} selectedId={selected.id} onSelect={setSelectedId} />
            </Suspense>

            {/* HUD */}
            <div className="absolute top-4 left-4 z-[500] bg-panel/95 border border-line p-3 w-[294px] shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex border border-line rounded-sm overflow-hidden" role="tablist" aria-label="Forecast day">
                  {[1, 2, 3].map((d) => (
                    <button
                      key={d}
                      role="tab"
                      aria-selected={day === d}
                      onClick={() => setDay(d)}
                      className={`num px-2.5 py-1 text-[11px] whitespace-nowrap ${day === d ? "bg-elev text-ink" : "text-dim hover:text-ink"}`}
                    >
                      Day {d}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className="ml-auto flex items-center gap-1 px-2 py-1 border border-line rounded-sm text-[10px] tracking-wider hover:bg-elev"
                  aria-label={playing ? "Pause replay" : "Play replay"}
                >
                  {playing ? <Pause size={12} strokeWidth={1.5} /> : <Play size={12} strokeWidth={1.5} />}
                  {playing ? "PAUSE" : "PLAY"}
                </button>
              </div>
              <label className="block mt-2">
                <span className="flex justify-between lbl">
                  <span>Rain boost</span>
                  <span className="num text-ink normal-case">+{rainBoost} mm</span>
                </span>
                <input type="range" min={0} max={30} step={1} value={rainBoost} onChange={(e) => setRainBoost(Number(e.target.value))} className="w-full mt-1" aria-label="Rain boost in millimetres" />
              </label>
            </div>

            {/* LAYERS + RAMP */}
            <div className="absolute bottom-4 right-4 z-[500] bg-panel/95 border border-line p-3 w-[206px] shadow-sm">
              <div className="lbl mb-1">Layers</div>
              {[
                ["risk", "Risk forecast"],
                ["uncertainty", "Uncertainty bounds"],
                ["extent", "SAR flood extent (schematic)"],
              ].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 py-0.5 text-[11px] cursor-pointer">
                  <input type="checkbox" checked={layers[k]} onChange={() => toggle(k)} />
                  <span>{label}</span>
                </label>
              ))}
              <div className="mt-2">
                <div className="h-[6px] border border-line" style={{ background: `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(ramp).join(",")})` }} />
                <div className="flex justify-between num text-[9px] text-dim mt-0.5">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            <div className="absolute bottom-3 left-3 z-[500] text-[9px] tracking-wider text-dim bg-panel/90 border border-line px-1.5 py-1">
              <span className="text-mod">●</span> SCHEMATIC BOUNDARIES · ILLUSTRATIVE INPUTS
            </div>
          </div>
          <TelemetryCharts district={selected} day={day} />
        </main>
      </div>

      {/* STATUS FOOTER */}
      <footer className="h-7 shrink-0 border-t border-line bg-panel flex items-center justify-between px-3 num text-[9px] text-dim gap-4">
        <span className="truncate">
          FEEDS (PLANNED · SIMULATED): MOSDAC · BHUVAN · BHOONIDHI SAR · VEDAS · FALLBACK: GPM IMERG / SENTINEL-1
        </span>
        <span className="shrink-0">
          {m ? (
            <>
              HOLDOUT (SYNTHETIC, n={m.n_test}): F1 <b className="text-ink">{m.model_f1.toFixed(2)}</b> · BRIER <b className="text-ink">{m.brier_error.toFixed(3)}</b> · BAND COVERAGE{" "}
              <b className="text-ink">{m.band_coverage_pct.toFixed(0)}%</b> · SAR–BHUVAN OVERLAP n/a
            </>
          ) : (
            <>HOLDOUT METRICS: n/a (backend offline) · SAR–BHUVAN OVERLAP n/a</>
          )}
        </span>
      </footer>

      {orbital && <OrbitalModal onClose={() => setOrbital(false)} />}
    </div>
  );
}
