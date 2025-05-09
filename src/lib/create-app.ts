import { RedisStore } from "@hono-rate-limiter/redis";
import { OpenAPIHono } from "@hono/zod-openapi";
import { rateLimiter } from "hono-rate-limiter";
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

export default function createApp() {
  const app = createRouter();

  app.use("*", (c, next) => {
    rateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
      standardHeaders: "draft-6", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
      keyGenerator: c => c.req.header("cf-connecting-ip") ?? "", // Method to generate custom identifiers for clients.
      store: new RedisStore({ client: redis }),
    });
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
