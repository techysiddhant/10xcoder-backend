import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { redis } from "@/lib/redis";

import type { GetAllRoute } from "./tags.routes";

export const getAll: AppRouteHandler<GetAllRoute> = async (c) => {
  const cached = await redis.get("tags");
  if (cached) {
    const data = typeof cached === "string" ? cached : JSON.stringify(cached);
    return c.json(JSON.parse(data), HttpStatusCodes.OK);
  }
  const tags = await db.query.resourceTags.findMany();
  await redis.set("tags", JSON.stringify(tags), { ex: 600 });
  return c.json(tags, HttpStatusCodes.OK);
};
