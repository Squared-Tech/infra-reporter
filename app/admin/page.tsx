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
    "w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-zgreen";

  return (
    <div className="min-h-screen">
      <header className="bg-zdeep text-white">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/">
              <Wordmark light className="text-2xl" />
            </a>
            <span className="hidden sm:inline bg-white/15 rounded-full px-3 py-1 text-sm font-semibold">
              👑 Admin · account manager
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a href="/dashboard" className="underline font-semibold">
              Dashboard
            </a>
            <button onClick={logout} className="bg-white/15 hover:bg-white/25 rounded-full px-3 py-1">
              Log out
            </button>
          </div>
        </div>
        <Stripe />
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="bg-white rounded-2xl shadow p-5 space-y-3 border-t-4 border-zdeep">
          <h1 className="text-2xl font-extrabold">Open a new account</h1>
          <p className="text-sm text-gray-600">
            Create an account for anyone — citizens, other council members, or another
            admin. The new user can log in straight away with the password you set.
          </p>
          <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          <input placeholder="Email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls} />
          <input placeholder="Temporary password (min 6)" type="text" value={newPass} onChange={(e) => setNewPass(e.target.value)} className={inputCls} />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className={inputCls}>
            <option value="citizen">🙋 Citizen</option>
            <option value="council">🏛️ Council member</option>
            <option value="admin">👑 Admin (can create accounts)</option>
          </select>
          <button
            onClick={create}
            disabled={busy || !newEmail || newPass.length < 6}
            className="w-full bg-zdeep hover:brightness-125 text-white font-bold rounded-xl p-3 disabled:opacity-40"
          >
            {busy ? "Creating..." : "Create account"}
          </button>
          {msg && <p className="text-zgreen text-sm font-semibold">{msg}</p>}
        </div>

        <div className="bg-white rounded-2xl shadow p-5 space-y-3 border border-gray-100">
          <h2 className="text-xl font-extrabold">All accounts ({users.length})</h2>
          {err && <p className="text-zred text-sm">{err}</p>}
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm flex-wrap sm:flex-nowrap"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{u.email}</p>
                  <p className="text-xs text-gray-500">
                    {u.email === email ? "you · " : ""}
                    {ROLE_LABEL[u.role] ?? u.role}
                  </p>
                </div>
                <select
                  value={u.role}
                  onChange={(e) => setRole(u.id, e.target.value)}
                  className="border border-gray-300 rounded-lg p-2 text-sm bg-white"
                >
                  <option value="citizen">Citizen</option>
                  <option value="council">Council</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ))}
            {users.length === 0 && !err && (
              <p className="text-gray-500 text-sm">Loading accounts...</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
