"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    setMsg("");
    if (mode === "up") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) {
        setMsg(error.message);
        setBusy(false);
        return;
      }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setMsg(error?.message ?? "Login failed");
      setBusy(false);
      return;
    }
    const { data: p } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
    router.replace(p?.role === "council" ? "/dashboard" : "/");
  }

  return (
    <main className="max-w-sm mx-auto p-4 space-y-3">
      <h1 className="text-2xl font-bold">FixZed</h1>
      <p className="text-sm text-gray-500">
        {mode === "in" ? "Log in to report or manage issues." : "Create a citizen account."}
      </p>
      {mode === "up" && (
        <input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded p-2"
        />
      )}
      <input
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border rounded p-2"
      />
      <input
        placeholder="Password (min 6 characters)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border rounded p-2"
      />
      <button
        onClick={go}
        disabled={busy || !email || password.length < 6}
        className="w-full bg-blue-600 text-white rounded p-3 disabled:opacity-40"
      >
        {busy ? "Please wait..." : mode === "in" ? "Log in" : "Sign up"}
      </button>
      {msg && <p className="text-red-600 text-sm">{msg}</p>}
      <button
        onClick={() => setMode(mode === "in" ? "up" : "in")}
        className="w-full text-blue-600 underline text-sm"
      >
        {mode === "in" ? "No account? Sign up" : "Have an account? Log in"}
      </button>
    </main>
  );
}