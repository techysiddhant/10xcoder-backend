import { createMiddleware } from "hono/factory";

export const auth = createMiddleware(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ message: "Unauthorized", success: false }, 401);
  }
  await next();
});
