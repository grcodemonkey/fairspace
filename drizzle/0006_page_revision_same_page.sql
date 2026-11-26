ALTER TABLE "pages" DROP CONSTRAINT "pages_publishedRevisionId_page_revisions_id_fk";
--> statement-breakpoint
DROP INDEX "page_revisions_page_id_idx";--> statement-breakpoint
-- Moved by hand above the FK: drizzle-kit emits it after, and Postgres needs the unique constraint first.
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_page_id_id_unique" UNIQUE("pageId","id");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_published_revision_same_page_fk" FOREIGN KEY ("id","publishedRevisionId") REFERENCES "public"."page_revisions"("pageId","id") ON DELETE no action ON UPDATE no action;
