"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { Stripe, Wordmark } from "@/components/Brand";

const ReportMap = dynamic(() => import("@/components/ReportMap"), { ssr: false });

function sevClass(s: number) {
  if (s >= 5) return "bg-zred text-white";
  if (s === 4) return "bg-zorange text-white";
  if (s === 3) return "bg-yellow-400 text-black";
  return "bg-zgreen text-white";
}

function confClass(level: string | null) {
  if (level === "High") return "bg-zgreen text-white";
  if (level === "Medium") return "bg-zorange text-white";
  if (level === "Low") return "bg-zred text-white";
  return "bg-gray-300 text-black";
}

export default function Dashboard() {
  const { ready, email, logout } = useAuth("council");
  const [reports, setReports] = useState<any[]>([]);
  const [onlyHigh, setOnlyHigh] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .order("severity", { ascending: false });
    setReports(data ?? []);
  }

  async function setStatus(id: string, status: string) {
    await supabase.from("reports").update({ status }).eq("id", id);
    load();
  }

  useEffect(() => {
    if (ready) load();
  }, [ready]);

  if (!ready) return <p className="p-6 text-center text-gray-500">Loading...</p>;

  const shown = onlyHigh
    ? reports.filter((r) => r.location_confidence === "High")
    : reports;

  const open = reports.filter((r) => r.status !== "fixed").length;
  const urgent = reports.filter((r) => r.severity >= 4 && r.status !== "fixed").length;
  const fixed = reports.filter((r) => r.status === "fixed").length;
  const high = reports.filter((r) => r.location_confidence === "High").length;

  const stats = [
    { label: "Total reports", value: reports.length, color: "#111111" },
    { label: "Open", value: open, color: "#ef7d00" },
    { label: "Urgent (4-5)", value: urgent, color: "#de2010" },
    { label: "Fixed", value: fixed, color: "#198a00" },
    { label: "High-confidence location", value: high, color: "#198a00" },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-zgreen text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/">
              <Wordmark light className="text-2xl" />
            </a>
            <span className="hidden sm:inline bg-white/15 rounded-full px-3 py-1 text-sm font-semibold">
              Council dashboard
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline opacity-80">{email}</span>
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

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-xl shadow p-4 border-t-4"
              style={{ borderColor: s.color }}
            >
              <p className="text-3xl font-black" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-xs text-gray-600">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl overflow-hidden shadow border border-gray-200">
          <ReportMap reports={shown} />
        </div>

        <div className="flex items-center justify-between pt-2">
          <h2 className="text-xl font-extrabold">Reports by priority</h2>
          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={onlyHigh}
              onChange={(e) => setOnlyHigh(e.target.checked)}
              className="w-4 h-4 accent-green-700"
            />
            High-confidence locations only
          </label>
        </div>

        <div className="space-y-3">
          {shown.length === 0 && <p className="text-gray-500 text-sm">No reports to show.</p>}
          {shown.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-xl shadow p-3 flex gap-3 items-center border border-gray-100"
            >
              <img src={r.photo_url} className="w-20 h-20 object-cover rounded-lg" alt="" />
              <div className="flex-1 text-sm">
                <p className="font-bold flex items-center gap-2 flex-wrap">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${sevClass(r.severity)}`}>
                    {r.severity}/5
                  </span>
                  {String(r.category).replace("_", " ")}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${confClass(
                      r.location_confidence
                    )}`}
                  >
                    🛡️ {r.location_confidence ?? "Unrated"}
                    {r.location_score != null && ` ${r.location_score}`}
                  </span>
                </p>
                <p className="text-gray-600">{r.reason}</p>
                <p className="text-gray-800">{r.suggested_action}</p>
                <p className="text-xs text-gray-500">
                  📍 {r.address ?? "Address unavailable"}
                  {r.accuracy_m != null && ` · ±${r.accuracy_m} m`}
                  {r.location_source && ` · ${r.location_source}`}
                </p>
              </div>
              <select
                value={r.status}
                onChange={(e) => setStatus(r.id, e.target.value)}
                className="border border-gray-300 rounded-lg p-2 text-sm"
              >
                <option value="reported">Reported</option>
                <option value="in_progress">In progress</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}