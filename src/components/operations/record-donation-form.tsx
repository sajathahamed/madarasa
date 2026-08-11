"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  recordDonationAction,
  sendDonationConfirmSmsAction,
} from "@/actions/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";

type SmsOffer = {
  donationId: string;
  donorName: string;
  amount: number;
  phone: string;
  collegeName: string;
  defaultMessage: string;
};

export function RecordDonationForm({
  vendorId,
  branchId,
  collegeName = "Madarasa",
}: {
  vendorId: string;
  branchId: string;
  collegeName?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [smsOffer, setSmsOffer] = useState<SmsOffer | null>(null);
  const [smsText, setSmsText] = useState("");
  const [smsFeedback, setSmsFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [smsPending, startSmsTransition] = useTransition();

  if (!vendorId || !branchId) {
    return (
      <p className="text-sm text-[#5a6f65]">
        Branch-scoped role required to record donations here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const amount = Number(fd.get("amount") ?? 0);
          const donorName = String(fd.get("donor_name") ?? "");
          const donorPhone = String(fd.get("donor_phone") ?? "").trim();
          startTransition(async () => {
            setSmsOffer(null);
            setSmsFeedback(null);
            const result = await recordDonationAction({
              vendor_id: vendorId,
              branch_id: branchId,
              donor_name: donorName,
              donor_phone: donorPhone || undefined,
              amount,
              type: String(fd.get("type") ?? "cash") as "cash" | "bank_transfer",
              bank_reference: String(fd.get("bank_reference") ?? "") || undefined,
              notes: String(fd.get("notes") ?? "") || undefined,
            });
            if (result.error) {
              setOk(false);
              setMessage(result.error);
              toast.error(result.error);
              return;
            }

            const college = result.collegeName || collegeName;
            const success = `Donation recorded — ${formatMoney(amount)} from ${donorName}.`;
            setOk(true);
            setMessage(success);
            toast.success(success);

            const phone = result.donorPhone || donorPhone;
            if (phone && result.donationId) {
              const amountText = Number(amount).toLocaleString("en-LK", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              const defaultMessage = `JazakAllah khair ${donorName}. Your donation of LKR ${amountText} to ${college} has been received. May Allah reward you.`;
              setSmsOffer({
                donationId: result.donationId,
                donorName,
                amount,
                phone,
                collegeName: college,
                defaultMessage,
              });
              setSmsText(defaultMessage);
            } else {
              setSmsFeedback("No donor phone — SMS skipped.");
            }

            form.reset();
          });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="donor_name">Donor name</Label>
          <Input id="donor_name" name="donor_name" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="donor_phone">Donor phone</Label>
          <Input
            id="donor_phone"
            name="donor_phone"
            placeholder="07XXXXXXXX (for SMS)"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
          />
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
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input id="notes" name="notes" placeholder="Purpose or remark" />
        </div>
        <div className="sm:col-span-2 space-y-2">
          {message ? (
            <p
              role="status"
              className={`rounded-lg border px-3 py-2 text-sm ${
                ok
                  ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-950"
                  : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              {ok ? "✓ " : ""}
              {message}
            </p>
          ) : null}
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

      {smsOffer ? (
        <div className="space-y-3 rounded-xl border border-sky-300 bg-sky-50 p-3 sm:col-span-2">
          <div>
            <p className="font-medium text-sky-950">Send SMS thank-you?</p>
            <p className="text-xs text-sky-900/80">
              Donor: {smsOffer.phone} · Mask: Upview Tech ·{" "}
              {smsOffer.collegeName}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="donation_sms_msg">Message</Label>
            <textarea
              id="donation_sms_msg"
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="bg-[#0b3d2e]"
              pending={smsPending}
              pendingLabel="Sending SMS…"
              onClick={() => {
                startSmsTransition(async () => {
                  const result = await sendDonationConfirmSmsAction({
                    donationId: smsOffer.donationId,
                    message: smsText,
                  });
                  if (result.error) {
                    setSmsFeedback(result.error);
                    toast.error(result.error);
                    return;
                  }
                  const msg = result.message || "SMS sent";
                  setSmsFeedback(msg);
                  toast.success(msg);
                  setSmsOffer(null);
                });
              }}
            >
              Send SMS
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={smsPending}
              onClick={() => {
                setSmsOffer(null);
                setSmsFeedback("SMS skipped.");
              }}
            >
              Skip SMS
            </Button>
          </div>
        </div>
      ) : null}

      {smsFeedback ? (
        <p className="text-sm text-[#0b3d2e]">{smsFeedback}</p>
      ) : null}
    </div>
  );
}
