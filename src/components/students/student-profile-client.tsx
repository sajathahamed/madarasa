"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  changeFeePlanAction,
  updateStudentAction,
} from "@/actions/students";
import { createParentLinkAction } from "@/actions/parent";
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
import { formatMoney, formatDate } from "@/lib/format";

type Student = {
  id: string;
  admission_no: string;
  full_name: string;
  dob: string | null;
  gender: string | null;
  guardian_name: string;
  guardian_phone: string;
  address: string | null;
  photo_url: string | null;
  status: string;
};

type Health = {
  blood_group: string | null;
  allergies: string | null;
  medical_conditions: string | null;
  current_medications: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
} | null;

type FeePlan = {
  monthly_amount: number;
  is_free: boolean;
  discount_percent: number;
} | null;

type Due = {
  id: string;
  due_month: number;
  due_year: number;
  total_due: number;
  amount_paid: number;
  status: string;
};

type Payment = {
  id: string;
  amount: number;
  status: string;
  method: string;
  created_at: string;
};

export function StudentProfileClient({
  student,
  health,
  feePlan,
  dues,
  payments,
  canEdit,
}: {
  student: Student;
  health: Health;
  feePlan: FeePlan;
  dues: Due[];
  payments: Payment[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [parentLink, setParentLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [isFree, setIsFree] = useState(feePlan?.is_free ?? false);

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-[#0b3d2e]">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Student, guardian, and health details</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canEdit) return;
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const result = await updateStudentAction({
                  id: student.id,
                  admission_no: String(fd.get("admission_no")),
                  full_name: String(fd.get("full_name")),
                  dob: String(fd.get("dob") || "") || null,
                  gender: String(fd.get("gender") || "") || null,
                  guardian_name: String(fd.get("guardian_name")),
                  guardian_phone: String(fd.get("guardian_phone")),
                  address: String(fd.get("address") || "") || null,
                  photo_url: String(fd.get("photo_url") || "") || null,
                  status: String(fd.get("status")) as
                    | "active"
                    | "left"
                    | "graduated",
                  blood_group: String(fd.get("blood_group") || "") || null,
                  allergies: String(fd.get("allergies") || "") || null,
                  medical_conditions:
                    String(fd.get("medical_conditions") || "") || null,
                  current_medications:
                    String(fd.get("current_medications") || "") || null,
                  emergency_contact_name:
                    String(fd.get("emergency_contact_name") || "") || null,
                  emergency_contact_phone:
                    String(fd.get("emergency_contact_phone") || "") || null,
                  notes: String(fd.get("notes") || "") || null,
                });
                setMessage(result.error ? result.error : "Saved");
                if (!result.error) router.refresh();
              });
            }}
          >
            <div className="space-y-1">
              <Label>Admission no</Label>
              <Input
                name="admission_no"
                defaultValue={student.admission_no}
                disabled={!canEdit}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input
                name="full_name"
                defaultValue={student.full_name}
                disabled={!canEdit}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Guardian</Label>
              <Input
                name="guardian_name"
                defaultValue={student.guardian_name}
                disabled={!canEdit}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Guardian phone</Label>
              <Input
                name="guardian_phone"
                defaultValue={student.guardian_phone}
                disabled={!canEdit}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>DOB</Label>
              <Input
                name="dob"
                type="date"
                defaultValue={student.dob ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1">
              <Label>Gender</Label>
              <Input
                name="gender"
                defaultValue={student.gender ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Address</Label>
              <Input
                name="address"
                defaultValue={student.address ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Photo URL</Label>
              <Input
                name="photo_url"
                defaultValue={student.photo_url ?? ""}
                disabled={!canEdit}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <select
                name="status"
                defaultValue={student.status}
                disabled={!canEdit}
                className="h-9 w-full rounded-lg border border-input bg-background px-2"
              >
                <option value="active">Active</option>
                <option value="left">Left</option>
                <option value="graduated">Graduated</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Blood group</Label>
              <Input
                name="blood_group"
                defaultValue={health?.blood_group ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1">
              <Label>Allergies</Label>
              <Input
                name="allergies"
                defaultValue={health?.allergies ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1">
              <Label>Medical conditions</Label>
              <Input
                name="medical_conditions"
                defaultValue={health?.medical_conditions ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1">
              <Label>Emergency contact</Label>
              <Input
                name="emergency_contact_name"
                defaultValue={health?.emergency_contact_name ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1">
              <Label>Emergency phone</Label>
              <Input
                name="emergency_contact_phone"
                defaultValue={health?.emergency_contact_phone ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Notes</Label>
              <Input
                name="notes"
                defaultValue={health?.notes ?? ""}
                disabled={!canEdit}
              />
            </div>
            {canEdit ? (
              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending} className="bg-[#0b3d2e]">
                  {pending ? "Saving…" : "Save profile"}
                </Button>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Fee plan</CardTitle>
            <CardDescription>
              Current:{" "}
              {feePlan
                ? feePlan.is_free
                  ? "Fee-free"
                  : `${formatMoney(feePlan.monthly_amount)} / mo (${feePlan.discount_percent}% off)`
                : "None"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  const result = await changeFeePlanAction({
                    student_id: student.id,
                    monthly_amount: Number(fd.get("monthly_amount") ?? 0),
                    is_free: isFree,
                    discount_percent: Number(fd.get("discount_percent") ?? 0),
                  });
                  setMessage(result.error ? result.error : "Fee plan updated");
                  if (!result.error) router.refresh();
                });
              }}
            >
              <label className="flex items-center gap-2 sm:col-span-3">
                <input
                  type="checkbox"
                  checked={isFree}
                  onChange={(e) => setIsFree(e.target.checked)}
                />
                Fee-free
              </label>
              {!isFree ? (
                <>
                  <div className="space-y-1">
                    <Label>Monthly amount</Label>
                    <Input
                      name="monthly_amount"
                      type="number"
                      step="0.01"
                      defaultValue={feePlan?.monthly_amount ?? 0}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Discount %</Label>
                    <Input
                      name="discount_percent"
                      type="number"
                      step="0.01"
                      defaultValue={feePlan?.discount_percent ?? 0}
                    />
                  </div>
                </>
              ) : null}
              <div className="flex items-end">
                <Button type="submit" disabled={pending} variant="outline">
                  Set new plan
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Money</CardTitle>
          <CardDescription>Dues and payments for this student</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-medium">Outstanding dues</h3>
            <ul className="space-y-2 text-sm">
              {dues.map((d) => (
                <li
                  key={d.id}
                  className="flex justify-between rounded-lg border border-[#0b3d2e]/10 px-3 py-2"
                >
                  <span>
                    {d.due_month}/{d.due_year} · {d.status}
                  </span>
                  <span>
                    {formatMoney(Number(d.amount_paid))} /{" "}
                    {formatMoney(Number(d.total_due))}
                  </span>
                </li>
              ))}
              {dues.length === 0 ? (
                <li className="text-[#5a6f65]">No dues yet.</li>
              ) : null}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Recent payments</h3>
            <ul className="space-y-2 text-sm">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between rounded-lg border border-[#0b3d2e]/10 px-3 py-2"
                >
                  <span>
                    {formatDate(p.created_at)} · {p.method} · {p.status}
                  </span>
                  <span>{formatMoney(Number(p.amount))}</span>
                </li>
              ))}
              {payments.length === 0 ? (
                <li className="text-[#5a6f65]">No payments yet.</li>
              ) : null}
            </ul>
          </div>
          {payments
            .filter((p) => p.status === "approved")
            .slice(0, 3)
            .map((p) => (
              <a
                key={`rcpt-${p.id}`}
                href={`/branch/fees/receipt/${p.id}`}
                className="block text-sm text-[#0b3d2e] underline"
              >
                Receipt {p.id.slice(0, 8)}…
              </a>
            ))}
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Parent link</CardTitle>
            <CardDescription>
              Share a read-only link for fees, attendance, and progress.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await createParentLinkAction(student.id);
                  if (result.error) setMessage(result.error);
                  else if (result.url) {
                    setParentLink(result.url);
                    setMessage("Parent link created");
                  }
                });
              }}
            >
              Generate parent link
            </Button>
            {parentLink ? (
              <p className="break-all rounded-lg bg-[#0b3d2e]/5 p-3 text-xs">
                {parentLink}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
