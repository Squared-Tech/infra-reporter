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
    `[out:json][timeout:30];(` +
    `node["name"]["amenity"](${at});` +
    `node["name"]["shop"](${at});` +
    `node["name"]["office"](${at});` +
    `node["name"]["leisure"](${at});` +
    `node["name"]["tourism"](${at});` +
    `node["name"]["healthcare"](${at});` +
    `way["name"]["amenity"](${at});` +
    `);out center 50;`;

  const p = (async (): Promise<Place[] | null> => {
    for (const url of MIRRORS) {
      const items = await tryOverpass(url, query);
      if (items !== null) return items;
    }
    cache.delete(key); // allow a retry after total failure
    return null;
  })();

  cache.set(key, p);
  return p;
}

async function tryOverpass(url: string, query: string): Promise<Place[] | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
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
