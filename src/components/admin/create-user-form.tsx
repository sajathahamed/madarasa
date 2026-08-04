"use client";

import { useMemo, useState, useTransition } from "react";

import { createAppUserAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VendorOption = { id: string; name: string };
type BranchOption = { id: string; name: string; vendor_id: string };

const ROLES = [
  "super_admin",
  "vendor_admin",
  "data_entry",
  "accountant",
  "principal",
] as const;

export function CreateUserForm({
  vendors,
  branches,
}: {
  vendors: VendorOption[];
  branches: BranchOption[];
}) {
  const [role, setRole] = useState<(typeof ROLES)[number]>("vendor_admin");
  const [vendorId, setVendorId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredBranches = useMemo(
    () => branches.filter((b) => b.vendor_id === vendorId),
    [branches, vendorId],
  );

  const needsVendor = role !== "super_admin";
  const needsBranch = ["data_entry", "accountant", "principal"].includes(role);

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await createAppUserAction({
            email: String(fd.get("email") ?? ""),
            full_name: String(fd.get("full_name") ?? ""),
            role,
            vendor_id: needsVendor ? vendorId || null : null,
            branch_id: needsBranch
              ? String(fd.get("branch_id") ?? "") || null
              : null,
            phone: String(fd.get("phone") ?? "") || undefined,
            whatsapp_number: String(fd.get("whatsapp_number") ?? ""),
            temp_password: String(fd.get("temp_password") ?? "") || undefined,
          });

          if (result.error) {
            setMessage(result.error);
            return;
          }

          setMessage(
            `User created. Temp password: ${result.credentials?.tempPassword}`,
          );
          e.currentTarget.reset();
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
          className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="whatsapp_number">WhatsApp number</Label>
        <Input id="whatsapp_number" name="whatsapp_number" required />
      </div>
      {needsVendor ? (
        <div className="space-y-1">
          <Label htmlFor="vendor_id">Vendor</Label>
          <select
            id="vendor_id"
            name="vendor_id"
            required
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
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
      ) : null}
      {needsBranch ? (
        <div className="space-y-1">
          <Label htmlFor="branch_id">Branch</Label>
          <select
            id="branch_id"
            name="branch_id"
            required
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">Select branch</option>
            {filteredBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="temp_password">Temp password (optional)</Label>
        <Input id="temp_password" name="temp_password" />
      </div>
      <div className="md:col-span-2 space-y-2">
        {message ? <p className="text-sm text-[#2f4a3f]">{message}</p> : null}
        <Button type="submit" disabled={pending} className="bg-[#0b3d2e]">
          {pending ? "Creating…" : "Create user + send WhatsApp"}
        </Button>
      </div>
    </form>
  );
}
