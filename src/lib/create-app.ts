import { OpenAPIHono } from "@hono/zod-openapi";
import * as Sentry from "@sentry/node";
import { Ratelimit } from "@upstash/ratelimit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { notFound, onError } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";

import "./instrument.mjs";

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
        limiter: Ratelimit.slidingWindow(100, "10 m"),
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
    if (env.NODE_ENV !== "development") {
      const ratelimit = RedisRateLimiter.getInstance();
      const ip = c.req.header("cf-connecting-ip") ?? "anonymous";
      const result = await ratelimit.limit(ip);
      c.set("ratelimit", ratelimit);
      if (!result.success) {
        return c.json({ error: "Rate limit exceeded" }, 429);
      }
      return next();
    }
    return next();
  });

  app.notFound(notFound);
  app.use(pinoLogger());
  app.use(
    "*",
    cors({
      origin: env.ORIGIN_URL,
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "x-uploadthing-version",
        "x-uploadthing-package",
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
  app
    .onError((err, c) => {
      Sentry.captureException(err);
      if (err instanceof HTTPException) {
        return err.getResponse();
      }
      return c.json({ error: "Internal server error" }, 500);
    })
    .use((c, next) => {
      if (c.get("user")?.email) {
        Sentry.setUser({
          email: c.get("user")?.email,
        });
      }
      return next();
    });
  app.onError(onError);
  return app;
}
