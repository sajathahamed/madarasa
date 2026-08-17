"use client";

import { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";

export type SmsLogRow = {
  id: string;
  sender_name: string | null;
  recipient_name: string | null;
  recipient_phone: string;
  message_body: string;
  purpose: string;
  status: string;
  sent_at: string | null;
  created_at: string;
};

export type SmsRecipientTotal = {
  phone: string;
  name: string | null;
  total: number;
  sent: number;
  failed: number;
};

function purposeLabel(purpose: string) {
  const map: Record<string, string> = {
    custom_sms: "Custom",
    bulk_student_sms: "Students bulk",
    bulk_staff_sms: "Staff bulk",
    payment_confirmation: "Payment",
    donation_confirmation: "Donation",
    fee_reminder: "Fee reminder",
    payment_approved: "Payment approved",
    password_reset: "Password reset",
    bulk: "Bulk",
    message: "Message",
  };
  return map[purpose] || purpose;
}

export function SmsLogClient({
  messages,
  totals,
}: {
  messages: SmsLogRow[];
  totals: SmsRecipientTotal[];
}) {
  const [q, setQ] = useState("");

  const filteredMessages = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return messages;
    return messages.filter((m) => {
      const hay = [
        m.sender_name,
        m.recipient_name,
        m.recipient_phone,
        m.message_body,
        m.purpose,
        m.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [messages, q]);

  const filteredTotals = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return totals;
    return totals.filter((t) => {
      const hay = [t.name, t.phone].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [totals, q]);

  const totalSent = messages.filter((m) => m.status === "sent").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[#5a6f65]">
            Every SMS is stored with sender, receiver, and body. Totals show how
            many messages went to each phone.
          </p>
          <p className="mt-1 text-sm font-medium text-[#1a2e24]">
            {messages.length} logged · {totalSent} sent successfully
          </p>
        </div>
        <Input
          className="max-w-xs"
          placeholder="Search sender, receiver, phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Totals by receiver</CardTitle>
            <CardDescription>
              How many messages were sent to each number
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTotals.length === 0 ? (
              <p className="text-sm text-[#5a6f65]">No SMS logged yet.</p>
            ) : (
              <ul className="divide-y divide-[#d5e0d9]">
                {filteredTotals.map((t) => (
                  <li
                    key={t.phone}
                    className="flex items-start justify-between gap-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-[#1a2e24]">
                        {t.name || "Unknown receiver"}
                      </p>
                      <p className="text-[#5a6f65]">{t.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#1a2e24]">
                        {t.total} total
                      </p>
                      <p className="text-xs text-[#5a6f65]">
                        {t.sent} sent
                        {t.failed ? ` · ${t.failed} failed` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Message history</CardTitle>
            <CardDescription>Newest first</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredMessages.length === 0 ? (
              <p className="text-sm text-[#5a6f65]">No messages match.</p>
            ) : (
              <ul className="max-h-[70vh] space-y-3 overflow-y-auto">
                {filteredMessages.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-lg border border-[#d5e0d9] bg-white p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-[#1a2e24]">
                        {m.sender_name || "System"} →{" "}
                        {m.recipient_name || m.recipient_phone}
                      </p>
                      <span
                        className={
                          m.status === "sent"
                            ? "text-xs font-medium text-emerald-700"
                            : m.status === "failed"
                              ? "text-xs font-medium text-rose-700"
                              : "text-xs font-medium text-amber-700"
                        }
                      >
                        {m.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#5a6f65]">
                      To {m.recipient_phone} · {purposeLabel(m.purpose)} ·{" "}
                      {formatDateTime(m.sent_at || m.created_at)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-[#1a2e24]">
                      {m.message_body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
