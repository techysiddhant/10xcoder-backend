import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDB } from "@/db";
import { admin, openAPI, username } from "better-auth/plugins";
import { Env } from "./types";
export const initAuth = (env: Env["Bindings"]) => {
  const db = createDB(env);
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),
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
    },
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },
  });
};
