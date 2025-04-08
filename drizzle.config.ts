// import { config } from "dotenv";
// import { defineConfig } from "drizzle-kit";
// import fs from "node:fs";
// import path from "node:path";
// config({ path: ".dev.vars" });
// function getLocalD1DB() {
//   try {
//     const basePath = path.resolve(".wrangler");
//     const dbFile = fs
//       .readdirSync(basePath, { encoding: "utf-8", recursive: true })
//       .find((f) => f.endsWith(".sqlite"));

//     if (!dbFile) {
//       throw new Error(`No .sqlite file found in ${basePath} directory`);
//     }
//     const url = path.resolve(basePath, dbFile);
//     return url;
//   } catch (e) {
//     console.error(e);
//     // return Buffer.from("");
//   }
// }

// export default defineConfig({
//   out: "./drizzle",
//   schema: "./src/db/schema.ts",
//   dialect: "sqlite",
//   ...(process.env.NODE_ENV === "production"
//     ? {
//         driver: "d1-http",
//         dbCredentials: {
//           accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
//           databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
//           token: process.env.CLOUDFLARE_D1_TOKEN!,
//         },
//       }
//     : {
//         dbCredentials: {
//           url: getLocalD1DB(),
//         },
//       }),
// });

// import { config } from "dotenv";
// import { defineConfig } from "drizzle-kit";

// config({ path: ".dev.vars" });

// export default process.env.LOCAL_DB_PATH
//   ? {
//       schema: "./src/db/schema.ts",
//       dialect: "sqlite",
//       dbCredentials: {
//         url: process.env.LOCAL_DB_PATH,
//       },
//     }
//   : defineConfig({
//       schema: "./src/db/schema.ts",
//       dialect: "sqlite",
//       out: "./drizzle",
//       driver: "d1-http",
//       dbCredentials: {
//         accountId:
//           process.env.CLOUDFLARE_ACCOUNT_ID ||
//           (() => {
//             throw new Error("CLOUDFLARE_ACCOUNT_ID is required");
//           })(),
//         databaseId:
//           process.env.CLOUDFLARE_DATABASE_ID ||
//           (() => {
//             throw new Error("CLOUDFLARE_DATABASE_ID is required");
//           })(),
//         token:
//           process.env.CLOUDFLARE_D1_TOKEN ||
//           (() => {
//             throw new Error("CLOUDFLARE_D1_TOKEN is required");
//           })(),
//       },
//     });

import env from "@/lib/env";
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./src/db/drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
