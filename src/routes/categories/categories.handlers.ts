import { AppRouteHandler } from "@/lib/types";
import { GetAllRoute } from "./categories.routes";
import * as HttpStatusCodes from "stoker/http-status-codes";
import db from "@/db";

export const getAll: AppRouteHandler<GetAllRoute> = async (c) => {
  // const cachedCategories = await c.env.MY_KV.get("categories");
  // if (cachedCategories) {
  //   return c.json(JSON.parse(cachedCategories), HttpStatusCodes.OK);
  // }
  const categories = await db.query.categories.findMany();
  // await c.env.MY_KV.put("categories", JSON.stringify(categories), {
  //   expirationTtl: 60 * 10,
  // });
  return c.json(categories, HttpStatusCodes.OK);
};
