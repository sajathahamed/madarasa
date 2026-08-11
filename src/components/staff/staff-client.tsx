"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createStaffMemberAction,
  updateStaffMemberAction,
} from "@/actions/staff";
import { StudentSearchInput } from "@/components/students/student-search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { matchesStudentQuery } from "@/lib/student-search";

type Staff = {
  id: string;
  full_name: string;
  staff_code: string | null;
  phone: string | null;
  email: string | null;
  role_title: string | null;
  address: string | null;
  status: string;
  notes: string | null;
};

export function StaffClient({
  vendorId,
  branchId,
  staff,
  canManage,
}: {
  vendorId: string;
  branchId: string;
  staff: Staff[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return staff.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return matchesStudentQuery(
        {
          full_name: s.full_name,
          admission_no: s.staff_code,
          guardian_phone: s.phone,
        },
        query,
      );
    });
  }, [staff, query, statusFilter]);

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-[#0b3d2e]">{message}</p> : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Add staff</CardTitle>
            <CardDescription>
              Teachers and other staff — they can also borrow library books.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                startTransition(async () => {
                  const result = await createStaffMemberAction({
                    vendor_id: vendorId,
                    branch_id: branchId,
                    full_name: String(fd.get("full_name") ?? ""),
                    staff_code: String(fd.get("staff_code") ?? "") || null,
                    phone: String(fd.get("phone") ?? "") || null,
                    email: String(fd.get("email") ?? "") || null,
                    role_title: String(fd.get("role_title") ?? "") || null,
                    address: String(fd.get("address") ?? "") || null,
                    notes: String(fd.get("notes") ?? "") || null,
                    status: "active",
                  });
                  setMessage(result.error ? result.error : "Staff added");
                  if (!result.error) {
                    form.reset();
                    router.refresh();
                  }
                });
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" name="full_name" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="staff_code">Staff ID / code</Label>
                <Input id="staff_code" name="staff_code" placeholder="e.g. T-01" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="role_title">Role / title</Label>
                <Input
                  id="role_title"
                  name="role_title"
                  placeholder="Teacher, Librarian…"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" inputMode="tel" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  pending={pending && !editingId}
                  pendingLabel="Saving…"
                  disabled={pending || !vendorId || !branchId}
                  className="bg-[#0b3d2e]"
                >
                  Add staff
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Staff list</CardTitle>
          <CardDescription>Search by name, staff ID, or phone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <StudentSearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search staff…"
              className="max-w-md"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-2 text-sm md:h-9"
            >
              <option value="active">Active</option>
              <option value="left">Left</option>
              <option value="all">All</option>
            </select>
          </div>
          <ul className="space-y-2">
            {filtered.map((s) => (
              <li
                key={s.id}
                className={`rounded-lg border p-3 ${
                  s.status === "left"
                    ? "border-rose-200 bg-rose-50/80"
                    : "border-[#0b3d2e]/10 bg-white/70"
                }`}
              >
                {editingId === s.id && canManage ? (
                  <form
                    className="grid gap-2 sm:grid-cols-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      startTransition(async () => {
                        const result = await updateStaffMemberAction({
                          id: s.id,
                          full_name: String(fd.get("full_name") ?? ""),
                          staff_code: String(fd.get("staff_code") ?? "") || null,
                          phone: String(fd.get("phone") ?? "") || null,
                          email: String(fd.get("email") ?? "") || null,
                          role_title:
                            String(fd.get("role_title") ?? "") || null,
                          address: String(fd.get("address") ?? "") || null,
                          notes: String(fd.get("notes") ?? "") || null,
                          status: String(fd.get("status") ?? "active") as
                            | "active"
                            | "left",
                        });
                        setMessage(
                          result.error ? result.error : "Staff updated",
                        );
                        if (!result.error) {
                          setEditingId(null);
                          router.refresh();
                        }
                      });
                    }}
                  >
                    <Input name="full_name" defaultValue={s.full_name} required />
                    <Input
                      name="staff_code"
                      defaultValue={s.staff_code ?? ""}
                      placeholder="Staff ID"
                    />
                    <Input
                      name="role_title"
                      defaultValue={s.role_title ?? ""}
                      placeholder="Role"
                    />
                    <Input name="phone" defaultValue={s.phone ?? ""} />
                    <Input name="email" defaultValue={s.email ?? ""} />
                    <Input name="address" defaultValue={s.address ?? ""} />
                    <select
                      name="status"
                      defaultValue={s.status}
                      className="h-10 rounded-lg border border-input bg-background px-2 text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="left">Left</option>
                    </select>
                    <Input name="notes" defaultValue={s.notes ?? ""} />
                    <div className="flex gap-2 sm:col-span-2">
                      <Button type="submit" size="sm" pending={pending}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="text-sm">
                      <p className="font-medium text-[#0b3d2e]">{s.full_name}</p>
                      <p className="text-[#5a6f65]">
                        {s.staff_code || "No code"}
                        {s.role_title ? ` · ${s.role_title}` : ""}
                        {s.phone ? ` · ${s.phone}` : ""}
                      </p>
                      {s.email ? (
                        <p className="text-xs text-[#5a6f65]">{s.email}</p>
                      ) : null}
                      <div className="mt-1">
                        <StatusBadge value={s.status} />
                      </div>
                    </div>
                    {canManage ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(s.id)}
                      >
                        Edit
                      </Button>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="text-sm text-[#5a6f65]">No staff match.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
