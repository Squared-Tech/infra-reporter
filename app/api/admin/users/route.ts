import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAdmin(req: Request) {
  const svc = adminClient();
  if (!svc) return { error: "SUPABASE_SERVICE_ROLE_KEY is not set on the server" };
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Not signed in" };
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data.user) return { error: "Not signed in" };
  const { data: p } = await svc
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  if (p?.role !== "admin") return { error: "Admin only" };
  return { svc, userId: data.user.id };
}

export async function GET(req: Request) {
  const g = await requireAdmin(req);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: 403 });
  const { data, error } = await g.svc.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = data.users.map((u) => u.id);
  const { data: profs } = await g.svc.from("profiles").select("id,role").in("id", ids);
  const roleOf = new Map((profs ?? []).map((p: any) => [p.id, p.role]));
  return NextResponse.json({
    users: data.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      role: roleOf.get(u.id) ?? "citizen",
      created_at: u.created_at,
    })),
  });
}

export async function POST(req: Request) {
  const g = await requireAdmin(req);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const { email, password, full_name, role } = body ?? {};
  if (!email || !password || String(password).length < 6) {
    return NextResponse.json(
      { error: "Email and a password of 6+ characters are required" },
      { status: 400 }
    );
  }
  const allowed = ["citizen", "council", "admin"];
  const r = allowed.includes(role) ? role : "citizen";
  const { data, error } = await g.svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name ?? "" },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await g.svc.from("profiles").upsert({ id: data.user.id, role: r });
  return NextResponse.json({ ok: true, id: data.user.id, role: r });
}

export async function PATCH(req: Request) {
  const g = await requireAdmin(req);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: 403 });
  const { id, role } = await req.json().catch(() => ({}));
  const allowed = ["citizen", "council", "admin"];
  if (!id || !allowed.includes(role)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { error } = await g.svc.from("profiles").update({ role }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
