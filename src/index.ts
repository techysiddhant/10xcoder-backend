import { initAuth } from "./lib/auth";
import configureOpenAPI from "./lib/configure-open-api";
import createApp from "./lib/create-app";
import index from "@/routes/index.route";
import resources from "@/routes/resources/resources.index";
import categories from "@/routes/categories/categories.index";
import tags from "@/routes/tags/tags.index";
import { auth } from "./middlewares/auth";
import { Context, Hono } from "hono";
import { redisSubscriber } from "./lib/redis";
const app = createApp();
configureOpenAPI(app);
const routes = [index, resources, categories, tags];
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
  const auth = initAuth(c.env);
  return auth.handler(c.req.raw);
});
app.on(["POST"], "/resources", auth);
app.on(["PATCH"], "/resource/:id", auth);
app.on(["GET"], "/user/resources", auth);
app.on(["PATCH"], "/resource/upvote/:id", auth);
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
