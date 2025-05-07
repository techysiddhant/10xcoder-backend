import { createElement } from "react";
import { Resend } from "resend";

import { ResetEmail } from "@/emails/reset-email";
import { VerificationEmail } from "@/emails/verification-email";

import type { UserAuth } from "./types";

import env from "./env";

interface EmailData {
  to: string;
  subject: string;
  url: string;
  user: UserAuth;
}
export async function sendEmail(type: string, emailData: EmailData) {
  const resend = new Resend(env.RESEND_API_KEY);
  try {
    if (type === "verification") {
      await resend.emails.send({
        from: `No-name <${env.RESEND_EMAIL}>`,
        to: emailData.to,
        subject: emailData.subject,
        react: createElement(VerificationEmail, {
          name: emailData.user.name,
          url: emailData.url,
        }),
      });
    }
    if (type === "reset-password") {
      await resend.emails.send({
        from: `No-name <${env.RESEND_EMAIL}>`,
        to: emailData.to,
        subject: emailData.subject,
        react: createElement(ResetEmail, {
          name: emailData.user.name,
          url: emailData.url,
        }),
      });
    }
  }
  catch (error) {
    console.error("email sending issue", error);
  }
}
