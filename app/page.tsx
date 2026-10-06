"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

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

export default function Home() {
  const { ready, role, email, logout } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

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

  if (!ready) return <p className="p-4">Loading...</p>;

  return (
    <main className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">{email}</span>
        <div className="flex gap-3">
          {role === "council" && (
            <a href="/dashboard" className="text-blue-600 underline">
              Council dashboard
            </a>
          )}
          <button onClick={logout} className="text-blue-600 underline">
            Log out
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold">Report a problem</h1>
      <p className="text-sm text-gray-500">
        Pothole, blocked drain, power or water fault. Take a photo and send.
      </p>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setSent(false);
        }}
        className="block w-full"
      />
      <textarea
        placeholder="Optional note (e.g. near Shoprite, Freedom Way)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full border rounded p-2"
      />
      <p className="text-sm">
        Location: {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "getting..."}
      </p>

      <button
        onClick={submit}
        disabled={!file || !coords || busy}
        className="w-full bg-blue-600 text-white rounded p-3 disabled:opacity-40"
      >
        {busy ? "Analysing..." : "Submit report"}
      </button>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {sent && (
        <div className="border rounded p-3 space-y-1">
          <p className="font-semibold">Report sent to the council</p>
          <p className="text-sm text-gray-600">
            Thank you. Your report has been analysed and added to the council's priority list.
          </p>
        </div>
      )}
    </main>
  );
}