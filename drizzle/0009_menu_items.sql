CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"parentId" text,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"pageId" text,
	"url" text,
	CONSTRAINT "menu_items_one_link" CHECK (num_nonnulls("menu_items"."pageId", "menu_items"."url") = 1)
);
--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_parentId_menu_items_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_pageId_pages_id_fk" FOREIGN KEY ("pageId") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;