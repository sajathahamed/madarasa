"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  sendCustomSmsAction,
  type CustomSmsRecipientResult,
} from "@/actions/sms";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RecipientRow = { id: string; name: string; phone: string };

function newRow(): RecipientRow {
  return { id: crypto.randomUUID(), name: "", phone: "" };
}

export function SendSmsClient({
  configured,
  mask,
}: {
  configured: boolean;
  mask: string;
}) {
  const [recipients, setRecipients] = useState<RecipientRow[]>([newRow()]);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<CustomSmsRecipientResult[] | null>(
    null,
  );
  const [banner, setBanner] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const updateRow = (id: string, patch: Partial<RecipientRow>) => {
    setRecipients((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  };

  const removeRow = (id: string) => {
    setRecipients((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setResults(null);

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
        setResults(result.results);
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

  return (
    <form className="grid max-w-2xl gap-6" onSubmit={onSubmit}>
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
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
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
                  onChange={(e) => updateRow(row.id, { phone: e.target.value })}
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

      {results && results.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {results.map((r) => (
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
        disabled={!configured}
      >
        Send SMS
      </Button>
    </form>
  );
}
