import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

import { selectTagSchema } from "@/db/schema";

const tags = ["Tags"];
export const getAll = createRoute({
  path: "/tags",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectTagSchema),
      "The List of Tags",
    ),
  },
});

export type GetAllRoute = typeof getAll;
