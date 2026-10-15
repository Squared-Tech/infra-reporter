import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// A second report of a case the council is already working is noise, not help, so
// the wizard checks for one before it saves. Only open cases block: once a council
// marks a problem fixed, a fresh report means it came back.
const RADIUS_M = 300;
const OPEN_DAYS = 30;

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function POST(req: Request) {
  const svc = adminClient();
  if (!svc) return NextResponse.json({ duplicate: false, error: "no service key" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ duplicate: false, error: "bad request" });
  }
  const { category, lat, lng } = body ?? {};
  if (!category || typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ duplicate: false, error: "category, lat and lng are required" });
  }

  const since = new Date(Date.now() - OPEN_DAYS * 86400_000).toISOString();
  const dLat = RADIUS_M / 111320;
  const dLng = RADIUS_M / (111320 * Math.cos((lat * Math.PI) / 180));

  // A citizen cannot read someone else's report, so this has to run as service role.
  const { data, error } = await svc
    .from("reports")
    .select("id, created_at, status, address, lat, lng, severity, location_confidence")
    .eq("category", category)
    .in("status", ["reported", "in_progress"])
    .gte("created_at", since)
    .gte("lat", lat - dLat)
    .lte("lat", lat + dLat)
    .gte("lng", lng - dLng)
    .lte("lng", lng + dLng)
    .order("created_at", { ascending: false })
    .limit(50);

  // Never let a broken check stop a report from getting through.
  if (error) return NextResponse.json({ duplicate: false, error: error.message });

  let match: any = null;
  for (const r of data ?? []) {
    if (typeof r.lat !== "number" || typeof r.lng !== "number") continue;
    const m = meters({ lat, lng }, { lat: r.lat, lng: r.lng });
    if (m <= RADIUS_M && (!match || m < match.distance_m)) {
      match = { ...r, distance_m: Math.round(m) };
    }
  }

  return NextResponse.json({ duplicate: !!match, match, radius_m: RADIUS_M });
}
