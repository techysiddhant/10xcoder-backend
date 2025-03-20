import configureOpenAPI from "./lib/configure-open-api";
import createApp from "./lib/create-app";
import index from "@/routes/index.route";
const app = createApp();
configureOpenAPI(app);
const routes = [index];

routes.forEach((route) => {
  app.route("/", route);
});

export default app;
