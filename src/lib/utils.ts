import db from "@/db";
import { redisIo } from "./redis";
import { resources } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { PinoLogger } from "hono-pino";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;
export function isResourceType(value: string): value is "video" | "article" {
  return value === "video" || value === "article";
}
export function isValidImageType(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.includes(file.type as any);
}
export function isValidImage(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    return { valid: false, error: "Invalid image type" };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { valid: false, error: "Image too large (max 2MB)" };
  }

  return { valid: true };
}

export async function syncUpvoteCount(logger: PinoLogger) {
  const keys = await redisIo.keys("upvote:count:*");
  logger.info(`Found ${keys.length} upvote keys to sync`);

  let syncedCount = 0;
  for (const key of keys) {
    try {
      const count = await redisIo.get(key);
      const resourceId = key.split(":")[2];

      if (count && resourceId) {
        logger.info(
          `Syncing upvote count for resource ${resourceId}: ${count}`
        );
        await db
          .update(resources) // Ensure `resources` is a valid PgTable instance
          .set({ upvoteCount: Number(count) })
          .where(eq(resources.id, resourceId));
        syncedCount++;
      }
    } catch (syncError) {
      logger.error(`Error syncing key ${key}:`, syncError);
      // Continue with other keys even if one fails
    }
  }
  logger.info(`Successfully synced ${syncedCount} upvote counts`);
  logger.info(
    `Total upvote keys processed: ${keys.length}, successfully synced: ${syncedCount}`
  );
}
