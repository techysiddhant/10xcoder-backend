import { initAuth } from "./lib/auth";
import configureOpenAPI from "./lib/configure-open-api";
import createApp from "./lib/create-app";
import index from "@/routes/index.route";
const app = createApp();
configureOpenAPI(app);
const routes = [index];

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = initAuth(c.env);
  return auth.handler(c.req.raw);
});
app.get("/session", async (c) => {
  const session = c.get("session");
  const user = c.get("user");

  if (!user) return c.body(null, 401);

  return c.json({
    session,
    user,
  });
});
routes.forEach((route) => {
  app.route("/", route);
});
export default app;
