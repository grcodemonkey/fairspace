CREATE INDEX "pages_kind_published_at_idx" ON "pages" USING btree ("kind","publishedAt" DESC NULLS LAST);--> statement-breakpoint
-- Hand-written (#22): /news is now the news index, which shadows a page created with slug `news` before #21 reserved it.
-- Move that page to `news-page` (or `news-page-<id prefix>` when that slug is taken). Menu items link by page id, so they follow.
UPDATE "pages" SET "slug" = CASE WHEN EXISTS (SELECT 1 FROM "pages" WHERE "slug" = 'news-page') THEN 'news-page-' || left(replace("id", '-', ''), 8) ELSE 'news-page' END WHERE "slug" = 'news' AND "kind" = 'page';
