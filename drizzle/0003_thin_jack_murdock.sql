PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`url` text NOT NULL,
	`image` text,
	`resource_type` text NOT NULL,
	`category_name` text NOT NULL,
	`upvote_count` integer DEFAULT 0 NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_resources`("id", "title", "description", "url", "image", "resource_type", "category_name", "upvote_count", "user_id", "created_at", "updated_at") SELECT "id", "title", "description", "url", "image", "resource_type", "category_name", "upvote_count", "user_id", "created_at", "updated_at" FROM `resources`;--> statement-breakpoint
DROP TABLE `resources`;--> statement-breakpoint
ALTER TABLE `__new_resources` RENAME TO `resources`;--> statement-breakpoint
PRAGMA foreign_keys=ON;