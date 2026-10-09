"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { Stripe, Wordmark } from "@/components/Brand";

export default function Where() {
  const { ready } = useAuth();
  const router = useRouter();
  const [scene, setScene] = useState<"yes" | "no" | null>(null);

  if (!ready) return <p className="p-6 text-center text-gray-500">Loading...</p>;

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Map backdrop */}
      <div className="fixed inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img/gps-map.png"
          alt="City map with a GPS pin"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-white/70" />
      </div>

      <Stripe />
      <header className="mx-auto w-full max-w-lg px-5 py-5 text-center">
        <a href="/">
          <Wordmark className="text-3xl" />
        </a>
      </header>

      <main className="flex flex-1 items-center justify-center p-5">
        <div className="w-full max-w-lg space-y-4 rounded-2xl border-4 border-zgreen bg-white/95 p-6 shadow-2xl">
          <div className="flex items-center justify-between text-sm">
            <p className="font-semibold">📍 Problem location</p>
            <p className="font-semibold text-gray-500">Answer the question below</p>
          </div>

          <div className="space-y-1 text-center">
            <p className="text-4xl">🤔</p>
            <h1 className="text-2xl font-extrabold">Where are you right now?</h1>
            <p className="text-xs text-gray-600">
              This picks the most honest location for your report — and boosts its
              confidence score.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setScene("yes")}
              className={`rounded-2xl border-2 p-4 text-left space-y-1 transition hover:-translate-y-0.5 ${
                scene === "yes"
                  ? "border-zgreen bg-zgreen/15 ring-4 ring-zgreen/30"
                  : "border-zgreen/50 bg-zgreen/5 hover:bg-zgreen/15"
              }`}
            >
              <p className="text-3xl">🧍</p>
              <p className="font-extrabold text-zgreen">I&apos;m at the problem now</p>
              <p className="text-xs text-gray-600">
                We&apos;ll use your live GPS — switch your phone&apos;s location ON.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setScene("no")}
              className={`rounded-2xl border-2 p-4 text-left space-y-1 transition hover:-translate-y-0.5 ${
                scene === "no"
                  ? "border-zorange bg-zorange/15 ring-4 ring-zorange/30"
                  : "border-zorange/50 bg-zorange/5 hover:bg-zorange/15"
              }`}
            >
              <p className="text-3xl">🛋️</p>
              <p className="font-extrabold text-zorange">I&apos;m somewhere else</p>
              <p className="text-xs text-gray-600">
                We&apos;ll use the location saved in your photo — no tags? You&apos;ll
                place the pin.
              </p>
            </button>
          </div>

          {scene && (
            <button
              onClick={() => router.push(`/report?scene=${scene}`)}
              className="w-full rounded-xl bg-zgreen p-3 font-bold text-white shadow hover:brightness-110"
            >
              Next →
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
