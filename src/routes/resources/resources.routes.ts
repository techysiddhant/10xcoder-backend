import {
  insertResourceSchema,
  patchTasksSchema,
  selectResourceSchema,
} from "@/db/schema";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import {
  jsonContent,
  jsonContentOneOf,
  jsonContentRequired,
} from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";
const tags = ["Resources"];
const ResourceParamsSchema = z.object({
  id: z.string().min(3),
});
export const getAll = createRoute({
  path: "/resources",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectResourceSchema),
      "The List of Resources"
    ),
  },
});
export const create = createRoute({
  path: "/resources",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(insertResourceSchema, "The Resource to create"),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectResourceSchema,
      "The created Resource"
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Bad Request"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertResourceSchema),
      "The validation errors"
    ),
  },
});
export const getOne = createRoute({
  path: "/resource/{id}",
  method: "get",
  request: {
    params: ResourceParamsSchema,
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectResourceSchema,
      "The requested Resource"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Resource not found"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(ResourceParamsSchema),
      "Invalid Id errors"
    ),
  },
});
export const patch = createRoute({
  path: "/resource/{id}",
  method: "patch",
  tags,
  request: {
    params: ResourceParamsSchema,
    body: jsonContentRequired(patchTasksSchema, "The Resource update"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectResourceSchema,
      "The updated Resource"
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Bad Request"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContentOneOf(
      [
        createErrorSchema(insertResourceSchema).or(
          createErrorSchema(ResourceParamsSchema)
        ),
      ],
      "The validation errors"
    ),
  },
});
export type GetAllRoute = typeof getAll;
export type CreateRoute = typeof create;
export type GetOne = typeof getOne;
export type PatchRoute = typeof patch;
