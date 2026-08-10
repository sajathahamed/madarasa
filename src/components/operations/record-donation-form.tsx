"use client";

import { useState, useTransition } from "react";

import { recordDonationAction } from "@/actions/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RecordDonationForm({
  vendorId,
  branchId,
}: {
  vendorId: string;
  branchId: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!vendorId || !branchId) {
    return (
      <p className="text-sm text-[#5a6f65]">
        Branch-scoped role required to record donations here.
      </p>
    );
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        startTransition(async () => {
          const result = await recordDonationAction({
            vendor_id: vendorId,
            branch_id: branchId,
            donor_name: String(fd.get("donor_name") ?? ""),
            donor_phone: String(fd.get("donor_phone") ?? "") || undefined,
            amount: Number(fd.get("amount") ?? 0),
            type: String(fd.get("type") ?? "cash") as "cash" | "bank_transfer",
            bank_reference: String(fd.get("bank_reference") ?? "") || undefined,
          });
          setMessage(result.error ? result.error : "Donation submitted for review");
          if (!result.error) form.reset();
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="donor_name">Donor name</Label>
        <Input id="donor_name" name="donor_name" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="donor_phone">Donor phone</Label>
        <Input id="donor_phone" name="donor_phone" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="amount">Amount</Label>
        <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="type">Type</Label>
        <select
          id="type"
          name="type"
          className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm md:h-9"
          defaultValue="cash"
        >
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
        </select>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="bank_reference">Bank reference</Label>
        <Input id="bank_reference" name="bank_reference" />
      </div>
      <div className="sm:col-span-2 space-y-2">
        {message ? <p className="text-sm">{message}</p> : null}
        <Button
          type="submit"
          pending={pending}
          pendingLabel="Saving…"
          className="bg-[#0b3d2e]"
        >
          Submit donation
        </Button>
      </div>
    </form>
  );
}
