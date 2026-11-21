import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ramp, pct, half } from "../lib/format.js";

/**
 * Vanilla Leaflet (no react-leaflet). The map is created once in an effect with a cleanup that removes it,
 * which keeps it safe under React 19 StrictMode's mount -> unmount -> mount cycle.
 */
export default function AssamMap({ dash, extent, selectedId, onSelect, layers }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const riskRef = useRef(null);
  const unRef = useRef(null);
  const sarRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const el = elRef.current;
    const map = L.map(el, { center: [26.65, 92.45], zoom: 7, zoomControl: false, attributionControl: true });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      subdomains: "abc",
      maxZoom: 12,
    }).addTo(map);
    sarRef.current = L.layerGroup().addTo(map);
    riskRef.current = L.layerGroup().addTo(map);
    unRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // risk choropleth + uncertainty bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dash) return;
    const byId = Object.fromEntries(dash.districts.map((d) => [d.id, d]));
    riskRef.current.clearLayers();
    unRef.current.clearLayers();

    dash.geojson.features.forEach((f) => {
      const d = byId[f.properties.id];
      if (!d) return;
      const sel = d.id === selectedId;
      const poly = L.geoJSON(f, {
        style: {
          color: sel ? "#162c3b" : "#fbfcfa",
          weight: sel ? 2.2 : 1.1,
          fillColor: layers.risk ? ramp(d.p_mid) : "#d9e2e3",
          fillOpacity: layers.risk ? 0.62 : 0.16,
        },
      });
      poly.on("click", () => onSelectRef.current(d.id));
      poly.bindTooltip(
        `<b>${d.name}</b><br/><span class="num">${pct(d.p_mid)} (${pct(d.p_low)}–${pct(d.p_high)})</span><br/><span class="num">#${d.rank} · ${d.tier}</span>`,
        { className: "og-tip", sticky: true }
      );
      riskRef.current.addLayer(poly);

      // district label (name + p_mid), always readable regardless of fill colour
      const label = L.marker(d.centroid, {
        interactive: false,
        icon: L.divIcon({
          className: "",
          iconSize: [0, 0],
          html: `<div style="transform:translate(-50%,-50%);text-align:center;white-space:nowrap;text-shadow:0 1px 2px #fff,0 0 4px #fff">
            <div style="font:700 10px Inter Variable,sans-serif;color:#162c3b">${d.name}</div>
            <div style="font:600 10px JetBrains Mono,monospace;color:#27495a">${pct(d.p_mid)}</div></div>`,
        }),
      });
      riskRef.current.addLayer(label);

      if (layers.uncertainty) {
        // dashed ring whose radius grows with band width (P90 - P10)
        const km = 8000 + d.uncertainty * 90000;
        unRef.current.addLayer(
          L.circle(d.centroid, { radius: km, color: "#314f5a", weight: 1, dashArray: "3 4", fill: false, opacity: 0.78, interactive: false })
        );
        unRef.current.addLayer(
          L.marker([d.centroid[0] - 0.17, d.centroid[1]], {
            interactive: false,
            icon: L.divIcon({
              className: "",
              iconSize: [0, 0],
              html: `<div class="num" style="transform:translate(-50%,0);font-size:9px;color:#162c3b;white-space:nowrap;text-shadow:0 1px 3px #fff">±${Math.round(half(d) * 100)}</div>`,
            }),
          })
        );
      }
    });
  }, [dash, selectedId, layers.risk, layers.uncertainty]);

  // SAR extent overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    sarRef.current.clearLayers();
    if (layers.extent && extent) {
      sarRef.current.addLayer(
        L.geoJSON(extent, { style: { color: "#087f9e", weight: 1.5, fillColor: "#38b4cf", fillOpacity: 0.34 }, interactive: false })
      );
    }
  }, [extent, layers.extent]);

  return <div ref={elRef} className="absolute inset-0" />;
}
