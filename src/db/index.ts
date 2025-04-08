import env from "@/lib/env";
import * as schema from "./schema";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
const sql = neon(env.DATABASE_URL);
const db = drizzle(sql, {
  schema,
});
export default db;
