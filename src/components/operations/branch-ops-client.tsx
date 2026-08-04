"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { ApprovalQueue } from "@/components/operations/approval-queue";
import { RecordPaymentForm } from "@/components/operations/record-payment-form";
import { RecordDonationForm } from "@/components/operations/record-donation-form";
import { CreateStudentForm } from "@/components/operations/create-student-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserRole } from "@/types/database";

type Branch = { id: string; name: string; vendor_id?: string };
type Student = { id: string; full_name: string; admission_no: string };
type Due = {
  id: string;
  student_id: string;
  total_due: number;
  amount_paid: number;
  due_month: number;
  due_year: number;
  branch_id?: string;
};
type Payment = {
  id: string;
  amount: number;
  status: string;
  method: string;
  student_id: string;
  created_at: string;
};
type Donation = {
  id: string;
  amount: number;
  status: string;
  type: string;
  donor_name: string;
  created_at: string;
};

export function BranchOpsClient({
  role,
  vendorId,
  defaultBranchId,
  homeHref,
  homeLabel,
  branches,
  students,
  dues,
  payments,
  donations,
}: {
  role: UserRole;
  vendorId: string | null;
  defaultBranchId: string | null;
  homeHref: string;
  homeLabel: string;
  branches: Branch[];
  students: Student[];
  dues: Due[];
  payments: Payment[];
  donations: Donation[];
}) {
  const [branchId, setBranchId] = useState(
    defaultBranchId || branches[0]?.id || "",
  );

  const canEnter = ["super_admin", "vendor_admin", "data_entry"].includes(role);
  const canReview = [
    "accountant",
    "principal",
    "vendor_admin",
    "super_admin",
  ].includes(role);

  const activeBranch = branches.find((b) => b.id === branchId) ?? branches[0];
  const activeVendorId = vendorId || activeBranch?.vendor_id || "";
  const activeBranchId =
    role === "data_entry" || role === "accountant" || role === "principal"
      ? defaultBranchId || branchId
      : branchId || activeBranch?.id || "";

  const branchStudents = useMemo(() => {
    if (!activeBranchId) return students;
    // students list is already scoped by RLS; keep all for payment recording
    return students;
  }, [students, activeBranchId]);

  const branchDues = useMemo(() => {
    if (!activeBranchId) return dues;
    return dues.filter((d) => !d.branch_id || d.branch_id === activeBranchId);
  }, [dues, activeBranchId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={homeHref} className="text-[#0b3d2e] underline">
          ← {homeLabel}
        </Link>
        {canEnter && branches.length > 0 && !defaultBranchId ? (
          <label className="flex items-center gap-2">
            <span className="text-[#5a6f65]">Working branch</span>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {!canEnter && !canReview ? (
        <p className="rounded-lg border border-[#0b3d2e]/10 bg-white/70 p-4 text-sm text-[#5a6f65]">
          Your role does not have branch operations access.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {canEnter ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Add student</CardTitle>
                <CardDescription>
                  Student, health info, and fee plan in one submit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreateStudentForm
                  vendorId={activeVendorId}
                  branchId={activeBranchId}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Record payment</CardTitle>
                <CardDescription>
                  Starts at pending accountant review.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RecordPaymentForm
                  students={branchStudents}
                  dues={branchDues}
                />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Record donation</CardTitle>
              </CardHeader>
              <CardContent>
                <RecordDonationForm
                  vendorId={activeVendorId}
                  branchId={activeBranchId}
                />
              </CardContent>
            </Card>
          </>
        ) : null}

        {canReview ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Approval queue</CardTitle>
              <CardDescription>
                Accountant → Principal → ledger post (atomic trigger).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApprovalQueue
                role={role}
                payments={payments}
                donations={donations}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
