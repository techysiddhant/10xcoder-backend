ALTER TABLE "resources" ALTER COLUMN "language" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "language" SET NOT NULL;