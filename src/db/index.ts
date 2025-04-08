import env from "@/lib/env";
import * as schema from "./schema";
import { neon } from "@neondatabase/serverless";
// import { drizzle } from "drizzle-orm/neon-http";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
// const sql = neon(env.DATABASE_URL);
// const db = drizzle(sql, {
//   schema,
// });
const client = postgres(env.DATABASE_URL);
const db = drizzle(client, { schema });
export default db;
