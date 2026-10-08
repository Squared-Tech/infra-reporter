import { NextResponse } from "next/server";
import { deptInfo, catInfo } from "@/lib/departments";

const AT_BASE = "https://api.africastalking.com/version1";

type SendResult = { ok: boolean; detail: string; provider: string };

// ---- Africa's Talking (primary: option 2, needs a dedicated Sender ID for Zambia) ----

async function atSms(to: string, message: string): Promise<SendResult> {
  const form = new URLSearchParams({
    username: process.env.AFRICASTALKING_USERNAME || "sandbox",
    to,
    message,
  });
  const from = process.env.AFRICASTALKING_SMS_FROM;
  if (from) form.set("from", from);
  const r = await fetch(`${AT_BASE}/messaging`, {
    method: "POST",
    headers: {
      apiKey: process.env.AFRICASTALKING_API_KEY!,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const data = await r.json().catch(() => ({}));
  const recip = data?.SMSMessageData?.Recipients?.[0];
  const ok = r.ok && (!recip || recip.status === "Success");
  return {
    ok,
    detail: ok ? "africastalking" : `africastalking: ${recip?.status ?? data?.SMSMessageData?.Message ?? r.status}`,
    provider: "africastalking",
  };
}

async function atCall(to: string): Promise<SendResult> {
  const from = process.env.AFRICASTALKING_VOICE_FROM;
  if (!from) return { ok: false, detail: "no voice number", provider: "africastalking" };
  const form = new URLSearchParams({
    username: process.env.AFRICASTALKING_USERNAME || "sandbox",
    from,
    to,
  });
  const r = await fetch(`${AT_BASE}/calling`, {
    method: "POST",
    headers: {
      apiKey: process.env.AFRICASTALKING_API_KEY!,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const data = await r.json().catch(() => ({}));
  const entry = data?.entries?.[0];
  const ok = r.ok && !!entry && entry.status !== "Failed";
  return {
    ok,
    detail: ok ? "africastalking" : `africastalking call: ${entry?.errorMessage ?? data?.errorMessage ?? r.status}`,
    provider: "africastalking",
  };
}

// ---- Vonage (fallback: option 3) ----

async function vonageSms(to: string, message: string): Promise<SendResult> {
  const form = new URLSearchParams({
    api_key: process.env.VONAGE_API_KEY!,
    api_secret: process.env.VONAGE_API_SECRET!,
    from: process.env.VONAGE_FROM || "FixZed",
    to,
    text: message,
    type: "text",
  });
  const r = await fetch("https://rest.nexmo.com/sms/json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = await r.json().catch(() => ({}));
  const msg = data?.messages?.[0];
  const ok = r.ok && msg?.status === "0";
  return {
    ok,
    detail: ok ? "vonage" : `vonage: ${msg?.["error-text"] ?? r.status}`,
    provider: "vonage",
  };
}

// ---- WhatsApp Cloud API (primary text channel) ----
// Template body must be created in the Meta dashboard as:
//   FIXZED {{1}}: {{2}} (severity {{3}}/5) at {{4}}. Check your emergency portal now: {{5}}

async function waText(to: string, vars: string[]): Promise<SendResult> {
  const phoneId = process.env.WHATSAPP_PHONE_ID!;
  const digits = to.replace(/\D/g, "");
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: digits,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE || "fixzed_alert",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: vars.map((text) => ({ type: "text", text })),
          },
        ],
      },
    }),
  });
  const data = await r.json().catch(() => ({}));
  const ok = r.ok && !!data?.messages?.[0]?.id;
  return {
    ok,
    detail: ok ? "whatsapp" : `whatsapp: ${data?.error?.message ?? r.status}`,
    provider: "whatsapp",
  };
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

  const atOn = !!process.env.AFRICASTALKING_API_KEY;
  const vonageOn = !!process.env.VONAGE_API_KEY && !!process.env.VONAGE_API_SECRET;
  const waOn = !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID;
  if (!atOn && !vonageOn && !waOn) {
    return NextResponse.json({
      status: "skipped",
      reason: "no alert provider configured (set WhatsApp, Africa's Talking or Vonage env vars)",
    });
  }

  const origin = new URL(req.url).origin;
  const ref = reportId ? String(reportId).slice(0, 8).toUpperCase() : "NEW";
  const where = address ? ` at ${address}` : "";
  const smsBody =
    `FIXZED ${dept.emergency ? "EMERGENCY" : "ALERT"}: ${cat.label} ` +
    `(severity ${severity ?? "?"}/5)${where}. ` +
    `Check your emergency portal now: ${origin}/dashboard  Ref ${ref}`;

  const errors: string[] = [];
  let callSent = false;
  let smsSent = false;
  let smsProvider = "";

  // Flash / missed call for emergency departments (ring, no answer expected).
  if (dept.emergency && atOn && process.env.AFRICASTALKING_VOICE_FROM) {
    const c = await atCall(dept.phone);
    if (c.ok) callSent = true;
    else errors.push(c.detail);
  }

  // Text: WhatsApp first, then Africa's Talking, then Vonage.
  if (waOn) {
    const w = await waText(dept.phone, [
      dept.emergency ? "EMERGENCY" : "ALERT",
      cat.label,
      String(severity ?? "?"),
      address || "unknown location",
      `${origin}/dashboard Ref ${ref}`,
    ]);
    if (w.ok) {
      smsSent = true;
      smsProvider = "whatsapp";
    } else errors.push(w.detail);
  }
  if (!smsSent && atOn) {
    const a = await atSms(dept.phone, smsBody);
    if (a.ok) {
      smsSent = true;
      smsProvider = "africastalking";
    } else errors.push(a.detail);
  }
  if (!smsSent && vonageOn) {
    const v = await vonageSms(dept.phone, smsBody);
    if (v.ok) {
      smsSent = true;
      smsProvider = "vonage";
    } else errors.push(v.detail);
  }

  if (callSent || smsSent) {
    return NextResponse.json({
      status: "sent",
      phone: dept.phone,
      call: callSent,
      sms: smsSent,
      provider: smsProvider,
      emergency: dept.emergency,
    });
  }
  return NextResponse.json({ status: "failed", errors, phone: dept.phone }, { status: 502 });
}
