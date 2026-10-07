"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Stripe, Wordmark } from "@/components/Brand";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
      p?.role === "council" || p?.role === "admin" ? "/dashboard" : "/report"
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) {
        setMsg(error.message);
        setBusy(false);
        return;
      }
      if (!data.session) {
        setSentTo(email);
        setCode("");
        setBusy(false);
        return;
      }
      await routeByRole(data.user!.id);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      if (error?.message.toLowerCase().includes("not confirmed")) {
        await resend(email);
        setSentTo(email);
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
    <div className="min-h-screen flex flex-col">
      <header className="bg-zgreen">
        <div className="max-w-md mx-auto px-5 py-4">
          <a href="/">
            <Wordmark light className="text-2xl" />
          </a>
        </div>
        <Stripe />
      </header>

      <main className="max-w-md w-full mx-auto p-5 flex-1">
        {sentTo ? (
          <div className="bg-white rounded-2xl shadow p-6 text-center space-y-3 border-t-4 border-zorange">
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
          <div className="bg-white rounded-2xl shadow p-6 space-y-3 border-t-4 border-zgreen">
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
            <input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
            <input
              placeholder="Password (min 6 characters)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />

            <button
              onClick={go}
              disabled={busy || !email || password.length < 6 || (mode === "up" && !name)}
              className="w-full bg-zgreen hover:brightness-110 text-white font-bold rounded-xl p-3 disabled:opacity-40"
            >
              {busy ? "Please wait..." : mode === "in" ? "Log in" : "Create account"}
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
      </main>
    </div>
  );
}