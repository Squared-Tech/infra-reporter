export type RegionPoint = { lat: number; lng: number };

// Last-resort centres (used only if geocoding is unreachable) — province centroids.
export const PROVINCE_CENTERS: Record<string, RegionPoint> = {
  Central: { lat: -14.6, lng: 29.75 },
  Copperbelt: { lat: -12.65, lng: 27.9 },
  Eastern: { lat: -13.6, lng: 32.6 },
  Luapula: { lat: -11.6, lng: 29.1 },
  Lusaka: { lat: -15.4, lng: 28.75 },
  Muchinga: { lat: -11.8, lng: 31.6 },
  Northern: { lat: -10.6, lng: 31.0 },
  "North-Western": { lat: -12.6, lng: 25.6 },
  Southern: { lat: -16.6, lng: 27.2 },
  Western: { lat: -15.6, lng: 23.6 },
};

const cache = new Map<string, RegionPoint>();

export async function regionCenter(
  district: string,
  province: string
): Promise<RegionPoint | null> {
  const key = `${province}/${district}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let point: RegionPoint | null = null;
  try {
    const q = encodeURIComponent(`${district}, ${province}, Zambia`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=zm&q=${q}`
    );
    if (res.ok) {
      const j = (await res.json()) as { lat?: string; lon?: string }[];
      const lat = j[0]?.lat ? parseFloat(j[0].lat) : NaN;
      const lng = j[0]?.lon ? parseFloat(j[0].lon) : NaN;
      if (Number.isFinite(lat) && Number.isFinite(lng)) point = { lat, lng };
    }
  } catch {
    // offline / blocked: fall through to the province centre
  }
  if (!point) point = PROVINCE_CENTERS[province] ?? null;
  if (point) cache.set(key, point);
  return point;
}
