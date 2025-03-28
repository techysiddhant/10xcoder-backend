import { createMiddleware } from "hono/factory";
import * as HttpStatusCodes from "stoker/http-status-codes";
export const isAdmin = createMiddleware(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json(
      {
        message: "Unauthorized: Authentication required",
        success: false,
        error: "AUTH_REQUIRED",
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }
  if (user.role !== "admin") {
    return c.json(
      {
        message: "Unauthorized: Authentication required",
        success: false,
        error: "INSUFFICIENT_PERMISSIONS",
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }
  await next();
});
