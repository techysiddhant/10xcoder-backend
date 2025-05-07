import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { redis } from "@/lib/redis";

import type { GetAllRoute } from "./categories.routes";

export const getAll: AppRouteHandler<GetAllRoute> = async (c) => {
  const cachedData = await redis.get("categories");
  if (cachedData) {
    const cachedDataString
      = typeof cachedData === "string" ? cachedData : JSON.stringify(cachedData);
    return c.json(JSON.parse(cachedDataString), HttpStatusCodes.OK);
  }
  const categories = await db.query.categories.findMany();
  await redis.set("categories", JSON.stringify(categories), { ex: 600 });
  return c.json(categories, HttpStatusCodes.OK);
};
