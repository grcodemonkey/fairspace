ALTER TABLE "site_settings" ADD COLUMN "analyticsProvider" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "analyticsId" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_analytics" CHECK (coalesce(
        ("site_settings"."analyticsProvider" is null and "site_settings"."analyticsId" is null)
        or ("site_settings"."analyticsProvider" = 'plausible' and "site_settings"."analyticsId" ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' and char_length("site_settings"."analyticsId") <= 253)
        or ("site_settings"."analyticsProvider" = 'google' and "site_settings"."analyticsId" ~ '^G-[A-Z0-9]{4,20}$'),
        false));