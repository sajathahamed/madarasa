/** Shared SMS greeting + bilingual (English / Tamil) templates. */

export const ISLAMIC_SMS_GREETING =
  "Assalamu Alaikkum Warahmathullahi Wabarakathuhu";

export function withIslamicGreeting(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return ISLAMIC_SMS_GREETING;
  if (trimmed.startsWith(ISLAMIC_SMS_GREETING)) return trimmed;
  return `${ISLAMIC_SMS_GREETING}\n\n${trimmed}`;
}

/** Default blank compose template: greeting + EN + TA placeholders. */
export function defaultBulkSmsTemplate(): string {
  return withIslamicGreeting(
    [
      "English:",
      "Assalamu Alaikkum. This is a message from the madarasa office.",
      "",
      "தமிழ்:",
      "அஸ்ஸலாமு அலைக்கும். இது மதரஸா அலுவலகத்திலிருந்து ஒரு செய்தி.",
    ].join("\n"),
  );
}

export function paymentConfirmSmsMessage(opts: {
  studentName: string;
  amountText: string;
}): string {
  return withIslamicGreeting(
    [
      `English: Payment of LKR ${opts.amountText} for ${opts.studentName} has been received. JazakAllah khair.`,
      "",
      `தமிழ்: ${opts.studentName} அவர்களுக்கான LKR ${opts.amountText} கட்டணம் பெறப்பட்டது. ஜஸகல்லாஹு கைரன்.`,
    ].join("\n"),
  );
}

export function donationConfirmSmsMessage(opts: {
  donorName: string;
  amountText: string;
  collegeName: string;
}): string {
  return withIslamicGreeting(
    [
      `English: JazakAllah khair ${opts.donorName}. Your donation of LKR ${opts.amountText} to ${opts.collegeName} has been received. May Allah reward you.`,
      "",
      `தமிழ்: ஜஸகல்லாஹு கைரன் ${opts.donorName}. ${opts.collegeName}க்கு உங்கள் LKR ${opts.amountText} நன்கொடை பெறப்பட்டது. அல்லாஹ் உங்களுக்கு நற்கூலி அளிப்பானாக.`,
    ].join("\n"),
  );
}

export function feeReminderSmsMessage(opts: {
  studentName: string;
  amount: string;
  period: string;
}): string {
  return withIslamicGreeting(
    [
      `English: Fee reminder — ${opts.studentName} has ${opts.amount} outstanding for ${opts.period}. Please settle at the office.`,
      "",
      `தமிழ்: கட்டண நினைவூட்டல் — ${opts.studentName} அவர்களுக்கு ${opts.period} காலத்திற்கு ${opts.amount} நிலுவையுள்ளது. அலுவலகத்தில் செலுத்தவும்.`,
    ].join("\n"),
  );
}

export function paymentApprovedSmsMessage(opts: {
  studentName: string;
  amount: string;
}): string {
  return withIslamicGreeting(
    [
      `English: Payment of ${opts.amount} for ${opts.studentName} has been approved. JazakAllah khair.`,
      "",
      `தமிழ்: ${opts.studentName} அவர்களுக்கான ${opts.amount} கட்டணம் அங்கீகரிக்கப்பட்டது. ஜஸகல்லாஹு கைரன்.`,
    ].join("\n"),
  );
}
