"use client";

import { useMemo, useState, useTransition } from "react";

import { recordPaymentAction } from "@/actions/operations";
import { StudentSearchSelect } from "@/components/students/student-search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Student = { id: string; full_name: string; admission_no: string };
type Due = {
  id: string;
  student_id: string;
  total_due: number;
  amount_paid: number;
  due_month: number;
  due_year: number;
};

export function RecordPaymentForm({
  students,
  dues,
}: {
  students: Student[];
  dues: Due[];
}) {
  const [studentId, setStudentId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const studentDues = useMemo(
    () => dues.filter((d) => d.student_id === studentId),
    [dues, studentId],
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await recordPaymentAction({
            student_id: studentId,
            fee_due_id: String(fd.get("fee_due_id") ?? "") || undefined,
            amount: Number(fd.get("amount") ?? 0),
            method: String(fd.get("method") ?? "cash") as
              | "cash"
              | "bank_transfer"
              | "card"
              | "online",
            bank_reference: String(fd.get("bank_reference") ?? "") || undefined,
          });
          setMessage(result.error ? result.error : "Payment submitted for review");
          if (!result.error) {
            e.currentTarget.reset();
            setStudentId("");
          }
        });
      }}
    >
      <StudentSearchSelect
        students={students}
        value={studentId}
        onChange={setStudentId}
        required
      />
      <div className="space-y-1">
        <Label htmlFor="fee_due_id">Fee due (optional)</Label>
        <select
          id="fee_due_id"
          name="fee_due_id"
          className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm md:h-9"
        >
          <option value="">None</option>
          {studentDues.map((d) => (
            <option key={d.id} value={d.id}>
              {d.due_month}/{d.due_year} · balance{" "}
              {(Number(d.total_due) - Number(d.amount_paid)).toFixed(2)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="amount">Amount</Label>
        <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="method">Method</Label>
        <select
          id="method"
          name="method"
          className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm md:h-9"
          defaultValue="cash"
        >
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="card">Card</option>
          <option value="online">Online</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="bank_reference">Bank reference</Label>
        <Input id="bank_reference" name="bank_reference" />
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <Button
        type="submit"
        pending={pending}
        pendingLabel="Saving…"
        className="bg-[#0b3d2e]"
      >
        Submit payment
      </Button>
    </form>
  );
}
