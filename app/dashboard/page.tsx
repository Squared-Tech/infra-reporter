"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { playSiren } from "@/lib/siren";
import { Stripe, Wordmark } from "@/components/Brand";
import { PROVINCES } from "@/lib/zambia";
import { DEPARTMENT_IDS, deptInfo, catInfo } from "@/lib/departments";
import { caseMessage, copyText, waDigits, waShareUrl } from "@/lib/share";
import { BarList, Donut, Trend, type Slice } from "@/components/Charts";

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

const DEPT_COLORS: Record<string, string> = {
  fire_rescue: "#de2010",
  police: "#2f3e9e",
  solid_waste: "#6b8e23",
  water_sanitation: "#0e7ea8",
  veterinary: "#8b5cf6",
  road_maintenance: "#ef7d00",
  general: "#0d5c00",
};

const SEV_COLORS: Record<number, string> = {
  5: "#de2010",
  4: "#ef7d00",
  3: "#e2b602",
  2: "#7cb51c",
  1: "#198a00",
};

const TABS = [
  { key: "reported", label: "🚨 Reported", empty: "Nothing waiting. Smooth sailing! 🌊" },
  { key: "in_progress", label: "🔧 In progress", empty: "No crews out right now. ☕" },
  { key: "fixed", label: "✅ Fixed", empty: "No fixes yet. The win list is waiting for you! 🏆" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const STATUS_STYLE: Record<TabKey, { chip: string; bar: string; name: string }> = {
  reported: { chip: "bg-zred/10 text-zred border-zred/30", bar: "#de2010", name: "Waiting for a crew" },
  in_progress: { chip: "bg-zorange/10 text-zorange border-zorange/30", bar: "#ef7d00", name: "Crew assigned" },
  fixed: { chip: "bg-zgreen/10 text-zdeep border-zgreen/30", bar: "#198a00", name: "Closed" },
};

function statusOf(r: any): TabKey {
  return r.status === "fixed" || r.status === "in_progress" ? r.status : "reported";
}

function ago(iso: string | null): string {
  if (!iso) return "recently";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

const FLOAT_CARDS = [
  { src: "/img/road-works.png", alt: "Road works", tilt: "-7deg", delay: "0s" },
  { src: "/img/fire-rescue.png", alt: "Fire and rescue", tilt: "5deg", delay: "1.1s" },
  { src: "/img/community.png", alt: "Community", tilt: "-3deg", delay: "2.2s" },
];

export default function Dashboard() {
  const { ready, role, email, logout } = useAuth("council");
  const [reports, setReports] = useState<any[]>([]);
  const [onlyHigh, setOnlyHigh] = useState(false);
  const [tab, setTab] = useState<TabKey>("reported");
  const [prov, setProv] = useState("");
  const [dist, setDist] = useState("");
  const [dept, setDept] = useState("");
  const [alarm, setAlarm] = useState<any | null>(null);
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState("");
  const [focus, setFocus] = useState("");

  // Jump from the emergency alarm straight to the case that caused it.
  function viewCase(r: any) {
    setAlarm(null);
    setTab(statusOf(r));
    setOnlyHigh(false);
    setProv("");
    setDist("");
    setDept("");
    setFocus(r.id);
  }

  // The card can be a frame behind the tab/filter state change, so retry the
  // scroll until it is in the DOM (bounded to ~2s).
  useEffect(() => {
    if (!focus) return;
    let frame = 0;
    let tries = 0;
    const step = () => {
      const el = document.getElementById(`case-${focus}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (++tries > 120) return;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    const t = setTimeout(() => setFocus(""), 5000);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(t);
    };
  }, [focus]);

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

  // Repeat the siren every 3s while the alarm overlay is up.
  useEffect(() => {
    if (!alarm) return;
    playSiren();
    const iv = setInterval(playSiren, 3000);
    return () => clearInterval(iv);
  }, [alarm]);

  // Live emergency alarm: flash + siren when a new urgent report lands.
  useEffect(() => {
    if (!ready) return;
    const ch = supabase
      .channel("fixzed-reports-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reports" },
        (payload: any) => {
          const r = payload.new;
          if (!r) return;
          setReports((prev) => [r, ...prev]);
          const urgent = deptInfo(r.department).emergency || (r.severity ?? 0) >= 4;
          if (urgent) {
            setAlarm(r);
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification(`🚨 FIXZED ${deptInfo(r.department).name}`, {
                body: `${catInfo(r.category).label} (severity ${r.severity}/5), ${
                  r.address ?? "location pending"
                }`,
              });
            }
          }
        }
      )
      .subscribe((status: string) => setLive(status === "SUBSCRIBED"));

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    return () => {
      supabase.removeChannel(ch);
    };
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

  // Reading the work: every figure below tracks the same list on screen, so a
  // filtered view reports on that view rather than quietly showing everything.
  const view = useMemo(() => {
    const list = filtered;
    const total = list.length;
    const open = list.filter((r) => r.status !== "fixed").length;
    const urgent = list.filter((r) => (r.severity ?? 0) >= 4 && r.status !== "fixed").length;
    const fixed = list.filter((r) => r.status === "fixed").length;
    const high = list.filter((r) => r.location_confidence === "High").length;

    const statusSlices: Slice[] = [
      { label: "Reported", value: list.filter((r) => statusOf(r) === "reported").length, color: "#de2010" },
      {
        label: "In progress",
        value: list.filter((r) => statusOf(r) === "in_progress").length,
        color: "#ef7d00",
      },
      { label: "Fixed", value: list.filter((r) => statusOf(r) === "fixed").length, color: "#198a00" },
    ];

    const confSlices: Slice[] = [
      { label: "High", value: list.filter((r) => r.location_confidence === "High").length, color: "#198a00" },
      {
        label: "Medium",
        value: list.filter((r) => r.location_confidence === "Medium").length,
        color: "#ef7d00",
      },
      { label: "Low", value: list.filter((r) => r.location_confidence === "Low").length, color: "#de2010" },
      {
        label: "Unrated",
        value: list.filter((r) => !["High", "Medium", "Low"].includes(r.location_confidence)).length,
        color: "#9ca3af",
      },
    ];

    const deptBars = DEPARTMENT_IDS.map((d) => ({
      label: deptInfo(d).name.replace(/ Department| Unit| Services$/, ""),
      emoji: deptInfo(d).emoji,
      value: list.filter((r) => (r.department ?? "general") === d).length,
      color: DEPT_COLORS[d],
      id: d,
    }))
      .filter((b) => b.value > 0)
      .sort((a, b) => b.value - a.value);

    const sevBars = [5, 4, 3, 2, 1].map((s) => ({
      label: `Severity ${s}`,
      value: list.filter((r) => (r.severity ?? 0) === s).length,
      color: SEV_COLORS[s],
    }));

    const provTally = new Map<string, number>();
    for (const r of list) {
      const p = r.province ?? "Unknown";
      provTally.set(p, (provTally.get(p) ?? 0) + 1);
    }
    const provBars = [...provTally.entries()]
      .map(([label, value]) => ({ label, value, color: "#0d5c00" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const days: { label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toDateString();
      days.push({
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        value: list.filter((r) => r.created_at && new Date(r.created_at).toDateString() === key)
          .length,
      });
    }

    return {
      total,
      open,
      urgent,
      fixed,
      high,
      resolved: total ? Math.round((fixed / total) * 100) : 0,
      statusSlices,
      confSlices,
      deptBars,
      sevBars,
      provBars,
      days,
    };
  }, [filtered]);

  if (!ready) return <p className="p-6 text-center text-gray-500">Loading...</p>;

  const pct = (n: number) => (view.total ? Math.round((n / view.total) * 100) : 0);

  const tiles = [
    { icon: "📥", label: "Reports in view", value: view.total, sub: "matching your filters", color: "#111111", fill: 100 },
    { icon: "🚨", label: "Open", value: view.open, sub: `${pct(view.open)}% of the pile`, color: "#ef7d00", fill: pct(view.open) },
    { icon: "⚡", label: "Urgent (4-5)", value: view.urgent, sub: "needs a crew now", color: "#de2010", fill: pct(view.urgent) },
    { icon: "✅", label: "Fixed", value: view.fixed, sub: `${pct(view.fixed)}% closed`, color: "#198a00", fill: pct(view.fixed) },
    { icon: "📈", label: "Resolved", value: `${view.resolved}%`, sub: "of reports in view", color: "#0d5c00", fill: view.resolved },
    { icon: "🛡️", label: "Solid pins", value: view.high, sub: `${pct(view.high)}% high confidence`, color: "#0e7ea8", fill: pct(view.high) },
  ];

  const scope = [prov || null, dist || null, dept ? deptInfo(dept).name : null, onlyHigh ? "High-confidence only" : null]
    .filter(Boolean)
    .join(" · ");

  const filtersOn = !!(prov || dist || dept || onlyHigh);

  const card = "rounded-2xl border border-gray-100 bg-white p-4 shadow-sm";
  const cardTitle = "flex items-center gap-2 text-sm font-extrabold text-zblack";

  return (
    <div className="min-h-screen bg-zcream">
      <header className="bg-gradient-to-r from-zgreen to-zdeep text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <a href="/">
              <Wordmark light className="text-2xl" />
            </a>
            <span className="hidden rounded-full bg-white/15 px-3 py-1 text-sm font-semibold sm:inline">
              Council dashboard
            </span>
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
                live ? "bg-zred text-white" : "bg-white/15 text-white/70"
              }`}
              title={live ? "Watching for new reports in real time" : "Connecting live feed..."}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  live ? "animate-pulse bg-white" : "bg-white/40"
                }`}
              />
              {live ? "LIVE" : "..."}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden opacity-80 sm:inline">{email}</span>
            {role === "admin" && (
              <a
                href="/admin"
                className="rounded-full bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
              >
                👑 Admin
              </a>
            )}
            <button
              onClick={logout}
              className="rounded-full bg-white/15 px-3 py-1 hover:bg-white/25"
            >
              Log out
            </button>
          </div>
        </div>
        <Stripe />
      </header>

      <main className="mx-auto max-w-6xl space-y-5 p-4">
        {/* Control-room banner */}
        <section className="rise relative overflow-hidden rounded-3xl bg-zblack px-5 py-6 text-white shadow-lg sm:px-7">
          <div
            className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-zgreen/40 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-zorange/25 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-zorange">
                {live ? "Live caseload" : "Connecting…"}
              </p>
              <h1 className="text-2xl font-black leading-tight sm:text-3xl">
                {view.open > 0
                  ? `${view.open} issue${view.open === 1 ? "" : "s"} still need${view.open === 1 ? "s" : ""} a crew`
                  : "Every reported issue is closed"}
              </h1>
              <p className="text-sm text-white/70">
                {scope ? `Filtered to ${scope}.` : "National view across every council on FixZed."}{" "}
                {view.urgent > 0 && (
                  <span className="font-bold text-zorange">{view.urgent} urgent.</span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-end gap-3 sm:gap-4">
              {FLOAT_CARDS.map((c, i) => (
                <figure
                  key={c.src}
                  className="floaty w-24 shrink-0 rounded-2xl border-2 border-white/70 bg-white/10 p-1 shadow-xl sm:w-28"
                  style={
                    {
                      "--tilt": c.tilt,
                      transform: `rotate(${c.tilt})`,
                      animationDelay: c.delay ?? `${i * 1.1}s`,
                    } as CSSProperties
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.src} alt={c.alt} className="h-20 w-full rounded-xl object-cover sm:h-24" />
                  <figcaption className="px-1 py-1 text-[10px] font-bold uppercase tracking-wide text-white/80">
                    {c.alt}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* KPI tiles */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((t, i) => (
            <div
              key={t.label}
              className="rise lift relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between">
                <span className="text-xl">{t.icon}</span>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: t.color }}
                  aria-hidden
                />
              </div>
              <p className="mt-2 text-3xl font-black leading-none" style={{ color: t.color }}>
                {t.value}
              </p>
              <p className="mt-1 text-xs font-bold text-zblack">{t.label}</p>
              <p className="text-[11px] text-gray-500">{t.sub}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${Math.max(2, t.fill)}%`, background: t.color }}
                />
              </div>
            </div>
          ))}
        </section>

        {/* Charts */}
        <section className="grid gap-3 lg:grid-cols-3">
          <div className={card}>
            <h2 className={cardTitle}>
              <span>🍩</span> Caseload by status
            </h2>
            <p className="mb-3 mt-0.5 text-[11px] text-gray-500">
              Where the {view.total} reports in view sit right now.
            </p>
            <Donut slices={view.statusSlices} centerLabel="in view" />
          </div>

          <div className={card}>
            <h2 className={cardTitle}>
              <span>📈</span> Reports per day
            </h2>
            <p className="mb-3 mt-0.5 text-[11px] text-gray-500">
              Last 14 days · {view.days.reduce((n, d) => n + d.value, 0)} received.
            </p>
            <Trend points={view.days.map((d) => d.value)} labels={view.days.map((d) => d.label)} />
          </div>

          <div className={card}>
            <h2 className={cardTitle}>
              <span>🏛️</span> Workload by department
            </h2>
            <p className="mb-3 mt-0.5 text-[11px] text-gray-500">
              Tap a bar in the queue below to isolate a department.
            </p>
            <BarList items={view.deptBars} emptyText="No department has been routed a case yet." />
          </div>

          <div className={card}>
            <h2 className={cardTitle}>
              <span>⚡</span> Severity mix
            </h2>
            <p className="mb-3 mt-0.5 text-[11px] text-gray-500">
              5 is danger to life. The council works this list top-down.
            </p>
            <BarList items={view.sevBars} emptyText="No severity scores yet." />
          </div>

          <div className={card}>
            <h2 className={cardTitle}>
              <span>🗺️</span> Busiest provinces
            </h2>
            <p className="mb-3 mt-0.5 text-[11px] text-gray-500">
              Ranked by reports in view · top {view.provBars.length || 0}.
            </p>
            <BarList items={view.provBars} emptyText="No province has reported yet." />
          </div>

          <div className={card}>
            <h2 className={cardTitle}>
              <span>🛡️</span> Location confidence
            </h2>
            <p className="mb-3 mt-0.5 text-[11px] text-gray-500">
              How far the crew can trust the pin before it drives out.
            </p>
            <Donut slices={view.confSlices} centerLabel="pinned" />
          </div>
        </section>

        {/* Department queues */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold">📬 Department queues</h2>
              <p className="text-xs text-gray-600">
                Every report is routed straight to the responsible department. Tap a department to
                see only its cases.
              </p>
            </div>
            {dept && (
              <button
                onClick={() => setDept("")}
                className="rounded-full border border-zdeep/30 px-3 py-1 text-xs font-bold text-zdeep hover:bg-zdeep/10"
              >
                ✕ Clear department
              </button>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {DEPARTMENT_IDS.map((d) => {
              const openCount = base.filter(
                (r) => (r.department ?? "general") === d && r.status !== "fixed"
              ).length;
              const totalD = deptCounts.get(d) ?? 0;
              const active = dept === d;
              return (
                <button
                  key={d}
                  onClick={() => setDept(active ? "" : d)}
                  className={`lift rounded-xl border-2 p-3 text-left transition ${
                    active
                      ? "border-zdeep bg-zdeep text-white shadow-md"
                      : "border-gray-200 bg-white hover:border-zdeep/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{deptInfo(d).emoji}</span>
                    <span
                      className={`flex-1 text-xs font-bold leading-tight ${
                        active ? "text-white" : "text-zblack"
                      }`}
                    >
                      {deptInfo(d).name}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span
                      className={`text-2xl font-black ${
                        openCount > 0
                          ? active
                            ? "text-white"
                            : "text-zred"
                          : active
                            ? "text-white/70"
                            : "text-gray-300"
                      }`}
                    >
                      {openCount}
                    </span>
                    <span className={`text-[11px] ${active ? "text-white/70" : "text-gray-500"}`}>
                      open · {totalD} total
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${totalD ? Math.max(4, (openCount / totalD) * 100) : 0}%`,
                        background: active ? "#ffffff" : DEPT_COLORS[d],
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filters */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:sticky lg:top-2 lg:z-20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">🔎 Narrow the view</h2>
            <label className="flex cursor-pointer items-center gap-2 rounded-full bg-zcream px-3 py-1.5 text-xs font-bold text-zdeep">
              <input
                type="checkbox"
                checked={onlyHigh}
                onChange={(e) => setOnlyHigh(e.target.checked)}
                className="h-4 w-4 accent-green-700"
              />
              High-confidence locations only
            </label>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={prov}
              onChange={(e) => {
                setProv(e.target.value);
                setDist("");
              }}
              className="rounded-xl border border-gray-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-zgreen"
            >
              <option value="">🇿🇲 All provinces</option>
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
              className="rounded-xl border border-gray-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-zgreen disabled:opacity-50"
            >
              <option value="">{prov ? "All districts" : "Pick a province first"}</option>
              {(PROVINCES[prov] ?? []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                {filtersOn ? `${filtered.length} of ${reports.length} shown` : "All reports shown"}
              </span>
              {filtersOn && (
                <button
                  onClick={() => {
                    setProv("");
                    setDist("");
                    setDept("");
                    setOnlyHigh(false);
                  }}
                  className="rounded-full border border-zred/30 px-3 py-1 text-xs font-bold text-zred hover:bg-zred/10"
                >
                  ✕ Reset filters
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {provinceCounts.map(([p, n]) => (
              <button
                key={p}
                onClick={() => {
                  setProv(p === prov ? "" : p);
                  setDist("");
                }}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  prov === p
                    ? "border-zgreen bg-zgreen text-white"
                    : "border-zgreen/30 bg-white text-zgreen hover:bg-zgreen/10"
                }`}
              >
                {p} <span className="opacity-70">({n})</span>
              </button>
            ))}
          </div>
        </section>

        {/* Map */}
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <h2 className="text-lg font-extrabold">🗺️ Where they are</h2>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-gray-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zgreen" /> High confidence
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zorange" /> Medium
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zred" /> Low / unrated
              </span>
            </div>
          </div>
          <div className="border-t border-gray-100">
            <ReportMap reports={shown} />
          </div>
        </section>

        {/* Status tabs */}
        <section className="grid grid-cols-3 gap-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`lift relative overflow-hidden rounded-2xl border-2 p-3 text-left transition ${
                  active
                    ? "border-zdeep bg-white shadow-md"
                    : "border-gray-200 bg-white/70 hover:border-gray-300"
                }`}
              >
                <span
                  className="absolute inset-y-0 left-0 w-1.5"
                  style={{ background: STATUS_STYLE[t.key].bar }}
                  aria-hidden
                />
                <span
                  className={`block pl-2 text-sm font-black ${active ? "text-zblack" : "text-gray-600"}`}
                >
                  {t.label}
                </span>
                <span className="mt-0.5 block pl-2 text-[11px] text-gray-500">
                  {STATUS_STYLE[t.key].name}
                </span>
                <span
                  className="mt-1 block pl-2 text-2xl font-black"
                  style={{ color: STATUS_STYLE[t.key].bar }}
                >
                  {countOf(t.key)}
                </span>
              </button>
            );
          })}
        </section>

        {shown.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
            <p className="text-5xl">🧹</p>
            <p className="mt-3 font-bold text-gray-700">{TABS.find((t) => t.key === tab)?.empty}</p>
            <p className="mt-1 text-xs text-gray-500">
              {filtersOn
                ? "Your filters are on — reset them to see the rest of the caseload."
                : "New reports appear here the moment a citizen sends one."}
            </p>
          </div>
        )}

        {groups.map(([p, districts]) => (
          <section key={p} className="space-y-3">
            <h2 className="flex items-center gap-2 pt-2 text-xl font-extrabold">
              <span className="rounded-lg bg-zdeep px-2 py-0.5 text-white">🗺️ {p}</span>
              <span className="text-sm font-semibold text-gray-500">
                {districts.reduce((n, dRs) => n + dRs[1].length, 0)} in this tab
              </span>
            </h2>
            {districts.map(([d, rs]) => (
              <div key={d} className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-zgreen">
                  📍 {d} District
                </h3>
                {rs.map((r) => (
                  <article
                    key={r.id}
                    id={`case-${r.id}`}
                    className={`rise overflow-hidden rounded-2xl border shadow-sm transition ${
                      focus === r.id
                        ? "border-zorange bg-white ring-4 ring-zorange"
                        : "lift border-gray-100 bg-white hover:shadow-md"
                    }`}
                  >
                    <div
                      className="flex items-center justify-between gap-2 px-4 py-2 text-xs font-black uppercase tracking-wide"
                      style={{
                        background: `${STATUS_STYLE[statusOf(r)].bar}12`,
                        color: STATUS_STYLE[statusOf(r)].bar,
                      }}
                    >
                      <span>
                        {deptInfo(r.department).emoji} {deptInfo(r.department).name}
                      </span>
                      <span>{ago(r.created_at)}</span>
                    </div>

                    <div className="flex flex-col gap-4 p-4 md:flex-row">
                      <div className="space-y-2 md:w-56 md:shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.photo_url}
                          alt=""
                          className="h-32 w-full rounded-xl border border-gray-200 object-cover"
                        />
                        <div className="overflow-hidden rounded-xl border border-gray-200">
                          <ReportPinMap
                            lat={r.lat}
                            lng={r.lng}
                            color={pinColor(r.location_confidence)}
                            label={r.address ?? "Pinned location"}
                          />
                        </div>
                      </div>

                      <div className="flex-1 space-y-2 text-sm">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${sevClass(r.severity)}`}>
                            {r.severity}/5
                          </span>
                          <span className="text-base font-black text-zblack">
                            {catInfo(r.category).emoji} {catInfo(r.category).label}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${confClass(
                              r.location_confidence
                            )}`}
                          >
                            🛡️ {r.location_confidence ?? "Unrated"}
                            {r.location_score != null && ` ${r.location_score}`}
                          </span>
                        </p>
                        <p className="text-gray-700">{r.reason}</p>
                        <p className="rounded-lg bg-zcream px-3 py-2 text-xs font-semibold text-zdeep">
                          👉 {r.suggested_action}
                        </p>
                        <p className="text-xs text-gray-500">
                          📍 {r.address ?? "Address unavailable"}
                          {r.compound && ` · 🏘️ ${r.compound}`}
                          {r.accuracy_m != null && ` · ±${r.accuracy_m} m`}
                          {r.location_source && ` · ${r.location_source}`}
                        </p>
                        <div className="rounded-xl border border-zgreen/20 bg-zcream p-3 text-xs">
                          <p className="font-bold text-zdeep">👤 Reporter contact (council only)</p>
                          <p className="mt-1">
                            {r.reporter_name ?? "Citizen"} ·{" "}
                            {r.reporter_phone ? (
                              <a
                                href={`tel:${r.reporter_phone}`}
                                className="font-semibold text-zgreen underline"
                              >
                                📞 {r.reporter_phone}
                              </a>
                            ) : (
                              <span className="text-gray-500">📞 no phone given</span>
                            )}
                          </p>
                          <p className="text-gray-600">✉️ {r.reporter_email ?? "No email"}</p>
                          {r.note && <p className="text-gray-600">📝 {r.note}</p>}
                        </div>
                      </div>

                      <div className="space-y-2 md:w-44 md:shrink-0">
                        <label className="block text-[10px] font-black uppercase tracking-wide text-gray-500">
                          Update status
                        </label>
                        <select
                          value={r.status}
                          onChange={(e) => setStatus(r.id, e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zgreen"
                        >
                          <option value="reported">🚨 Reported</option>
                          <option value="in_progress">🔧 In progress</option>
                          <option value="fixed">✅ Fixed</option>
                        </select>
                        <a
                          href={waShareUrl(r)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full rounded-lg bg-zgreen p-2 text-center text-sm font-bold text-white hover:brightness-110"
                        >
                          📲 Share on WhatsApp
                        </a>
                        {waDigits(r.reporter_phone) && (
                          <a
                            href={waShareUrl(r, r.reporter_phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full rounded-lg border-2 border-zgreen p-2 text-center text-sm font-bold text-zgreen hover:bg-zgreen/10"
                          >
                            💬 Message reporter
                          </a>
                        )}
                        <button
                          onClick={() => {
                            copyText(caseMessage(r)).then((ok) => {
                              setCopied(ok ? r.id : `fail:${r.id}`);
                              setTimeout(() => setCopied(""), 2500);
                            });
                          }}
                          className="w-full rounded-lg border border-gray-300 p-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          {copied === r.id
                            ? "✅ Copied"
                            : copied === `fail:${r.id}`
                              ? "⚠️ Use Share instead"
                              : "📋 Copy summary"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </section>
        ))}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-2 text-center text-xs text-gray-500">
        FixZed · citizen reporting for Zambia&apos;s local councils · figures follow the filters you
        have set
      </footer>

      {alarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md animate-pulse overflow-hidden rounded-3xl bg-zred text-white shadow-2xl">
            <div className="space-y-3 p-6 text-center">
              <p className="text-6xl">🚨</p>
              <h2 className="text-2xl font-black uppercase tracking-wide">Emergency report</h2>
              <p className="text-lg font-bold">
                {deptInfo(alarm.department).emoji} {deptInfo(alarm.department).name}
              </p>
              <p className="text-white/90">
                {catInfo(alarm.category).label} · severity {alarm.severity}/5
              </p>
              <p className="text-sm text-white/80">
                📍 {alarm.address ?? "Location pending"}
                {alarm.province ? ` · ${alarm.province}` : ""}
                {alarm.district ? ` / ${alarm.district}` : ""}
              </p>
              <p className="text-sm text-white/80">{alarm.reason}</p>
              <button
                onClick={() => {
                  playSiren();
                }}
                className="w-full rounded-xl bg-zorange p-3 font-black text-white hover:brightness-110"
              >
                🔊 Tap for sound
              </button>
              <button
                onClick={() => viewCase(alarm)}
                className="w-full rounded-xl bg-white p-3 font-black text-zred hover:brightness-95"
              >
                Acknowledge &amp; view this case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
