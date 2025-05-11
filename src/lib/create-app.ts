import { OpenAPIHono } from "@hono/zod-openapi";
import { Ratelimit } from "@upstash/ratelimit";
import { cors } from "hono/cors";
import { notFound, onError } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";

import { pinoLogger } from "@/middlewares/pino-logger";

import type { AppBindings } from "./types";

import { auth } from "./auth";
import env from "./env";
import { redis } from "./redis";

export function createRouter() {
  return new OpenAPIHono<AppBindings>({ strict: false, defaultHook });
}
const cache = new Map();
class RedisRateLimiter {
  static instance: Ratelimit;

  static getInstance() {
    if (!this.instance) {
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "10 s"),
        ephemeralCache: cache,
      });
      this.instance = ratelimit;
      return this.instance;
    }
    else {
      return this.instance;
    }
  }
}
export default function createApp() {
  const app = createRouter();
  app.use("*", async (c, next) => {
    const ratelimit = RedisRateLimiter.getInstance();
    const ip = c.req.header("cf-connecting-ip") ?? "anonymous";
    const result = await ratelimit.limit(ip);
    c.set("ratelimit", ratelimit);
    if (!result.success) {
      return c.json({ error: "Rate limit exceeded" }, 429);
    }
    return next();
  });

  app.notFound(notFound);
  app.onError(onError);
  app.use(pinoLogger());
  app.use(
    "*",
    cors({
      origin: env.ORIGIN_URL,
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "x-uploadthing-version",
        "x-uploadthing-package", // 👈 add this
      ],
      allowMethods: ["POST", "GET", "OPTIONS", "PUT", "PATCH"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }),
  );
  app.use("*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      c.set("user", null);
      c.set("session", null);
      return next();
    }

    c.set("user", session.user);
    c.set("session", session.session);
    return next();
  });
  return app;
}
