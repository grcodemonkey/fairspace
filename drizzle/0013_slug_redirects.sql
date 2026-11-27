CREATE TABLE "slug_redirects" (
	"slug" text PRIMARY KEY NOT NULL,
	"pageId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slug_redirects_slug_format" CHECK ("slug_redirects"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "slug_redirects" ADD CONSTRAINT "slug_redirects_pageId_pages_id_fk" FOREIGN KEY ("pageId") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slug_redirects_page_id_idx" ON "slug_redirects" USING btree ("pageId");