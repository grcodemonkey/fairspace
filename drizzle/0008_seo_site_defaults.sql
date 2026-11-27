ALTER TABLE "site_settings" ADD COLUMN "defaultDescription" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "defaultShareImageId" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_defaultShareImageId_media_id_fk" FOREIGN KEY ("defaultShareImageId") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;