import { catInfo, deptInfo } from "@/lib/departments";

const STATUS_LABEL: Record<string, string> = {
  reported: "🚨 Reported",
  in_progress: "🔧 In progress",
  fixed: "✅ Fixed",
};

// wa.me only accepts international digits: 0971... and 260971... both become 260971...
export function waDigits(phone: string | null | undefined): string {
  const raw = (phone ?? "").replace(/[^\d]/g, "");
  if (raw.startsWith("260") && raw.length >= 12) return raw.slice(0, 15);
  if (raw.startsWith("0260")) return raw.slice(1);
  if (raw.startsWith("0") && raw.length === 10) return `260${raw.slice(1)}`;
  if (raw.length === 9) return `260${raw}`;
  return "";
}

export function mapsLink(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return "";
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

// A forwardable summary of one case, ready to paste into a WhatsApp chat.
export function caseMessage(r: any): string {
  const lines = [
    `🚨 FIXZED case: ${catInfo(r.category).emoji} ${catInfo(r.category).label}`,
    `Severity: ${r.severity}/5 · Location confidence: ${r.location_confidence ?? "unrated"}`,
    `Department: ${deptInfo(r.department).emoji} ${deptInfo(r.department).name}`,
    `Status: ${STATUS_LABEL[r.status] ?? r.status}`,
    `Where: ${r.address ?? "address unavailable"}`,
  ];
  if (r.compound) lines.push(`Compound: ${r.compound}`);
  if (r.district || r.province) lines.push([r.district, r.province].filter(Boolean).join(", "));
  const map = mapsLink(r.lat, r.lng);
  if (map) lines.push(`Map pin: ${map}`);
  if (r.reason) lines.push(`Findings: ${r.reason}`);
  if (r.suggested_action) lines.push(`Next action: ${r.suggested_action}`);
  lines.push("Sent from FixZed: fixzed.netlify.app");
  return lines.join("\n");
}

export function waShareUrl(r: any, phone?: string | null): string {
  const n = waDigits(phone);
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(caseMessage(r))}`;
}

// navigator.clipboard is blocked unless the page holds write permission, so fall
// back to a hidden textarea and execCommand for older and mobile browsers.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
