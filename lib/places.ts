export type Place = { name: string; emoji: string; kind: string; lat: number; lng: number };

const KIND_EMOJI: [RegExp, string][] = [
  [/^(school|kindergarten)$/i, "🏫"],
  [/^(college|university)$/i, "🎓"],
  [/^(hospital|clinic|health_post|doctors)$/i, "🏥"],
  [/^(pharmacy|chemist)$/i, "💊"],
  [/^(place_of_worship|church|mosque)$/i, "⛪"],
  [/^(police)$/i, "🚓"],
  [/^(fire_station)$/i, "🚒"],
  [/^(fuel|filling_station)$/i, "⛽"],
  [/^(bank|atm|bureau_de_change)$/i, "🏦"],
  [/^(marketplace|market)$/i, "🧺"],
  [/^(library)$/i, "📚"],
  [/^(bus_station|bus_stop|taxi|station)$/i, "🚌"],
  [/^(restaurant|fast_food|cafe|bar|pub|food_court)$/i, "🍽️"],
  [/^(stadium|sports_centre|pitch|playground)$/i, "🏟️"],
  [/^(park|garden|recreation_ground)$/i, "🌳"],
  [/^(community_centre|townhall|courthouse|government)$/i, "🏛️"],
  [/^(supermarket|convenience|mall|department_store)$/i, "🛒"],
];

function emojiFor(kind: string): string {
  for (const [re, e] of KIND_EMOJI) if (re.test(kind)) return e;
  return "📌";
}

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const cache = new Map<string, Promise<Place[] | null>>();

// Named places (schools, clinics, churches, shops...) around a point, from OpenStreetMap.
// Returns null on network/API failure so the caller can offer a retry; [] when nothing is mapped.
export function fetchPlaces(lat: number, lng: number): Promise<Place[] | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // around-radius is ~6x faster on Overpass than a bbox union.
  const at = `around:2500,${lat.toFixed(4)},${lng.toFixed(4)}`;
  const query =
    `[out:json][timeout:6];(` +
    `node["name"]["amenity"](${at});` +
    `node["name"]["shop"](${at});` +
    `node["name"]["office"](${at});` +
    `node["name"]["leisure"](${at});` +
    `node["name"]["tourism"](${at});` +
    `node["name"]["healthcare"](${at});` +
    `way["name"]["amenity"](${at});` +
    `);out center 50;`;

  const p = (async (): Promise<Place[] | null> => {
    const items = await raceOverpass(query);
    if (items !== null) return items;
    const fallback = await fetchPhoton(lat, lng);
    if (fallback !== null) return fallback;
    cache.delete(key); // allow a retry after total failure
    return null;
  })();

  cache.set(key, p);
  return p;
}

// One mirror answers in ~3 s when it is healthy; waiting for them one after
// another costs the whole timeout budget when the network is bad, so race them.
async function raceOverpass(query: string): Promise<Place[] | null> {
  try {
    return await Promise.any(
      MIRRORS.map(async (url) => {
        const items = await tryOverpass(url, query);
        if (items === null) throw new Error("mirror unavailable");
        return items;
      })
    );
  } catch {
    return null;
  }
}

async function withTimeout(url: string, ms: number): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function withTimeoutPost(
  url: string,
  body: string,
  ms: number
): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: ctrl.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Photon is a geocoder rather than a database dump, so each category needs its
// own keyword lookup. It answers when every Overpass mirror is unreachable.
const PHOTON_CATEGORIES: [string, string][] = [
  ["school", "amenity:school"],
  ["clinic", "amenity:clinic"],
  ["hospital", "amenity:hospital"],
  ["church", "amenity:place_of_worship"],
  ["market", "amenity:marketplace"],
  ["petrol station", "amenity:fuel"],
  ["bank", "amenity:bank"],
  ["police", "amenity:police"],
];

type PhotonFeature = {
  geometry?: { coordinates?: number[] };
  properties?: { name?: string; osm_key?: string; osm_value?: string };
};

async function fetchPhoton(lat: number, lng: number): Promise<Place[] | null> {
  const d = 0.0225; // ~2.5 km box around the compound
  const bbox = [lng - d, lat - d, lng + d, lat + d].map((n) => n.toFixed(4)).join(",");
  const settled = await Promise.allSettled(
    PHOTON_CATEGORIES.map(async ([q, tag]) => {
      const res = await withTimeout(
        `https://photon.komoot.io/api/?bbox=${bbox}&q=${encodeURIComponent(
          q
        )}&osm_tag=${encodeURIComponent(tag)}&limit=8`,
        12000
      );
      if (!res?.ok) return null;
      return ((await res.json()) as { features?: PhotonFeature[] }).features ?? [];
    })
  );

  let reachable = false;
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const s of settled) {
    if (s.status !== "fulfilled" || !s.value) continue;
    reachable = true;
    for (const f of s.value) {
      const name = f.properties?.name?.trim();
      const [lo, la] = f.geometry?.coordinates ?? [];
      if (!name || la == null || lo == null) continue;
      if (la < lat - d || la > lat + d || lo < lng - d || lo > lng + d) continue;
      const dedupe = name.toLowerCase();
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const kind = f.properties?.osm_value ?? "";
      out.push({ name, emoji: emojiFor(kind), kind, lat: la, lng: lo });
    }
  }
  if (!reachable) return null;
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out.slice(0, 40);
}

async function tryOverpass(url: string, query: string): Promise<Place[] | null> {
  const res = await withTimeoutPost(url, `data=${encodeURIComponent(query)}`, 6000);
  if (!res?.ok) return null;
  try {
    const j = (await res.json()) as {
      elements?: {
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }[];
    };
    const seen = new Set<string>();
    const out: Place[] = [];
    for (const el of j.elements ?? []) {
      const tags = el.tags ?? {};
      const name = tags.name?.trim();
      const la = el.lat ?? el.center?.lat;
      const lo = el.lon ?? el.center?.lon;
      if (!name || la == null || lo == null) continue;
      const dedupe = name.toLowerCase();
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const kind =
        tags.amenity ??
        tags.shop ??
        tags.office ??
        tags.leisure ??
        tags.tourism ??
        tags.healthcare ??
        "";
      out.push({ name, emoji: emojiFor(kind), kind, lat: la, lng: lo });
      if (out.length >= 40) break;
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  } catch {
    return null;
  }
}
