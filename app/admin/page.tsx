"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { Stripe, Wordmark } from "@/components/Brand";

type Row = { id: string; email: string; role: string; created_at?: string };

const ROLE_LABEL: Record<string, string> = {
  citizen: "🙋 Citizen",
  council: "🏛️ Council",
  admin: "👑 Admin (can create accounts)",
};

export default function Admin() {
  const { ready, role, email, logout } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState("citizen");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  const load = useCallback(async () => {
    const t = await token();
    const res = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${t}` },
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setErr(j.error ?? "Could not load users");
    else setUsers(j.users ?? []);
  }, [token]);

  useEffect(() => {
    if (ready && role === "admin") load();
  }, [ready, role, load]);

  useEffect(() => {
    if (ready && role !== "admin") router.replace("/dashboard");
  }, [ready, role, router]);

  async function create() {
    setBusy(true);
    setMsg("");
    setErr("");
    const t = await token();
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify({
        email: newEmail,
        password: newPass,
        full_name: name,
        role: newRole,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setErr(j.error ?? "Could not create the account");
    else {
      setMsg(`Account created for ${newEmail} (${newRole}). They can log in now.`);
      setNewEmail("");
      setNewPass("");
      setName("");
      load();
    }
    setBusy(false);
  }

  async function setRole(id: string, r: string) {
    const t = await token();
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify({ id, role: r }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Could not change role");
    } else {
      setErr("");
      load();
    }
  }

  if (!ready) return <p className="p-6 text-center text-gray-500">Loading...</p>;
  if (role !== "admin") return null;

  const inputCls =
    "w-full rounded-xl border border-amber-300/30 bg-black/30 p-3 text-white placeholder-amber-100/40 focus:outline-none focus:ring-2 focus:ring-amber-300";

  const counts = {
    admin: users.filter((u) => u.role === "admin").length,
    council: users.filter((u) => u.role === "council").length,
    citizen: users.filter((u) => u.role !== "admin" && u.role !== "council").length,
  };

  const card = "rounded-xl border border-amber-300/30 bg-white/5 px-4 py-3 text-center";

  const roleChip: Record<string, string> = {
    admin: "bg-amber-300 text-black",
    council: "bg-emerald-500 text-white",
    citizen: "bg-slate-500 text-white",
  };

  return (
    <div className="min-h-screen bg-zdeep text-white">
      <header className="border-b-4 border-amber-300 bg-gradient-to-r from-black via-slate-900 to-black">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <a href="/">
              <Wordmark light className="text-3xl" />
            </a>
            <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-widest text-black">
              👑 Admin console
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a href="/dashboard" className="font-semibold text-amber-300 underline">
              Dashboard
            </a>
            <button
              onClick={logout}
              className="rounded-full border border-amber-300/50 px-3 py-1 font-semibold hover:bg-amber-300/15"
            >
              Log out
            </button>
          </div>
        </div>
        <Stripe />
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="rounded-2xl border border-amber-300/30 bg-white/5 p-5 shadow-2xl backdrop-blur">
          <h1 className="text-2xl font-black text-amber-300">Accounts</h1>
          <p className="mt-1 text-sm text-amber-100/70">
            Signed in as {email}. You can open accounts for anyone, and change who
            is a citizen, council member or admin.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className={card}>
              <p className="text-3xl font-black text-amber-300">{counts.admin}</p>
              <p className="text-xs uppercase tracking-wider text-amber-100/70">
                👑 Admins
              </p>
            </div>
            <div className={card}>
              <p className="text-3xl font-black text-emerald-400">{counts.council}</p>
              <p className="text-xs uppercase tracking-wider text-amber-100/70">
                🏛️ Council
              </p>
            </div>
            <div className={card}>
              <p className="text-3xl font-black text-white">{counts.citizen}</p>
              <p className="text-xs uppercase tracking-wider text-amber-100/70">
                🙋 Citizens
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-amber-300/60 bg-white/5 p-5 space-y-3 shadow-2xl backdrop-blur">
          <h2 className="text-xl font-black text-amber-300">✨ Open a new account</h2>
          <p className="text-sm text-amber-100/70">
            Create an account for anyone: citizens, other council members, or another
            admin. The new user can log in straight away with the password you set.
          </p>
          <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          <input placeholder="Email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls} />
          <input placeholder="Temporary password (min 6)" type="text" value={newPass} onChange={(e) => setNewPass(e.target.value)} className={inputCls} />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className={inputCls}>
            <option className="text-black" value="citizen">🙋 Citizen</option>
            <option className="text-black" value="council">🏛️ Council member</option>
            <option className="text-black" value="admin">👑 Admin (can create accounts)</option>
          </select>
          <button
            onClick={create}
            disabled={busy || !newEmail || newPass.length < 6}
            className="w-full rounded-xl bg-amber-300 p-3 font-black text-black shadow-lg hover:brightness-110 disabled:opacity-40"
          >
            {busy ? "Creating..." : "Create account"}
          </button>
          {msg && (
            <p className="rounded-lg bg-emerald-500/20 p-2 text-sm font-semibold text-emerald-200">
              ✅ {msg}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-amber-300/30 bg-white/5 p-5 space-y-3 shadow-2xl backdrop-blur">
          <h2 className="text-xl font-black text-amber-300">All accounts ({users.length})</h2>
          {err && (
            <p className="rounded-lg bg-zred/25 p-2 text-sm text-red-200">{err}</p>
          )}
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-amber-300/20 bg-black/25 p-3 text-sm flex-wrap sm:flex-nowrap"
              >
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs font-black ${
                    roleChip[u.role] ?? roleChip.citizen
                  }`}
                >
                  {u.role}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-white">{u.email}</p>
                  <p className="text-xs text-amber-100/60">
                    {u.email === email ? "you · " : ""}
                    {ROLE_LABEL[u.role] ?? u.role}
                  </p>
                </div>
                <select
                  value={u.role}
                  onChange={(e) => setRole(u.id, e.target.value)}
                  className="rounded-lg border border-amber-300/30 bg-black/40 p-2 text-sm text-white"
                >
                  <option className="text-black" value="citizen">Citizen</option>
                  <option className="text-black" value="council">Council</option>
                  <option className="text-black" value="admin">Admin</option>
                </select>
              </div>
            ))}
            {users.length === 0 && !err && (
              <p className="text-amber-100/60 text-sm">Loading accounts...</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
