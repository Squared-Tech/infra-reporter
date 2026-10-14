"use client";

import { useState } from "react";
import { TileLayer } from "react-leaflet";

// tile.openstreetmap.org answers rate-limited clients with blank tiles, which
// renders as a grey map, so it is the last resort rather than the default.
const PROVIDERS = [
  {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    subdomains: "abcd",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    subdomains: "",
    attribution: "Tiles &copy; Esri, &copy; OpenStreetMap",
  },
  {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    attribution: "&copy; OpenStreetMap",
  },
];

export default function MapTiles() {
  const [failures, setFailures] = useState(0);
  const p = PROVIDERS[Math.min(failures, PROVIDERS.length - 1)];
  return (
    <TileLayer
      key={p.url}
      url={p.url}
      subdomains={p.subdomains}
      attribution={p.attribution}
      eventHandlers={{ tileerror: () => setFailures((n) => n + 1) }}
    />
  );
}
