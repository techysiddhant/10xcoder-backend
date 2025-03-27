PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_resource_tags` (
	`resource_id` text NOT NULL,
	`tag_name` text NOT NULL,
	PRIMARY KEY(`resource_id`, `tag_name`),
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_resource_tags`("resource_id", "tag_name") SELECT "resource_id", "tag_name" FROM `resource_tags`;--> statement-breakpoint
DROP TABLE `resource_tags`;--> statement-breakpoint
ALTER TABLE `__new_resource_tags` RENAME TO `resource_tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_resource_upvotes` (
	`resource_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`resource_id`, `user_id`),
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_resource_upvotes`("resource_id", "user_id") SELECT "resource_id", "user_id" FROM `resource_upvotes`;--> statement-breakpoint
DROP TABLE `resource_upvotes`;--> statement-breakpoint
ALTER TABLE `__new_resource_upvotes` RENAME TO `resource_upvotes`;