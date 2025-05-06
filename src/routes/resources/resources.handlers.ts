import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { count } from "drizzle-orm/sql";

import * as HttpStatusCodes from "stoker/http-status-codes";
import {
  bookmarks,
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
  AddRemoveBookmarkRoute,
  CreateRoute,
  GetAllRoute,
  GetOne,
  GetUsersResources,
  PatchRoute,
  PublishRoute,
  UpvoteQueueRoute,
  UpvoteRoute,
  UserBookmarksRoute,
} from "./resources.routes";
import { CACHE_VERSIONS, redis, redisIo } from "@/lib/redis";
import db from "@/db";
import { alias } from "drizzle-orm/pg-core";
import { qstashClient, qstashReceiver } from "@/lib/qstash";
import env from "@/lib/env";
import type { PinoLogger } from "hono-pino";
import { Context } from "hono";
import { Redis } from "@upstash/redis";
const GETALL_TTL = 60 * 2; // 2 minutes
export const invalidateUserBookmarksCache = async (
  userId: string,
  redis: Redis,
  logger: PinoLogger
): Promise<void> => {
  try {
    // The cache version should match what's used in the userBookmarks handler

    // Pattern for user's bookmarks cache keys
    const pattern = `bookmarks:${CACHE_VERSIONS.BOOKMARKS}:user:${userId}:cursor:*`;

    // For Upstash Redis, we need to use the raw SCAN command
    // Initialize scan cursor to 0
    let cursor = 0;
    const keysToDelete: string[] = [];

    do {
      // Execute SCAN command with the pattern
      // @ts-ignore - Upstash Redis may have different typings
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: pattern,
        count: 100, // Scan 100 keys at a time
      });

      // Convert nextCursor to number
      cursor =
        typeof nextCursor === "string" ? parseInt(nextCursor, 10) : nextCursor;

      // Add found keys to our list
      if (keys && Array.isArray(keys) && keys.length > 0) {
        keysToDelete.push(...keys);
      }

      // Continue until cursor is 0
    } while (cursor !== 0);

    // Delete keys in batches to avoid command size limits
    if (keysToDelete.length > 0) {
      // Delete in batches of 100 keys
      const batchSize = 100;
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize);
        if (batch.length > 0) {
          await redis.del(...batch);
        }
      }
      logger.info(
        `Invalidated ${keysToDelete.length} bookmark cache keys for user ${userId}`
      );
    } else {
      logger.debug(`No bookmark cache keys found for user ${userId}`);
    }
  } catch (error) {
    logger.error(
      `Error invalidating bookmark cache for user ${userId}:`,
      error
    );
    // We don't throw here, as cache invalidation failure should not break the main operation
  }
};

async function processBatch(
  listKey: string,
  batchSize: number,
  logger: PinoLogger
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  // Process operations in a loop, atomically popping one item at a time
  for (let i = 0; i < batchSize; i++) {
    // LPOP atomically removes and returns the first element of the list
    const opStr = await redisIo.lpop(listKey);

    // Exit the loop if the list is empty
    if (!opStr) break;

    try {
      const op = JSON.parse(opStr);
      const { userId, resourceId, action } = op;

      if (action === "add") {
        // Check if upvote already exists to prevent duplicates
        const existing = await db
          .select()
          .from(resourceUpvotes)
          .where(
            and(
              eq(resourceUpvotes.userId, userId),
              eq(resourceUpvotes.resourceId, resourceId)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(resourceUpvotes).values({
            userId,
            resourceId,
          });
          logger.info(
            `Added upvote for user ${userId} on resource ${resourceId}`
          );
        } else {
          logger.info(
            `Skipped duplicate add for user ${userId} on resource ${resourceId}`
          );
        }
      } else if (action === "remove") {
        await db
          .delete(resourceUpvotes)
          .where(
            and(
              eq(resourceUpvotes.userId, userId),
              eq(resourceUpvotes.resourceId, resourceId)
            )
          );
        logger.info(
          `Removed upvote for user ${userId} on resource ${resourceId}`
        );
      }

      processed++;
    } catch (error) {
      logger.error(`Failed to process operation: ${opStr}`, error);
      failed++;

      // Move failed operations to a dead letter queue
      await redisIo.rpush(`${listKey}:failed`, opStr);
    }
  }

  return { processed, failed };
}
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
const getUpvoteCountKey = (resourceId: string) => `upvote:count:${resourceId}`;
/**
 * Get the bookmark count for a resource from Redis or database
 * @param resourceId - The ID of the resource
 * @param redis - Redis client instance
 * @param logger - Logger instance
 * @returns The number of bookmarks for the resource
 */
export const getResourceBookmarkCount = async (
  resourceId: string,
  redis: Redis,
  logger: PinoLogger
): Promise<number> => {
  try {
    const key = getResourceBookmarkCountKey(resourceId);

    // Try to get from Redis first
    const cachedCount = await redis.get(key);

    if (cachedCount !== null) {
      return Number(cachedCount);
    }

    // If not in Redis, initialize from database
    await initializeResourceBookmarkCount(resourceId, redis, logger);

    // Get the newly set value
    const newCachedCount = await redis.get(key);
    return Number(newCachedCount || 0);
  } catch (error) {
    logger.error(
      `Error getting bookmark count for resource ${resourceId}:`,
      error
    );
    return 0; // Default to 0 on error
  }
};
export const getAll: AppRouteHandler<GetAllRoute> = async (c) => {
  const resourceType = c.req.query("resourceType") ?? "";
  const categoryName = c.req.query("category") ?? "";
  const tagsParam = c.req.query("tags") ?? "";
  const userLoggedIn = c.get("user");
  const cursor = c.req.query("cursor") ?? undefined;
  const rawLimit = c.req.query("limit") ?? "10";
  const limit = Number.parseInt(rawLimit, 10);
  const { logger } = c.var;
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
  }

  const tags = tagsParam
    .split(",")
    .map((tag: string) => tag.trim())
    .filter(Boolean);

  // Generate a full cache key including cursor and limit
  const cacheKey = [
    "resources:",
    `user:${userLoggedIn?.id || "guest"}`,
    `type:${resourceType}`,
    `category:${categoryName}`,
    `tags:${tags.sort().join(",")}`,
    `cursor:${cursor ?? "null"}`,
    `limit:${limit}`,
  ].join("|");
  try {
    // Try Redis Cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      const data = typeof cached === "string" ? cached : JSON.stringify(cached);
      return c.json(JSON.parse(data), HttpStatusCodes.OK);
    }
    const userId = userLoggedIn?.id;
    // Build where clause
    const baseWhere = and(
      eq(resources.isPublished, true), // ✅ Ensure only published resources are included
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
        // Add isBookmarked flag using a CASE statement
        // If user is logged in, check if resource is bookmarked by user
        // If user is not logged in, set isBookmarked to false for all resources
        isBookmarked: userId
          ? sql<boolean>`EXISTS (
        SELECT 1 FROM ${bookmarks} 
        WHERE ${bookmarks.resourceId} = ${resources.id} 
        AND ${bookmarks.userId} = ${userId}
      )`
          : sql`false`,
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

    // First try to get all upvote counts from Redis in a single batch operation
    const countKeys = resourceIds.map(getUpvoteCountKey);
    const redisCounts =
      resourceIds.length > 0 ? await redis.mget(...countKeys) : [];

    // Build a map of resource ID to upvote count
    const upvoteCounts = new Map();
    // Process the results from Redis
    for (let i = 0; i < resourceIds.length; i++) {
      const resourceId = resourceIds[i];
      const redisCount = redisCounts[i];

      if (redisCount !== null) {
        // Found in Redis
        upvoteCounts.set(resourceId, Number(redisCount));
      } else {
        // Not found in Redis, will need to fetch from DB
        upvoteCounts.set(resourceId, null);
      }
    }

    // For any missing counts, query the database
    const missingIds = resourceIds.filter(
      (id) => upvoteCounts.get(id) === null
    );

    if (missingIds.length > 0) {
      const dbCounts = await db.execute(sql`
      SELECT resource_id, COUNT(*) as count
      FROM resource_upvotes
      WHERE resource_id IN (${sql.join(
        missingIds.map((id) => sql`${id}`),
        sql`, `
      )})
      GROUP BY resource_id
    `);
      // Update the counts map and cache in Redis
      const pipeline = redis.pipeline();
      const UPVOTE_COUNT_TTL = 60 * 60 * 24 * 7;
      console.log("DB Counts", dbCounts);
      dbCounts.forEach((row) => {
        const resourceId = row.resource_id;
        const count = Number(row.count);
        upvoteCounts.set(resourceId, count);
        // Cache this count in Redis
        pipeline.set(getUpvoteCountKey(String(resourceId)), count, {
          ex: UPVOTE_COUNT_TTL,
        }); // 7 days TTL
      });
      // Any IDs not found in DB have 0 upvotes
      missingIds.forEach((id) => {
        if (upvoteCounts.get(id) === null) {
          upvoteCounts.set(id, 0);
          pipeline.set(getUpvoteCountKey(id), 0, {
            ex: UPVOTE_COUNT_TTL,
          });
        }
      });
      // Execute all Redis operations in one round-trip
      await pipeline.exec();
    }
    // Check if user has upvoted each resource (if logged in)
    let userUpvotes = new Map();
    if (userLoggedIn?.id) {
      // Batch check user upvotes from Redis
      const upvoteKeys = resourceIds.map(
        (id) => `upvote:user:${userLoggedIn.id}:resource:${id}`
      );
      const userUpvoteResults =
        resourceIds.length > 0 ? await redis.mget(...upvoteKeys) : [];

      // Build a map of resource ID to upvoted status
      for (let i = 0; i < resourceIds.length; i++) {
        userUpvotes.set(resourceIds[i], Boolean(userUpvoteResults[i]));
      }

      // For any not found in Redis, we could query the database as well,
      // but that's optional since the upvote endpoint will handle it
    }
    // Fetch tags for resources
    const tagRows = await db
      .select({
        resourceId: resourceToTag.resourceId,
        tagName: resourceTags.name,
      })
      .from(resourceToTag)
      .innerJoin(resourceTags, eq(resourceToTag.tagId, resourceTags.id))
      .where(inArray(resourceToTag.resourceId, [...resourceIds]));

    const tagMap = new Map<string, string[]>();
    for (const { resourceId, tagName } of tagRows) {
      if (!tagMap.has(resourceId)) tagMap.set(resourceId, []);
      tagMap.get(resourceId)!.push(tagName);
    }

    // Attach tags
    let finalData = filteredResources.map((res) => {
      const upvoteCount = upvoteCounts.get(res.id) || 0;
      const hasUpvoted = userLoggedIn?.id
        ? userUpvotes.get(res.id) || false
        : false;
      return {
        ...res,
        tags: tagMap.get(res.id) ?? [],
        upvoteCount,
        hasUpvoted,
      };
    });

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
    await redis.set(cacheKey, JSON.stringify(response), { ex: GETALL_TTL });

    return c.json(response, HttpStatusCodes.OK);
  } catch (error) {
    logger.error("Error in GetALL handler:", error);
    return c.json(
      { success: false, message: "Internal server error" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
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
      status: userLoggedIn.role === "admin" ? "approved" : "pending",
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
  const { logger } = c.var;
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

  // Fetch tags for the resource
  const tagRows = await db
    .select({
      tagName: resourceTags.name,
    })
    .from(resourceToTag)
    .innerJoin(resourceTags, eq(resourceToTag.tagId, resourceTags.id))
    .where(eq(resourceToTag.resourceId, id));

  const tags = tagRows.map((row) => row.tagName);
  // Cache this count in Redis with 7 days TTL (matching getAll handler)
  const UPVOTE_COUNT_TTL = 60 * 60 * 24 * 7;
  // Get upvote count from Redis first
  const upvoteCountKey = getUpvoteCountKey(id);
  let upvoteCount = await redis.get(upvoteCountKey);

  // If not in Redis, get from DB and cache it
  if (upvoteCount === null) {
    const [dbCount] = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM resource_upvotes
      WHERE resource_id = ${id}
    `);

    upvoteCount = Number(dbCount?.count || 0);

    await redis.set(upvoteCountKey, upvoteCount, { ex: UPVOTE_COUNT_TTL });
  } else {
    upvoteCount = Number(upvoteCount);
  }

  // Check if user has upvoted this resource (if logged in)
  let hasUpvoted = false;
  if (userLogged?.id) {
    // First check Redis for user upvote status
    const userUpvoteKey = `upvote:user:${userLogged.id}:resource:${id}`;
    const cachedUpvoteStatus = await redis.get(userUpvoteKey);

    if (cachedUpvoteStatus !== null) {
      hasUpvoted = Boolean(cachedUpvoteStatus);
    } else {
      // Fall back to database check
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

      hasUpvoted = vote.length > 0;

      // Cache the result (this is optional, but matches approach from getAll)
      await redis.set(userUpvoteKey, hasUpvoted ? "1" : "", {
        ex: UPVOTE_COUNT_TTL,
      });
    }
  }
  // Get updated count after operation
  const updatedCount = await getResourceBookmarkCount(
    resource.id,
    redis,
    logger
  );

  const finalData = {
    ...resource,
    tags,
    upvoteCount,
    hasUpvoted,
    bookmarkCount: updatedCount,
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

export const upvote: AppRouteHandler<UpvoteRoute> = async (c) => {
  const { id } = c.req.param();
  const userLoggedIn = c.get("user");
  if (!userLoggedIn?.id) {
    return c.json(
      { message: "User not authenticated", success: false },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const upvoteKey = `upvote:user:${userLoggedIn.id}:resource:${id}`;
  const countKey = `upvote:count:${id}`;
  const resourceKey = `resource:${id}:exists`;
  const resourceSingleKeyUser = `resource:${id}:user:${userLoggedIn.id}`;

  try {
    // Check if resource exists
    let resourceExists = await redisIo.get(resourceKey);
    if (resourceExists === null) {
      const [existing] = await db
        .select()
        .from(resources)
        .where(eq(resources.id, id));
      if (!existing) {
        return c.json(
          { success: false, message: "Resource not found" },
          HttpStatusCodes.NOT_FOUND
        );
      }

      await redisIo.set(resourceKey, 1, "EX", 60 * 60 * 24 * 7); // 7d TTL
      resourceExists = "1";
    }

    // Check if already upvoted
    const alreadyUpvoted = await redisIo.get(upvoteKey);
    let newCount: number;

    if (alreadyUpvoted) {
      // Remove upvote from Redis
      await redisIo.del(upvoteKey);
      newCount = await redisIo.decr(countKey);
      if (newCount < 0) {
        newCount = 0;
        await redisIo.set(countKey, 0);
      }

      // Queue the removal operation
      await qstashClient.publishJSON({
        url: `${env.APP_URL}/resource/upvote/queue`,
        body: {
          userId: userLoggedIn.id,
          resourceId: id,
          action: "remove",
          timestamp: Date.now(),
        },
      });
    } else {
      // Add upvote to Redis
      await redisIo.set(upvoteKey, 1, "EX", 60 * 60 * 24 * 7); // 7d TTL

      // Initialize or increment count
      const currentCount = await redisIo.get(countKey);
      if (currentCount === null) {
        const count = await db
          .select({ count: sql`count(*)` })
          .from(resourceUpvotes)
          .where(eq(resourceUpvotes.resourceId, id));
        newCount = Number(count[0]?.count || 0) + 1;
        await redisIo.set(countKey, newCount, "EX", 60 * 60 * 24 * 7); // 7d TTL
      } else {
        newCount = await redisIo.incr(countKey);
      }

      // Queue the add operation
      await qstashClient.publishJSON({
        url: `${env.APP_URL}/resource/upvote/queue`,
        body: {
          userId: userLoggedIn.id,
          resourceId: id,
          action: "add",
          timestamp: Date.now(),
        },
      });
    }

    // Invalidate cache
    await redisIo.del(resourceSingleKeyUser);
    await deleteResourceKeys(`resources:|user:${userLoggedIn.id}*`);

    // Publish real-time event
    await redisIo.publish(
      "upvote-events",
      JSON.stringify({
        resourceId: id,
        count: newCount,
        action: alreadyUpvoted ? "removed" : "added",
        timestamp: Date.now(),
      })
    );

    return c.json(
      {
        success: true,
        resourceId: id,
        count: newCount,
        action: alreadyUpvoted ? "removed" : "added",
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Error in upvote handler:", error);
    return c.json(
      { success: false, message: "Internal server error" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
export const upvoteQueue: AppRouteHandler<UpvoteQueueRoute> = async (c) => {
  try {
    const { userId, resourceId, action, timestamp } = c.req.valid("json");
    const { logger } = c.var;

    // Verify request signature from QStash
    const signature = c.req.header("upstash-signature");
    if (!signature) {
      return c.json(
        { success: false, message: "Invalid signature" },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const body = await c.req.json();
    const isValid = await qstashReceiver.verify({
      signature,
      body: JSON.stringify(body),
      url: `${env.APP_URL}/resource/upvote/queue`,
    });

    if (!isValid) {
      return c.json(
        { success: false, message: "Invalid signature" },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    if (!userId || !resourceId || !action) {
      return c.json(
        { success: false, message: "Invalid request" },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Add operation to Redis list for batch processing
    const operation = JSON.stringify({
      userId,
      resourceId,
      action,
      timestamp,
    });

    // Use different lists for adds and removes to allow prioritization if needed
    const listKey =
      action === "add" ? "upvote:batch:add" : "upvote:batch:remove";
    await redisIo.rpush(listKey, operation);

    logger.info(
      `Queued ${action} operation for user ${userId} on resource ${resourceId}`
    );

    // Check if we need to schedule a batch job
    // We'll schedule a job if one isn't already scheduled (using a sentinel key)
    const batchJobScheduled = await redisIo.get("upvote:batch:scheduled");
    if (!batchJobScheduled) {
      // Schedule a batch job to run in 1 minute
      await qstashClient.publishJSON({
        url: `${env.APP_URL}/resource/upvote/job/batch`,
        delay: "60s", // 1 minute delay to collect operations
      });

      // Set sentinel key to expire in 70 seconds (slightly longer than the delay)
      await redisIo.set("upvote:batch:scheduled", 1, "EX", 70);
      logger.info("Scheduled new batch upvote processing job");
    }

    return c.json(
      { success: true, message: "Operation queued for batch processing" },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Error in upvote queue handler:", error);
    return c.json(
      { success: false, message: "Internal server error" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
export const upvoteJobBatch = async (c: Context) => {
  const { logger } = c.var;
  try {
    // Process configuration
    const BATCH_SIZE = 50; // Maximum operations to process in one batch
    let processedOperations = 0;
    let failedOperations = 0;

    // Process removes first (usually fewer and important for consistency)
    let removeOps = await processBatch(
      "upvote:batch:remove",
      BATCH_SIZE,
      logger
    );
    processedOperations += removeOps.processed;
    failedOperations += removeOps.failed;

    // Then process adds
    let addOps = await processBatch("upvote:batch:add", BATCH_SIZE, logger);
    processedOperations += addOps.processed;
    failedOperations += addOps.failed;

    // Check if we need to schedule another batch job (if there are remaining operations)
    const remainingAdds = await redisIo.llen("upvote:batch:add");
    const remainingRemoves = await redisIo.llen("upvote:batch:remove");

    if (remainingAdds > 0 || remainingRemoves > 0) {
      // Schedule another job immediately
      await qstashClient.publish({
        url: `${env.APP_URL}/resource/upvote/job/batch`,
        delay: "5s", // Short delay to prevent hammering the system
        // Send a minimal payload to avoid empty body issues
        body: JSON.stringify({ scheduled: true, followUp: true }),
      });

      // Update sentinel key
      await redisIo.set("upvote:batch:scheduled", 1, "EX", 15);
      logger.info(
        `Scheduled follow-up batch job. Remaining operations: ${
          remainingAdds + remainingRemoves
        }`
      );
    }

    return c.json(
      {
        success: true,
        message: "Batch processing completed",
        stats: {
          processed: processedOperations,
          failed: failedOperations,
          remaining: remainingAdds + remainingRemoves,
        },
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    logger.error("Error in batch upvote job handler:", error);
    return c.json(
      { success: false, message: "Internal server error" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
/**
 * Get the Redis key for a resource's bookmark count
 * @param resourceId - The ID of the resource
 * @returns The Redis key for the bookmark count
 */
export const getResourceBookmarkCountKey = (resourceId: string): string => {
  return `resource:${CACHE_VERSIONS.BOOKMARKS}:${resourceId}:bookmark:count`;
};
/**
 * Update bookmark count in Redis for a resource
 * @param resourceId - The ID of the resource
 * @param increment - Whether to increment (true) or decrement (false) the count
 * @param redis - Redis client instance
 * @param logger - Logger instance
 */
export const updateResourceBookmarkCount = async (
  resourceId: string,
  increment: boolean,
  redis: Redis,
  logger: PinoLogger
): Promise<void> => {
  try {
    const key = getResourceBookmarkCountKey(resourceId);

    // First check if the key exists
    const exists = await redis.exists(key);

    if (exists) {
      // Increment or decrement the existing count
      if (increment) {
        await redis.incr(key);
      } else {
        // Ensure we don't go below zero
        await redis.eval(
          // Lua script to decrement only if value is > 0
          `local current = redis.call('get', KEYS[1])
           if current and tonumber(current) > 0 then
             return redis.call('decr', KEYS[1])
           else
             redis.call('set', KEYS[1], '0')
             return 0
           end`,
          [key], // Array of keys
          [] // Array of args (empty in this case)
        );
      }
    } else if (increment) {
      // Key doesn't exist, get accurate count from database
      await initializeResourceBookmarkCount(resourceId, redis, logger);
    } else {
      // We're trying to decrement a non-existent key, just set to 0
      await redis.set(key, 0);
    }

    // Set expiration to prevent stale counts
    await redis.expire(key, 60 * 60 * 24 * 30); // 30 days TTL
  } catch (error) {
    logger.error(
      `Error updating bookmark count for resource ${resourceId}:`,
      error
    );
    // Non-blocking - we don't want to fail the main operation
  }
};
/**
 * Initialize the bookmark count for a resource by querying the database
 * @param resourceId - The ID of the resource
 * @param redis - Redis client instance
 * @param logger - Logger instance
 */
export const initializeResourceBookmarkCount = async (
  resourceId: string,
  redis: Redis,
  logger: PinoLogger
): Promise<void> => {
  try {
    // Get actual count from database
    const result = await db
      .select({ count: sql`count(*)` })
      .from(bookmarks)
      .where(eq(bookmarks.resourceId, resourceId));

    const count = Number(result[0]?.count || 0);
    const key = getResourceBookmarkCountKey(resourceId);

    // Store count in Redis with TTL
    await redis.set(key, count, { ex: 60 * 60 * 24 * 30 }); // 30 days TTL
    logger.debug(
      `Initialized bookmark count for resource ${resourceId}: ${count}`
    );
  } catch (error) {
    logger.error(
      `Error initializing bookmark count for resource ${resourceId}:`,
      error
    );
  }
};

export const addOrRemoveBookmark: AppRouteHandler<
  AddRemoveBookmarkRoute
> = async (c) => {
  const { resourceId } = c.req.param();
  const userLoggedIn = c.get("user");
  const { logger } = c.var;
  const userResourceKey = `resource:${resourceId}:user:${
    userLoggedIn?.id || "guest"
  }`;

  if (!userLoggedIn || !userLoggedIn.id) {
    return c.json(
      {
        message: "Unauthorized: Authentication required",
        success: false,
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  try {
    const [existing] = await db
      .select()
      .from(resources)
      .where(
        and(eq(resources.id, resourceId), eq(resources.isPublished, true))
      );

    if (!existing) {
      return c.json(
        {
          message: "Resource not found",
          success: false,
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const isBookmarked = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.resourceId, resourceId),
          eq(bookmarks.userId, userLoggedIn.id)
        )
      );

    const wasBookmarked = isBookmarked.length > 0;

    if (!wasBookmarked) {
      // Add bookmark
      await db.insert(bookmarks).values({
        resourceId,
        userId: userLoggedIn.id,
      });
      logger.info(
        `Added bookmark for resource ${resourceId} by user ${userLoggedIn.id}`
      );

      // Increment bookmark count in Redis
      await updateResourceBookmarkCount(resourceId, true, redis, logger);
    } else {
      // Remove bookmark
      await db
        .delete(bookmarks)
        .where(
          and(
            eq(bookmarks.resourceId, resourceId),
            eq(bookmarks.userId, userLoggedIn.id)
          )
        );
      logger.info(
        `Removed bookmark for resource ${resourceId} by user ${userLoggedIn.id}`
      );

      // Decrement bookmark count in Redis
      await updateResourceBookmarkCount(resourceId, false, redis, logger);
    }

    // Invalidate user's bookmarks cache
    await invalidateUserBookmarksCache(userLoggedIn.id, redis, logger);
    await deleteResourceKeys(`resources:|user:${userLoggedIn.id}*`);
    await redis.del(userResourceKey);

    return c.json(
      {
        success: true,
        resourceId,
        message: wasBookmarked ? "Removed" : "Added",
        isBookmarked: !wasBookmarked,
      },
      wasBookmarked ? HttpStatusCodes.OK : HttpStatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Error in add or remove bookmark handler:", error);
    return c.json(
      { success: false, message: "Internal server error" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const userBookmarks: AppRouteHandler<UserBookmarksRoute> = async (c) => {
  const userLoggedIn = c.get("user");
  const { logger } = c.var;

  // Early authentication check
  if (!userLoggedIn || !userLoggedIn.id) {
    return c.json(
      {
        message: "Unauthorized: Authentication required",
        success: false,
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const cursor = c.req.query("cursor") ?? undefined;
  const limit = 10;

  // Improved cache key with version to facilitate future cache invalidation
  const cacheKey = `bookmarks:${CACHE_VERSIONS.BOOKMARKS}:user:${
    userLoggedIn.id
  }:cursor:${cursor ?? "null"}`;
  const CACHE_TTL = 60 * 60 * 24; // Increased to 24 hours for better performance

  try {
    // Try to get from cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      const data = typeof cached === "string" ? cached : JSON.stringify(cached);
      logger.debug(`Cache hit for ${cacheKey}`);
      return c.json(JSON.parse(data), HttpStatusCodes.OK);
    }

    logger.debug(`Cache miss for ${cacheKey}, fetching from database`);

    // Build where clause
    const baseWhere = and(
      eq(bookmarks.userId, userLoggedIn.id),
      ...(cursor ? [lt(bookmarks.createdAt, new Date(cursor))] : [])
    );

    // Single query with limit+1 for pagination
    const userBookmarksWithResources = await db
      .select({
        bookmark: bookmarks,
        resource: resources,
      })
      .from(bookmarks)
      .innerJoin(resources, eq(bookmarks.resourceId, resources.id))
      .where(baseWhere)
      .limit(limit + 1)
      .orderBy(desc(bookmarks.createdAt));

    // Early exit if no results to avoid unnecessary processing
    if (userBookmarksWithResources.length === 0) {
      const emptyResponse = { bookmarks: [], nextCursor: null };
      await redis.set(cacheKey, emptyResponse, { ex: CACHE_TTL });
      return c.json(emptyResponse, HttpStatusCodes.OK);
    }

    const resourceIds = userBookmarksWithResources.map((r) => r.resource.id);

    // Batch Redis operations in a single pipeline
    const pipeline = redis.pipeline();

    // 1. Get all upvote counts
    const countKeys = resourceIds.map(getUpvoteCountKey);
    pipeline.mget(...countKeys);

    // 2. Get user upvote status in the same pipeline if user is logged in
    const upvoteKeys = resourceIds.map(
      (id) => `upvote:user:${userLoggedIn.id}:resource:${id}`
    );
    pipeline.mget(...upvoteKeys);

    // Execute all Redis reads in one round trip
    const [upvoteCountsResult, userUpvotesResult] = await pipeline.exec();

    // Process upvote counts from Redis
    const upvoteCounts = new Map();
    const missingIds = [];

    // Process upvote counts
    for (let i = 0; i < resourceIds.length; i++) {
      const resourceId = resourceIds[i];
      const redisCount = Array.isArray(upvoteCountsResult)
        ? upvoteCountsResult[i]
        : null;

      if (redisCount !== null && redisCount !== undefined) {
        upvoteCounts.set(resourceId, Number(redisCount));
      } else {
        missingIds.push(resourceId);
        upvoteCounts.set(resourceId, 0); // Default to 0 initially
      }
    }

    // Process user upvotes
    const userUpvotes = new Map();
    for (let i = 0; i < resourceIds.length; i++) {
      const redisUpvote = Array.isArray(userUpvotesResult)
        ? userUpvotesResult[i]
        : null;
      userUpvotes.set(resourceIds[i], Boolean(redisUpvote));
    }

    // Only query DB for missing upvote counts if we have missing counts
    if (missingIds.length > 0) {
      // Efficient SQL with prepared parameters
      const dbCounts = await db.execute(sql`
        SELECT resource_id, COUNT(*) as count
        FROM resource_upvotes
        WHERE resource_id IN (${sql.join(
          missingIds.map((id) => sql`${id}`),
          sql`, `
        )})
        GROUP BY resource_id
      `);

      // Update Redis in a single pipeline
      const updatePipeline = redis.pipeline();
      const UPVOTE_COUNT_TTL = 60 * 60 * 24 * 30; // Increased to 30 days

      // Update counts from DB results
      dbCounts.forEach((row) => {
        const resourceId = row.resource_id;
        const count = Number(row.count);
        upvoteCounts.set(resourceId, count);
        updatePipeline.set(getUpvoteCountKey(String(resourceId)), count, {
          ex: UPVOTE_COUNT_TTL,
        });
      });

      // Set 0 counts for any remaining IDs
      missingIds.forEach((id) => {
        if (!dbCounts.some((row) => row.resource_id === id)) {
          updatePipeline.set(getUpvoteCountKey(id), 0, {
            ex: UPVOTE_COUNT_TTL,
          });
        }
      });

      // Execute all Redis writes in one batch
      await updatePipeline.exec();
    }

    // Process final data
    let finalData = userBookmarksWithResources.map((res) => {
      return {
        id: res.bookmark.id,
        userId: res.bookmark.userId,
        resourceId: res.bookmark.resourceId,
        createdAt: res.bookmark.createdAt,
        updatedAt: res.bookmark.updatedAt,
        resource: {
          ...res.resource,
          upvoteCount: upvoteCounts.get(res.resource.id) || 0,
          hasUpvoted: userUpvotes.get(res.resource.id) || false,
        },
      };
    });

    // Handle pagination
    let nextCursor: string | null = null;
    if (finalData.length > limit) {
      const nextItem = finalData.pop();
      nextCursor = nextItem?.createdAt.toISOString() ?? null;
    }

    const response = {
      bookmarks: finalData,
      nextCursor,
    };

    // Cache the final result
    await redis.set(cacheKey, JSON.stringify(response), { ex: CACHE_TTL });

    logger.debug(`Bookmarks data cached with key ${cacheKey}`);
    return c.json(response, HttpStatusCodes.OK);
  } catch (error) {
    logger.error("Error in user bookmarks handler:", error);
    return c.json(
      { success: false, message: "Internal server error" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
