"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { logIslamicProgressAction } from "@/actions/progress";
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
import { formatDate } from "@/lib/format";
import type { IslamicStream, HifzComponent } from "@/types/database";

type Student = { id: string; full_name: string; admission_no: string };
type Klass = { id: string; name: string };
type Log = {
  id: string;
  student_id: string;
  stream: string;
  hifz_component: string | null;
  lesson_label: string;
  pages_or_ayah: string | null;
  quality_note: string | null;
  logged_on: string;
  student_name?: string;
};

export function ProgressClient({
  students,
  classes,
  logs,
  canLog,
}: {
  students: Student[];
  classes: Klass[];
  logs: Log[];
  canLog: boolean;
}) {
  const router = useRouter();
  const [stream, setStream] = useState<IslamicStream>("qaida");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {canLog ? (
        <Card>
          <CardHeader>
            <CardTitle>Log progress</CardTitle>
            <CardDescription>Qaida · Nazirah · Hifz</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  const result = await logIslamicProgressAction({
                    student_id: String(fd.get("student_id")),
                    class_id: String(fd.get("class_id") || "") || null,
                    stream,
                    hifz_component:
                      stream === "hifz"
                        ? (String(fd.get("hifz_component")) as HifzComponent)
                        : null,
                    lesson_label: String(fd.get("lesson_label")),
                    pages_or_ayah: String(fd.get("pages_or_ayah") || "") || null,
                    quality_note: String(fd.get("quality_note") || "") || null,
                    logged_on: String(fd.get("logged_on") || "") || undefined,
                    notify_parent: fd.get("notify_parent") === "on",
                  });
                  setMessage(result.error ? result.error : "Progress logged");
                  if (!result.error) {
                    e.currentTarget.reset();
                    router.refresh();
                  }
                });
              }}
            >
              {message ? <p className="text-sm">{message}</p> : null}
              <div className="space-y-1">
                <Label>Student</Label>
                <select
                  name="student_id"
                  required
                  className="h-9 w-full rounded-lg border border-input bg-background px-2"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Class (optional)</Label>
                <select
                  name="class_id"
                  className="h-9 w-full rounded-lg border border-input bg-background px-2"
                >
                  <option value="">—</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Stream</Label>
                <select
                  value={stream}
                  onChange={(e) => setStream(e.target.value as IslamicStream)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2"
                >
                  <option value="qaida">Qaida</option>
                  <option value="nazirah">Nazirah</option>
                  <option value="hifz">Hifz</option>
                </select>
              </div>
              {stream === "hifz" ? (
                <div className="space-y-1">
                  <Label>Hifz component</Label>
                  <select
                    name="hifz_component"
                    className="h-9 w-full rounded-lg border border-input bg-background px-2"
                    defaultValue="sabaq"
                  >
                    <option value="sabaq">Sabaq</option>
                    <option value="sabqi">Sabqi</option>
                    <option value="manzil">Manzil</option>
                    <option value="juz">Juz</option>
                  </select>
                </div>
              ) : null}
              <div className="space-y-1">
                <Label>Lesson</Label>
                <Input name="lesson_label" required placeholder="Surah / lesson" />
              </div>
              <div className="space-y-1">
                <Label>Pages / ayah</Label>
                <Input name="pages_or_ayah" />
              </div>
              <div className="space-y-1">
                <Label>Quality note</Label>
                <Input name="quality_note" />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  name="logged_on"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="notify_parent" />
                WhatsApp parent
              </label>
              <Button type="submit" disabled={pending} className="bg-[#0b3d2e]">
                {pending ? "Saving…" : "Save log"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent logs</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="max-h-[560px] space-y-2 overflow-y-auto text-sm">
            {logs.map((l) => (
              <li
                key={l.id}
                className="rounded-lg border border-[#0b3d2e]/10 p-3"
              >
                <p className="font-medium">
                  {l.student_name} · {l.stream}
                  {l.hifz_component ? ` / ${l.hifz_component}` : ""}
                </p>
                <p>{l.lesson_label}</p>
                <p className="text-xs text-[#5a6f65]">
                  {formatDate(l.logged_on)}
                  {l.pages_or_ayah ? ` · ${l.pages_or_ayah}` : ""}
                  {l.quality_note ? ` · ${l.quality_note}` : ""}
                </p>
              </li>
            ))}
            {logs.length === 0 ? (
              <li className="text-[#5a6f65]">No progress logs yet.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
