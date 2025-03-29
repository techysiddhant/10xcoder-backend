import { sql } from "drizzle-orm";
import { z } from "zod";
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { isValidImageType } from "@/lib/utils";
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  role: text("role").notNull().$type<"user" | "admin">().default("user"),
  banned: integer("banned", { mode: "boolean" }),
  banReason: text("ban_reason"),
  banExpires: integer("ban_expires", { mode: "timestamp" }),
  username: text("username").unique(),
  displayUsername: text("display_username"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});
export const resources = sqliteTable("resources", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  image: text("image"), // Thumbnail / Preview image
  resourceType: text("resource_type").notNull().$type<"video" | "article">(),
  categoryName: text("category_name").notNull(),
  upvoteCount: integer("upvote_count").notNull().default(0),
  isPublished: integer("is_published", { mode: "boolean" })
    .notNull()
    .default(false),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const resourcesIndexes = sql`
  CREATE INDEX idx_resources_title_desc ON resources(title, description);
  CREATE INDEX idx_resources_type ON resources(resource_type);
  CREATE INDEX idx_resources_category_name ON resources(category_name);
`;
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});
export const categoriesIndexes = sql`
  CREATE INDEX idx_categories_name ON categories(name);
`;
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});
export const tagsIndexes = sql`
  CREATE INDEX idx_tags_name ON tags(name);
`;

export const resourceTags = sqliteTable(
  "resource_tags",
  {
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    tagName: text("tag_name").notNull(), // Storing tag name for fast lookups
    // ✅ Define composite primary key correctly
  },
  (t) => ({
    pk: primaryKey({ columns: [t.resourceId, t.tagName] }),
  })
);
export const resourceTagsIndexes = sql`
  CREATE INDEX idx_resource_tags_tag_name ON resource_tags(tag_name);
`;
export const resourceUpvotes = sqliteTable(
  "resource_upvotes",
  {
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }), // Storing user ID to prevent duplicate upvotes
  },
  (t) => ({
    pk: primaryKey({ columns: [t.resourceId, t.userId] }), // Composite PK ensures unique upvote per user
  })
);

// ✅ Index for fast lookups
export const resourceUpvotesIndexes = sql`
  CREATE INDEX idx_upvotes_resource_id ON resource_upvotes(resource_id);
  CREATE INDEX idx_upvotes_user_id ON resource_upvotes(user_id);
`;

export const selectResourceSchema = createSelectSchema(resources).extend({
  tags: z.array(z.string()),
});
export const insertResourceSchema = createInsertSchema(resources, {
  title: z.string().min(1),
  resourceType: z.enum(["video", "article"]),
  categoryName: z.string().min(1),
  url: z.string().url(),
  image: z
    .custom<File | undefined>((file) => {
      if (!file) return true; // Allow no image (optional)

      if (!(file instanceof File)) return false;

      const allowedTypes = ["image/jpeg", "image/png"];
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
