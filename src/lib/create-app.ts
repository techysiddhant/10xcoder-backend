import { pinoLogger } from "@/middlewares/pino-logger";
import { Hono } from "hono";
import { notFound, onError } from "stoker/middlewares";
import { AppBindings } from "./types";

export default function createApp() {
  const app = new Hono<AppBindings>({ strict: false });

  app.notFound(notFound);
  app.onError(onError);
  app.use(pinoLogger());
  return app;
}
