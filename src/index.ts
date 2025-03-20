import createApp from "./lib/create-app";

const app = createApp();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

export default app;
