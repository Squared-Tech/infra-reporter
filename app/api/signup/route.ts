import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isZambiaMobile, phoneAccount, zambiaDigits } from "@/lib/phone";

// Supabase confirms email sign-ups, and a citizen with no email address cannot
// read that mail, so a phone account is created here with the phone number as
// its identity. The service role is needed to skip the email step, which means
// this route is deliberately open: it can only ever create a citizen.
function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  const svc = adminClient();
  if (!svc) return NextResponse.json({ error: "Accounts are unavailable right now." }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.full_name ?? "").trim().slice(0, 80);
  const password = String(body?.password ?? "");
  const digits = zambiaDigits(String(body?.phone ?? ""));

  if (!name) return NextResponse.json({ error: "Please give your name." }, { status: 400 });
  if (!isZambiaMobile(digits)) {
    return NextResponse.json(
      { error: "Use a Zambian mobile number, e.g. 0971 234 567." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Choose a password of at least 6 characters." }, { status: 400 });
  }

  const email = phoneAccount(digits);
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, phone: digits },
  });
  if (error) {
    const exists = /already|registered|duplicate/i.test(error.message);
    return NextResponse.json(
      { error: exists ? "That number already has an account. Log in instead." : error.message },
      { status: exists ? 409 : 400 }
    );
  }
  // Role is never taken from the request body.
  await svc.from("profiles").upsert({ id: data.user.id, role: "citizen" });
  return NextResponse.json({ ok: true, email });
}
