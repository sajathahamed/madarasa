import { redirect } from "next/navigation";

import { SendSmsClient } from "@/components/sms/send-sms-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OpsShell } from "@/components/layout/ops-shell";
import { canSendSms } from "@/lib/auth/session";
import { notificationStatus } from "@/lib/notify";
import { requireOpsContext } from "@/lib/ops-page";

export default async function SendSmsPage() {
  const { profile } = await requireOpsContext();

  if (!canSendSms(profile.role)) {
    redirect("/branch");
  }

  const notify = notificationStatus();

  return (
    <OpsShell profile={profile} title="Send SMS">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Send SMS</CardTitle>
          <CardDescription>
            Add recipient name and phone, type your message, then send via
            Dialog Rich Communication (mask Upview Tech). Multiple numbers are
            joined in one API request, same as the working PHP Send_msg flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SendSmsClient
            configured={notify.dialogConfigured}
            mask={notify.smsMask}
          />
        </CardContent>
      </Card>
    </OpsShell>
  );
}
