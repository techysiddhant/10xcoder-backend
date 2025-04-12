import configureOpenAPI from "./lib/configure-open-api";
import createApp from "./lib/create-app";
import index from "@/routes/index.route";
import resources from "@/routes/resources/resources.index";
import categories from "@/routes/categories/categories.index";
import tags from "@/routes/tags/tags.index";
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

export default app;
