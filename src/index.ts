import { Hono } from "hono";
import { notFound, onError } from "stoker/middlewares";
import { pinoLogger } from "./middlewares/pino-logger";
import { PinoLogger } from "hono-pino";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
expand(config());
type AppBindings = {
  Variables: {
    logger: PinoLogger;
  };
};

const app = new Hono<AppBindings>();
app.use(pinoLogger());
app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.notFound(notFound);
app.onError(onError);
export default app;
