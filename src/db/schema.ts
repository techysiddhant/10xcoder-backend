// import { sql } from "drizzle-orm";
import { z } from "zod";
// import {
//   sqliteTable,
//   text,
//   integer,
//   primaryKey,
// } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { isValidImageType } from "@/lib/utils";
// export const user = sqliteTable("user", {
//   id: text("id").primaryKey(),
//   name: text("name").notNull(),
//   email: text("email").notNull().unique(),
//   emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
//   image: text("image"),
//   createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
//   updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
//   role: text("role").notNull().$type<"user" | "admin">().default("user"),
//   banned: integer("banned", { mode: "boolean" }),
//   banReason: text("ban_reason"),
//   banExpires: integer("ban_expires", { mode: "timestamp" }),
//   username: text("username").unique(),
//   displayUsername: text("display_username"),
// });

// export const session = sqliteTable("session", {
//   id: text("id").primaryKey(),
//   expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
//   token: text("token").notNull().unique(),
//   createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
//   updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
//   ipAddress: text("ip_address"),
//   userAgent: text("user_agent"),
//   userId: text("user_id")
//     .notNull()
//     .references(() => user.id, { onDelete: "cascade" }),
//   impersonatedBy: text("impersonated_by"),
// });

// export const account = sqliteTable("account", {
//   id: text("id").primaryKey(),
//   accountId: text("account_id").notNull(),
//   providerId: text("provider_id").notNull(),
//   userId: text("user_id")
//     .notNull()
//     .references(() => user.id, { onDelete: "cascade" }),
//   accessToken: text("access_token"),
//   refreshToken: text("refresh_token"),
//   idToken: text("id_token"),
//   accessTokenExpiresAt: integer("access_token_expires_at", {
//     mode: "timestamp",
//   }),
//   refreshTokenExpiresAt: integer("refresh_token_expires_at", {
//     mode: "timestamp",
//   }),
//   scope: text("scope"),
//   password: text("password"),
//   createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
//   updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
// });

// export const verification = sqliteTable("verification", {
//   id: text("id").primaryKey(),
//   identifier: text("identifier").notNull(),
//   value: text("value").notNull(),
//   expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
//   createdAt: integer("created_at", { mode: "timestamp" }),
//   updatedAt: integer("updated_at", { mode: "timestamp" }),
// });
// export const resources = sqliteTable("resources", {
//   id: text("id").primaryKey(),
//   title: text("title").notNull(),
//   description: text("description"),
//   url: text("url").notNull(),
//   image: text("image"), // Thumbnail / Preview image
//   resourceType: text("resource_type").notNull().$type<"video" | "article">(),
//   categoryName: text("category_name").notNull(),
//   upvoteCount: integer("upvote_count").notNull().default(0),
//   isPublished: integer("is_published", { mode: "boolean" })
//     .notNull()
//     .default(false),
//   userId: text("user_id")
//     .notNull()
//     .references(() => user.id, { onDelete: "cascade" }),
//   createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
//     () => new Date()
//   ),
//   updatedAt: integer("updated_at", { mode: "timestamp" })
//     .$defaultFn(() => new Date())
//     .$onUpdate(() => new Date()),
// });

// export const resourcesIndexes = sql`
//   CREATE INDEX idx_resources_title_desc ON resources(title, description);
//   CREATE INDEX idx_resources_type ON resources(resource_type);
//   CREATE INDEX idx_resources_category_name ON resources(category_name);
// `;
// export const categories = sqliteTable("categories", {
//   id: integer("id").primaryKey({ autoIncrement: true }),
//   name: text("name").notNull().unique(),
// });
// export const categoriesIndexes = sql`
//   CREATE INDEX idx_categories_name ON categories(name);
// `;
// export const tags = sqliteTable("tags", {
//   id: integer("id").primaryKey({ autoIncrement: true }),
//   name: text("name").notNull().unique(),
// });
// export const tagsIndexes = sql`
//   CREATE INDEX idx_tags_name ON tags(name);
// `;

// export const resourceTags = sqliteTable(
//   "resource_tags",
//   {
//     resourceId: text("resource_id")
//       .notNull()
//       .references(() => resources.id, { onDelete: "cascade" }),
//     tagName: text("tag_name").notNull(), // Storing tag name for fast lookups
//     // ✅ Define composite primary key correctly
//   },
//   (t) => ({
//     pk: primaryKey({ columns: [t.resourceId, t.tagName] }),
//   })
// );
// export const resourceTagsIndexes = sql`
//   CREATE INDEX idx_resource_tags_tag_name ON resource_tags(tag_name);
// `;
// export const resourceUpvotes = sqliteTable(
//   "resource_upvotes",
//   {
//     resourceId: text("resource_id")
//       .notNull()
//       .references(() => resources.id, { onDelete: "cascade" }),
//     userId: text("user_id")
//       .notNull()
//       .references(() => user.id, { onDelete: "cascade" }), // Storing user ID to prevent duplicate upvotes
//   },
//   (t) => ({
//     pk: primaryKey({ columns: [t.resourceId, t.userId] }), // Composite PK ensures unique upvote per user
//   })
// );

// // ✅ Index for fast lookups
// export const resourceUpvotesIndexes = sql`
//   CREATE INDEX idx_upvotes_resource_id ON resource_upvotes(resource_id);
//   CREATE INDEX idx_upvotes_user_id ON resource_upvotes(user_id);
// `;

import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  uuid,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  role: text("role"),
  banned: boolean("banned"),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
export const resources = pgTable(
  "resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    url: text("url").notNull(),
    image: text("image"),
    resourceType: text("resource_type").notNull().$type<"video" | "article">(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    upvoteCount: integer("upvote_count").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(false),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (resources) => ({
    resourceTypeIdx: index("resource_type_idx").on(resources.resourceType),
    categoryIdIdx: index("category_id_idx").on(resources.categoryId),
  })
);

// CATEGORY TABLE
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// TAG TABLE
export const resourceTags = pgTable("resource_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// JOIN TABLE (Many-to-Many: Resources ↔ Tags)
export const resourceToTag = pgTable(
  "resource_to_tag",
  {
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => resourceTags.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.resourceId, t.tagId] }),
    resourceIdx: index("resource_tag_resource_idx").on(t.resourceId),
    tagIdx: index("resource_tag_tag_idx").on(t.tagId),
  })
);
export const resourceUpvotes = pgTable(
  "resource_upvotes",
  {
    userId: text("user_id").notNull(), // or uuid if you're using UUIDs for users
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.resourceId] }),
    userIdx: index("resource_upvote_user_idx").on(t.userId),
    resourceIdx: index("resource_upvote_resource_idx").on(t.resourceId),
  })
);

export const selectCategorySchema = createSelectSchema(categories);
export const selectTagSchema = createSelectSchema(resourceTags);
export const selectResourceSchema = createSelectSchema(resources)
  .extend({
    tags: z.array(z.string()),
  })
  .omit({
    userId: true,
  });
export const insertResourceSchema = createInsertSchema(resources, {
  title: z.string().min(1),
  resourceType: z.enum(["video", "article"]),
  categoryId: z.string().min(1),
  url: z.string().url(),
  image: z
    .custom<File | undefined>((file) => {
      if (!file) return true; // Allow no image (optional)

      if (!(file instanceof File)) return false;

      if (!isValidImageType(file)) {
        return false; // Invalid file type
      }

      if (file.size > 2 * 1024 * 1024) {
        return false; // File too large (2MB max)
      }

      return true;
    }, "Invalid image file (must be JPEG/PNG, max 2MB)")
    .optional(),
})
  .omit({
    createdAt: true,
    updatedAt: true,
    id: true,
    userId: true,
    isPublished: true,
    upvoteCount: true,
  })
  .extend({
    tags: z.string().min(1),
  });

export const patchResourceSchema = insertResourceSchema.partial();
