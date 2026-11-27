# Fairspace

An open-source site builder for nonprofits. One site per install.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgrcodemonkey%2Ffairspace&project-name=fairspace&repository-name=fairspace&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D&env=AUTH_SECRET%2CEMAIL_SERVER%2CEMAIL_FROM%2CADMIN_EMAIL%2CS3_REGION%2CS3_BUCKET%2CS3_ACCESS_KEY_ID%2CS3_SECRET_ACCESS_KEY&envDefaults=%7B%22S3_REGION%22%3A%22auto%22%7D&envDescription=Sign-in%20secret%2C%20SMTP%20sender%20%28for%20example%20Resend%29%2C%20first%20admin%20email%2C%20and%20an%20S3-compatible%20bucket%20%28for%20example%20Cloudflare%20R2%29.&envLink=https%3A%2F%2Fgithub.com%2Fgrcodemonkey%2Ffairspace%23deploy-to-vercel)

The button copies this repository to your GitHub account, creates a Vercel project, and creates a Neon Postgres database through the Vercel Marketplace. Neon sets `DATABASE_URL` for you. Before you click, have an S3-compatible bucket (for example Cloudflare R2) and an SMTP sender (for example Resend) ready. Vercel asks for these values:

| Variable | Value |
| --- | --- |
| `AUTH_SECRET` | Generate with `openssl rand -base64 32`. See [Sign in](#sign-in). |
| `EMAIL_SERVER` | SMTP URL, for example `smtp://resend:<API_KEY>@smtp.resend.com:465`. |
| `EMAIL_FROM` | Sender address, for example `Fairspace <noreply@example.org>`. |
| `ADMIN_EMAIL` | Email of the first admin. |
| `S3_REGION` | Bucket region. R2: `auto`. |
| `S3_BUCKET` | Bucket name. |
| `S3_ACCESS_KEY_ID` | Bucket access key. |
| `S3_SECRET_ACCESS_KEY` | Bucket secret key. |

Optional, add in Project Settings after the deploy: `S3_ENDPOINT` (empty for AWS S3; the R2 or B2 endpoint otherwise, and you need it for R2 and B2). See [Media storage](#media-storage).

- Each production deploy runs the database migrations. Preview deploys skip them.
- A build with a missing variable fails and lists every missing name. Vercel applies variable changes on the next deploy, so redeploy after you fix them.
- `AUTH_URL` is optional on Vercel: it falls back to the production URL. For a custom domain, set `AUTH_URL` before the first deploy, or redeploy after you add the domain. If Vercel system environment variables are not exposed to the build, also set `AUTH_TRUST_HOST=true`.
- Backblaze B2: also set `S3_FORCE_PATH_STYLE=true`.
- Migrations must stay additive. Use expand/contract for destructive changes: a migration runs before the new build goes live.
- After the first deploy, set the bucket CORS origin to the site URL.
- To use a Postgres database from another provider, skip the Neon step and set `DATABASE_URL` in Project Settings.

## Requirements

- Node 24 (see `.nvmrc`)
- pnpm 10
- Docker (local Postgres)

## Database

Postgres 17 runs in Docker on host port 5433. It has two databases: `fairspace` (dev) and `fairspace_test` (tests).

```sh
cp .env.example .env.local
pnpm db:up
pnpm db:migrate
```

`pnpm test` needs `pnpm db:up` first. It migrates `fairspace_test` and refuses to run against any database whose name does not end in `_test`.

## Sign in

Users sign in with an email magic link (Auth.js). Only existing users get a link. An unknown email sees the same "check your email" page, and no email is sent.

Set these in `.env.local` (see `.env.example`):

| Variable | What it is |
| --- | --- |
| `AUTH_SECRET` | Session secret. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | Public site URL. Magic links and absolute share URLs (canonical, `og:image`) use it. Required on self-hosted installs, at build time and at run time. Optional on Vercel (falls back to the production URL). |
| `EMAIL_SERVER` | SMTP URL. Local: `smtp://localhost:1025`. Resend: `smtp://resend:<API_KEY>@smtp.resend.com:465`. |
| `EMAIL_FROM` | Sender address, for example `Fairspace <noreply@example.org>`. |
| `ADMIN_EMAIL` | Email of the first admin. Used only while no admin exists. |

`pnpm db:up` also starts Mailpit, a local inbox. Read sign-in emails at http://localhost:8025.

To create the first admin, set `ADMIN_EMAIL`, open http://localhost:3000/sign-in, and submit that email. The first sign-in creates the admin. After that, a change to `ADMIN_EMAIL` creates no second admin. When no admin exists (for example, the last admin was removed), the next sign-in with `ADMIN_EMAIL` makes that user an admin again. This is the way to recover from a lockout. If you do not want this, remove or change `ADMIN_EMAIL`. After you sign in, you land on `/admin`.

## Roles

- **Admin** can do everything: users, settings, menu and pages.
- **Editor** can create, edit and publish pages and posts.

Admins invite users, change roles and remove users at `/admin/users`. An invite sends the normal sign-in link. The last admin cannot be changed to editor or removed. Removing a user signs them out at once.

New users are editors. For contributors: call `requireUser()` or `requireAdmin()` from `src/guards.ts` in every page, server action and route handler. A layout, a hidden link or proxy is not a guard.

In a guarded page, call the guard first, inside the same async `<Suspense>` child that fetches the admin data. Never fetch admin data in the page body or in a sibling component.

## Pages

Admins and editors create pages at `/admin/pages` and edit them in the Puck editor. "Save draft" saves only the draft; it does not change the live page.

"Publish" saves the content in the editor and makes it live at once. Each publish keeps a revision. The history is at `/admin/pages/<id>/history`: it lists every revision with a preview. Admins can restore a revision: restore copies it into a new live revision and into the draft, so the history stays complete. Editors and admins can unpublish a page; the draft and the history stay. Known limit: an editor tab that was open during a restore can save its old draft over the restored draft (the last save wins). The live page stays the same until the next publish.

A published page shows at `/<slug>`. The page with slug `home` shows at `/`, and `/home` redirects to `/`. Public pages need no sign-in and show only the published revision, never the draft. Until a `home` page is published, `/` shows the welcome text.

The editor warns when a page does not have exactly one H1 (a post: when a block adds an H1, or the title is empty, because the title is the post's H1). The warning shows beside Publish and does not block a save or a publish.

Search and sharing: in the editor's page fields, set a Description (at most 300 characters; about 160 shows in search results), a Social image (from the media library) and "Hide from search engines". They fill the `description`, canonical, `og:*` and `twitter:*` tags on the published page. "Hide" adds `robots: noindex`. Pages are prerendered, so set `AUTH_URL` at build time and at run time (on Vercel it falls back to the production URL): the canonical and `og:image` URLs are fixed at build. A page with no social image has no `og:image`.

Blocks: Hero (with an optional background image under a dark overlay), Heading, Rich text, Button, Image (with an optional caption), Image + text (the image stacks over the text on mobile), Card grid (1–12 cards with an image, title, text and link), Columns (2–4 columns that stack on mobile), Video, Embed and Donate. The server checks every block value on save, publish and restore. Links must start with `https://`, `http://`, `mailto:`, `tel:`, `/` or `#`; rich text is cleaned to a short list of safe tags.

Images take their alt text from the media library when the page renders; a hero background is decorative and gets an empty alt. If an image is deleted, the block shows no image.

Video, Embed and Donate take a page link. Editors never paste embed code or HTML.

- **Video**: a YouTube or Vimeo video link. It plays from `youtube-nocookie.com` or with Vimeo's "do not track" option. The title is required; screen readers read it.
- **Embed**: a Google Forms link (`https://docs.google.com/forms/d/e/…/viewform`) or a Donorbox embed link (`https://donorbox.org/embed/…`, from the campaign's "Embed Code" in Donorbox). `forms.gle` short links do not work: open the form and copy the full link.
- **Donate**: a button that links to any donation page, for example Givebutter, Donorbox or PayPal (`https://www.paypal.com/donate/?hosted_button_id=…`). PayPal pages cannot show inside a frame, and Givebutter offers only a script widget (no frame link), so use Donate for them.

Video and Embed frames are sandboxed and load only when a visitor scrolls near them. The site sends a `Content-Security-Policy: frame-src` header that allows frames only from these sites. To add a site, change `src/puck/embed-providers.ts`.

## News posts

Admins and editors create news posts at `/admin/news`. A post uses the same editor, blocks, publish, history, restore and unpublish as a page. A published post shows at `/news/<slug>` with its title and publish date. Pages and posts share one set of slugs, and no page can use the slug `news`.

The first publish sets the publish date; a republish, restore or unpublish keeps it. Editors and admins can change the date on the post's history page, to today or an earlier day (no scheduling). Dates are UTC days.

The post's Description is its summary, and its Social image is its featured image. The menu page picker lists pages only; to put a post in the menu, use its URL.

`/news` lists published posts, newest first, 10 for each page (`/news/page/2`, `/news/page/3`, …). Each post shows its title, date, summary and featured image. Posts with "Hide from search engines" on are listed too. To put the index in the menu, add a URL item `/news`.

`/news/feed.xml` is an RSS feed of the newest 10 posts (title, link, date and summary; not the full text). Every public page links to it in its head, so feed readers find it from the site address. The feed builds its links from `AUTH_URL` (on Vercel, the production URL is the fallback); with neither set, it answers 503.

A page made with the slug `news` before news posts existed is renamed to `news-page` by the database migration, so it stays reachable at `/news-page`.

## Search engines

`/sitemap.xml` lists every published page and news post at its current slug (`/` for the `home` page), except those with "Hide from search engines" on. Unpublished pages and old slugs never appear. It updates when you publish, restore, unpublish or change a post date. `/robots.txt` allows the site, disallows `/admin`, `/api` and `/sign-in`, and links to the sitemap.

Both build their URLs from `AUTH_URL` (on Vercel, the production URL is the fallback). With neither set, the sitemap is empty and `robots.txt` has no `Sitemap:` line.

## Menu

Admins edit the site menu at `/admin/menu`. The menu has two levels: top items, and child items under a top item. Every item links to a page or to a URL (the same link rule as blocks). A top item with children shows as its link plus a separate button that opens the children. A page link follows the page when its slug changes, and goes away when the page is deleted. A link to a page that is not published does not show on the public site; it shows when the page is published. "Save menu" replaces the whole menu (the last save wins). At most 50 items, and labels of at most 60 characters.

## Media storage

Signed-in users upload images and PDFs at `/admin/media`. The browser sends the file straight to an S3-compatible bucket with a presigned PUT URL. The URL is valid for 5 minutes and is signed for one key, one Content-Type and one Content-Length. After the upload, the server reads the object's size and first bytes. If they do not match the declared type, the server deletes the object.

- Allowed types: JPEG, PNG, WebP, GIF, AVIF and PDF. No SVG, because an SVG can contain script.
- Size limit: 10 MB.
- Known limit: AVIF files with the major brand `mif1` (not `avif`) are refused.
- The browser uploads to `uploads/<id>`. After the checks, the server copies the file to `media/<id>.<ext>`. Only the server writes to `media/`.

| Variable | Value |
| --- | --- |
| `S3_ENDPOINT` | The S3 API URL. Leave it empty for AWS S3. |
| `S3_REGION` | `auto` for R2 and SeaweedFS; the bucket region for AWS and B2 |
| `S3_BUCKET` | The bucket name |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | An access key for this bucket only |
| `S3_FORCE_PATH_STYLE` | `true` for SeaweedFS and B2 |

Locally, `pnpm db:up` starts SeaweedFS (S3 API on http://localhost:8333) and creates the `fairspace` bucket with CORS for `AUTH_URL`. Tests use the `fairspace-test` bucket (set `TEST_S3_BUCKET` to use another one).

In production (Cloudflare R2, Backblaze B2, AWS S3 or another S3-compatible service):

1. Create a private bucket for Fairspace only. Do not share it with other apps: the cleanup deletes old objects under `uploads/`. Do not allow public writes.
2. Add a CORS rule: allowed origin is your exact site origin (for example `https://example.com`, no wildcard), allowed method is `PUT` only, allowed header is `Content-Type` only. Without it, the browser cannot upload, even though the server works.
3. Create an access key that can read, write and delete objects in this bucket only. Set the `S3_*` variables.
4. Optional: add a lifecycle rule that expires objects under `uploads/` after 1 day. The app already cleans them up (see below); the rule is a second safety net.

### Media library

`/admin/media` lists the finished uploads, newest first (the newest 500).

- **Abandoned uploads**: an upload that never finishes is deleted after 1 hour, with its row and its `uploads/` object. Each new upload runs this cleanup after its response.
- **Serving**: each finished file is public at `/media/<id>.<ext>`. The bucket stays private: the app streams the file with the type from the database, `X-Content-Type-Options: nosniff`, and `Cache-Control: public, max-age=86400`. Anyone who has the URL can open the file (the id is a random UUID). That is required, because public pages show these files.
- **Alt text**: set it for each image in the library. An image with no alt text shows a "No alt text" badge. Mark an image "Decorative image" when it adds no information; it then gets an empty alt.
- **Delete**: editors delete their own uploads; admins delete any upload. A file that the draft or the live version of a page uses cannot be deleted: the library lists the pages. Remove the file from those pages first. Old versions in the page history do not block a delete; if you restore one, the deleted file shows no image. The site logo cannot be deleted either; change the logo in Settings first.
- **After a delete**: browsers and a CDN can keep the file for up to 1 day. The image optimizer cache keeps resized copies too; on a self-hosted install, `rm -rf .next/cache/images` removes them at once.

## Site settings

Admins edit the site at `/admin/settings`. Editors get a 403.

- **Site name**: shows in the public header and in each page title ("Page title · Site name"). 1 to 100 characters.
- **Logo**: an image from the media library. It replaces the site name in the header; its alt text is the site name. A file in use as the logo cannot be deleted.
- **Primary colors**: one for light mode, one for dark mode. Buttons and links use them. Each must have at least 4.5:1 contrast on its page background (WCAG AA); a lower color is refused with its ratio. The text on a button is white or black, whichever has more contrast.
- **Font**: one font for the whole public site: Geist (default), System sans, or Serif.
- **Search and sharing**: a default description (at most 300 characters) and a default share image (an image from the media library). A page with no description or social image of its own uses them, and so does the welcome page. A file in use as the default share image cannot be deleted.
- **Analytics**: Plausible (a site domain like `example.org`; no cookies) or Google Analytics (a measurement ID like `G-XXXXXXXXXX`). You enter only the ID: Fairspace builds the script tag from a fixed template and host, so there is no free-form snippet. The script loads on public pages only (never `/admin` or `/sign-in`), and only while a provider is set. Google Analytics sets cookies. Where the law requires consent (for example the EU and UK), the site owner must get it; Fairspace has no consent banner. Self-hosted Plausible is not supported.

Public pages show a save at once. The Puck editor preview keeps the default colors and font.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm exec playwright install chromium` | Install the e2e browser |
| `pnpm dev` | Start the dev server at http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm build:vercel` | What Vercel runs: check required env vars, migrate (production only), then build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate route types, then `tsc --noEmit` |
| `pnpm db:up` | Start local Postgres, Mailpit and SeaweedFS (Docker), wait until ready, then create the media bucket |
| `pnpm db:down` | Stop local Postgres (data stays in the volume) |
| `pnpm db:generate` | Generate a migration from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to the dev database |
| `pnpm test` | Unit tests (Vitest); needs `pnpm db:up` |
| `pnpm e2e` | End-to-end tests (Playwright; builds and starts the app). Also runs the axe check (WCAG 2.2 AA) on every block, light and dark, desktop and mobile, and on every admin and sign-in page, light and dark (in the page editor only the `[data-fairspace]` parts, not Puck's own UI) |

## License

MIT. See `LICENSE`.
