import { sql } from "drizzle-orm";
import type { Data } from "@puckeditor/core";
import {
  type AnyPgColumn,
  check,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// What a user may do. New users are editors; the first admin comes from ADMIN_EMAIL.
export const userRole = pgEnum("user_role", ["admin", "editor"]);

// Auth.js Drizzle adapter tables (https://authjs.dev/getting-started/adapters/drizzle) with plural names.
// No password column: sign-in is by email magic link only.
export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").unique(),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    image: text("image"),
    role: userRole("role").notNull().default("editor"),
  },
  // Auth.js looks users up by the lower-cased email, so a mixed-case row would get a duplicate user.
  (user) => [check("users_email_lower_case", sql`${user.email} = lower(${user.email})`)],
);

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [primaryKey({ columns: [verificationToken.identifier, verificationToken.token] })],
);

// A CMS page. The editor saves only to `draft`, so a save never changes the live page.
export const pages = pgTable(
  "pages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    draft: jsonb("draft").$type<Data>().notNull(),
    // The live version: publish and restore set it, unpublish clears it; null means the page is not live.
    publishedRevisionId: text("publishedRevisionId"),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updatedBy").references(() => users.id, { onDelete: "set null" }),
  },
  (page) => [
    check("pages_slug_format", sql`${page.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    // A page can only point at its own revision. A null publishedRevisionId skips the check (MATCH SIMPLE).
    // No "set null": on a composite FK it would null pages.id too. Revisions go only with the page-delete cascade.
    foreignKey({
      name: "pages_published_revision_same_page_fk",
      columns: [page.id, page.publishedRevisionId],
      foreignColumns: [pageRevisions.pageId, pageRevisions.id],
    }),
  ],
);

// Published snapshots of a page's Puck data. Append-only: publish and restore each add one (src/puck/publish.ts).
export const pageRevisions = pgTable(
  "page_revisions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pageId: text("pageId")
      .notNull()
      .references((): AnyPgColumn => pages.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<Data>().notNull(),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    createdBy: text("createdBy").references(() => users.id, { onDelete: "set null" }),
  },
  // The target of the same-page FK on pages. pageId comes first, so it also serves the history list and the cascade.
  (revision) => [unique("page_revisions_page_id_id_unique").on(revision.pageId, revision.id)],
);

// Uploaded files. The object is in the S3 bucket at `key`; uploadedAt stays null while the upload is pending.
export const media = pgTable("media", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  filename: text("filename").notNull(),
  contentType: text("contentType").notNull(),
  size: integer("size").notNull(),
  uploadedBy: text("uploadedBy").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  uploadedAt: timestamp("uploadedAt", { mode: "date", withTimezone: true }),
  // null = not set yet (flagged in the library); '' = decorative; #14 renders `alt ?? ''`.
  alt: text("alt"),
});

// Site-wide settings: one row (id = 1). Each column null = the default in src/brand.ts.
// Later settings (#16 SEO, #20 analytics) add their own columns here.
export const siteSettings = pgTable(
  "site_settings",
  {
    id: integer("id").primaryKey().default(1),
    siteName: text("siteName"),
    // The media delete action refuses the logo file; the FK is only the safety net.
    logoMediaId: text("logoMediaId").references(() => media.id, { onDelete: "set null" }),
    primaryLight: text("primaryLight"),
    primaryDark: text("primaryDark"),
    font: text("font"),
    // #16 search and sharing defaults. The media delete action refuses the file; the FK is only the safety net.
    defaultDescription: text("defaultDescription"),
    defaultShareImageId: text("defaultShareImageId").references(() => media.id, { onDelete: "set null" }),
    updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updatedBy").references(() => users.id, { onDelete: "set null" }),
  },
  // The colors reach CSS: only a 6-digit lower-case hex gets in (the action and the layout check again).
  (s) => [
    check("site_settings_single_row", sql`${s.id} = 1`),
    check("site_settings_primary_light_hex", sql`${s.primaryLight} ~ '^#[0-9a-f]{6}$'`),
    check("site_settings_primary_dark_hex", sql`${s.primaryDark} ~ '^#[0-9a-f]{6}$'`),
    check("site_settings_font", sql`${s.font} in ('geist', 'system', 'serif')`),
  ],
);
