import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, openAPI, username } from "better-auth/plugins";

import db from "@/db";

import env from "./env";
import { sendEmail } from "./resend";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  appName: "10xCoder.club",
  plugins: [openAPI(), admin(), username()],
  trustedOrigins: [env.ORIGIN_URL],
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (every 1 day the session expiration is updated)
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        default: "user",
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, token }) => {
      const newUrl = `${env.ORIGIN_URL}/reset-password?token=${token}`;
      const data = {
        to: user.email,
        subject: "Reset your password",
        url: newUrl,
        user,
      };
      await sendEmail("reset-password", data);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, token }) => {
      const verificationUrl = `${
        env.ORIGIN_URL
      }/api/auth/verify-email?token=${token}&callbackURL=${
        env.EMAIL_VERIFICATION_CALLBACK_URL ?? "/"
      }`;
      const data = {
        to: user.email,
        subject: "Verify your email address",
        url: verificationUrl,
        user,
      };
      await sendEmail("verification", data);
    },
  },
  ipAddress: {
    ipAddressHeaders: ["x-client-ip", "x-forwarded-for"],
    disableIpTracking: false,
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
  socialProviders: {
    github: {
      clientId: env.G_CLIENT_ID,
      clientSecret: env.G_CLIENT_SECRET,
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["github", "google"],
    },
  },
});
