import { NextResponse } from "next/server";
import { deptInfo, catInfo } from "@/lib/departments";

const AT_BASE = "https://api.africastalking.com/version1";

function atHeaders() {
  return {
    apiKey: process.env.AFRICASTALKING_API_KEY!,
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function username() {
  return process.env.AFRICASTALKING_USERNAME || "sandbox";
}

async function atPost(path: string, form: URLSearchParams) {
  const r = await fetch(`${AT_BASE}/${path}`, {
    method: "POST",
    headers: atHeaders(),
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
  if (!process.env.AFRICASTALKING_API_KEY) {
    return NextResponse.json({
      status: "skipped",
      reason: "Africa's Talking API key not set on the server",
    });
  }

  const origin = new URL(req.url).origin;
  const ref = reportId ? String(reportId).slice(0, 8).toUpperCase() : "NEW";
  const where = address ? ` at ${address}` : "";
  const smsBody =
    `FIXZED ${dept.emergency ? "EMERGENCY" : "ALERT"}: ${cat.label} ` +
    `(severity ${severity ?? "?"}/5)${where}. ` +
    `Check your emergency portal now: ${origin}/dashboard  Ref ${ref}`;

  let callSent = false;
  let smsSent = false;
  const errors: string[] = [];

  // Flash / missed call for emergency departments (ring, no answer expected).
  const voiceFrom = process.env.AFRICASTALKING_VOICE_FROM;
  if (dept.emergency && voiceFrom) {
    const callForm = new URLSearchParams({
      username: username(),
      from: voiceFrom,
      to: dept.phone,
    });
    const c = await atPost("calling", callForm);
    const entry = c.data?.entries?.[0];
    if (c.ok && entry && entry.status !== "Failed") callSent = true;
    else errors.push(`call: ${entry?.errorMessage ?? c.data?.errorMessage ?? "failed"}`);
  }

  // Follow-up SMS ("check your emergency portal").
  const smsForm = new URLSearchParams({
    username: username(),
    to: dept.phone,
    message: smsBody,
  });
  const smsFrom = process.env.AFRICASTALKING_SMS_FROM;
  if (smsFrom) smsForm.set("from", smsFrom);
  const s = await atPost("messaging", smsForm);
  const recip = s.data?.SMSMessageData?.Recipients?.[0];
  if (s.ok && (!recip || recip.status === "Success")) smsSent = true;
  else errors.push(`sms: ${recip?.statusCode ?? s.data?.SMSMessageData?.Message ?? "failed"}`);

  if (callSent || smsSent) {
    return NextResponse.json({
      status: "sent",
      phone: dept.phone,
      call: callSent,
      sms: smsSent,
      emergency: dept.emergency,
    });
  }
  return NextResponse.json({ status: "failed", errors, phone: dept.phone }, { status: 502 });
}
