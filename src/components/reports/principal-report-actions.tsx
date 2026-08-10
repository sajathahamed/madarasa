"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildWhatsAppLink, isValidMobile } from "@/lib/phone";
import { openWhatsAppLinks } from "@/lib/open-whatsapp";

export function PrincipalReportActions({
  shareText,
  title = "Monthly branch report",
}: {
  shareText: string;
  title?: string;
}) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const printPdf = () => {
    document.title = title;
    window.print();
  };

  const shareWhatsApp = () => {
    const trimmed = phone.trim();
    if (trimmed && !isValidMobile(trimmed)) {
      setMessage("Enter a valid WhatsApp number, or leave blank to choose a chat.");
      return;
    }
    setMessage(null);
    const url = trimmed
      ? buildWhatsAppLink(trimmed, shareText)
      : `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    openWhatsAppLinks(url);
  };

  return (
    <div className="space-y-4 print:hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          className="w-full bg-[#0b3d2e] sm:w-auto"
          onClick={printPdf}
        >
          Download / Print PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={shareWhatsApp}
        >
          Share on WhatsApp
        </Button>
      </div>
      <div className="grid gap-2 sm:max-w-sm">
        <Label htmlFor="report_wa_phone">
          WhatsApp number (optional)
        </Label>
        <Input
          id="report_wa_phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07XXXXXXXX — leave empty to pick a chat"
          inputMode="tel"
        />
        <p className="text-xs text-[#5a6f65]">
          Opens WhatsApp with the report summary ready to send.
        </p>
      </div>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </div>
  );
}
