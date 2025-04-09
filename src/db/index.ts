import env from "@/lib/env";
import * as schema from "./schema";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const client = postgres(env.DATABASE_URL);
const db = drizzle(client, { schema });
export default db;
