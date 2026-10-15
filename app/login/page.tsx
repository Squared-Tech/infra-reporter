"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Stripe, Wordmark } from "@/components/Brand";
import InstallButton from "@/components/InstallButton";
import { isZambiaMobile, phoneAccount, zambiaDigits } from "@/lib/phone";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [kind, setKind] = useState<"email" | "phone">("phone");
  const [name, setName] = useState("");
  const [ident, setIdent] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");

  async function routeByRole(userId: string) {
    const { data: p } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    router.replace(
      p?.role === "council" || p?.role === "admin" ? "/dashboard" : "/where"
    );
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("mode") === "up") setMode("up");
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) routeByRole(data.session.user.id);
    });
  }, []);

  async function resend(addr: string) {
    const { error } = await supabase.auth.resend({ type: "signup", email: addr });
    setInfo(
      error
        ? error.message
        : "A new code has been sent. Check your inbox and spam folder."
    );
  }

  async function go() {
    setBusy(true);
    setMsg("");
    setInfo("");

    if (mode === "up") {
      if (kind === "phone") {
        if (!isZambiaMobile(ident)) {
          setMsg("Use a Zambian mobile number, e.g. 0971 234 567.");
          setBusy(false);
          return;
        }
        const r = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: name, phone: zambiaDigits(ident), password }),
        })
          .then((x) => x.json())
          .catch(() => null);
        if (!r?.ok) {
          setMsg(r?.error ?? "Could not create the account.");
          setBusy(false);
          return;
        }
        const s = await supabase.auth.signInWithPassword({ email: r.email, password });
        if (s.error || !s.data.user) {
          setInfo("Account created. Log in with your number and password.");
          setMode("in");
          setBusy(false);
          return;
        }
        await routeByRole(s.data.user.id);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: ident,
        password,
        options: { data: { full_name: name } },
      });
      if (error) {
        setMsg(error.message);
        setBusy(false);
        return;
      }
      if (!data.session) {
        setSentTo(ident);
        setCode("");
        setBusy(false);
        return;
      }
      await routeByRole(data.user!.id);
      return;
    }

    const addr =
      kind === "phone"
        ? phoneAccount(zambiaDigits(ident))
        : ident.trim().includes("@")
          ? ident.trim()
          : `${ident.trim().toLowerCase()}@fixzed.zm`;

    const { data, error } = await supabase.auth.signInWithPassword({ email: addr, password });
    if (error || !data.user) {
      if (error?.message.toLowerCase().includes("not confirmed")) {
        await resend(addr);
        setSentTo(addr);
        setCode("");
        setBusy(false);
        return;
      }
      setMsg(error?.message ?? "Login failed");
      setBusy(false);
      return;
    }
    await routeByRole(data.user.id);
  }

  async function verify() {
    setBusy(true);
    setMsg("");
    setInfo("");
    const { data, error } = await supabase.auth.verifyOtp({
      email: sentTo,
      token: code.trim(),
      type: "signup",
    });
    if (error || !data.user) {
      setMsg(error?.message ?? "Invalid or expired code");
      setBusy(false);
      return;
    }
    await routeByRole(data.user.id);
  }

  const inputCls =
    "w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-zgreen";

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Live photo backdrop */}
      <div className="fixed inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img/community.png"
          alt="Residents joining hands in unity"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zblack/80 via-zblack/60 to-zblack/80" />
      </div>

      <Stripe />
      <header className="mx-auto w-full max-w-md px-5 py-5 text-center">
        <a href="/">
          <Wordmark light className="text-3xl" />
        </a>
        <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-green-200">
          Citizen reporting for Zambia's local councils
        </p>
      </header>

      <main className="flex flex-1 items-center justify-center p-5">
        <div className="w-full max-w-md">
        {sentTo ? (
          <div className="rounded-2xl border-4 border-zorange bg-white p-6 text-center space-y-3 shadow-2xl">
            <div className="text-5xl">📧</div>
            <h1 className="text-2xl font-extrabold">Enter your code</h1>
            <p className="text-gray-600">
              We sent a 6-digit code to <b>{sentTo}</b>. Enter it below to verify your
              account.
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full border-2 border-zgreen rounded-xl p-3 text-center text-3xl font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-zorange"
            />
            <button
              onClick={verify}
              disabled={busy || code.length !== 6}
              className="w-full bg-zgreen hover:brightness-110 text-white font-bold rounded-xl p-3 disabled:opacity-40"
            >
              {busy ? "Verifying..." : "Verify and continue"}
            </button>
            {info && <p className="text-zgreen text-sm font-semibold">{info}</p>}
            {msg && <p className="text-zred text-sm">{msg}</p>}
            <button
              onClick={() => resend(sentTo)}
              className="text-zorange underline text-sm font-semibold"
            >
              Resend code
            </button>
            <div>
              <button
                onClick={() => {
                  setSentTo("");
                  setMode("in");
                  setInfo("");
                  setMsg("");
                }}
                className="text-zgreen underline text-sm"
              >
                Back to log in
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-4 border-zgreen bg-white p-6 space-y-3 shadow-2xl">
            <h1 className="text-3xl font-extrabold">
              {mode === "in" ? "Welcome back" : "Welcome to "}
              {mode === "up" && (
                <span className="font-black">
                  Fix<span className="text-zorange">Zed</span>
                </span>
              )}
            </h1>
            <p className="text-gray-600 text-sm">
              {mode === "in"
                ? "Log in to report problems or manage reports."
                : "Create your free citizen account and start reporting."}
            </p>

            {mode === "up" && (
              <input
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
              />
            )}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
              {(
                [
                  ["phone", "📱 Phone number"],
                  ["email", "✉️ Email"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setKind(k);
                    setIdent("");
                    setMsg("");
                  }}
                  aria-pressed={kind === k}
                  className={`rounded-lg p-2 text-sm font-bold ${
                    kind === k ? "bg-white text-zdeep shadow" : "text-gray-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              placeholder={
                kind === "phone"
                  ? "e.g. 0971 234 567"
                  : mode === "in"
                    ? "Email or username (admin)"
                    : "Email"
              }
              type={kind === "phone" ? "tel" : mode === "in" ? "text" : "email"}
              inputMode={kind === "phone" ? "tel" : undefined}
              autoComplete={kind === "phone" ? "tel" : "username"}
              value={ident}
              onChange={(e) => setIdent(e.target.value)}
              className={inputCls}
            />
            {kind === "phone" && (
              <p className="text-xs text-gray-500">
                No email address needed. Your number and the password you choose are your login.
              </p>
            )}
            <input
              placeholder="Password (min 6 characters)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />

            <button
              onClick={go}
              disabled={
                busy ||
                (kind === "phone" ? !isZambiaMobile(ident) : !ident.trim()) ||
                password.length < 6 ||
                (mode === "up" && !name)
              }
              className="w-full bg-zgreen hover:brightness-110 text-white font-bold rounded-xl p-3 disabled:opacity-40"
            >
              {busy
                ? "Please wait..."
                : mode === "in"
                  ? "Log in"
                  : kind === "phone"
                    ? "Create account with my number"
                    : "Create account"}
            </button>

            {info && <p className="text-zgreen text-sm font-semibold">{info}</p>}
            {msg && <p className="text-zred text-sm">{msg}</p>}

            <button
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setMsg("");
                setInfo("");
              }}
              className="w-full text-zgreen underline text-sm pt-1"
            >
              {mode === "in" ? "New here? Create an account" : "Have an account? Log in"}
            </button>
          </div>
        )}
        <div className="pt-2">
          <InstallButton compact />
        </div>
        </div>
      </main>
    </div>
  );
}