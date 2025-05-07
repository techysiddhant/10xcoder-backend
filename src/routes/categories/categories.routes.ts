import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

import { selectCategorySchema } from "@/db/schema";

const tags = ["Categories"];
export const getAll = createRoute({
  path: "/categories",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectCategorySchema),
      "The List of Category",
    ),
  },
});

export type GetAllRoute = typeof getAll;
