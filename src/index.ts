import { initAuth } from "./lib/auth";
import configureOpenAPI from "./lib/configure-open-api";
import createApp from "./lib/create-app";
import index from "@/routes/index.route";
const app = createApp();
configureOpenAPI(app);
const routes = [index];

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

routes.forEach((route) => {
  app.route("/", route);
});
export default app;
