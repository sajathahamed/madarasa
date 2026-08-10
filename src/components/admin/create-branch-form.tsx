"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createBranchAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VendorOption = { id: string; name: string };

export function CreateBranchForm({ vendors }: { vendors: VendorOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setMessage(null);
        startTransition(async () => {
          try {
            const result = await createBranchAction({
              vendor_id: String(fd.get("vendor_id") ?? ""),
              name: String(fd.get("name") ?? ""),
              address: String(fd.get("address") ?? "") || undefined,
              contact_phone: String(fd.get("contact_phone") ?? "") || undefined,
            });
            if (result.error) {
              setMessage(result.error);
              return;
            }
            setMessage("Branch created");
            form.reset();
            router.refresh();
          } catch (err) {
            setMessage(
              err instanceof Error ? err.message : "Unexpected error creating branch",
            );
          }
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="vendor_id">Vendor</Label>
        <select
          id="vendor_id"
          name="vendor_id"
          required
          className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm md:h-9"
        >
          <option value="">Select vendor</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="name">Branch name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="contact_phone">Contact phone</Label>
        <Input id="contact_phone" name="contact_phone" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" />
      </div>
      {message ? (
        <p
          className={`text-sm ${message.includes("created") ? "text-[#2f4a3f]" : "text-red-700"}`}
        >
          {message}
        </p>
      ) : null}
      <Button
        type="submit"
        pending={pending}
        pendingLabel="Saving…"
        className="bg-[#0b3d2e]"
      >
        Create branch
      </Button>
    </form>
  );
}
