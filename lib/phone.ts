import { waDigits } from "@/lib/share";

// A phone-only citizen account has no mailbox, so its Supabase identity is the
// normalised number on the same synthetic domain the admin username logins use.
export function phoneAccount(digits: string) {
  return `${digits}@fixzed.zm`;
}

export function isZambiaMobile(raw: string) {
  return /^260\d{9}$/.test(waDigits(raw));
}

export function zambiaDigits(raw: string) {
  return waDigits(raw);
}
