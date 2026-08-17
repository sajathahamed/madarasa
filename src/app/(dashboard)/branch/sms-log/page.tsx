import { redirect } from "next/navigation";

import { OpsShell } from "@/components/layout/ops-shell";
import {
  SmsLogClient,
  type SmsLogRow,
  type SmsRecipientTotal,
} from "@/components/sms/sms-log-client";
import { canManageAdminOps } from "@/lib/auth/session";
import { requireOpsContext } from "@/lib/ops-page";

export default async function SmsLogPage() {
  const { supabase, profile } = await requireOpsContext();

  if (!canManageAdminOps(profile.role)) {
    redirect("/branch");
  }

  let messagesQ = supabase
    .from("sms_messages")
    .select(
      "id, sender_name, recipient_name, recipient_phone, message_body, purpose, status, sent_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (profile.vendor_id) {
    messagesQ = messagesQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    messagesQ = messagesQ.eq("branch_id", profile.branch_id);
  }

  const { data: messages } = await messagesQ;
  const rows = (messages ?? []) as SmsLogRow[];

  const totalsMap = new Map<string, SmsRecipientTotal>();
  for (const m of rows) {
    const key = m.recipient_phone;
    const existing = totalsMap.get(key) ?? {
      phone: key,
      name: m.recipient_name,
      total: 0,
      sent: 0,
      failed: 0,
    };
    existing.total += 1;
    if (m.status === "sent") existing.sent += 1;
    if (m.status === "failed") existing.failed += 1;
    if (!existing.name && m.recipient_name) {
      existing.name = m.recipient_name;
    }
    totalsMap.set(key, existing);
  }

  const totals = [...totalsMap.values()].sort((a, b) => b.total - a.total);

  return (
    <OpsShell profile={profile} title="SMS log">
      <SmsLogClient messages={rows} totals={totals} />
    </OpsShell>
  );
}
