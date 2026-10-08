"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { Stripe, Wordmark } from "@/components/Brand";
import { PROVINCES } from "@/lib/zambia";
import { DEPARTMENT_IDS, deptInfo, catInfo } from "@/lib/departments";

const ReportMap = dynamic(() => import("@/components/ReportMap"), { ssr: false });
const ReportPinMap = dynamic(() => import("@/components/ReportPinMap"), { ssr: false });

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

function pinColor(level: string | null) {
  return level === "High" ? "#198a00" : level === "Medium" ? "#ef7d00" : "#de2010";
}

const TABS = [
  { key: "reported", label: "🚨 Reported", empty: "Nothing waiting. Smooth sailing! 🌊" },
  { key: "in_progress", label: "🔧 In progress", empty: "No crews out right now. ☕" },
  { key: "fixed", label: "✅ Fixed", empty: "No fixes yet — the win list is waiting for you! 🏆" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function statusOf(r: any): TabKey {
  return r.status === "fixed" || r.status === "in_progress" ? r.status : "reported";
}

export default function Dashboard() {
  const { ready, role, email, logout } = useAuth("council");
  const [reports, setReports] = useState<any[]>([]);
  const [onlyHigh, setOnlyHigh] = useState(false);
  const [tab, setTab] = useState<TabKey>("reported");
  const [prov, setProv] = useState("");
  const [dist, setDist] = useState("");
  const [dept, setDept] = useState("");

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

  const base = useMemo(
    () => reports.filter((r) => !onlyHigh || r.location_confidence === "High"),
    [reports, onlyHigh]
  );

  const filtered = useMemo(
    () =>
      base.filter(
        (r) =>
          (!prov || r.province === prov) &&
          (!dist || r.district === dist) &&
          (!dept || r.department === dept)
      ),
    [base, prov, dist, dept]
  );

  const countOf = (k: TabKey) => filtered.filter((r) => statusOf(r) === k).length;
  const shown = filtered.filter((r) => statusOf(r) === tab);

  const provinceCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of base) {
      const p = r.province ?? "Unknown";
      m.set(p, (m.get(p) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [base]);

  const deptCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of base) {
      const d = r.department ?? "general";
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [base]);

  const groups = useMemo(() => {
    const byProv = new Map<string, any[]>();
    for (const r of shown) {
      const p = r.province ?? "Unknown";
      if (!byProv.has(p)) byProv.set(p, []);
      byProv.get(p)!.push(r);
    }
    return [...byProv.entries()].map((pEntry) => {
      const byDist = new Map<string, any[]>();
      for (const r of pEntry[1]) {
        const d = r.district ?? "Unknown";
        if (!byDist.has(d)) byDist.set(d, []);
        byDist.get(d)!.push(r);
      }
      return [pEntry[0], [...byDist.entries()]] as [string, [string, any[]][]];
    });
  }, [shown]);

  if (!ready) return <p className="p-6 text-center text-gray-500">Loading...</p>;

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
            {role === "admin" && (
              <a href="/admin" className="bg-white/15 hover:bg-white/25 rounded-full px-3 py-1 font-semibold">
                👑 Admin
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

        <div className="bg-white rounded-2xl shadow p-4 border border-gray-100 space-y-2">
          <h2 className="text-lg font-extrabold">📬 Department queues (open cases)</h2>
          <p className="text-xs text-gray-600">
            Every report is routed straight to the responsible department. Tap a department
            to see only its cases.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DEPARTMENT_IDS.map((d) => {
              const openCount = base.filter(
                (r) => (r.department ?? "general") === d && r.status !== "fixed"
              ).length;
              return (
                <button
                  key={d}
                  onClick={() => setDept(d === dept ? "" : d)}
                  className={`flex items-center gap-2 rounded-xl border-2 p-3 text-left transition ${
                    dept === d
                      ? "border-zdeep bg-zdeep/10"
                      : "border-gray-200 bg-white hover:border-zdeep/50"
                  }`}
                >
                  <span className="text-2xl">{deptInfo(d).emoji}</span>
                  <span className="flex-1 text-xs font-semibold leading-tight">
                    {deptInfo(d).name}
                  </span>
                  <span
                    className={`text-xl font-black ${openCount > 0 ? "text-zred" : "text-gray-300"}`}
                  >
                    {openCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-4 space-y-3 border border-gray-100">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-extrabold">🗺️ Filter by area</h2>
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

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setProv("");
                setDist("");
              }}
              className={`rounded-full px-3 py-1 text-sm font-semibold border ${
                prov === ""
                  ? "bg-zgreen text-white border-zgreen"
                  : "bg-white text-zgreen border-zgreen/40 hover:bg-zgreen/10"
              }`}
            >
              🇿🇲 All provinces
            </button>
            {provinceCounts.map(([p, n]) => (
              <button
                key={p}
                onClick={() => {
                  setProv(p === prov ? "" : p);
                  setDist("");
                }}
                className={`rounded-full px-3 py-1 text-sm font-semibold border ${
                  prov === p
                    ? "bg-zgreen text-white border-zgreen"
                    : "bg-white text-zgreen border-zgreen/40 hover:bg-zgreen/10"
                }`}
              >
                {p} <span className="opacity-70">({n})</span>
              </button>
            ))}
          </div>

          <div className="pt-1">
            <p className="text-sm font-extrabold mb-2">🏢 Filter by department</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDept("")}
                className={`rounded-full px-3 py-1 text-sm font-semibold border ${
                  dept === ""
                    ? "bg-zdeep text-white border-zdeep"
                    : "bg-white text-zdeep border-zdeep/40 hover:bg-zdeep/10"
                }`}
              >
                🏛️ All departments
              </button>
              {DEPARTMENT_IDS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDept(d === dept ? "" : d)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold border ${
                    dept === d
                      ? "bg-zdeep text-white border-zdeep"
                      : "bg-white text-zdeep border-zdeep/40 hover:bg-zdeep/10"
                  }`}
                >
                  {deptInfo(d).emoji} {deptInfo(d).name}
                  <span className="opacity-70"> ({deptCounts.get(d) ?? 0})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={prov}
              onChange={(e) => {
                setProv(e.target.value);
                setDist("");
              }}
              className="border border-gray-300 rounded-xl p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zgreen"
            >
              <option value="">All provinces</option>
              {Object.keys(PROVINCES).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={dist}
              onChange={(e) => setDist(e.target.value)}
              disabled={!prov}
              className="border border-gray-300 rounded-xl p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zgreen disabled:opacity-50"
            >
              <option value="">{prov ? "All districts" : "Pick a province first"}</option>
              {(PROVINCES[prov] ?? []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden shadow border border-gray-200">
          <ReportMap reports={shown} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-xl p-3 font-bold text-sm border-2 transition ${
                tab === t.key
                  ? t.key === "fixed"
                    ? "bg-zgreen text-white border-zgreen"
                    : t.key === "in_progress"
                    ? "bg-zorange text-white border-zorange"
                    : "bg-zred text-white border-zred"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
              }`}
            >
              {t.label}
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  tab === t.key ? "bg-white/25" : "bg-gray-100"
                }`}
              >
                {countOf(t.key)}
              </span>
            </button>
          ))}
        </div>

        {shown.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-8 text-center border border-gray-100">
            <p className="text-4xl">🧹</p>
            <p className="text-gray-600 mt-2 font-semibold">
              {TABS.find((t) => t.key === tab)?.empty}
            </p>
          </div>
        )}

        {groups.map(([p, districts]) => (
          <section key={p} className="space-y-3">
            <h2 className="text-xl font-extrabold flex items-center gap-2 pt-2">
              🗺️ {p}
              <span className="text-sm font-semibold text-gray-500">
                ({districts.reduce((n, dRs) => n + dRs[1].length, 0)} in this tab)
              </span>
            </h2>
            {districts.map(([d, rs]) => (
              <div key={d} className="space-y-3">
                <h3 className="text-sm font-bold text-zgreen uppercase tracking-wide">
                  📍 {d} District
                </h3>
                {rs.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white rounded-2xl shadow p-4 border border-gray-100 hover:shadow-md transition space-y-3"
                  >
                    <div className="flex gap-4 flex-col md:flex-row">
                      <div className="md:w-56 shrink-0 space-y-2">
                        <img
                          src={r.photo_url}
                          className="w-full h-32 object-cover rounded-xl border border-gray-200"
                          alt=""
                        />
                        <div className="rounded-xl overflow-hidden border border-gray-200">
                          <ReportPinMap
                            lat={r.lat}
                            lng={r.lng}
                            color={pinColor(r.location_confidence)}
                            label={r.address ?? "Pinned location"}
                          />
                        </div>
                      </div>
                      <div className="flex-1 text-sm space-y-2">
                        <p className="font-bold flex items-center gap-2 flex-wrap">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${sevClass(r.severity)}`}>
                            {r.severity}/5
                          </span>
                          {catInfo(r.category).emoji} {catInfo(r.category).label}
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${confClass(
                              r.location_confidence
                            )}`}
                          >
                            🛡️ {r.location_confidence ?? "Unrated"}
                            {r.location_score != null && ` ${r.location_score}`}
                          </span>
                        </p>
                        <p className="inline-flex items-center gap-1 rounded-full bg-zdeep text-white px-3 py-1 text-xs font-bold">
                          {deptInfo(r.department).emoji} Alerted: {deptInfo(r.department).name}
                        </p>
                        <p className="text-gray-600">{r.reason}</p>
                        <p className="text-gray-800">{r.suggested_action}</p>
                        <p className="text-xs text-gray-500">
                          📍 {r.address ?? "Address unavailable"}
                          {r.accuracy_m != null && ` · ±${r.accuracy_m} m`}
                          {r.location_source && ` · ${r.location_source}`}
                        </p>
                        <div className="rounded-xl bg-zcream border border-zgreen/20 p-3 text-xs space-y-1">
                          <p className="font-bold text-zdeep">👤 Reporter contact (council only)</p>
                          <p>
                            {r.reporter_name ?? "Citizen"} ·{" "}
                            {r.reporter_phone ? (
                              <a
                                href={`tel:${r.reporter_phone}`}
                                className="text-zgreen font-semibold underline"
                              >
                                📞 {r.reporter_phone}
                              </a>
                            ) : (
                              <span className="text-gray-500">📞 no phone given</span>
                            )}
                          </p>
                          <p className="text-gray-600">✉️ {r.reporter_email ?? "—"}</p>
                          {r.note && <p className="text-gray-600">📝 {r.note}</p>}
                        </div>
                      </div>
                      <div className="md:w-40 shrink-0">
                        <select
                          value={r.status}
                          onChange={(e) => setStatus(r.id, e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white"
                        >
                          <option value="reported">🚨 Reported</option>
                          <option value="in_progress">🔧 In progress</option>
                          <option value="fixed">✅ Fixed</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
