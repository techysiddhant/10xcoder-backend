import { AppRouteHandler } from "@/lib/types";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { GetAllRoute } from "./tags.routes";
import db from "@/db";

export const getAll: AppRouteHandler<GetAllRoute> = async (c) => {
  // const cachedTags = await c.env.MY_KV.get("tags");
  // if (cachedTags) {
  //   return c.json(JSON.parse(cachedTags), HttpStatusCodes.OK);
  // }
  const tags = await db.query.resourceTags.findMany();
  // await c.env.MY_KV.put("tags", JSON.stringify(tags), {
  //   expirationTtl: 60 * 10,
  // });
  return c.json(tags, HttpStatusCodes.OK);
};
