"use client";

import { useState, useTransition } from "react";

import { createStudentAction } from "@/actions/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateStudentForm({
  vendorId,
  branchId,
}: {
  vendorId: string;
  branchId: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [isFree, setIsFree] = useState(false);

  if (!vendorId || !branchId) {
    return (
      <p className="text-sm text-[#5a6f65]">
        Branch-scoped role required to add students from this screen.
      </p>
    );
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await createStudentAction({
            vendor_id: vendorId,
            branch_id: branchId,
            admission_no: String(fd.get("admission_no") ?? ""),
            full_name: String(fd.get("full_name") ?? ""),
            dob: String(fd.get("dob") ?? "") || undefined,
            gender: String(fd.get("gender") ?? "") || undefined,
            guardian_name: String(fd.get("guardian_name") ?? ""),
            guardian_phone: String(fd.get("guardian_phone") ?? ""),
            address: String(fd.get("address") ?? "") || undefined,
            monthly_amount: Number(fd.get("monthly_amount") ?? 0),
            is_free: isFree,
            discount_percent: Number(fd.get("discount_percent") ?? 0),
            blood_group: String(fd.get("blood_group") ?? "") || undefined,
            allergies: String(fd.get("allergies") ?? "") || undefined,
            medical_conditions:
              String(fd.get("medical_conditions") ?? "") || undefined,
            emergency_contact_name:
              String(fd.get("emergency_contact_name") ?? "") || undefined,
            emergency_contact_phone:
              String(fd.get("emergency_contact_phone") ?? "") || undefined,
          });
          setMessage(result.error ? result.error : "Student created");
          if (!result.error) e.currentTarget.reset();
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="admission_no">Admission no</Label>
        <Input id="admission_no" name="admission_no" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="guardian_name">Guardian name</Label>
        <Input id="guardian_name" name="guardian_name" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="guardian_phone">Guardian phone</Label>
        <Input id="guardian_phone" name="guardian_phone" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="dob">DOB</Label>
        <Input id="dob" name="dob" type="date" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="gender">Gender</Label>
        <Input id="gender" name="gender" />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <input
          id="is_free"
          type="checkbox"
          checked={isFree}
          onChange={(e) => setIsFree(e.target.checked)}
        />
        <Label htmlFor="is_free">Fee-free student</Label>
      </div>
      {!isFree ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="monthly_amount">Monthly fee</Label>
            <Input
              id="monthly_amount"
              name="monthly_amount"
              type="number"
              step="0.01"
              min="0"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="discount_percent">Discount %</Label>
            <Input
              id="discount_percent"
              name="discount_percent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={0}
            />
          </div>
        </>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="blood_group">Blood group</Label>
        <Input id="blood_group" name="blood_group" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="allergies">Allergies</Label>
        <Input id="allergies" name="allergies" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="emergency_contact_name">Emergency contact</Label>
        <Input id="emergency_contact_name" name="emergency_contact_name" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="emergency_contact_phone">Emergency phone</Label>
        <Input id="emergency_contact_phone" name="emergency_contact_phone" />
      </div>
      <div className="sm:col-span-2 space-y-2">
        {message ? <p className="text-sm">{message}</p> : null}
        <Button
          type="submit"
          pending={pending}
          pendingLabel="Saving…"
          className="bg-[#0b3d2e]"
        >
          Create student
        </Button>
      </div>
    </form>
  );
}
