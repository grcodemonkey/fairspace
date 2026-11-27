CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"siteName" text,
	"logoMediaId" text,
	"primaryLight" text,
	"primaryDark" text,
	"font" text,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedBy" text,
	CONSTRAINT "site_settings_single_row" CHECK ("site_settings"."id" = 1),
	CONSTRAINT "site_settings_primary_light_hex" CHECK ("site_settings"."primaryLight" ~ '^#[0-9a-f]{6}$'),
	CONSTRAINT "site_settings_primary_dark_hex" CHECK ("site_settings"."primaryDark" ~ '^#[0-9a-f]{6}$'),
	CONSTRAINT "site_settings_font" CHECK ("site_settings"."font" in ('geist', 'system', 'serif'))
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_logoMediaId_media_id_fk" FOREIGN KEY ("logoMediaId") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updatedBy_users_id_fk" FOREIGN KEY ("updatedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;