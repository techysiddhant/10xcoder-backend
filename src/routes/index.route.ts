import { createRoute, z } from "@hono/zod-openapi";

import { createRouter } from "@/lib/create-app";

const router = createRouter().openapi(
  createRoute({
    tags: ["Index"],
    method: "get",
    path: "/",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              message: z.string(),
            }),
          },
        },
        description: "Index Route",
      },
    },
  }),
  (c) => {
    return c.json(
      {
        message: "Hello Hono!",
      },
      200,
    );
  },
);

export default router;
