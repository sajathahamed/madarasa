"use client";

import { useState, useTransition } from "react";

import { createVendorAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateVendorForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await createVendorAction({
            name: String(fd.get("name") ?? ""),
            address: String(fd.get("address") ?? "") || undefined,
            contact_phone: String(fd.get("contact_phone") ?? "") || undefined,
            whatsapp_number: String(fd.get("whatsapp_number") ?? ""),
          });
          setMessage(result.error ? result.error : "Vendor created");
          if (!result.error) e.currentTarget.reset();
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="whatsapp_number">WhatsApp number</Label>
        <Input id="whatsapp_number" name="whatsapp_number" required />
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
        {pending ? "Saving…" : "Create vendor"}
      </Button>
    </form>
  );
}
