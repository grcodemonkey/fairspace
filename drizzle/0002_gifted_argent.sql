CREATE TYPE "public"."user_role" AS ENUM('admin', 'editor');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'editor' NOT NULL;