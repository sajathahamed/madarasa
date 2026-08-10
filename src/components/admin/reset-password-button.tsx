"use client";

import { useState, useTransition } from "react";

import { resetUserPasswordAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  const [creds, setCreds] = useState<{
    email: string;
    tempPassword: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await resetUserPasswordAction(userId);
            if (result.error) {
              setError(result.error);
              setCreds(null);
              return;
            }
            if (result.credentials) {
              setCreds({
                email: result.credentials.email,
                tempPassword: result.credentials.tempPassword,
              });
            }
          });
        }}
      >
        {pending ? "…" : "Reset password"}
      </Button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {creds ? (
        <p className="max-w-[220px] break-all rounded-md bg-[#0b3d2e]/5 p-2 text-xs text-[#0b3d2e]">
          Username: <strong>{creds.email}</strong>
          <br />
          New password: <strong>{creds.tempPassword}</strong>
          <br />
          <span className="text-[#5a6f65]">Copy now — shown once only.</span>
        </p>
      ) : null}
    </div>
  );
}
