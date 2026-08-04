"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createVendorAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateVendorForm() {
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
            const result = await createVendorAction({
              name: String(fd.get("name") ?? ""),
              address: String(fd.get("address") ?? "") || undefined,
              contact_phone: String(fd.get("contact_phone") ?? "") || undefined,
              whatsapp_number: String(fd.get("whatsapp_number") ?? ""),
            });
            if (result.error) {
              setMessage(result.error);
              return;
            }
            setMessage("Vendor created");
            form.reset();
            router.refresh();
          } catch (err) {
            setMessage(
              err instanceof Error ? err.message : "Unexpected error creating vendor",
            );
          }
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
      {message ? (
        <p
          className={`text-sm ${message.includes("created") ? "text-[#2f4a3f]" : "text-red-700"}`}
        >
          {message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="bg-[#0b3d2e]">
        {pending ? "Saving…" : "Create vendor"}
      </Button>
    </form>
  );
}
