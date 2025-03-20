import { PinoLogger } from "hono-pino";
import type { OpenAPIHono } from "@hono/zod-openapi";

export type AppBindings = {
  Variables: {
    logger: PinoLogger;
  };
  Bindings: Env["Bindings"];
};

export type Env = {
  Bindings: {
    LOG_LEVEL: string;
    NODE_ENV: string;
    DATABASE_URL: string;
  };
};
export type AppOpenAPI = OpenAPIHono<AppBindings>;
