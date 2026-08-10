/** Shared phone helpers for SMS / WhatsApp click-to-chat. */

/** Digits only, Sri Lanka-aware (0XXXXXXXXX → 94XXXXXXXXX). */
export function toWhatsAppMsIsdn(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = `94${p.slice(1)}`;
  if (p.length === 9 && p.startsWith("7")) p = `94${p}`;
  return p;
}

export function isValidMobile(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  if (!digits || /^0+$/.test(digits) || digits.length < 9) return false;
  return true;
}

export function buildWhatsAppLink(phone: string, text: string): string {
  const msisdn = toWhatsAppMsIsdn(phone);
  return `https://wa.me/${msisdn}?text=${encodeURIComponent(text)}`;
}

export function feeReminderMessage(opts: {
  studentName: string;
  amount: string;
  period: string;
}): string {
  return `Madarasa fee reminder: ${opts.studentName} has ${opts.amount} outstanding for ${opts.period}. Please settle at the office.`;
}
