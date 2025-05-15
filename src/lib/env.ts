/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { z } from "zod";

expand(
  config({
    path: path.resolve(
      process.cwd(),
      process.env.NODE_ENV === "test" ? ".env.test" : ".env",
    ),
  }),
);

const EnvSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().default(9999),
    LOG_LEVEL: z.enum([
      "fatal",
      "error",
      "warn",
      "info",
      "debug",
      "trace",
      "silent",
    ]),
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().url(),
    APP_URL: z.string().url(),
    ORIGIN_URL: z.string().url(),
    EMAIL_VERIFICATION_CALLBACK_URL: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    RESEND_EMAIL: z.string().email(),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    UPLOADTHING_TOKEN: z.string().min(1),
    REDIS_URL: z.string().url(),
    QSTASH_URL: z.string().url(),
    QSTASH_TOKEN: z.string().min(1),
    QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).startsWith("sig"),
    QSTASH_NEXT_SIGNING_KEY: z.string().min(1).startsWith("sig"),
    AI_API_KEY: z.string().min(1),
    UPSTASH_VECTOR_REST_URL: z.string().url(),
    UPSTASH_VECTOR_REST_TOKEN: z.string().min(1),
  })
  .superRefine((input, ctx) => {
    if (input.NODE_ENV === "production" && !input.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.invalid_type,
        expected: "string",
        received: "undefined",
        path: ["DATABASE_URL"],
        message: "Must be set when NODE_ENV is 'production'",
      });
    }
  });

export type env = z.infer<typeof EnvSchema>;

// eslint-disable-next-line ts/no-redeclare
const { data: env, error } = EnvSchema.safeParse(process.env);
if (process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "ci") {
  if (error) {
    console.error("❌ Invalid env:");
    console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }
}

export default env!;
