import { pinoLogger } from "@/middlewares/pino-logger";
import { notFound, onError } from "stoker/middlewares";
import { AppBindings } from "./types";
import { OpenAPIHono } from "@hono/zod-openapi";
import { defaultHook } from "stoker/openapi";
export function createRouter() {
  return new OpenAPIHono<AppBindings>({ strict: false, defaultHook });
}

export default function createApp() {
  const app = createRouter();
  app.notFound(notFound);
  app.onError(onError);
  app.use(pinoLogger());
  return app;
}
