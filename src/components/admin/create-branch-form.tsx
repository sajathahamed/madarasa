"use client";

import { useState, useTransition } from "react";

import { createBranchAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VendorOption = { id: string; name: string };

export function CreateBranchForm({ vendors }: { vendors: VendorOption[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await createBranchAction({
            vendor_id: String(fd.get("vendor_id") ?? ""),
            name: String(fd.get("name") ?? ""),
            address: String(fd.get("address") ?? "") || undefined,
            contact_phone: String(fd.get("contact_phone") ?? "") || undefined,
          });
          setMessage(result.error ? result.error : "Branch created");
          if (!result.error) e.currentTarget.reset();
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="vendor_id">Vendor</Label>
        <select
          id="vendor_id"
          name="vendor_id"
          required
          className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
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
      {message ? <p className="text-sm text-[#2f4a3f]">{message}</p> : null}
      <Button type="submit" disabled={pending} className="bg-[#0b3d2e]">
        {pending ? "Saving…" : "Create branch"}
      </Button>
    </form>
  );
}
