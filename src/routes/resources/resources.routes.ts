import {
  insertResourceSchema,
  patchResourceSchema,
  selectResourceSchema,
} from "@/db/schema";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentOneOf } from "stoker/openapi/helpers";
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
    body: {
      content: {
        "multipart/form-data": {
          schema: insertResourceSchema,
        },
      },
      description: "The Resource to create",
    },
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        success: z.boolean().default(true),
        resourceId: z.string(),
      }),
      "The created Resource"
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Bad Request"
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Internal Server Error"
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
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized"
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
    body: {
      content: {
        "multipart/form-data": {
          schema: patchResourceSchema,
        },
      },
      description: "The Resource to update",
    },
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean().default(true),
        message: z.string(),
      }),
      "The updated Resource"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized"
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Bad Request"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Resource Not Found"
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Internal Server Error"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContentOneOf(
      [
        createErrorSchema(patchResourceSchema).or(
          createErrorSchema(ResourceParamsSchema)
        ),
      ],
      "The validation errors"
    ),
  },
});
export const publish = createRoute({
  path: "/resource/{id}/publish",
  method: "patch",
  request: {
    params: ResourceParamsSchema,
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean().default(true),
        message: z.string(),
      }),
      "The requested Resource"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Resource not found"
    ),
  },
});
export const getUsersResources = createRoute({
  path: "/user/resources",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectResourceSchema),
      "The List of Resources by the user"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized"
    ),
  },
});
// export const upvote = createRoute({
//   path: "/resource/upvote/{id}",
//   method: "patch",
//   tags,
//   responses: {
//     [HttpStatusCodes.OK]: jsonContent(
//       z.object({
//         count: z.number(),
//         success: z.boolean().default(false),
//         resourceId: z.string(),
//       }),
//       "The upvote was successful"
//     ),
//     [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
//       z.object({ message: z.string(), success: z.boolean().default(false) }),
//       "Unauthorized"
//     ),
//   },
// });
export type GetAllRoute = typeof getAll;
export type CreateRoute = typeof create;
export type GetOne = typeof getOne;
export type PatchRoute = typeof patch;
export type PublishRoute = typeof publish;
export type GetUsersResources = typeof getUsersResources;
// export type UpvoteRoute = typeof upvote;
