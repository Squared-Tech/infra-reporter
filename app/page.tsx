"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { Stripe, Wordmark } from "@/components/Brand";
import { DEPARTMENTS, DEPARTMENT_IDS } from "@/lib/departments";

const SERVICES = [
  {
    img: "/img/crime-report.png",
    tag: "EMERGENCY",
    title: "Crime & Public Safety",
    text: "Report petty crime, vandalism and public safety threats. The Police Department is alerted instantly with a flash call and SMS.",
  },
  {
    img: "/img/fire-rescue.png",
    tag: "EMERGENCY",
    title: "Fire & Rescue Services",
    text: "Fires, trapped persons, downed powerlines and electrical faults go straight to the Fire and Rescue Unit — and trigger a live siren on the council dashboard.",
  },
  {
    img: "/img/road-works.png",
    tag: "INFRASTRUCTURE",
    title: "Roads & Drainage",
    text: "Potholes, road damage, street lights, blocked drains and water leaks are routed to the right maintenance team with a location-confidence score.",
  },
  {
    img: "/img/partnership.png",
    tag: "COMMUNITY",
    title: "A Council That Listens",
    text: "Every report lands in one live queue that council staff work through in real time. Residents and the council, fixing Kazungula together.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Snap a photo",
    text: "Take a picture of the problem from your phone. Your location is captured automatically — no forms, no phone calls, no queueing at council offices.",
  },
  {
    n: "2",
    title: "AI classifies & routes it",
    text: "FixZed's AI reads the photo, identifies the issue from 18 categories and routes it to the correct department. You confirm before it is sent — you stay in control.",
  },
  {
    n: "3",
    title: "Location confidence scored",
    text: "Every report carries a 0–100 location-confidence score, so crews know exactly how precisely to trust the pin and can find the site first time.",
  },
  {
    n: "4",
    title: "Council responds live",
    text: "The report appears instantly on the council dashboard. Emergencies flash red with a live siren, and the on-duty department is alerted by call and SMS.",
  },
];

const STATS = [
  { value: "7", label: "Council departments connected" },
  { value: "18", label: "Issue categories AI can detect" },
  { value: "0–100", label: "Location-confidence score" },
  { value: "24/7", label: "Live emergency monitoring" },
];

export default function Home() {
  const { ready, role } = useAuth();
  const router = useRouter();

  // Staff go straight to their dashboard; citizens see the landing page.
  useEffect(() => {
    if (!ready) return;
    if (role === "council" || role === "admin") router.replace("/dashboard");
  }, [ready, role, router]);

  if (!ready) return <p className="p-6 text-center text-gray-500">Loading...</p>;
  if (role === "council" || role === "admin") return null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Stripe />

      {/* Utility bar */}
      <div className="bg-zblack text-xs text-gray-300">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <span>
            Kazungula Town Council · Official citizen reporting portal
          </span>
          <span className="flex items-center gap-4">
            <span className="hidden sm:inline">
              Police emergency line: <b className="text-white">0975 170 412</b>
            </span>
            {role ? (
              <Link href="/dashboard" className="font-semibold text-zorange hover:underline">
                Council / Admin login →
              </Link>
            ) : (
              <Link href="/login" className="font-semibold text-zorange hover:underline">
                Staff login →
              </Link>
            )}
          </span>
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Wordmark className="text-2xl" />
          <nav className="hidden items-center gap-6 text-sm font-semibold text-gray-700 md:flex">
            <a href="#services" className="hover:text-zgreen">Services</a>
            <a href="#how" className="hover:text-zgreen">How it works</a>
            <a href="#departments" className="hover:text-zgreen">Departments</a>
            <a href="#about" className="hover:text-zgreen">About</a>
          </nav>
          <Link
            href="/report"
            className="rounded-lg bg-zgreen px-4 py-2 text-sm font-bold text-white shadow hover:bg-zdeep"
          >
            Report an issue
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/road-works.png"
            alt="Council road maintenance crew at work"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zblack/85 via-zblack/60 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-24 md:py-36">
          <p className="mb-3 inline-block rounded bg-zorange px-3 py-1 text-xs font-black tracking-widest text-white">
            SEE IT · SNAP IT · FIX IT
          </p>
          <h1 className="max-w-2xl text-4xl font-black leading-tight text-white md:text-6xl">
            Report a problem. <span className="text-zorange">Watch your town get fixed.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-gray-200">
            FixZed is Kazungula Town Council's digital reporting platform. One photo is all it
            takes — our AI classifies the issue, scores how precise your location is, and routes
            it to the right department in seconds. Emergencies ring an alarm at the council, live.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/report"
              className="rounded-lg bg-zgreen px-6 py-3 text-base font-bold text-white shadow-lg hover:bg-zdeep"
            >
              📷 Report an issue now
            </Link>
            <Link
              href="/login"
              className="rounded-lg border-2 border-white/70 px-6 py-3 text-base font-bold text-white hover:bg-white hover:text-zblack"
            >
              Council staff login
            </Link>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-zgreen">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 text-center text-white md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-black md:text-4xl">{s.value}</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-green-100">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-xs font-black tracking-widest text-zorange">OUR SERVICES</p>
        <h2 className="mt-1 text-3xl font-black text-zblack">
          One platform for every civic issue
        </h2>
        <p className="mt-2 max-w-2xl text-gray-600">
          From a burst pipe to a fire hazard, FixZed connects residents directly to the council
          teams responsible — no middlemen, no lost paperwork.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <article
              key={s.title}
              className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative h-44 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.img}
                  alt={s.title}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <span
                  className={`absolute left-3 top-3 rounded px-2 py-0.5 text-[10px] font-black tracking-wider text-white ${
                    s.tag === "EMERGENCY" ? "bg-zred" : s.tag === "INFRASTRUCTURE" ? "bg-zorange" : "bg-zgreen"
                  }`}
                >
                  {s.tag}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-zblack">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Emergency banner */}
      <section className="bg-zred">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center text-white md:flex-row md:text-left">
          <div className="text-5xl">🚨</div>
          <div className="flex-1">
            <h2 className="text-2xl font-black">Emergencies don't wait — and neither does FixZed</h2>
            <p className="mt-1 text-red-100">
              Urgent reports trigger a live flashing alarm with siren on the council dashboard and
              alert the Police Department with a flash call and SMS, day or night.
            </p>
          </div>
          <Link
            href="/report"
            className="rounded-lg bg-white px-6 py-3 font-bold text-zred shadow hover:bg-red-50"
          >
            Report an emergency
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-zcream">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-xs font-black tracking-widest text-zorange">HOW IT WORKS</p>
          <h2 className="mt-1 text-3xl font-black text-zblack">Four steps from photo to fix</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border border-green-100 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zgreen text-lg font-black text-white">
                  {s.n}
                </div>
                <h3 className="mt-3 font-bold text-zblack">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Departments */}
      <section id="departments" className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-xs font-black tracking-widest text-zorange">CONNECTED DEPARTMENTS</p>
        <h2 className="mt-1 text-3xl font-black text-zblack">
          Your report reaches the right desk
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DEPARTMENT_IDS.map((id) => {
            const d = DEPARTMENTS[id];
            return (
              <div
                key={id}
                className="rounded-xl border border-gray-200 p-4 transition hover:border-zgreen"
              >
                <div className="text-3xl">{d.emoji}</div>
                <h3 className="mt-2 text-sm font-bold text-zblack">{d.name}</h3>
                <p className="mt-1 text-xs text-gray-500">{d.blurb}</p>
                {d.emergency && (
                  <span className="mt-2 inline-block rounded bg-red-50 px-2 py-0.5 text-[10px] font-black tracking-wider text-zred">
                    EMERGENCY RESPONSE
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* About */}
      <section id="about" className="bg-zblack">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2">
          <div>
            <p className="text-xs font-black tracking-widest text-zorange">ABOUT FIXZED</p>
            <h2 className="mt-1 text-3xl font-black text-white">
              Built for Kazungula, with Kazungula
            </h2>
            <p className="mt-4 leading-relaxed text-gray-300">
              FixZed is a civic technology platform developed for Kazungula Town Council. It turns
              every resident's phone into a direct line to the people who maintain our roads,
              drains, water supply and public safety — and gives council staff one live dashboard
              to see, prioritise and act on every issue in the district.
            </p>
            <p className="mt-3 leading-relaxed text-gray-400">
              Transparent reporting. Faster response. A town that works for everyone.
            </p>
            <Link
              href="/report"
              className="mt-6 inline-block rounded-lg bg-zorange px-6 py-3 font-bold text-white shadow hover:brightness-110"
            >
              Make your first report
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/partnership.png"
              alt="Partnership between residents and council"
              className="h-72 w-full object-cover md:h-80"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zdeep">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm text-green-100 md:grid-cols-3">
          <div>
            <Wordmark light className="text-2xl" />
            <p className="mt-3 leading-relaxed text-green-200">
              The official citizen issue-reporting platform of Kazungula Town Council.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-white">Quick links</h3>
            <ul className="mt-3 space-y-2">
              <li><Link href="/report" className="hover:text-white">Report an issue</Link></li>
              <li><Link href="/login" className="hover:text-white">Staff login</Link></li>
              <li><a href="#services" className="hover:text-white">Services</a></li>
              <li><a href="#how" className="hover:text-white">How it works</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-white">Emergency contacts</h3>
            <ul className="mt-3 space-y-2">
              <li>Police Department: <b className="text-white">0975 170 412</b></li>
              <li>Fire & Rescue: via FixZed emergency report</li>
              <li>Kazungula Town Council · Southern Province, Zambia</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-green-800 py-4 text-center text-xs text-green-200">
          © {new Date().getFullYear()} FixZed · Kazungula Town Council. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
