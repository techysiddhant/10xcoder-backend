import configureOpenAPI from "./lib/configure-open-api";
import createApp from "./lib/create-app";
import index from "@/routes/index.route";
import resources from "@/routes/resources/resources.index";
import categories from "@/routes/categories/categories.index";
import tags from "@/routes/tags/tags.index";
import { Context, Hono } from "hono";
import { redisSubscriber } from "./lib/redis";
import { auth } from "./lib/auth";
import { isAuth } from "./middlewares/is-auth";
import { createRouteHandler } from "uploadthing/server";
import { uploadRouter } from "./lib/uploadthing";
import env from "./lib/env";
const app = createApp();
configureOpenAPI(app);
const handlers = createRouteHandler({
  router: uploadRouter,
  config: {
    token: env.UPLOADTHING_TOKEN,
  },
});
const routes = [index, resources, categories, tags];
app.all("/api/uploadthing", (context) => handlers(context.req.raw));
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  if (c.req.path === "/api/auth/use-session") {
    const session = c.get("session");
    const user = c.get("user");

    if (!user) return c.body(null, 401);

    return c.json({
      session,
      user,
    });
  }
  return auth.handler(c.req.raw);
});
app.on(["POST"], "/resources", isAuth);
app.on(["PATCH"], "/resource/:id", isAuth);
app.on(["GET"], "/user/resources", isAuth);
app.on(["PATCH"], "/resource/upvote/:id", isAuth);
app.on(["GET", "POST"], "/api/uploadthing", isAuth);
routes.forEach((route) => {
  app.route("/", route);
});
const streamRoute = new Hono();
streamRoute.get("/api/upvote/stream", async (c: Context) => {
  const redisSub = redisSubscriber(c.env);
  const stream = new ReadableStream({
    async start(controller) {
      const channel = "upvote-events";

      await redisSub.subscribe(channel, (err) => {
        if (err) console.error("Redis subscribe error:", err);
      });

      redisSub.on("message", (ch, message) => {
        if (ch === channel) {
          controller.enqueue(`data: ${message}\n\n`);
        }
      });

      c.req.raw.signal.addEventListener("abort", () => {
        redisSub.unsubscribe(channel);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
app.route("/", streamRoute);
export default app;
