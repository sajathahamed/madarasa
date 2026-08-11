"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  sendBulkStaffSmsAction,
  sendBulkStudentSmsAction,
  sendCustomSmsAction,
  type BulkStaffSmsResult,
  type BulkStudentSmsResult,
  type CustomSmsRecipientResult,
} from "@/actions/sms";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { classDisplayName } from "@/lib/academic-sections";
import type { AcademicSection } from "@/types/database";

type RecipientRow = { id: string; name: string; phone: string };

type SmsStudent = {
  id: string;
  full_name: string;
  admission_no: string;
  guardian_phone: string;
  class_id: string | null;
  class_name: string | null;
  section: AcademicSection | null;
  grade: number | null;
};

type SmsStaff = {
  id: string;
  full_name: string;
  staff_code: string | null;
  phone: string;
  role_title: string | null;
};

type SmsClass = {
  id: string;
  name: string;
  section: AcademicSection | null;
  grade: number | null;
};

type SmsMode = "students" | "staff" | "custom";

function newRow(): RecipientRow {
  return { id: crypto.randomUUID(), name: "", phone: "" };
}

function hasPhone(phone: string) {
  return phone.replace(/\D/g, "").length >= 9;
}

export function SendSmsClient({
  configured,
  mask,
  students,
  staff,
  classes,
}: {
  configured: boolean;
  mask: string;
  students: SmsStudent[];
  staff: SmsStaff[];
  classes: SmsClass[];
}) {
  const [mode, setMode] = useState<SmsMode>("students");
  const [recipients, setRecipients] = useState<RecipientRow[]>([newRow()]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customResults, setCustomResults] = useState<
    CustomSmsRecipientResult[] | null
  >(null);
  const [studentResults, setStudentResults] = useState<
    BulkStudentSmsResult[] | null
  >(null);
  const [staffResults, setStaffResults] = useState<BulkStaffSmsResult[] | null>(
    null,
  );
  const [banner, setBanner] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter !== "all") {
        if (classFilter === "unassigned") {
          if (s.class_id) return false;
        } else if (s.class_id !== classFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.admission_no.toLowerCase().includes(q) ||
        s.guardian_phone.toLowerCase().includes(q)
      );
    });
  }, [students, search, classFilter]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.staff_code || "").toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        (s.role_title || "").toLowerCase().includes(q)
      );
    });
  }, [staff, search]);

  const filteredIds = useMemo(() => {
    if (mode === "staff") return filteredStaff.map((s) => s.id);
    return filteredStudents.map((s) => s.id);
  }, [mode, filteredStaff, filteredStudents]);

  const selectedInView = filteredIds.filter((id) => selected.has(id)).length;
  const allFilteredSelected =
    filteredIds.length > 0 && selectedInView === filteredIds.length;

  const selectedWithPhone = useMemo(() => {
    let count = 0;
    for (const id of selected) {
      if (mode === "staff") {
        const s = staff.find((st) => st.id === id);
        if (s && hasPhone(s.phone)) count++;
      } else {
        const s = students.find((st) => st.id === id);
        if (s && hasPhone(s.guardian_phone)) count++;
      }
    }
    return count;
  }, [selected, students, staff, mode]);

  const selectedWithoutPhone = selected.size - selectedWithPhone;

  const updateRow = (id: string, patch: Partial<RecipientRow>) => {
    setRecipients((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  };

  const removeRow = (id: string) => {
    setRecipients((rows) =>
      rows.length <= 1 ? rows : rows.filter((r) => r.id !== id),
    );
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  };

  const switchMode = (next: SmsMode) => {
    setMode(next);
    setBanner(null);
    setCustomResults(null);
    setStudentResults(null);
    setStaffResults(null);
    setSelected(new Set());
    setSearch("");
    setClassFilter("all");
  };

  const applyBulkResult = (result: {
    error?: string;
    results?: BulkStudentSmsResult[] | BulkStaffSmsResult[];
    resultDesc?: string;
    message?: string;
    ok?: boolean;
    sent?: number;
  }) => {
    if (result.error && !("sent" in result)) {
      setBanner({ ok: false, text: result.error });
      toast.error(result.error);
      return;
    }

    if (result.results) {
      if (mode === "staff") {
        setStaffResults(result.results as BulkStaffSmsResult[]);
      } else {
        setStudentResults(result.results as BulkStudentSmsResult[]);
      }
    }

    const resultDesc = result.resultDesc ? String(result.resultDesc) : null;
    const text = result.message || result.error || "Done";
    const detail = resultDesc ? `${text} · resultDesc=${resultDesc}` : text;
    const ok = Boolean(result.ok);
    setBanner({ ok, text: detail });
    if (ok) toast.success(detail);
    else toast.error(detail);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setCustomResults(null);
    setStudentResults(null);
    setStaffResults(null);

    if (mode === "students") {
      if (selected.size === 0) {
        toast.error("Select at least one student");
        return;
      }

      startTransition(async () => {
        const result = await sendBulkStudentSmsAction({
          message,
          studentIds: [...selected],
        });
        applyBulkResult(result);
      });
      return;
    }

    if (mode === "staff") {
      if (selected.size === 0) {
        toast.error("Select at least one staff member");
        return;
      }

      startTransition(async () => {
        const result = await sendBulkStaffSmsAction({
          message,
          staffIds: [...selected],
        });
        applyBulkResult(result);
      });
      return;
    }

    startTransition(async () => {
      const result = await sendCustomSmsAction({
        message,
        recipients: recipients.map((r) => ({
          name: r.name.trim(),
          phone: r.phone.trim(),
        })),
      });

      if ("error" in result && result.error && !("sent" in result)) {
        setBanner({ ok: false, text: result.error });
        toast.error(result.error);
        return;
      }

      if ("results" in result && result.results) {
        setCustomResults(result.results);
      }

      const resultDesc =
        "resultDesc" in result && result.resultDesc
          ? String(result.resultDesc)
          : null;
      const text =
        ("message" in result && result.message) ||
        ("error" in result && result.error) ||
        "Done";
      const detail = resultDesc ? `${text} · resultDesc=${resultDesc}` : text;
      const ok = Boolean("ok" in result && result.ok);
      setBanner({ ok, text: detail });
      if (ok) toast.success(detail);
      else toast.error(detail);
    });
  };

  const bulkLabel =
    mode === "staff"
      ? `Send to ${selectedWithPhone || 0} staff`
      : `Send to ${selectedWithPhone || 0} student${selectedWithPhone === 1 ? "" : "s"}`;

  return (
    <form className="grid gap-6" onSubmit={onSubmit}>
      <div className="rounded-lg border border-[#0b3d2e]/15 bg-[#0b3d2e]/[0.03] px-3 py-2 text-sm text-[#5a6f65]">
        {configured ? (
          <p>
            Dialog Rich Communication · mask{" "}
            <span className="font-medium text-[#0b3d2e]">{mask}</span>
            {" · "}numbers sent comma-joined in one API call
          </p>
        ) : (
          <p className="text-amber-800">
            Dialog SMS credentials are not configured. Sends will fail until
            environment variables are set.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "students" ? "default" : "outline"}
          className={mode === "students" ? "bg-[#0b3d2e]" : ""}
          onClick={() => switchMode("students")}
          disabled={pending}
        >
          Students (bulk)
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "staff" ? "default" : "outline"}
          className={mode === "staff" ? "bg-[#0b3d2e]" : ""}
          onClick={() => switchMode("staff")}
          disabled={pending}
        >
          Staff (bulk)
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "custom" ? "default" : "outline"}
          className={mode === "custom" ? "bg-[#0b3d2e]" : ""}
          onClick={() => switchMode("custom")}
          disabled={pending}
        >
          Custom numbers
        </Button>
      </div>

      {mode === "students" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1 space-y-1">
              <Label htmlFor="sms-student-search">Search</Label>
              <Input
                id="sms-student-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, admission no, or phone"
                disabled={pending}
              />
            </div>
            {classes.length > 0 ? (
              <div className="space-y-1">
                <Label htmlFor="sms-class-filter">Class</Label>
                <select
                  id="sms-class-filter"
                  className="flex h-9 w-full min-w-[10rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  disabled={pending}
                >
                  <option value="all">All classes</option>
                  <option value="unassigned">Unassigned</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {classDisplayName(c.section, c.grade, c.name)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#5a6f65]">
            <p>
              {selected.size} selected
              {selectedWithoutPhone > 0
                ? ` · ${selectedWithoutPhone} without phone (will skip)`
                : ""}
              {" · "}
              {selectedWithPhone} ready to send
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleSelectAllFiltered}
              disabled={pending || filteredIds.length === 0}
            >
              {allFilteredSelected ? "Clear filtered" : "Select all filtered"}
            </Button>
          </div>

          <div className="max-h-72 overflow-auto rounded-lg border border-[#0b3d2e]/10">
            {filteredStudents.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[#5a6f65]">
                No active students match this filter.
              </p>
            ) : (
              <ul className="divide-y divide-[#0b3d2e]/10">
                {filteredStudents.map((s) => {
                  const phoneOk = hasPhone(s.guardian_phone);
                  const checked = selected.has(s.id);
                  return (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-[#0b3d2e]/[0.03]">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-[#0b3d2e]"
                          checked={checked}
                          onChange={() => toggleSelected(s.id)}
                          disabled={pending}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-[#0b3d2e]">
                            {s.full_name}
                          </span>
                          <span className="block text-xs text-[#5a6f65]">
                            {s.admission_no}
                            {s.class_name || s.section
                              ? ` · ${classDisplayName(s.section, s.grade, s.class_name)}`
                              : " · Unassigned"}
                            {" · "}
                            {phoneOk ? (
                              s.guardian_phone
                            ) : (
                              <span className="text-amber-800">No phone</span>
                            )}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {mode === "staff" ? (
        <div className="space-y-3">
          <div className="min-w-[12rem] space-y-1">
            <Label htmlFor="sms-staff-search">Search</Label>
            <Input
              id="sms-staff-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, code, role, or phone"
              disabled={pending}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#5a6f65]">
            <p>
              {selected.size} selected
              {selectedWithoutPhone > 0
                ? ` · ${selectedWithoutPhone} without phone (will skip)`
                : ""}
              {" · "}
              {selectedWithPhone} ready to send
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleSelectAllFiltered}
              disabled={pending || filteredIds.length === 0}
            >
              {allFilteredSelected ? "Clear filtered" : "Select all filtered"}
            </Button>
          </div>

          <div className="max-h-72 overflow-auto rounded-lg border border-[#0b3d2e]/10">
            {filteredStaff.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[#5a6f65]">
                No active staff match this filter.
              </p>
            ) : (
              <ul className="divide-y divide-[#0b3d2e]/10">
                {filteredStaff.map((s) => {
                  const phoneOk = hasPhone(s.phone);
                  const checked = selected.has(s.id);
                  return (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-[#0b3d2e]/[0.03]">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-[#0b3d2e]"
                          checked={checked}
                          onChange={() => toggleSelected(s.id)}
                          disabled={pending}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-[#0b3d2e]">
                            {s.full_name}
                          </span>
                          <span className="block text-xs text-[#5a6f65]">
                            {s.staff_code || "No code"}
                            {s.role_title ? ` · ${s.role_title}` : ""}
                            {" · "}
                            {phoneOk ? (
                              s.phone
                            ) : (
                              <span className="text-amber-800">No phone</span>
                            )}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {mode === "custom" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label>Recipients</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRecipients((rows) => [...rows, newRow()])}
              disabled={pending || recipients.length >= 50}
            >
              <Plus data-icon="inline-start" />
              Add recipient
            </Button>
          </div>

          <ul className="space-y-3">
            {recipients.map((row, index) => (
              <li
                key={row.id}
                className="grid gap-3 rounded-lg border border-[#0b3d2e]/10 p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <div className="space-y-1">
                  <Label htmlFor={`name-${row.id}`}>
                    Name{recipients.length > 1 ? ` ${index + 1}` : ""}
                  </Label>
                  <Input
                    id={`name-${row.id}`}
                    value={row.name}
                    onChange={(e) =>
                      updateRow(row.id, { name: e.target.value })
                    }
                    placeholder="Recipient name"
                    required
                    disabled={pending}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`phone-${row.id}`}>Phone</Label>
                  <Input
                    id={`phone-${row.id}`}
                    value={row.phone}
                    onChange={(e) =>
                      updateRow(row.id, { phone: e.target.value })
                    }
                    placeholder="07XXXXXXXX"
                    inputMode="tel"
                    required
                    disabled={pending}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove recipient"
                    onClick={() => removeRow(row.id)}
                    disabled={pending || recipients.length <= 1}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="sms-message">Message</Label>
        <Textarea
          id="sms-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type the SMS text to send…"
          required
          maxLength={1000}
          rows={5}
          disabled={pending}
        />
        <p className="text-xs text-[#5a6f65]">
          Same message is sent to every recipient · {message.length}/1000
        </p>
      </div>

      {banner ? (
        <Alert variant={banner.ok ? "default" : "destructive"}>
          <AlertTitle>{banner.ok ? "Sent" : "Send failed"}</AlertTitle>
          <AlertDescription>{banner.text}</AlertDescription>
        </Alert>
      ) : null}

      {studentResults && studentResults.length > 0 ? (
        <ul className="max-h-56 space-y-2 overflow-auto text-sm">
          {studentResults.map((r) => (
            <li
              key={r.studentId}
              className="flex items-start justify-between gap-3 rounded-lg border border-[#0b3d2e]/10 px-3 py-2"
            >
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-[#5a6f65]">
                  {r.phone || "No phone"}
                </p>
              </div>
              <p
                className={
                  r.status === "sent"
                    ? "text-right text-[#0b3d2e]"
                    : r.status === "skipped"
                      ? "text-right text-amber-800"
                      : "text-right text-destructive"
                }
              >
                {r.status === "sent"
                  ? "Sent"
                  : r.status === "skipped"
                    ? r.error || "Skipped"
                    : r.error || "Failed"}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {staffResults && staffResults.length > 0 ? (
        <ul className="max-h-56 space-y-2 overflow-auto text-sm">
          {staffResults.map((r) => (
            <li
              key={r.staffId}
              className="flex items-start justify-between gap-3 rounded-lg border border-[#0b3d2e]/10 px-3 py-2"
            >
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-[#5a6f65]">
                  {r.phone || "No phone"}
                </p>
              </div>
              <p
                className={
                  r.status === "sent"
                    ? "text-right text-[#0b3d2e]"
                    : r.status === "skipped"
                      ? "text-right text-amber-800"
                      : "text-right text-destructive"
                }
              >
                {r.status === "sent"
                  ? "Sent"
                  : r.status === "skipped"
                    ? r.error || "Skipped"
                    : r.error || "Failed"}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {customResults && customResults.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {customResults.map((r) => (
            <li
              key={`${r.name}-${r.phone}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-[#0b3d2e]/10 px-3 py-2"
            >
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-[#5a6f65]">{r.phone}</p>
              </div>
              <p
                className={
                  r.ok
                    ? "text-right text-[#0b3d2e]"
                    : "text-right text-destructive"
                }
              >
                {r.ok
                  ? r.queued
                    ? "Queued"
                    : "Sent"
                  : r.error || "Failed"}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        type="submit"
        pending={pending}
        pendingLabel="Sending…"
        className="bg-[#0b3d2e]"
        disabled={
          !configured ||
          ((mode === "students" || mode === "staff") &&
            (selected.size === 0 || selectedWithPhone === 0))
        }
      >
        {mode === "custom" ? "Send SMS" : bulkLabel}
      </Button>
    </form>
  );
}
