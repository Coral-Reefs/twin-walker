"use client";
import { useEffect, useRef, useState } from "react";
import {
  network,
  nodes,
  places,
  parking,
  park,
  school,
  type Place,
  type Point,
  type Result,
} from "@/lib/bbr/engine";
declare global {
  interface Window {
    L: any;
  }
}
let loading: Promise<void> | undefined;
function load() {
  if (window.L) return Promise.resolve();
  if (!loading)
    loading = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "/vendor/leaflet.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "/vendor/leaflet.js";
      s.onload = () => resolve();
      s.onerror = () => {
        loading = undefined;
        reject(new Error("Map library could not load"));
      };
      document.head.appendChild(s);
    });
  return loading;
}
export default function BBRMap({
  home,
  result,
  baseline,
  showParking,
  compare,
  active,
  selected,
  onSelect,
  onHome,
  pinHome,
  progress,
}: {
  home: Place;
  result: Result;
  baseline: Result;
  showParking: boolean;
  compare: boolean;
  active: string[];
  selected: Place | null;
  onSelect: (p: Place) => void;
  onHome: (p: Point) => void;
  pinHome: boolean;
  progress: number;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<any>(null),
    layers = useRef<any>(null),
    dot = useRef<any>(null),
    callbacks = useRef({ onSelect, onHome, pinHome });
  callbacks.current = { onSelect, onHome, pinHome };
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let resize: ResizeObserver;
    load()
      .then(() => {
        if (cancelled || !container.current) return;
        const L = window.L;
        const m = L.map(container.current, { zoomControl: false }).setView(
          [3.089, 101.432],
          15,
        );
        map.current = m;
        L.control.zoom({ position: "bottomright" }).addTo(m);
        L.control.scale({ position: "bottomleft", imperial: false }).addTo(m);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
          .addTo(m)
          .on("tileerror", () =>
            setError(
              "Background tiles unavailable. Study-area roads remain visible.",
            ),
          );
        for (const w of network.ways) {
          const pts = w.nodes
            .map((id) => nodes.get(id))
            .filter(Boolean)
            .map((n) => [n!.lat, n!.lon]);
          if (pts.length > 1)
            L.polyline(pts, {
              color: "#869c8f",
              weight: 1,
              opacity: 0.25,
              interactive: false,
            }).addTo(m);
        }
        L.rectangle(network.bounds, {
          color: "#4e7769",
          weight: 1,
          dashArray: "6 6",
          fillOpacity: 0,
          interactive: false,
        }).addTo(m);
        m.on("click", (e: any) => {
          if (callbacks.current.pinHome) {
            const { lat, lng } = e.latlng;
            if (lat < 3.08 || lat > 3.105 || lng < 101.415 || lng > 101.445) {
              setError("Choose a home inside the dashed study boundary.");
              return;
            }
            setError("");
            callbacks.current.onHome({ lat, lon: lng });
          }
        });
        layers.current = L.layerGroup().addTo(m);
        dot.current = L.circleMarker([home.lat, home.lon], {
          radius: 8,
          color: "#fff",
          weight: 3,
          fillColor: "#153d34",
          fillOpacity: 1,
        }).addTo(m);
        resize = new ResizeObserver(() => m.invalidateSize());
        resize.observe(container.current);
        setReady(true);
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
      resize?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !layers.current) return;
    const L = window.L,
      g = layers.current;
    g.clearLayers();
    const marker = (p: Place, text: string, kind: string) => {
      const el = document.createElement("div");
      el.textContent = p.name + " · " + p.source;
      L.marker([p.lat, p.lon], {
        icon: L.divIcon({
          className: "",
          html: `<span class="map-pin ${kind}">${text}</span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        title: p.name,
      })
        .bindTooltip(el)
        .on("click", () => callbacks.current.onSelect(p))
        .addTo(g);
    };
    for (const p of places.filter((p) => p.kind !== "home"))
      marker(
        p,
        p.kind === "school"
          ? "S"
          : p.kind === "park"
            ? "♧"
            : p.kind === "clinic"
              ? "+"
              : "·",
        "poi",
      );
    if (showParking) for (const p of parking) marker(p, "P", "parking");
    marker(home, "H", "home");
    if (compare)
      for (const s of baseline.segments)
        L.polyline(
          s.route.points.map((p) => [p.lat, p.lon]),
          {
            color: "#9b8069",
            weight: 5,
            dashArray: "7 8",
            opacity: 0.7,
            interactive: false,
          },
        ).addTo(g);
    for (const s of result.segments) {
      const line = L.polyline(
        s.route.points.map((p) => [p.lat, p.lon]),
        {
          color: s.mode === "drive" ? "#526ba2" : "#16674e",
          weight: s.mode === "drive" ? 5 : 4,
          dashArray: s.mode === "walk" ? "5 6" : undefined,
          opacity: 0.95,
        },
      ).addTo(g);
      const tip = document.createElement("span");
      tip.textContent = `${s.label} · ${s.minutes.toFixed(1)} min`;
      line.bindTooltip(tip);
    }
    if (active.includes("seating"))
      L.circle([park.lat, park.lon], {
        radius: 500,
        color: "#3c9472",
        fillOpacity: 0.12,
        weight: 1,
      })
        .bindTooltip("Proposed seating coverage · illustrative")
        .addTo(g);
    if (active.includes("crossing") || active.includes("pickup"))
      L.circle([school.lat, school.lon], {
        radius: 200,
        color: "#bd7b40",
        fillOpacity: 0.12,
        weight: 1,
      })
        .bindTooltip("Proposed school-area changes · illustrative")
        .addTo(g);
  }, [ready, home, result, baseline, showParking, compare, active]);
  useEffect(() => {
    if (ready && selected) map.current?.panTo([selected.lat, selected.lon]);
  }, [ready, selected]);
  useEffect(() => {
    if (!ready) return;
    let time = progress * result.segments.reduce((a, s) => a + s.minutes, 0);
    for (const s of result.segments) {
      if (time > s.minutes) {
        time -= s.minutes;
        continue;
      }
      const pts = s.route.points;
      let m = (s.minutes ? time / s.minutes : 0) * s.route.distance;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!,
          b = pts[i]!;
        const d = window.L.latLng(a.lat, a.lon).distanceTo([b.lat, b.lon]);
        if (m <= d) {
          const f = d ? m / d : 0;
          dot.current?.setLatLng([
            a.lat + (b.lat - a.lat) * f,
            a.lon + (b.lon - a.lon) * f,
          ]);
          return;
        }
        m -= d;
      }
      if (pts.length)
        dot.current?.setLatLng([pts.at(-1)!.lat, pts.at(-1)!.lon]);
      return;
    }
    dot.current?.setLatLng([home.lat, home.lon]);
  }, [ready, progress, result, home]);
  return (
    <>
      <div
        ref={container}
        className={"bbr-map " + (pinHome ? "pin-mode" : "")}
        aria-label="Interactive Bandar Bukit Raja map"
      />
      <button
        className="map-fit map-shadow"
        onClick={() =>
          map.current?.fitBounds(network.bounds, { padding: [35, 35] })
        }
      >
        ⌖ Fit study area
      </button>
      {error && (
        <div role="status" className="map-error">
          {error}
        </div>
      )}
    </>
  );
}
