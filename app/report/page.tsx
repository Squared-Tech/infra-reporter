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
        body: