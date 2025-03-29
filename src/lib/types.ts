import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";

export type AppBindings = {
  Variables: {
    logger: PinoLogger;
    user: UserAuth | null;
    session: SessionAuth | null;
  };
  Bindings: Env["Bindings"];
};

export type Env = {
  Bindings: {
    LOG_LEVEL: string;
    NODE_ENV: string;
    DB: D1Database;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    ORIGIN_URL: string;
    EMAIL_VERIFICATION_CALLBACK_URL?: string;
    RESEND_API_KEY: string;
    RESEND_EMAIL: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    MY_BUCKET: R2Bucket;
    MY_KV: KVNamespace;
    MY_RATE_LIMITER: any;
  };
};
export interface UserAuth {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
  role?: string | null | undefined;
  banReason?: string | null | undefined;
  banExpires?: Date | null | undefined;
}
export interface SessionAuth {
  id: string;
  expiresAt: Date;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
  userId: string;
}
export type AppOpenAPI = OpenAPIHono<AppBindings>;
export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
  R,
  AppBindings
>;
