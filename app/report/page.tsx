"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { gps, parse } from "exifr";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { Stripe, Wordmark } from "@/components/Brand";
import { PROVINCES, PROVINCE_NAMES } from "@/lib/zambia";
import {
  CATEGORIES,
  CATEGORY_IDS,
  normalizeCategory,
  deptOf,
  deptInfo,
  catInfo,
} from "@/lib/departments";

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

async function resize(file: File, max = 1024, quality = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width * scale;
  canvas.height = bmp.height * scale;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", quality));
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
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [pos, setPos] = useState<LatLng | null>(null);
  const [acc, setAcc] = useState<number | null>(null);
  const [live, setLive] = useState<(LatLng & { acc: number }) | null>(null);
  const [moved, setMoved] = useState(false);
  const [usedPhoto, setUsedPhoto] = useState(false);
  const [photoGps, setPhotoGps] = useState<LatLng | null>(null);
  const [photoTime, setPhotoTime] = useState<Date | null>(null);
  const [photoOld, setPhotoOld] = useState(false);
  const [photoChecked, setPhotoChecked] = useState(false);
  const [scene, setScene] = useState<"yes" | "no" | null>(null);
  const [gpsErr, setGpsErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [chosenCategory, setChosenCategory] = useState<string | null>(null);

  const imageRef = useRef<string | null>(null);
  const [sizes, setSizes] = useState<{ orig: number; sent: number } | null>(null);
  const [alertMsg, setAlertMsg] = useState("");

  const movedRef = useRef(false);
  const bestRef = useRef(Infinity);
  const sceneRef = useRef<"yes" | "no" | null>(null);

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
          if (!movedRef.current && sceneRef.current === "yes") {
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
    if (!f) return;
    let pg: LatLng | null = null;
    try {
      const g = await gps(f);
      if (g && typeof g.latitude === "number" && typeof g.longitude === "number") {
        pg = { lat: g.latitude, lng: g.longitude };
        setPhotoGps(pg);
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
    if (sceneRef.current === "no") {
      if (pg) {
        movedRef.current = true;
        setMoved(true);
        setUsedPhoto(true);
        setPos(pg);
        setGpsErr("");
      } else {
        movedRef.current = false;
        setMoved(false);
        setUsedPhoto(false);
        setPos((p) => p ?? { lat: FALLBACK.lat, lng: FALLBACK.lng });
        setGpsErr("This photo has no saved location. Tap the map to place the pin on the problem.");
      }
    }
  }

  function moveTo(lat: number, lng: number) {
    movedRef.current = true;
    setMoved(true);
    setUsedPhoto(false);
    setPos({ lat, lng });
  }

  function redetect() {
    movedRef.current = false;
    bestRef.current = Infinity;
    setMoved(false);
    setUsedPhoto(false);
    setAcc(null);
  }

  function pickScene(s: "yes" | "no") {
    sceneRef.current = s;
    setScene(s);
    setGpsErr("");
    if (s === "yes") {
      movedRef.current = false;
      setMoved(false);
      setUsedPhoto(false);
      setAcc(null);
      if (live) {
        setPos({ lat: live.lat, lng: live.lng });
        setAcc(live.acc);
      } else {
        setPos(null);
      }
    } else if (photoGps) {
      movedRef.current = true;
      setMoved(true);
      setUsedPhoto(true);
      setPos(photoGps);
    } else {
      movedRef.current = false;
      setMoved(false);
      setUsedPhoto(false);
      setAcc(null);
      setPos((p) => p ?? { lat: FALLBACK.lat, lng: FALLBACK.lng });
      if (photoChecked && file) {
        setGpsErr("This photo has no saved location. Tap the map to place the pin on the problem.");
      }
    }
  }

  const photoDist = photoGps && live ? Math.round(distanceM(photoGps, live)) : null;
  const photoFresh = !!photoTime && !photoOld;
  const source = moved ? (usedPhoto ? "photo" : "manual") : "gps";

  const locationOk =
    !!pos && (forwarded ? moved : moved || (acc !== null && acc <= MAX_OK_ACCURACY));

  const phoneOk = phone.replace(/\D/g, "").length >= 9;

  const conf = pos
    ? scoreLocation({ moved, usedPhoto, acc, photoDist, photoFresh, forwarded })
    : null;
  const confColor =
    conf?.level === "High" ? "#198a00" : conf?.level === "Medium" ? "#ef7d00" : "#de2010";

  const quality =
    scene === null
      ? { text: "Answer the question below", color: "text-gray-500" }
      : moved
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
    setAiResult(null);
    try {
      const analysisBlob = await resize(file, 768, 0.65);
      const image = await toBase64(analysisBlob);
      imageRef.current = image;
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
      setAiResult(ai);
      setChosenCategory(normalizeCategory(ai.category));
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    }
    setBusy(false);
  }

  async function confirmSubmit() {
    if (!file || !pos || !locationOk || !conf || !aiResult || !chosenCategory) return;
    setBusy(true);
    setError("");
    setSent(false);
    setAlertMsg("");
    try {
      const blob = await resize(file, 1600, 0.85);
      setSizes({ orig: file.size, sent: blob.size });

      const path = `${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage
        .from("report-photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("report-photos").getPublicUrl(path);

      const address = await lookupAddress(pos.lat, pos.lng);

      const { data: sess } = await supabase.auth.getSession();
      const reporterName =
        (sess?.session?.user?.user_metadata?.full_name as string) ?? email;

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
        reporter_phone: phone.replace(/\s/g, ""),
        reporter_email: email,
        reporter_name: reporterName,
        province,
        district,
        category: chosenCategory,
        department: deptOf(chosenCategory),
        severity: aiResult.severity,
        reason: aiResult.reason,
        suggested_action: aiResult.suggested_action,
        note,
      }).select("id").maybeSingle();
      if (ins.error) throw ins.error;
      const newId = (ins as { data: { id?: string } | null }).data?.id ?? null;

      const alertRes = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: newId,
          department: deptOf(chosenCategory),
          category: chosenCategory,
          severity: aiResult.severity,
          address,
        }),
      });
      const aj = await alertRes.json().catch(() => null);
      const dName = deptInfo(deptOf(chosenCategory)).name;
      setAlertMsg(
        aj?.status === "sent"
          ? aj.emergency
            ? `🚨 ${dName} alerted: flash call + SMS sent to ${aj.phone}.`
            : `📨 ${dName} notified by SMS to ${aj.phone}.`
          : aj?.status === "skipped"
          ? `ℹ️ Report saved. Alert not sent yet (${aj.reason}).`
          : "⚠️ Report saved, but the alert failed to send."
      );

      setSent(true);
      setNote("");
      setProvince("");
      setDistrict("");
      setAiResult(null);
      setChosenCategory(null);
      imageRef.current = null;
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
          <p className="text-xs text-gray-500">
            📉 <b>Data saver is on.</b> Photos are compressed only for transmission — the
            council still receives a clear, full-colour picture, and the GPS location saved
            inside your photo is kept.
          </p>

          {forwarded && (
            <div className="rounded-xl border border-zred/50 bg-zred/10 p-3 text-sm">
              <p className="font-bold text-zred">This looks like a WhatsApp photo</p>
              <p>
                WhatsApp removes a photo&apos;s location. Please <b>place the pin manually</b>{" "}
                on the map below at the exact spot of the problem.
              </p>
            </div>
          )}

          {file && photoGps && scene === "yes" && (
            <div className="rounded-xl border border-gray-200 p-3 text-sm">
              {photoDist !== null && photoDist <= MATCH_DISTANCE ? (
                <p className="text-zgreen font-semibold">
                  ✅ Photo location matches your GPS ({photoDist} m apart) — strong evidence!
                </p>
              ) : (
                <p className="text-gray-600">
                  {photoDist !== null
                    ? `📸 This photo was taken ${photoDist} m from here — since you're at the scene, we'll use your live GPS.`
                    : "📸 This photo also carries a location — great, it cross-checks your GPS!"}
                </p>
              )}
            </div>
          )}
          {file && photoGps && scene === "no" && (
            <div className="rounded-xl border border-zgreen/40 bg-zgreen/10 p-3 text-sm font-semibold text-zgreen">
              📸 Using the location saved inside your photo — pin set on the map below.
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

          <div className="space-y-3">
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold">
                📞 Your phone number <span className="text-zred">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="e.g. 0977 123 456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-zgreen"
              />
              <p className="text-xs text-gray-500">
                Only the council can see this — they&apos;ll call you if the location is
                unclear.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="province" className="block text-sm font-semibold">
                  🗺️ Province <span className="text-zred">*</span>
                </label>
                <select
                  id="province"
                  value={province}
                  onChange={(e) => {
                    setProvince(e.target.value);
                    setDistrict("");
                  }}
                  className="mt-1 w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-zgreen"
                >
                  <option value="">Select province</option>
                  {PROVINCE_NAMES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="district" className="block text-sm font-semibold">
                  📍 District <span className="text-zred">*</span>
                </label>
                <select
                  id="district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  disabled={!province}
                  className="mt-1 w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-zgreen disabled:opacity-50"
                >
                  <option value="">{province ? "Select district" : "Pick province first"}</option>
                  {(PROVINCES[province] ?? []).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold">📍 Problem location</p>
              <p className={`font-semibold ${quality.color}`}>{quality.text}</p>
            </div>

            {scene === null ? (
              <div className="rounded-2xl bg-white border-2 border-zgreen/30 shadow p-5 space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-4xl">🤔</p>
                  <h2 className="text-lg font-extrabold">Where are you right now?</h2>
                  <p className="text-xs text-gray-600">
                    This picks the most honest location for your report — and boosts its
                    confidence score.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => pickScene("yes")}
                    className="rounded-2xl border-2 border-zgreen/50 bg-zgreen/5 hover:bg-zgreen/15 hover:-translate-y-0.5 transition p-4 text-left space-y-1"
                  >
                    <p className="text-3xl">🧍</p>
                    <p className="font-extrabold text-zgreen">I&apos;m at the problem now</p>
                    <p className="text-xs text-gray-600">
                      We&apos;ll use your live GPS — switch your phone&apos;s location ON.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => pickScene("no")}
                    className="rounded-2xl border-2 border-zorange/50 bg-zorange/5 hover:bg-zorange/15 hover:-translate-y-0.5 transition p-4 text-left space-y-1"
                  >
                    <p className="text-3xl">🛋️</p>
                    <p className="font-extrabold text-zorange">I&apos;m somewhere else</p>
                    <p className="text-xs text-gray-600">
                      We&apos;ll use the location saved in your photo — no tags? You&apos;ll
                      place the pin.
                    </p>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {scene === "yes" ? (
                  <div className="rounded-xl border border-zgreen/40 bg-zgreen/10 p-3 text-sm space-y-1">
                    <p className="font-bold text-zgreen">🛰️ You&apos;re at the scene — perfect!</p>
                    <p className="text-gray-700">
                      Turn your phone&apos;s location ON and stay put while we lock the pin.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-zorange/40 bg-zorange/10 p-3 text-sm space-y-1">
                    <p className="font-bold text-zorange">📸 Not at the scene — no problem.</p>
                    <p className="text-gray-700">
                      Make sure your photo was taken with <b>Location tags ON</b>. If it carries
                      no location, just tap the map to place the pin yourself.
                    </p>
                  </div>
                )}

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
                    Finding your GPS... make sure location is ON.
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Tap the map or drag the red pin to place it exactly on the problem.
                </p>
                {!locationOk && pos && (
                  <p className="text-xs text-zred">
                    {forwarded || scene === "no"
                      ? "Tap the map to place the pin on the exact spot to continue."
                      : "GPS is weak. Move outside, or tap the map to place the pin on the exact spot."}
                  </p>
                )}
                <div className="flex gap-4 flex-wrap">
                  {scene === "yes" && (
                    <button
                      onClick={redetect}
                      type="button"
                      className="text-sm text-zgreen underline font-semibold"
                    >
                      Re-detect my location
                    </button>
                  )}
                  <button
                    onClick={() => pickScene(scene === "yes" ? "no" : "yes")}
                    type="button"
                    className="text-sm text-zorange underline font-semibold"
                  >
                    Switch to {scene === "yes" ? '"I\'m somewhere else"' : '"I\'m at the scene"'}
                  </button>
                </div>
              </>
            )}
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

          {aiResult ? (
            <div className="rounded-2xl border-2 border-zorange/50 bg-zorange/5 p-4 space-y-3">
              <div className="text-center space-y-1">
                <p className="text-3xl">🤖</p>
                <h2 className="text-lg font-extrabold">
                  The AI thinks this is: {catInfo(chosenCategory).label}
                </h2>
                {aiResult.reason && (
                  <p className="text-xs text-gray-600 italic">“{aiResult.reason}”</p>
                )}
                <p className="text-xs text-gray-600">
                  Photos can look alike — a baby fallen in a well vs a blocked drain, for
                  example. Please confirm or pick the correct issue so it reaches the right
                  department.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORY_IDS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChosenCategory(c)}
                    className={`rounded-xl border-2 p-2 text-xs font-semibold text-left transition ${
                      chosenCategory === c
                        ? "border-zgreen bg-zgreen/15 text-zdeep"
                        : "border-gray-200 bg-white hover:border-zgreen/50"
                    }`}
                  >
                    <span className="text-lg block">{CATEGORIES[c].emoji}</span>
                    {CATEGORIES[c].label}
                  </button>
                ))}
              </div>
              <div className="rounded-xl bg-white border border-zgreen/30 p-3 text-sm">
                <p className="font-bold text-zdeep">
                  {deptInfo(deptOf(chosenCategory ?? "")).emoji} Will be sent to:{" "}
                  {deptInfo(deptOf(chosenCategory ?? "")).name}
                </p>
                <p className="text-xs text-gray-600">
                  {deptInfo(deptOf(chosenCategory ?? "")).blurb}
                </p>
              </div>
              <button
                onClick={confirmSubmit}
                disabled={!chosenCategory || busy}
                className="w-full bg-zgreen hover:brightness-110 text-white font-bold text-lg rounded-xl p-4 disabled:opacity-40"
              >
                {busy
                  ? "Sending..."
                  : `Confirm & send to ${deptInfo(deptOf(chosenCategory ?? "")).name}`}
              </button>
              <button
                onClick={() => setAiResult(null)}
                type="button"
                className="w-full text-zorange underline text-sm font-semibold"
              >
                Change photo / start over
              </button>
            </div>
          ) : (
            <button
              onClick={submit}
              disabled={!file || !locationOk || !phoneOk || !province || !district || busy}
              className="w-full bg-zorange hover:brightness-110 text-white font-bold text-lg rounded-xl p-4 disabled:opacity-40"
            >
              {busy ? "Analysing your photo..." : "Analyse photo & continue"}
            </button>
          )}

          {error && <p className="text-zred text-sm">{error}</p>}
        </div>

        {sent && (
          <div className="bg-zgreen/10 border border-zgreen rounded-2xl p-4">
            <p className="font-bold text-zgreen text-lg">✅ Report sent to the council</p>
            <p className="text-sm text-gray-700">
              Thank you for helping improve your community. Your report has been analysed
              and added to the council&apos;s priority list.
            </p>
            {sizes && sizes.orig > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                📉 Data saver: {(sizes.orig / 1048576).toFixed(1)} MB on your phone →{" "}
                {(sizes.sent / 1024).toFixed(0)} KB sent (
                {Math.max(0, Math.round(100 - (sizes.sent / sizes.orig) * 100))}% less data
                used).
              </p>
            )}
            {alertMsg && <p className="text-sm font-semibold text-zdeep mt-1">{alertMsg}</p>}
          </div>
        )}
      </main>
    </div>
  );
}