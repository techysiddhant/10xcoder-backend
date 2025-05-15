import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentOneOf } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";

import {
  insertResourceSchema,
  patchResourceSchema,
  selectBookmarkSchema,
  selectResourceSchema,
} from "@/db/schema";

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
      "The List of Resources",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Resources not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Internal Server Error",
    ),
  },
});
export const search = createRoute({
  path: "/search",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean().default(true),
        message: z.string(),
        resources: z.array(selectResourceSchema),
      }),
      "The List of Resources",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Query is required",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Internal Server Error",
    ),
  },
});
export const create = createRoute({
  path: "/resources",
  method: "post",
  tags,
  request: {
    body: jsonContent(insertResourceSchema, "The Resource to create"),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        success: z.boolean().default(true),
        resourceId: z.string(),
      }),
      "The created Resource",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Bad Request",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Internal Server Error",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertResourceSchema),
      "The validation errors",
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
      "The requested Resource",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Resource not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(ResourceParamsSchema),
      "Invalid Id errors",
    ),
  },
});
export const patch = createRoute({
  path: "/resource/{id}",
  method: "patch",
  tags,
  request: {
    params: ResourceParamsSchema,
    body: jsonContent(patchResourceSchema, "The Resource to update"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean().default(true),
        message: z.string(),
      }),
      "The updated Resource",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Bad Request",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Resource Not Found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Internal Server Error",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContentOneOf(
      [
        createErrorSchema(patchResourceSchema).or(
          createErrorSchema(ResourceParamsSchema),
        ),
      ],
      "The validation errors",
    ),
  },
});
export const publish = createRoute({
  path: "/resource/{id}/publish",
  method: "patch",
  request: {
    params: ResourceParamsSchema,
    body: jsonContent(
      z.object({
        status: z.enum(["pending", "approved", "rejected"]),
      }),
      "The Resource to update",
    ),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean().default(true),
        message: z.string(),
      }),
      "The requested Resource",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Resource not found",
    ),
  },
});
export const getUsersResources = createRoute({
  path: "/user/resources",
  method: "get",
  tags,
  request: {
    query: z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(10),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        resources: z.array(selectResourceSchema),
        page: z.number(),
        limit: z.number(),
        totalCount: z.number(),
        hasNextPage: z.boolean(),
        hasPrevPage: z.boolean(),
      }),
      "The List of Resources by the user",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Bad Request",
    ),
  },
});
export const upvote = createRoute({
  path: "/resource/upvote/{id}",
  method: "patch",
  tags,
  request: {
    params: ResourceParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        count: z.number(),
        success: z.boolean().default(true),
        resourceId: z.string(),
      }),
      "The upvote was successful",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Resource not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Internal Server Error",
    ),
  },
});
export const publishJob = createRoute({
  path: "/resource/publish/job",
  method: "post",
  tags,
  request: {
    body: jsonContent(
      z.object({
        resourceId: z.string(),
        timestamp: z.coerce.date().default(() => new Date()),
      }),
      "Add Publish Job to the queue for vector indexing",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean().default(true),
        message: z.string(),
      }),
      "Job was successful",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Internal Server Error",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Bad Request",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Resource not found",
    ),
  },
});
export const upvoteQueue = createRoute({
  path: "/resource/upvote/queue",
  method: "post",
  tags,
  request: {
    body: jsonContent(
      z.object({
        resourceId: z.string(),
        userId: z.string(),
        action: z.enum(["add", "remove"]),
        timestamp: z.coerce.date().default(() => new Date()),
      }),
      "Add Upvote Job to the queue",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean().default(true),
        message: z.string(),
      }),
      "Job was successful",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Internal Server Error",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Bad Request",
    ),
  },
});
export const addOrRemoveBookmark = createRoute({
  path: "/resource/{resourceId}/bookmark",
  method: "post",
  tags,
  request: {
    params: z.object({
      resourceId: z.string().min(3),
    }),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        success: z.boolean().default(true),
        resourceId: z.string(),
        message: z.string(),
        isBookmarked: z.boolean(),
        bookmarkCount: z.number(),
      }),
      "The Bookmark added",
    ),
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean().default(true),
        resourceId: z.string(),
        message: z.string(),
        isBookmarked: z.boolean(),
        bookmarkCount: z.number(),
      }),
      "The Bookmark removed",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Resource not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Internal Server Error",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized",
    ),
  },
});
export const userBookmarks = createRoute({
  path: "/user/bookmarks",
  method: "get",
  tags,
  request: {
    query: z
      .object({
        cursor: z.string().optional(),
      })
      .partial(),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        bookmarks: z.array(selectBookmarkSchema),
        nextCursor: z.string().nullable(),
      }),
      "The User Bookmarks",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Internal Server Error",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ message: z.string(), success: z.boolean().default(false) }),
      "Unauthorized",
    ),
  },
});
export type GetAllRoute = typeof getAll;
export type CreateRoute = typeof create;
export type GetOne = typeof getOne;
export type PatchRoute = typeof patch;
export type PublishRoute = typeof publish;
export type GetUsersResources = typeof getUsersResources;
export type UpvoteRoute = typeof upvote;
export type UpvoteQueueRoute = typeof upvoteQueue;
export type AddRemoveBookmarkRoute = typeof addOrRemoveBookmark;
export type UserBookmarksRoute = typeof userBookmarks;
export type PublishJobRoute = typeof publishJob;
export type SearchRoute = typeof search;
