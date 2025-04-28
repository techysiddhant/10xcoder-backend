import { and, asc, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { count, SQL } from "drizzle-orm/sql";

import * as HttpStatusCodes from "stoker/http-status-codes";
import {
  categories,
  resources,
  resourceTags,
  resourceToTag,
  resourceUpvotes,
  user,
} from "@/db/schema";
import { isResourceType } from "@/lib/utils";
import type { AppRouteHandler, ResourceTag } from "@/lib/types";
import type {
  CreateRoute,
  GetAllRoute,
  GetOne,
  GetUsersResources,
  PatchRoute,
  PublishRoute,
} from "./resources.routes";
import { redis } from "@/lib/redis";
import db from "@/db";
import { alias } from "drizzle-orm/pg-core";
async function deleteResourceKeys(pattern: string) {
  let cursor = 0;
  const keysToDelete: string[] = [];

  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: pattern,
      count: 100,
    });
    cursor = Number(nextCursor);
    keysToDelete.push(...keys);
  } while (cursor !== 0);

  // Delete in batches
  const BATCH_SIZE = 10;
  for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
    const batch = keysToDelete.slice(i, i + BATCH_SIZE);
    await redis.del(...batch);
    console.log(`🗑️ Deleted batch:`, batch);
  }

  console.log(`✅ Deleted ${keysToDelete.length} keys`);
}

export const getAll: AppRouteHandler<GetAllRoute> = async (c) => {
  const resourceType = c.req.query("resourceType") ?? "";
  const categoryName = c.req.query("category") ?? "";
  const tagsParam = c.req.query("tags") ?? "";

  const cursor = c.req.query("cursor") ?? undefined;
  let cursorDate: Date | undefined;
  const rawLimit = c.req.query("limit") ?? "10";
  const limit = Number.parseInt(rawLimit, 10);
  if (Number.isNaN(limit) || limit < 10 || limit > 50) {
    return c.json(
      { message: "Invalid limit", success: false },
      HttpStatusCodes.BAD_REQUEST
    );
  }
  if (cursor != null) {
    const timestamp = Date.parse(cursor);
    if (Number.isNaN(timestamp)) {
      // return a 400 Bad Request or throw a BadRequestError
      return c.json(
        { message: "Invalid cursor ", success: false },
        HttpStatusCodes.BAD_REQUEST
      );
    }
    cursorDate = new Date(timestamp);
  }

  const tags = tagsParam
    .split(",")
    .map((tag: string) => tag.trim())
    .filter(Boolean);

  // Generate a full cache key including cursor and limit
  const cacheKey = [
    "resources",
    `type:${resourceType}`,
    `category:${categoryName}`,
    `tags:${tags.sort().join(",")}`,
    `cursor:${cursor ?? "null"}`,
    `limit:${limit}`,
  ].join("|");

  // Try Redis Cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    const data = typeof cached === "string" ? cached : JSON.stringify(cached);
    return c.json(JSON.parse(data), HttpStatusCodes.OK);
  }

  // Build where clause
  const baseWhere = and(
    ...(resourceType && isResourceType(resourceType)
      ? [eq(resources.resourceType, resourceType)]
      : []),
    ...(categoryName ? [eq(categories.name, categoryName)] : []),
    ...(tags.length > 0 ? [inArray(resourceTags.name, tags)] : []),
    ...(cursor ? [lt(resources.createdAt, new Date(cursor))] : [])
  );

  const filteredResources = await db
    .selectDistinctOn([resources.createdAt], {
      id: resources.id,
      title: resources.title,
      description: resources.description,
      url: resources.url,
      image: resources.image,
      resourceType: resources.resourceType,
      categoryId: resources.categoryId,
      createdAt: resources.createdAt,
      updatedAt: resources.updatedAt,
      categoryName: categories.name,
      language: resources.language,
    })
    .from(resources)
    .innerJoin(categories, eq(resources.categoryId, categories.id))
    .leftJoin(resourceToTag, eq(resourceToTag.resourceId, resources.id))
    .leftJoin(resourceTags, eq(resourceToTag.tagId, resourceTags.id))
    .where(baseWhere)
    .groupBy(resources.id, categories.id)
    .having(
      tags.length > 0
        ? sql`COUNT(DISTINCT ${resourceTags.name}) = ${tags.length}`
        : undefined
    )
    .orderBy(desc(resources.createdAt), desc(resources.id))
    .limit(limit + 1); // limit + 1 for nextCursor

  const resourceIds = filteredResources.map((r) => r.id);

  // Fetch tags for resources
  const tagRows = await db
    .select({
      resourceId: resourceToTag.resourceId,
      tagName: resourceTags.name,
    })
    .from(resourceToTag)
    .innerJoin(resourceTags, eq(resourceToTag.tagId, resourceTags.id))
    .where(inArray(resourceToTag.resourceId, resourceIds));

  const tagMap = new Map<string, string[]>();
  for (const { resourceId, tagName } of tagRows) {
    if (!tagMap.has(resourceId)) tagMap.set(resourceId, []);
    tagMap.get(resourceId)!.push(tagName);
  }

  // Attach tags
  let finalData = filteredResources.map((res) => ({
    ...res,
    tags: tagMap.get(res.id) ?? [],
  }));

  // Handle nextCursor
  let nextCursor: string | null = null;
  if (finalData.length > limit) {
    const nextItem = finalData.pop(); // remove extra
    nextCursor = nextItem?.createdAt.toISOString() ?? null;
  }

  const response = {
    resources: finalData,
    nextCursor,
  };

  // Cache this page for 5 minutes
  await redis.set(cacheKey, JSON.stringify(response), { ex: 300 });

  return c.json(response, HttpStatusCodes.OK);
};

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const {
    tags: tagsArray,
    title,
    description,
    url,
    image,
    resourceType,
    categoryId,
    language,
  } = c.req.valid("json");

  // const tagNames = (tagsArray ?? "")
  //   .split(",")
  //   .map((tag: string) => tag.trim().toLowerCase())
  //   .filter((tag: string) => tag.length > 0);
  const tagNames = Array.from(
    new Set(
      (tagsArray ?? "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const userLoggedIn = c.get("user");

  if (!userLoggedIn || !userLoggedIn.id) {
    return c.json(
      { message: "User not authenticated", success: false },
      HttpStatusCodes.UNAUTHORIZED
    );
  }
  if (!isResourceType(resourceType)) {
    return c.json(
      { message: "Invalid resource type", success: false },
      HttpStatusCodes.BAD_REQUEST
    );
  }
  const [createdResource] = await db
    .insert(resources)
    .values({
      title,
      description,
      url,
      image,
      resourceType,
      categoryId,
      language,
      upvoteCount: 0,
      userId: userLoggedIn.id,
      isPublished: userLoggedIn.role === "admin",
    })
    .returning();
  const existingTags = await db
    .select()
    .from(resourceTags)
    .where(inArray(resourceTags.name, tagNames));

  const existingTagMap = new Map(existingTags.map((tag) => [tag.name, tag.id]));

  const newTagNames = tagNames.filter((name) => !existingTagMap.has(name));
  let newTags: ResourceTag[] = [];
  if (newTagNames.length > 0) {
    newTags = await db
      .insert(resourceTags)
      .values(newTagNames.map((name) => ({ name })))
      .returning();
  }
  const allTagIds = [
    ...existingTags.map((tag) => tag.id),
    ...newTags.map((tag) => tag.id),
  ];
  // 5. Create resource-to-tag relationships
  if (allTagIds.length > 0) {
    await db.insert(resourceToTag).values(
      allTagIds.map((tagId) => ({
        resourceId: createdResource.id,
        tagId,
      }))
    );
  }
  await deleteResourceKeys(`user-resources:${userLoggedIn.id}:*`);
  if (userLoggedIn.role === "admin") {
    await deleteResourceKeys("resources:*");
    await deleteResourceKeys(`user-resources:${userLoggedIn.id}:*`);
  }
  return c.json(
    { success: true, resourceId: createdResource.id },
    HttpStatusCodes.CREATED
  );
};

export const getOne: AppRouteHandler<GetOne> = async (c) => {
  const { id } = c.req.param(); // assumes /resource/:id
  const userLogged = c.get("user");
  const cacheKey = `resource:${id}:user:${userLogged?.id || "guest"}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    const data = typeof cached === "string" ? cached : JSON.stringify(cached);
    return c.json(JSON.parse(data), HttpStatusCodes.OK);
  }
  const creator = alias(user, "creator");
  const [resource] = await db
    .select({
      id: resources.id,
      title: resources.title,
      description: resources.description,
      url: resources.url,
      image: resources.image,
      resourceType: resources.resourceType,
      upvoteCount: resources.upvoteCount,
      createdAt: resources.createdAt,
      updatedAt: resources.updatedAt,
      categoryName: categories.name,
      language: resources.language,
      categoryId: resources.categoryId,
      creator: {
        name: creator.name,
        username: creator.username,
      },
      status: resources.status,
      isPublished: resources.isPublished,
    })
    .from(resources)
    .innerJoin(categories, eq(resources.categoryId, categories.id))
    .innerJoin(creator, eq(resources.userId, creator.id))
    .where(
      and(
        eq(resources.id, id),
        userLogged?.id ? undefined : eq(resources.isPublished, true)
      )
    );

  if (!resource) {
    return c.json(
      { success: false, message: "Resource not found" },
      HttpStatusCodes.NOT_FOUND
    );
  }
  const tagRows = await db
    .select({
      tagName: resourceTags.name,
    })
    .from(resourceToTag)
    .innerJoin(resourceTags, eq(resourceToTag.tagId, resourceTags.id))
    .where(eq(resourceToTag.resourceId, id));

  const tags = tagRows.map((row) => row.tagName);
  let isVoted = false;
  if (userLogged?.id) {
    const vote = await db
      .select({ id: resourceUpvotes.userId })
      .from(resourceUpvotes)
      .where(
        and(
          eq(resourceUpvotes.resourceId, id),
          eq(resourceUpvotes.userId, userLogged.id)
        )
      )
      .limit(1);
    isVoted = vote.length > 0;
  }
  const finalData = {
    ...resource,
    tags,
    isVoted,
  };

  await redis.set(cacheKey, JSON.stringify(finalData), { ex: 600 });

  return c.json(finalData, HttpStatusCodes.OK);
};

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const { id } = c.req.param();
  const userLogged = c.get("user");
  if (!userLogged?.id) {
    return c.json(
      { success: false, message: "Unauthorized" },
      HttpStatusCodes.UNAUTHORIZED
    );
  }
  const {
    title,
    description,
    url,
    image,
    resourceType,
    categoryId,
    language,
    tags: tagsString,
  } = c.req.valid("json");
  const tagNames = (tagsString ?? "")
    .split(",")
    .map((tag: string) => tag.trim().toLowerCase())
    .filter((tag: string) => tag.length > 0);
  const [existing] = await db
    .select()
    .from(resources)
    .where(and(eq(resources.id, id), eq(resources.userId, userLogged.id)));

  if (!existing) {
    return c.json(
      { success: false, message: "Resource not found or not yours" },
      HttpStatusCodes.NOT_FOUND
    );
  }
  await db
    .update(resources)
    .set({
      title,
      description,
      url,
      image,
      resourceType,
      categoryId,
      language,
      updatedAt: new Date(),
      isPublished: userLogged.role === "admin",
    })
    .where(eq(resources.id, id));
  const existingTags = await db
    .select()
    .from(resourceTags)
    .where(inArray(resourceTags.name, tagNames));

  const existingTagNames = existingTags.map((tag) => tag.name);
  const newTagsToCreate = tagNames.filter(
    (name) => !existingTagNames.includes(name)
  );

  // b. Insert new tags if any
  if (newTagsToCreate.length > 0) {
    await db.insert(resourceTags).values(
      newTagsToCreate.map((name) => ({
        name,
      }))
    );
  }

  // c. Fetch final tag IDs
  const finalTags = await db
    .select()
    .from(resourceTags)
    .where(inArray(resourceTags.name, tagNames));

  // d. Delete old tag mappings
  await db.delete(resourceToTag).where(eq(resourceToTag.resourceId, id));

  // e. Add new tag mappings
  if (finalTags.length > 0) {
    await db.insert(resourceToTag).values(
      finalTags.map((tag) => ({
        resourceId: id,
        tagId: tag.id,
      }))
    );
  }

  // 4. Invalidate Redis cache
  await redis.del(`resource:${id}`);
  await redis.del(`resource:${id}:user:${userLogged.id}`);
  await deleteResourceKeys(`user-resources:${userLogged.id}:*`);
  await deleteResourceKeys("resources:*");
  await deleteResourceKeys(`resource:${id}:user:*`);

  return c.json(
    { success: true, message: "Resource updated successfully" },
    HttpStatusCodes.OK
  );
};

export const publish: AppRouteHandler<PublishRoute> = async (c) => {
  const { id } = c.req.param();
  const { status } = c.req.valid("json");
  const userLoggedIn = c.get("user");
  if (!userLoggedIn || !userLoggedIn.id || userLoggedIn.role !== "admin") {
    return c.json(
      { message: "User not authenticated", success: false },
      HttpStatusCodes.UNAUTHORIZED
    );
  }
  const [existing] = await db
    .select({ id: resources.id, isPublished: resources.isPublished })
    .from(resources)
    .where(eq(resources.id, id));

  if (!existing) {
    return c.json(
      { success: false, message: "Resource not found" },
      HttpStatusCodes.NOT_FOUND
    );
  }
  await db
    .update(resources)
    .set({
      isPublished: status === "approved" ? true : false,
      status: status,
      updatedAt: new Date(),
    })
    .where(eq(resources.id, id));

  // 4. Invalidate cache
  await redis.del(`resource:${id}`);
  await deleteResourceKeys("resources:*");
  await deleteResourceKeys(`user-resources:${userLoggedIn.id}:*`);
  await redis.del(`resource:${id}:user:${userLoggedIn.id}`);
  return c.json({
    success: true,
    message: `Resource has been ${
      existing.isPublished ? "Un-published" : "Published"
    }`,
  });
};
export const getUsersResources: AppRouteHandler<GetUsersResources> = async (
  c
) => {
  const userLoggedIn = c.get("user");

  if (!userLoggedIn?.id) {
    return c.json(
      { message: "User not authenticated", success: false },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const page = Number.parseInt(c.req.query("page") || "1", 10);
  const limit = Number.parseInt(c.req.query("limit") || "10", 10);
  if (isNaN(page) || page < 1) {
    return c.json(
      { message: "Invalid page number", success: false },
      HttpStatusCodes.BAD_REQUEST
    );
  }
  if (Number.isNaN(limit) || limit < 10) {
    return c.json(
      { message: "Invalid limit number", success: false },
      HttpStatusCodes.BAD_REQUEST
    );
  }
  const offset = (page - 1) * limit;

  const cacheKey = `user-resources:${userLoggedIn.id}:${page}:${limit}`;

  // 1. Try Redis cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    const data = typeof cached === "string" ? cached : JSON.stringify(cached);
    if (data) return c.json(JSON.parse(data), HttpStatusCodes.OK);
  }

  const baseWhere = eq(resources.userId, userLoggedIn.id);

  const rows = await db
    .select({
      id: resources.id,
      title: resources.title,
      description: resources.description,
      url: resources.url,
      image: resources.image,
      resourceType: resources.resourceType,
      isPublished: resources.isPublished,
      createdAt: resources.createdAt,
      updatedAt: resources.updatedAt,
      categoryName: categories.name,
      upvoteCount: resources.upvoteCount,
      language: resources.language,
      status: resources.status,
      categoryId: resources.categoryId,
    })
    .from(resources)
    .leftJoin(categories, eq(resources.categoryId, categories.id))
    .where(baseWhere)
    .orderBy(desc(resources.createdAt))
    .limit(limit)
    .offset(offset);

  const totalCountResult = await db
    .select({ count: count() })
    .from(resources)
    .where(baseWhere);
  const totalCount = totalCountResult[0]?.count || 0;

  const resourceIds = rows.map((r) => r.id);
  const tagMappings = await db
    .select({
      resourceId: resourceToTag.resourceId,
      tagName: resourceTags.name,
    })
    .from(resourceToTag)
    .leftJoin(resourceTags, eq(resourceToTag.tagId, resourceTags.id))
    .where(inArray(resourceToTag.resourceId, resourceIds));

  const tagMap: Record<string, string[]> = {};
  for (const { resourceId, tagName } of tagMappings) {
    if (!tagMap[resourceId]) tagMap[resourceId] = [];
    if (tagName !== null) tagMap[resourceId].push(tagName);
  }

  const resourcesWithTags = rows.map((res) => ({
    ...res,
    tags: tagMap[res.id] || [],
  }));

  const hasNextPage = offset + limit < totalCount;
  const hasPrevPage = offset > 0;

  await redis.set(
    cacheKey,
    JSON.stringify({
      resources: resourcesWithTags,
      page,
      limit,
      totalCount,
      hasNextPage,
      hasPrevPage,
    }),
    { ex: 300 }
  );

  return c.json(
    {
      resources: resourcesWithTags,
      page,
      limit,
      totalCount,
      hasNextPage,
      hasPrevPage,
    },
    HttpStatusCodes.OK
  );
};
