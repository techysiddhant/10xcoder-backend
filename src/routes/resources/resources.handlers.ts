import {
  CreateRoute,
  GetAllRoute,
  GetOne,
  PatchRoute,
} from "./resources.routes";
import { AppRouteHandler } from "@/lib/types";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { createDB } from "@/db";
import { categories, resources, resourceTags, tags } from "@/db/schema";
import { nanoid } from "nanoid";
import { isResourceType } from "@/lib/utils";
import { eq } from "drizzle-orm";
export const getAll: AppRouteHandler<GetAllRoute> = async (c) => {
  const db = createDB(c.env);
  const resources = await db.query.resources.findMany();
  return c.json(resources, HttpStatusCodes.OK);
};
export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const resource = c.req.valid("json");
  const tagNames = resource.tags
    .split(",")
    .map((tag) => tag.trim().toLowerCase()) // Normalize to lowercase
    .filter((tag) => tag.length > 0); // Remove empty strings
  const resourceType = resource.resourceType.toLocaleLowerCase();
  if (!isResourceType(resourceType)) {
    return c.json(
      { message: "Invalid resource type", success: false },
      HttpStatusCodes.BAD_REQUEST
    );
  }
  const user = c.get("user");
  const db = createDB(c.env);
  await db
    .insert(categories)
    .values({ name: resource.categoryName.toLowerCase() })
    .onConflictDoNothing();

  const [newResource] = await db
    .insert(resources)
    .values({
      title: resource.title,
      description: resource.description,
      url: resource.url,
      image: resource.image,
      resourceType,
      categoryName: resource.categoryName.toLowerCase(),
      id: nanoid(),
      userId: user?.id!,
    })
    .returning();
  await Promise.all(
    tagNames.map(async (tagName) => {
      await db.insert(tags).values({ name: tagName }).onConflictDoNothing();
    })
  );
  await Promise.all(
    tagNames.map(async (tagName) => {
      await db
        .insert(resourceTags)
        .values({
          resourceId: newResource.id,
          tagName,
        })
        .onConflictDoNothing();
    })
  );

  return c.json(
    {
      id: newResource.id,
      image: newResource.image,
      createdAt: newResource.createdAt,
      updatedAt: newResource.updatedAt,
      userId: newResource.userId,
      title: newResource.title,
      description: newResource.description,
      url: newResource.url,
      resourceType: newResource.resourceType,
      categoryName: newResource.categoryName,
      upvoteCount: newResource.upvoteCount,
    },
    HttpStatusCodes.CREATED
  );
};

export const getOne: AppRouteHandler<GetOne> = async (c) => {
  const params = c.req.param();
  const db = createDB(c.env);
  const resource = await db.query.resources.findFirst({
    where: (resources, { eq }) => eq(resources.id, params.id),
  });
  if (!resource) {
    return c.json(
      { message: "Resource not found", success: false },
      HttpStatusCodes.NOT_FOUND
    );
  }
  return c.json(resource, HttpStatusCodes.OK);
};

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const params = c.req.param();
  const resource = c.req.valid("json");
  const db = createDB(c.env);
  const [updatedResource] = await db
    .update(resources)
    .set({
      title: resource.title,
      description: resource.description,
      url: resource.url,
      image: resource.image,
      resourceType: resource.resourceType,
      categoryName: resource.categoryName,
    })
    .where(eq(resources.id, params.id))
    .returning();
  return c.json(
    {
      id: updatedResource.id,
      image: updatedResource.image,
      createdAt: updatedResource.createdAt,
      updatedAt: updatedResource.updatedAt,
      userId: updatedResource.userId,
      title: updatedResource.title,
      description: updatedResource.description,
      url: updatedResource.url,
      resourceType: updatedResource.resourceType,
      categoryName: updatedResource.categoryName,
      upvoteCount: updatedResource.upvoteCount,
    },
    HttpStatusCodes.OK
  );
};
