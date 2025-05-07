CREATE TABLE "resource_bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "resource_bookmarks" ADD CONSTRAINT "resource_bookmarks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_bookmarks" ADD CONSTRAINT "resource_bookmarks_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_id_bookmark_idx" ON "resource_bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resource_id_bookmark_idx" ON "resource_bookmarks" USING btree ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_resource" ON "resource_bookmarks" USING btree ("user_id","resource_id");