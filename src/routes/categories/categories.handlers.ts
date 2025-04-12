import { AppRouteHandler } from "@/lib/types";
import { GetAllRoute } from "./categories.routes";
import * as HttpStatusCodes from "stoker/http-status-codes";
import db from "@/db";
import { redis } from "@/lib/redis";

export const getAll: AppRouteHandler<GetAllRoute> = async (c) => {
  const cachedData = await redis.get("categories");
  if (cachedData) {
    const data = typeof cachedData === "string" ? JSON.parse(cachedData) : null;
    return c.json(data, HttpStatusCodes.OK);
  }
  const categories = await db.query.categories.findMany();
  await redis.set("categories", JSON.stringify(categories), { ex: 600 });
  return c.json(categories, HttpStatusCodes.OK);
};
