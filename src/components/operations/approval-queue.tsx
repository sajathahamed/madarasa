"use client";

import { useState, useTransition } from "react";

import { reviewTransactionAction } from "@/actions/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserRole } from "@/types/database";

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  method: string;
  student_id: string;
  created_at: string;
};

type DonationRow = {
  id: string;
  amount: number;
  status: string;
  type: string;
  donor_name: string;
  created_at: string;
};

export function ApprovalQueue({
  role,
  payments,
  donations,
}: {
  role: UserRole;
  payments: PaymentRow[];
  donations: DonationRow[];
}) {
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const act = (
    kind: "payment" | "donation",
    id: string,
    decision: "approve" | "reject",
  ) => {
    startTransition(async () => {
      const result = await reviewTransactionAction({
        kind,
        id,
        decision,
        remarks: remarks[id],
      });
      setMessage(result.error ? result.error : `Marked ${decision}`);
    });
  };

  if (payments.length === 0 && donations.length === 0) {
    return <p className="text-sm text-[#5a6f65]">No items awaiting your action.</p>;
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm">{message}</p> : null}

      <div>
        <h3 className="mb-2 font-medium">Payments</h3>
        <div className="space-y-3">
          {payments.map((p) => {
            const canAct =
              (role === "accountant" && p.status === "pending_accountant") ||
              (role === "principal" && p.status === "pending_principal") ||
              role === "super_admin" ||
              (role === "vendor_admin" &&
                process.env.NEXT_PUBLIC_VENDOR_ADMIN_CAN_APPROVE === "true");

            return (
              <div
                key={p.id}
                className="rounded-lg border border-[#0b3d2e]/10 bg-white/60 p-3"
              >
                <p className="text-sm">
                  {Number(p.amount).toFixed(2)} · {p.method} · {p.status}
                </p>
                <Input
                  className="mt-2"
                  placeholder="Remarks"
                  value={remarks[p.id] ?? ""}
                  onChange={(e) =>
                    setRemarks((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                />
                {canAct ? (
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      disabled={pending}
                      className="bg-[#0b3d2e]"
                      onClick={() => act("payment", p.id, "approve")}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => act("payment", p.id, "reject")}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-medium">Donations</h3>
        <div className="space-y-3">
          {donations.map((d) => {
            const canAct =
              (role === "accountant" && d.status === "pending_accountant") ||
              (role === "principal" && d.status === "pending_principal") ||
              role === "super_admin";

            return (
              <div
                key={d.id}
                className="rounded-lg border border-[#0b3d2e]/10 bg-white/60 p-3"
              >
                <p className="text-sm">
                  {d.donor_name} · {Number(d.amount).toFixed(2)} · {d.type} ·{" "}
                  {d.status}
                </p>
                <Input
                  className="mt-2"
                  placeholder="Remarks"
                  value={remarks[d.id] ?? ""}
                  onChange={(e) =>
                    setRemarks((prev) => ({ ...prev, [d.id]: e.target.value }))
                  }
                />
                {canAct ? (
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      disabled={pending}
                      className="bg-[#0b3d2e]"
                      onClick={() => act("donation", d.id, "approve")}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => act("donation", d.id, "reject")}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
