CREATE TYPE "public"."page_kind" AS ENUM('page', 'post');--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "kind" "page_kind" DEFAULT 'page' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "publishedAt" timestamp with time zone;