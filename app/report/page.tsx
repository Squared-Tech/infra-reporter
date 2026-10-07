"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { Stripe, Wordmark } from "@/components/Brand";

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

export default function Report() {
  const { ready, role, email, logout } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    if (!ready) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError("Location blocked. Allow location access and refresh.")
    );
  }, [ready]);

  async function submit() {
    if (!file || !coords) return;
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
      if (!res.ok) throw new Error("AI analysis failed");
      const ai = await res.json();

      const path = `${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage
        .from("report-photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("report-photos").getPublicUrl(path);

      const ins = await supabase.from("reports").insert({
        photo_url: data.publicUrl,
        lat: coords.lat,
        lng: coords.lng,
        category: ai.category,
        severity: ai.severity,
        reason: ai.reason,
        suggested_action: ai.suggested_action,
        note,
      });
      if (ins.error) throw ins.error;
      setSent(true);
      setFile(null);
      setNote("");
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
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setSent(false);
            }}
          />

          <textarea
            placeholder="Optional note (e.g. near Shoprite, Freedom Way)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-zgreen"
          />

          <p className="text-sm text-gray-600">
            📍 Location:{" "}
            <span className="font-semibold">
              {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "getting..."}
            </span>
          </p>

          <button
            onClick={submit}
            disabled={!file || !coords || busy}
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