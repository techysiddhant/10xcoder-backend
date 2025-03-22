import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { Env } from "@/lib/types";

export function createDB(env: Env["Bindings"]) {
  return drizzle(env.DB, { schema });
}
