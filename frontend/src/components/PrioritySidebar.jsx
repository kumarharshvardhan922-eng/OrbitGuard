import { AGENCIES } from "../data/orbitguardEngine.js";
import { TIER_COLOR, TIER_LABEL, pm, rank2 } from "../lib/format.js";

const AGENCY_NAMES = { ALL: "ALL", SDRF: "SDRF", SDMA: "SDMA", DISTRICT: "DISTRICT", NGO: "NGO" };

export default function PrioritySidebar({ dash, selectedId, onSelect, agency, onAgency }) {
  const rows = dash.districts;
  return (
    <aside className="w-[340px] max-lg:w-[280px] shrink-0 border-r border-line bg-panel flex flex-col min-h-0">
      <div className="px-3 pt-3 pb-2 border-b border-line">
        <div className="lbl">Priority queue (risk × exposure)</div>
        <div className="mt-2 flex gap-px bg-line border border-line rounded-sm overflow-hidden" role="tablist" aria-label="Agency">
          {AGENCIES.map((a) => (
            <button
              key={a}
              role="tab"
              aria-selected={agency === a}
              onClick={() => onAgency(a)}
              className={`flex-1 py-1 text-[10px] tracking-wider ${agency === a ? "bg-elev text-ink" : "bg-panel text-dim hover:text-ink"}`}
            >
              {AGENCY_NAMES[a]}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-line">
        {rows.map((d) => {
          const sel = d.id === selectedId;
          return (
            <li key={d.id} className={sel ? "bg-elev" : ""}>
              <button
                onClick={() => onSelect(d.id)}
                className="w-full text-left flex items-stretch hover:bg-elev/70"
                aria-expanded={sel}
              >
                <span className="w-[3px] shrink-0" style={{ background: TIER_COLOR[d.tier] }} aria-hidden />
                <span className="num w-9 shrink-0 pl-2 py-2 text-dim text-[13px]">{rank2(d.rank)}</span>
                <span className="flex-1 min-w-0 py-2 pr-1">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-[12px] truncate">{d.name}</span>
                    <span className="text-[9px] tracking-wider px-1 border border-line rounded-sm" style={{ color: TIER_COLOR[d.tier] }}>
                      {TIER_LABEL[d.tier]}
                    </span>
                    {d.borderline && <span className="text-[9px] tracking-wider text-dim border border-dashed border-dim/60 px-1 rounded-sm">BORDERLINE</span>}
                  </span>
                  <span className="lbl block mt-0.5 normal-case tracking-normal">
                    exposure <span className="num text-ink">{d.exposure.toFixed(2)}</span> · priority <span className="num text-ink">{d.priority.toFixed(2)}</span>
                  </span>
                </span>
                <span className="py-2 pr-3 text-right shrink-0">
                  <span className="num block text-[13px]">{pm(d)}</span>
                  <span className="num block text-[10px] text-dim">{d.at_risk_lakh.toFixed(2)}L at risk</span>
                </span>
              </button>

              {sel && (
                <div className="pl-[3px] border-t border-line/60 bg-canvas/40">
                  <div className="px-3 py-2">
                    <div className="lbl mb-1">Action advisory · {agency}</div>
                    <ul className="space-y-1">
                      {d.advisories[agency].map((t, i) => (
                        <li key={i} className="flex gap-2 text-[11px] leading-snug">
                          <span className="num text-dim">{i + 1}</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="lbl mt-3 mb-1">Top risk drivers</div>
                    <ul className="space-y-1.5">
                      {d.drivers.map((r) => {
                        const w = Math.min(100, Math.abs(r.contribution) * 200);
                        const up = r.contribution >= 0;
                        return (
                          <li key={r.feature} className="text-[11px]">
                            <div className="flex justify-between">
                              <span>{r.label}</span>
                              <span className="num text-dim">
                                {r.value} {r.unit}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-[3px] bg-line">
                                <div style={{ width: `${w}%`, background: up ? "#e5484d" : "#38bdf8" }} className="h-full" />
                              </div>
                              <span className="num text-[10px] text-dim w-20 text-right">
                                {up ? "raises" : "lowers"} {up ? "+" : "−"}
                                {Math.abs(r.contribution).toFixed(2)}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-2 text-[10px] text-dim">
                      Rain {d.rain_daily_mm.join(" / ")} mm · cumulative <span className="num">{d.rain_cumulative_mm}</span> mm
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="px-3 py-2 border-t border-line text-[10px] text-dim leading-snug">
        Priority = P50 risk index × exposure score. BORDERLINE: the P10–P90 band spans two tiers. Exposure scores are illustrative.
      </div>
    </aside>
  );
}
