import { and, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
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

export const getAll: AppRouteHandler<GetAllRoute> = async (c) => {
  const resourceType = c.req.query("resourceType") ?? "";
  const categoryName = c.req.query("category") ?? "";
  const tagsParam = c.req.query("tags") ?? "";

  const tags = tagsParam
    .split(",")
    .map((tag: string) => tag.trim())
    .filter(Boolean);

  const cacheKey = `resources:${resourceType}:${categoryName}:${tags
    .sort()
    .join(",")}`;

  // Check Redis cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    const data = typeof cached === "string" ? JSON.parse(cached) : null;
    return c.json(data, HttpStatusCodes.OK);
  }

  // Get filtered resources
  const filteredResources = await db
    .selectDistinctOn([resources.id], {
      id: resources.id,
      title: resources.title,
      description: resources.description,
      url: resources.url,
      image: resources.image,
      resourceType: resources.resourceType,
      categoryId: resources.categoryId,
      createdAt: resources.createdAt,
      updatedAt: resources.updatedAt,
    })
    .from(resources)
    .innerJoin(categories, eq(resources.categoryId, categories.id))
    .leftJoin(resourceToTag, eq(resourceToTag.resourceId, resources.id))
    .leftJoin(resourceTags, eq(resourceToTag.tagId, resourceTags.id))
    .where(
      and(
        ...(resourceType && isResourceType(resourceType)
          ? [eq(resources.resourceType, resourceType)]
          : []),
        ...(categoryName ? [eq(categories.name, categoryName)] : []),
        ...(tags.length > 0 ? [inArray(resourceTags.name, tags)] : [])
      )
    )
    .groupBy(resources.id)
    .having(
      tags.length > 0
        ? sql`COUNT(DISTINCT ${resourceTags.name}) = ${tags.length}`
        : undefined
    );

  const resourceIds = filteredResources.map((r) => r.id);

  // Fetch all tags for these resources in one go
  const tagRows = await db
    .select({
      resourceId: resourceToTag.resourceId,
      tagName: resourceTags.name,
    })
    .from(resourceToTag)
    .innerJoin(resourceTags, eq(resourceToTag.tagId, resourceTags.id))
    .where(inArray(resourceToTag.resourceId, resourceIds));

  // Group tags by resourceId
  const tagMap = new Map<string, string[]>();
  for (const { resourceId, tagName } of tagRows) {
    if (!tagMap.has(resourceId)) tagMap.set(resourceId, []);
    tagMap.get(resourceId)!.push(tagName);
  }

  // Attach tags to each resource
  const finalData = filteredResources.map((res) => ({
    ...res,
    tags: tagMap.get(res.id) ?? [],
  }));

  // Cache for 10 min
  await redis.set(cacheKey, JSON.stringify(finalData), { ex: 600 });

  return c.json(finalData, HttpStatusCodes.OK);
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
  } = c.req.valid("form");

  const tagNames = tagsArray
    .split(",")
    .map((tag: string) => tag.trim().toLowerCase())
    .filter((tag: string) => tag.length > 0);

  const user = c.get("user");

  if (!user || !user.id) {
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
      image: String(image),
      resourceType,
      categoryId,
      upvoteCount: 0,
      userId: user.id,
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
  redis.del("user-resources:" + user.id);
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
    const data = typeof cached === "string" ? JSON.parse(cached) : null;
    return c.json(data, HttpStatusCodes.OK);
  }
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
      creator: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
    .from(resources)
    .innerJoin(categories, eq(resources.categoryId, categories.id))
    .innerJoin(
      user,
      userLogged?.id ? eq(resources.userId, userLogged.id) : undefined
    )
    .where(and(eq(resources.id, id), eq(resources.isPublished, true)));

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
  if (user?.id) {
    const vote = await db
      .select({ id: resourceUpvotes.userId })
      .from(resourceUpvotes)
      .where(
        and(
          eq(resourceUpvotes.resourceId, id),
          eq(resourceUpvotes.userId, user.id)
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
  // const resource = c.req.valid("form");
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
    tags: tagsString,
  } = c.req.valid("form");
  const tagNames = (tagsString ?? "")
    .split(",")
    .map((tag: string) => tag.trim().toLowerCase())
    .filter((tag: string) => tag.length > 0);
  const [existing] = await db
    .select()
    .from(resources)
    .where(and(eq(resources.id, id), eq(resources.userId, user.id)));

  if (!existing) {
    return c.json(
      { success: false, message: "Resource not found or not yours" },
      HttpStatusCodes.NOT_FOUND
    );
  }
  // if (resource.image && isValidImageType(resource.image)) {
  //   return c.json(
  //     { message: "Invalid image type", success: false },
  //     HttpStatusCodes.BAD_REQUEST
  //   );
  // }
  // let newImageKey = existingResource.image;

  // if (resource.image) {
  //   newImageKey = resource.image.name + nanoid(5);
  //   if (existingResource.image) {
  //     await c.env.MY_BUCKET.delete(existingResource.image);
  //   }
  //   const imageR2 = await c.env.MY_BUCKET.put(newImageKey, resource.image!);
  //   if (!imageR2) {
  //     return c.json(
  //       { message: "Failed to upload image", success: false },
  //       HttpStatusCodes.INTERNAL_SERVER_ERROR
  //     );
  //   }
  // }
  await db
    .update(resources)
    .set({
      title,
      description,
      url,
      image: String(image),
      resourceType,
      categoryId,
      updatedAt: new Date(),
    })
    .where(eq(resources.id, id));
  // await db
  //   .insert(categories)
  //   .values({ name: resource.categoryName! })
  //   .onConflictDoNothing();
  // const [updatedResource] = await db
  //   .update(resources)
  //   .set({
  //     title: resource.title,
  //     description: resource.description,
  //     url: resource.url,
  //     image: newImageKey,
  //     resourceType: resource.resourceType,
  //     categoryName: resource.categoryName,
  //   })
  //   .where(eq(resources.id, params.id))
  //   .returning();
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
        id: nanoid(),
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
        id: nanoid(),
        resourceId: id,
        tagId: tag.id,
      }))
    );
  }

  // 4. Invalidate Redis cache
  await redis.del(`resource:${id}`);
  await redis.del(`resource:${id}:user:${user.id}`);
  return c.json(
    { success: true, message: "Resource updated successfully" },
    HttpStatusCodes.OK
  );
};

export const publish: AppRouteHandler<PublishRoute> = async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  if (!user || !user.id || user.role !== "admin") {
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
      isPublished: existing.isPublished ? false : true,
      updatedAt: new Date(),
    })
    .where(eq(resources.id, id));

  // 4. Invalidate cache
  await redis.del(`resource:${id}`);

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
  const user = c.get("user");
  if (!user || !user.id) {
    return c.json(
      { message: "User not authenticated", success: false },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const cacheKey = `user-resources:${user.id}`;

  // 1. Try Redis cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    const data = typeof cached === "string" ? JSON.parse(cached) : null;
    if (data) return c.json(data, HttpStatusCodes.OK); // ✅ Only return the array
  }

  // 2. Fetch user's resources
  const userResources = await db
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
    })
    .from(resources)
    .leftJoin(categories, eq(resources.categoryId, categories.id))
    .where(eq(resources.userId, user.id));

  if (userResources.length === 0) {
    await redis.set(cacheKey, JSON.stringify([]), { ex: 600 });
    return c.json([], HttpStatusCodes.OK); // ✅ Return empty array
  }

  // 3. Get tag mappings
  const resourceIds = userResources.map((r) => r.id);
  const tagMappings = await db
    .select({
      resourceId: resourceToTag.resourceId,
      tagName: resourceTags.name,
    })
    .from(resourceToTag)
    .leftJoin(resourceTags, eq(resourceToTag.tagId, resourceTags.id))
    .where(inArray(resourceToTag.resourceId, resourceIds));

  // 4. Group tags by resource
  const resourceTagMap: Record<string, string[]> = {};
  for (const { resourceId, tagName } of tagMappings) {
    if (!resourceTagMap[resourceId]) resourceTagMap[resourceId] = [];
    if (tagName !== null) {
      resourceTagMap[resourceId].push(tagName);
    }
  }

  // 5. Merge tags into resource objects
  const result = userResources.map((res) => ({
    ...res,
    tags: resourceTagMap[res.id] || [],
  }));

  // 6. Cache result
  await redis.set(cacheKey, JSON.stringify(result), { ex: 600 });

  return c.json(result, HttpStatusCodes.OK); // ✅ Final return
};

// export const upvote: AppRouteHandler<UpvoteRoute> = async (c) => {
//   const resourceId = c.req.param("id");
//   const user = c.get("user");
//   const red = redisPublisher(c.env); // your Redis client

//   if (!user || !user.id) {
//     return c.json(
//       { message: "User not authenticated", success: false },
//       HttpStatusCodes.UNAUTHORIZED
//     );
//   }

//   const upvoteKey = `upvote:user:${user.id}:resource:${resourceId}`;
//   const countKey = `upvote:count:${resourceId}`;

//   const alreadyUpvoted = await red.get(upvoteKey);

//   let newCount: number;

//   if (alreadyUpvoted) {
//     await red.del(upvoteKey);
//     newCount = await red.decr(countKey);
//   } else {
//     await red.set(upvoteKey, "1", "EX", 60 * 60 * 24 * 7);
//     newCount = await red.incr(countKey);
//   }

//   // Publish the upvote event
//   await red.publish(
//     "upvote-events",
//     JSON.stringify({ resourceId, count: newCount })
//   );

//   // Queue it for background DB persistence (e.g., with queue)
//   // TODO: Add this to a queue service like QStash/Cloudflare Queue or custom cron job

//   return c.json(
//     { success: true, resourceId, count: newCount },
//     HttpStatusCodes.OK
//   );
// };
