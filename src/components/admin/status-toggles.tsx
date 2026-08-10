"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { setUserStatusAction, setVendorStatusAction } from "@/actions/management";
import { Button } from "@/components/ui/button";

export function ToggleUserStatusButton({
  userId,
  status,
}: {
  userId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = status === "active" ? "inactive" : "active";

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      pending={pending}
      pendingLabel="…"
      onClick={() => {
        startTransition(async () => {
          await setUserStatusAction({
            userId,
            status: next,
          });
          router.refresh();
        });
      }}
    >
      {next === "inactive" ? "Deactivate" : "Activate"}
    </Button>
  );
}

export function ToggleVendorStatusButton({
  vendorId,
  status,
}: {
  vendorId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = status === "active" ? "suspended" : "active";

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      pending={pending}
      pendingLabel="…"
      onClick={() => {
        startTransition(async () => {
          await setVendorStatusAction({
            vendorId,
            status: next,
          });
          router.refresh();
        });
      }}
    >
      {next === "suspended" ? "Suspend" : "Activate"}
    </Button>
  );
}
