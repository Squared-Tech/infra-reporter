import { NextResponse } from "next/server";
import { deptInfo, catInfo } from "@/lib/departments";

const TWILIO = "https://api.twilio.com/2010-04-01/Accounts";

async function twilio(path: string, form: URLSearchParams) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const r = await fetch(`${TWILIO}/${sid}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { department, category, severity, address, reportId } = body ?? {};
  const dept = deptInfo(department);
  const cat = catInfo(category);

  if (!dept.phone) {
    return NextResponse.json({
      status: "skipped",
      reason: `no phone number configured for ${dept.name}`,
    });
  }
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM) {
    return NextResponse.json({
      status: "skipped",
      reason: "Twilio credentials not set on the server",
    });
  }

  const origin = new URL(req.url).origin;
  const ref = reportId ? String(reportId).slice(0, 8).toUpperCase() : "NEW";
  const where = address ? ` at ${address}` : "";
  const smsBody =
    `FIXZED ${dept.emergency ? "EMERGENCY" : "ALERT"}: ${cat.label} ` +
    `(severity ${severity ?? "?"}/5)${where}. ` +
    `Check your emergency portal now: ${origin}/dashboard  Ref ${ref}`;

  let callSid: string | null = null;
  let smsSid: string | null = null;
  const errors: string[] = [];

  if (dept.emergency) {
    const callForm = new URLSearchParams({
      From: process.env.TWILIO_FROM!,
      To: dept.phone,
      Timeout: "20",
      Twiml: "<Response><Hangup/></Response>",
    });
    const c = await twilio("Calls.json", callForm);
    if (c.ok) callSid = c.data.sid ?? null;
    else errors.push(`call: ${c.data?.message ?? "failed"}`);
  }

  const smsForm = new URLSearchParams({
    From: process.env.TWILIO_FROM!,
    To: dept.phone,
    Body: smsBody,
  });
  const s = await twilio("Messages.json", smsForm);
  if (s.ok) smsSid = s.data.sid ?? null;
  else errors.push(`sms: ${s.data?.message ?? "failed"}`);

  if (callSid || smsSid) {
    return NextResponse.json({
      status: "sent",
      phone: dept.phone,
      call: callSid,
      sms: smsSid,
      emergency: dept.emergency,
    });
  }
  return NextResponse.json({ status: "failed", errors, phone: dept.phone }, { status: 502 });
}
