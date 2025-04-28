import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

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
    language: text("language").notNull().$type<"hindi" | "english">(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    upvoteCount: integer("upvote_count").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(false),
    status: text("status")
      .notNull()
      .$type<"pending" | "approved" | "rejected">()
      .default("pending"),
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
  language: z.enum(["hindi", "english"]),
  categoryId: z.string().min(1),
  url: z.string().url(),
  image: z.string().url().optional(),
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
