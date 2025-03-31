import { AppRouteHandler } from "@/lib/types";
import { createDB } from "@/db";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { GetAllRoute } from "./tags.routes";

export const getAll: AppRouteHandler<GetAllRoute> = async (c) => {
  const cachedTags = await c.env.MY_KV.get("tags");
  if (cachedTags) {
    return c.json(JSON.parse(cachedTags), HttpStatusCodes.OK);
  }
  const db = createDB(c.env);
  const tags = await db.query.tags.findMany();
  await c.env.MY_KV.put("tags", JSON.stringify(tags), {
    expirationTtl: 60 * 10,
  });
  return c.json(tags, HttpStatusCodes.OK);
};
