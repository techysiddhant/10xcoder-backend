import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { createDB } from "@/db";
import { categories, resources, resourceTags, tags } from "@/db/schema";
import { isResourceType } from "@/lib/utils";
import type { AppRouteHandler } from "@/lib/types";
import type {
  CreateRoute,
  GetAllRoute,
  GetOne,
  PatchRoute,
  PublishRoute,
} from "./resources.routes";
export const getAll: AppRouteHandler<GetAllRoute> = async (c) => {
  const db = createDB(c.env);
  const resources = await db.query.resources.findMany({
    orderBy: (resources, { desc }) => desc(resources.createdAt),
    where: (resources, { eq }) => eq(resources.isPublished, true),
  });
  const resourceTags = await db.query.resourceTags.findMany({
    where: (resourceTags, { inArray }) =>
      inArray(
        resourceTags.resourceId,
        resources.map((r) => r.id)
      ),
  });
  // ✅ Merge tags into resources
  const resourceTagsMap = resourceTags.reduce((acc, tag) => {
    if (!acc[tag.resourceId]) acc[tag.resourceId] = [];
    acc[tag.resourceId].push(tag.tagName);
    return acc;
  }, {} as Record<string, string[]>);

  const formattedResources = resources.map((resource) => ({
    ...resource,
    tags: resourceTagsMap[resource.id] || [], // Attach tags array
  }));

  return c.json(formattedResources, HttpStatusCodes.OK);
};
export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const resource = c.req.valid("json");
  const tagNames = resource.tags
    .split(",")
    .map((tag) => tag.trim().toLowerCase()) // Normalize to lowercase
    .filter((tag) => tag.length > 0);

  const user = c.get("user");
  if (!user || !user.id) {
    return c.json(
      { message: "User not authenticated", success: false },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const resourceType = resource.resourceType.toLocaleLowerCase();
  if (!isResourceType(resourceType)) {
    return c.json(
      { message: "Invalid resource type", success: false },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const db = createDB(c.env);

  // Ensure category exists
  await db
    .insert(categories)
    .values({ name: resource.categoryName.toLowerCase() })
    .onConflictDoNothing();

  // Create new resource
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
      userId: user.id,
    })
    .returning();

  // Insert tags & resource-tag mapping
  await Promise.all(
    tagNames.map(async (tagName) => {
      await db.insert(tags).values({ name: tagName }).onConflictDoNothing();
      await db
        .insert(resourceTags)
        .values({
          resourceId: newResource.id,
          tagName,
        })
        .onConflictDoNothing();
    })
  );

  // Fetch associated tags for the response
  const associatedTags = await db.query.resourceTags.findMany({
    where: (resourceTags, { eq }) =>
      eq(resourceTags.resourceId, newResource.id),
    columns: { tagName: true }, // Fetch only the tag names
  });

  return c.json(
    { ...newResource, tags: associatedTags.map((t) => t.tagName) },
    HttpStatusCodes.CREATED
  );
};

export const getOne: AppRouteHandler<GetOne> = async (c) => {
  const params = c.req.param();
  const db = createDB(c.env);
  const resource = await db.query.resources.findFirst({
    where: (resources, { eq }) =>
      eq(resources.id, params.id) && eq(resources.isPublished, true),
  });
  if (!resource) {
    return c.json(
      { message: "Resource not found", success: false },
      HttpStatusCodes.NOT_FOUND
    );
  }
  const associatedTags = await db.query.resourceTags.findMany({
    where: (resourceTags, { eq }) => eq(resourceTags.resourceId, resource.id),
    columns: { tagName: true }, // Fetch only the tag names
  });
  return c.json(
    { ...resource, tags: associatedTags.map((t) => t.tagName) },
    HttpStatusCodes.OK
  );
};

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const params = c.req.param();
  const resource = c.req.valid("json");
  const db = createDB(c.env);
  const existingResource = await db.query.resources.findFirst({
    where: (resources, { eq }) => eq(resources.id, params.id),
  });

  if (!existingResource) {
    return c.json(
      { message: "Resource not found", success: false },
      HttpStatusCodes.NOT_FOUND
    );
  }
  await db
    .insert(categories)
    .values({ name: resource.categoryName! })
    .onConflictDoNothing();
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
  if (!updatedResource) {
    return c.json(
      { message: "Failed to update resource", success: false },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
  if (resource.tags) {
    const newTags = resource.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase()) // Normalize tags
      .filter((tag) => tag.length > 0);

    const existingTags = await db.query.resourceTags.findMany({
      where: (resourceTags, { eq }) => eq(resourceTags.resourceId, params.id),
    });
    const existingTagNames = existingTags.map((tag) => tag.tagName);
    const tagsToRemove = existingTagNames.filter(
      (tag) => !newTags.includes(tag)
    );

    if (tagsToRemove.length > 0) {
      await db
        .delete(resourceTags)
        .where(
          and(
            eq(resourceTags.resourceId, params.id),
            inArray(resourceTags.tagName, tagsToRemove)
          )
        );
    }

    await Promise.all(
      newTags.map(async (tagName) => {
        await db.insert(tags).values({ name: tagName }).onConflictDoNothing();
        await db
          .insert(resourceTags)
          .values({
            resourceId: params.id,
            tagName,
          })
          .onConflictDoNothing();
      })
    );
  }
  const associatedTags = await db.query.resourceTags.findMany({
    where: (resourceTags, { eq }) =>
      eq(resourceTags.resourceId, updatedResource.id),
    columns: { tagName: true }, // Fetch only the tag names
  });
  return c.json(
    { ...updatedResource, tags: associatedTags.map((t) => t.tagName) },
    HttpStatusCodes.OK
  );
};

export const publish: AppRouteHandler<PublishRoute> = async (c) => {
  const params = c.req.param();
  const db = createDB(c.env);
  const user = c.get("user");
  if (!user || !user.id || user.role !== "admin") {
    return c.json(
      { message: "User not authenticated", success: false },
      HttpStatusCodes.UNAUTHORIZED
    );
  }
  const resource = await db.query.resources.findFirst({
    where: (resources, { eq }) => eq(resources.id, params.id),
  });
  if (!resource) {
    return c.json(
      { message: "Resource not found", success: false },
      HttpStatusCodes.NOT_FOUND
    );
  }
  await db
    .update(resources)
    .set({ isPublished: user?.role === "admin" })
    .where(eq(resources.id, params.id));

  const associatedTags = await db.query.resourceTags.findMany({
    where: (resourceTags, { eq }) => eq(resourceTags.resourceId, resource.id),
    columns: { tagName: true }, // Fetch only the tag names
  });
  return c.json(
    { ...resource, tags: associatedTags.map((t) => t.tagName) },
    HttpStatusCodes.OK
  );
};
