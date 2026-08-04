"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { parentLoginWithDetailsAction } from "@/actions/parent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ParentPortalClient() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-xl border border-[#0b3d2e]/10 bg-white/80 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await parentLoginWithDetailsAction({
            admission_no: String(fd.get("admission_no")),
            guardian_phone: String(fd.get("guardian_phone")),
          });
          if (result.error) setMessage(result.error);
          else router.refresh();
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="admission_no">Admission no</Label>
        <Input id="admission_no" name="admission_no" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="guardian_phone">Guardian phone</Label>
        <Input id="guardian_phone" name="guardian_phone" required />
      </div>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
      <Button type="submit" disabled={pending} className="w-full bg-[#0b3d2e]">
        {pending ? "Checking…" : "View child"}
      </Button>
    </form>
  );
}
