"use client";

import { useEffect, useState } from "react";
import { TileLayer } from "react-leaflet";

type Provider = {
  url: string;
  subdomains: string;
  attribution: string;
  probe: string;
};

// Z13 over Kabwe, a built-up area, so a genuine tile is always well above the
// size of the junk both known outages return.
const PROBE = { z: 13, x: 4743, y: 4428 };

const PROVIDERS: Provider[] = [
  {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>",
    probe: `https://a.tile.openstreetmap.org/${PROBE.z}/${PROBE.x}/${PROBE.y}.png`,
  },
  {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    subdomains: "",
    attribution: "Tiles &copy; Esri &copy; OpenStreetMap",
    probe: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${PROBE.z}/${PROBE.y}/${PROBE.x}`,
  },
  {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    subdomains: "",
    attribution: "Tiles &copy; Esri &copy; OpenStreetMap",
    probe: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${PROBE.z}/${PROBE.y}/${PROBE.x}`,
  },
];

// OSM answers a rate-limited client with a 103-byte blank tile and CARTO stamps
// a 2 KB "API KEY REQUIRED" tile, both over HTTP 200, so tileerror never fires
// and byte size is the only signal that catches them.
const MIN_REAL_TILE = 8000;

let ranked: Promise<number[]> | null = null;

async function works(i: number): Promise<boolean> {
  try {
    const res = await fetch(PROVIDERS[i].probe);
    if (!res.ok) return false;
    return (await res.blob()).size >= MIN_REAL_TILE;
  } catch {
    return false;
  }
}

function ranking(): Promise<number[]> {
  if (!ranked) {
    ranked = (async () => {
      const results = await Promise.all(PROVIDERS.map((_, i) => works(i)));
      const good = results.flatMap((ok, i) => (ok ? [i] : []));
      return good.length ? good : PROVIDERS.map((_, i) => i);
    })();
  }
  return ranked;
}

export default function MapTiles() {
  const [order, setOrder] = useState<number[]>([0, 1, 2]);
  const [failed, setFailed] = useState(0);

  useEffect(() => {
    let live = true;
    ranking().then((o) => {
      if (live && o[0] !== 0) setOrder(o.concat(o.filter((i) => !o.includes(i))));
    });
    return () => {
      live = false;
    };
  }, []);

  const p = PROVIDERS[order[Math.min(failed, order.length - 1)]];

  return (
    <TileLayer
      key={p.url}
      url={p.url}
      subdomains={p.subdomains}
      attribution={p.attribution}
      eventHandlers={{ tileerror: () => setFailed((n) => n + 1) }}
    />
  );
}
