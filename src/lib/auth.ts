import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDB } from "@/db";
import { admin, openAPI, username } from "better-auth/plugins";
import { Env } from "./types";
import { sendEmail } from "./resend";
export const initAuth = (env: Env["Bindings"]) => {
  const db = createDB(env);
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),
    appName: "No-name",
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
        await sendEmail(env, "reset-password", data);
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
        await sendEmail(env, "verification", data);
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
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
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
};
