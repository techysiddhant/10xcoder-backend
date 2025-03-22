import { Resend } from "resend";
import { Env, UserAuth } from "./types";
import { createElement } from "react";
import { VerificationEmail } from "@/emails/verification-email";
import { ResetEmail } from "@/emails/reset-email";
type EmailData = {
  to: string;
  subject: string;
  url: string;
  user: UserAuth;
};
export const sendEmail = async (
  env: Env["Bindings"],
  type: string,
  emailData: EmailData
) => {
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
  } catch (error) {
    console.error("email sending issue", error);
  }
};
