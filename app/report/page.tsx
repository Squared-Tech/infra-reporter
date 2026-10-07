"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { gps, parse } from "exifr";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { Stripe, Wordmark } from "@/components/Brand";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), { ssr: false });

const MAX_OK_ACCURACY = 30; // metres
const MATCH_DISTANCE = 50; // metres: photo vs GPS agreement
const FALLBACK: LatLng = { lat: -12.9922, lng: 28.5781 }; // Ndola centre, for manual pin

type LatLng = { lat: number; lng: number };

function distanceM(a: LatLng, b: LatLng) {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function scoreLocation(o: {
  moved: boolean;
  usedPhoto: boolean;
  acc: number | null;
  photoDist: number | null;
  photoFresh: boolean;
  forwarded: boolean;
}) {
  const reasons: string[] = [];
  let s = 0;

  if (o.moved && o.usedPhoto) {
    s += 65;
    reasons.push("Photo location used");
  } else if (o.moved) {
    s += 40;
    reasons.push("Pin placed by you");
  } else if (o.acc !== null) {
    s += o.acc <= 10 ? 60 : o.acc <= 20 ? 55 : o.acc <= 30 ? 45 : 20;
    reasons.push(`GPS ±${o.acc} m`);
  }

  if (!o.moved && o.photoDist !== null && o.photoDist <= MATCH_DISTANCE) {
    s += 30;
    reasons.push("Photo matches GPS");
  }
  if (o.photoFresh) {
    s += 10;
    reasons.push("Fresh photo");
  }
  if (o.forwarded) {
    s -= 10;
    reasons.push("Forwarded photo");
  }

  s = Math.max(0, Math.min(100, s));
  const level = s >= 70 ? "High" : s >= 45 ? "Medium" : "Low";
  return { score: s, level, reasons };
}

async function resize(file: File, max = 1024): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width * scale;
  canvas.height = bmp.height * scale;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.8));
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1]);
    r.readAsDataURL(blob);
  });
}

async function lookupAddress(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d.display_name ?? null;
  } catch {
    return null;
  }
}

export default function Report() {
  const { ready, role, email, logout } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [pos, setPos] = useState<LatLng | null>(null);
  const [acc, setAcc] = useState<number | null>(null);
  const [live, setLive] = useState<(LatLng & { acc: number }) | null>(null);
  const [moved, setMoved] = useState(false);
  const [usedPhoto, setUsedPhoto] = useState(false);
  const [photoGps, setPhotoGps] = useState<LatLng | null>(null);
  const [photoTime, setPhotoTime] = useState<Date | null>(null);
  const [photoOld, setPhotoOld] = useState(false);
  const [photoChecked, setPhotoChecked] = useState(false);
  const [choice, setChoice] = useState<"photo" | "gps" | null>(null);
  const [gpsErr, setGpsErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const movedRef = useRef(false);
  const bestRef = useRef(Infinity);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const forwarded =
    !!file && (/-WA\d{3,}/i.test(file.name) || /whatsapp/i.test(file.name));

  useEffect(() => {
    if (!ready) return;
    if (!navigator.geolocation) {
      setGpsErr("This browser can't get your location.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const a = p.coords.accuracy;
        if (a <= bestRef.current) {
          bestRef.current = a;
          const here = { lat: p.coords.latitude, lng: p.coords.longitude };
          setLive({ ...here, acc: Math.round(a) });
          if (!movedRef.current) {
            setPos(here);
            setAcc(Math.round(a));
            setGpsErr("");
          }
        }
      },
      (e) => {
        if (e.code === 1) {
          setGpsErr(
            "Location is blocked. Allow location access in your browser settings, then refresh, or tap the map to place the pin yourself."
          );
        } else {
          setGpsErr(
            "GPS isn't available right now. Tap the map below to place the pin on the problem."
          );
        }
        setPos((p) => p ?? { lat: FALLBACK.lat, lng: FALLBACK.lng });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [ready]);

  useEffect(() => {
    if (!ready || pos) return;
    const t = setTimeout(() => {
      setPos((p) => p ?? { lat: FALLBACK.lat, lng: FALLBACK.lng });
      setGpsErr("GPS is taking too long. Tap the map below to place the pin on the problem.");
    }, 10000);
    return () => clearTimeout(t);
  }, [ready, pos]);

  async function onPick(f: File | null) {
    setFile(f);
    setSent(false);
    setPhotoGps(null);
    setPhotoTime(null);
    setPhotoOld(false);
    setPhotoChecked(false);
    setChoice(null);
    if (!f) return;
    try {
      const g = await gps(f);
      if (g && typeof g.latitude === "number" && typeof g.longitude === "number") {
        setPhotoGps({ lat: g.latitude, lng: g.longitude });
      }
      const t: any = await parse(f, ["DateTimeOriginal"]);
      if (t?.DateTimeOriginal) {
        const d = new Date(t.DateTimeOriginal);
        setPhotoTime(d);
        setPhotoOld(Date.now() - d.getTime() > 15 * 60 * 1000);
      }
    } catch {
      // photo has no readable metadata
    }
    setPhotoChecked(true);
  }

  function moveTo(lat: number, lng: number) {
    movedRef.current = true;
    setMoved(true);
    setUsedPhoto(false);
    setPos({ lat, lng });
  }

  function choosePhoto() {
    if (!photoGps) return;
    movedRef.current = true;
    setMoved(true);
    setUsedPhoto(true);
    setChoice("photo");
    setPos(photoGps);
  }

  function chooseLive() {
    if (!live) return;
    movedRef.current = false;
    setMoved(false);
    setUsedPhoto(false);
    setChoice("gps");
    setPos({ lat: live.lat, lng: live.lng });
    setAcc(live.acc);
  }

  function redetect() {
    movedRef.current = false;
    bestRef.current = Infinity;
    setMoved(false);
    setUsedPhoto(false);
    setChoice(null);
    setAcc(null);
  }

  const photoDist = photoGps && live ? Math.round(distanceM(photoGps, live)) : null;
  const photoFresh = !!photoTime && !photoOld;
  const source = moved ? (usedPhoto ? "photo" : "manual") : "gps";

  const locationOk =
    !!pos && (forwarded ? moved : moved || (acc !== null && acc <= MAX_OK_ACCURACY));

  const conf = pos
    ? scoreLocation({ moved, usedPhoto, acc, photoDist, photoFresh, forwarded })
    : null;
  const confColor =
    conf?.level === "High" ? "#198a00" : conf?.level === "Medium" ? "#ef7d00" : "#de2010";

  const quality = moved
    ? { text: usedPhoto ? "Using photo location" : "Pin placed by you", color: "text-zgreen" }
    : acc === null
    ? pos
      ? { text: "Place the pin on the map", color: "text-zorange" }
      : { text: "Finding your location...", color: "text-gray-500" }
    : acc <= 20
    ? { text: `Excellent (±${acc} m)`, color: "text-zgreen" }
    : acc <= MAX_OK_ACCURACY
    ? { text: `Good (±${acc} m)`, color: "text-zgreen" }
    : { text: `Weak (±${acc} m)`, color: "text-zred" };

  async function submit() {
    if (!file || !pos || !locationOk || !conf) return;
    setBusy(true);
    setError("");
    setSent(false);
    try {
      const blob = await resize(file);
      const image = await toBase64(blob);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "AI analysis failed");
      }
      const ai = await res.json();

      const path = `${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage
        .from("report-photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("report-photos").getPublicUrl(path);

      const address = await lookupAddress(pos.lat, pos.lng);

      const ins = await supabase.from("reports").insert({
        photo_url: data.publicUrl,
        lat: pos.lat,
        lng: pos.lng,
        accuracy_m: moved ? null : acc,
        location_adjusted: moved,
        location_source: source,
        location_score: conf.score,
        location_confidence: conf.level,
        photo_lat: photoGps?.lat ?? null,
        photo_lng: photoGps?.lng ?? null,
        photo_distance_m: photoDist,
        photo_taken_at: photoTime ? photoTime.toISOString() : null,
        address,
        category: ai.category,
        severity: ai.severity,
        reason: ai.reason,
        suggested_action: ai.suggested_action,
        note,
      });
      if (ins.error) throw ins.error;
      setSent(true);
      setNote("");
      onPick(null);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    }
    setBusy(false);
  }

  if (!ready) return <p className="p-6 text-center text-gray-500">Loading...</p>;

  return (
    <div className="min-h-screen">
      <header className="bg-zgreen text-white">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/">
            <Wordmark light className="text-2xl" />
          </a>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline opacity-80">{email}</span>
            {role === "council" && (
              <a href="/dashboard" className="underline font-semibold">
                Dashboard
              </a>
            )}
            <button
              onClick={logout}
              className="bg-white/15 hover:bg-white/25 rounded-full px-3 py-1"
            >
              Log out
            </button>
          </div>
        </div>
        <Stripe />
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-4">
        <div className="pt-2">
          <h1 className="text-3xl font-extrabold">Report a problem</h1>
          <p className="text-gray-600">
            Pothole, blocked drain, power or water fault. Take a photo and send it to your
            council.
          </p>
        </div>

        <div className="rounded-2xl border border-zorange/50 bg-zorange/10 p-4 text-sm space-y-2">
          <p className="font-bold">Before you report</p>
          <p>
            📍 <b>Turn ON your phone&apos;s location (GPS)</b> before taking the picture, and
            switch on <b>Location tags</b> in your camera settings so the photo carries its
            location.
          </p>
          <p>📸 Take the photo <b>at the problem</b>, so the location is fresh and accurate.</p>
          <p>
            💬 <b>Photo forwarded on WhatsApp, or a screenshot?</b> These carry no location.
            Kindly <b>share the location manually</b> by placing the pin on the map.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-4 space-y-4 border border-gray-100">
          <label
            htmlFor="photo"
            className="block cursor-pointer rounded-xl border-2 border-dashed border-zgreen/50 bg-zgreen/5 p-6 text-center hover:bg-zgreen/10"
          >
            {preview ? (
              <img src={preview} alt="" className="mx-auto max-h-56 rounded-lg" />
            ) : (
              <>
                <div className="text-4xl">📷</div>
                <p className="font-semibold text-zgreen mt-1">Take or choose a photo</p>
                <p className="text-xs text-gray-500">Tap here to open your camera or gallery</p>
              </>
            )}
          </label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />

          {forwarded && (
            <div className="rounded-xl border border-zred/50 bg-zred/10 p-3 text-sm">
              <p className="font-bold text-zred">This looks like a WhatsApp photo</p>
              <p>
                WhatsApp removes a photo&apos;s location. Please <b>place the pin manually</b>{" "}
                on the map below at the exact spot of the problem.
              </p>
            </div>
          )}

          {file && photoGps && (
            <div className="rounded-xl border border-gray-200 p-3 text-sm space-y-2">
              {photoDist !== null && photoDist <= MATCH_DISTANCE ? (
                <p className="text-zgreen font-semibold">
                  ✅ Photo location matches your GPS ({photoDist} m apart)
                </p>
              ) : (
                <>
                  <p className="font-semibold text-zred">
                    {photoDist !== null
                      ? `⚠️ This photo was taken ${photoDist} m from where you are now.`
                      : "📸 This photo has a location saved in it."}
                  </p>
                  {choice === null ? (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={choosePhoto}
                        className="bg-zgreen text-white rounded-lg px-3 py-2 font-semibold"
                      >
                        Use photo location
                      </button>
                      {live && (
                        <button
                          type="button"
                          onClick={chooseLive}
                          className="border border-zgreen text-zgreen rounded-lg px-3 py-2 font-semibold"
                        >
                          Use my current location
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-600">
                      Using {choice === "photo" ? "the photo's" : "your current"} location.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {file && photoChecked && !photoGps && !forwarded && (
            <p className="text-xs text-gray-500">
              No location was found in this photo. Make sure Location tags are on in your
              camera. We&apos;ll use your live GPS, so check the pin below.
            </p>
          )}
          {file && photoOld && (
            <p className="text-xs text-zred">
              This photo looks older than 15 minutes. Please take a fresh one if you can.
            </p>
          )}

          <textarea
            placeholder="Optional note (e.g. near Shoprite, Freedom Way)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-zgreen"
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold">📍 Problem location</p>
              <p className={`font-semibold ${quality.color}`}>{quality.text}</p>
            </div>

            {gpsErr && <p className="text-zred text-sm">{gpsErr}</p>}

            {pos ? (
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <LocationPicker
                  lat={pos.lat}
                  lng={pos.lng}
                  accuracy={moved ? null : acc}
                  onChange={moveTo}
                />
              </div>
            ) : (
              <div className="h-24 rounded-xl bg-gray-100 flex items-center justify-center text-sm text-gray-500">
                Waiting for GPS...
              </div>
            )}

            <p className="text-xs text-gray-500">
              Tap the map or drag the red pin to place it exactly on the problem.
            </p>
            {!locationOk && pos && (
              <p className="text-xs text-zred">
                {forwarded
                  ? "Tap the map to place the pin on the exact spot to continue."
                  : "GPS is weak. Move outside, or tap the map to place the pin on the exact spot."}
              </p>
            )}
            <button
              onClick={redetect}
              type="button"
              className="text-sm text-zgreen underline font-semibold"
            >
              Re-detect my location
            </button>
          </div>

          {conf && (
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="flex justify-between text-sm font-semibold">
                <span>🛡️ Location confidence</span>
                <span style={{ color: confColor }}>
                  {conf.level} · {conf.score}/100
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${conf.score}%`, background: confColor }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">{conf.reasons.join(" · ")}</p>
            </div>
          )}

          <button
            onClick={submit}
            disabled={!file || !locationOk || busy}
            className="w-full bg-zorange hover:brightness-110 text-white font-bold text-lg rounded-xl p-4 disabled:opacity-40"
          >
            {busy ? "Analysing your photo..." : "Submit report"}
          </button>

          {error && <p className="text-zred text-sm">{error}</p>}
        </div>

        {sent && (
          <div className="bg-zgreen/10 border border-zgreen rounded-2xl p-4">
            <p className="font-bold text-zgreen text-lg">✅ Report sent to the council</p>
            <p className="text-sm text-gray-700">
              Thank you for helping improve your community. Your report has been analysed
              and added to the council&apos;s priority list.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}