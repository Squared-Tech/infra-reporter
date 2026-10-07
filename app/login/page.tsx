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
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function routeByRole(userId: string) {
    const { data: p } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    router.replace(p?.role === "council" ? "/dashboard" : "/report");
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("mode") === "up") setMode("up");
    if (q.get("verified")) setInfo("Email verified. Welcome to FixZed!");
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) routeByRole(data.session.user.id);
    });
  }, []);

  async function go() {
    setBusy(true);
    setMsg("");
    setInfo("");
    setNeedsConfirm(false);

    if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/login?verified=1`,
        },
      });
      if (error) {
        setMsg(error.message);
        setBusy(false);
        return;
      }
      if (!data.session) {
        setSentTo(email);
        setBusy(false);
        return;
      }
      await routeByRole(data.user!.id);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      if (error?.message.toLowerCase().includes("not confirmed")) setNeedsConfirm(true);
      setMsg(error?.message ?? "Login failed");
      setBusy(false);
      return;
    }
    await routeByRole(data.user.id);
  }

  async function resend(addr: string) {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: addr,
      options: { emailRedirectTo: `${window.location.origin}/login?verified=1` },
    });
    setInfo(
      error
        ? error.message
        : "Verification email sent again. Check your inbox and spam folder."
    );
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
            <h1 className="text-2xl font-extrabold">Check your email</h1>
            <p className="text-gray-600">
              We sent a verification link to <b>{sentTo}</b>. Click it to activate your
              account, then log in.
            </p>
            {info && <p className="text-zgreen text-sm font-semibold">{info}</p>}
            <button
              onClick={() => resend(sentTo)}
              className="w-full bg-zorange text-white font-bold rounded-xl p-3"
            >
              Resend email
            </button>
            <button
              onClick={() => {
                setSentTo("");
                setMode("in");
                setInfo("");
              }}
              className="text-zgreen underline text-sm"
            >
              Back to log in
            </button>
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
            {needsConfirm && (
              <button
                onClick={() => resend(email)}
                className="text-zorange underline text-sm font-semibold"
              >
                Resend verification email
              </button>
            )}

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