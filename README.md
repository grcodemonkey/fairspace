# Fairspace

An open-source site builder for nonprofits. One site per install.

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
| `AUTH_URL` | Public site URL. Magic links use it. Set it on self-hosted installs. |
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

Admins and editors create pages at `/admin/pages` and edit them in the Puck editor. "Save draft" saves only the draft; it does not change the live page. Publishing comes in a later release.

A published page shows at `/<slug>`. The page with slug `home` shows at `/`, and `/home` redirects to `/`. Public pages need no sign-in and show only the published revision, never the draft. Until a `home` page is published, `/` shows the welcome text.

Blocks: Hero, Heading, Rich text, Button and Columns (2–4 columns that stack on mobile). The server checks every block value on save. Links must start with `https://`, `http://`, `mailto:`, `tel:`, `/` or `#`; rich text is cleaned to a short list of safe tags.

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

Locally, `pnpm db:up` starts SeaweedFS (S3 API on http://localhost:8333) and creates the `fairspace` bucket with CORS for `AUTH_URL`. Tests use the `fairspace-test` bucket.

In production (Cloudflare R2, Backblaze B2, AWS S3 or another S3-compatible service):

1. Create a private bucket. Do not allow public writes.
2. Add a CORS rule: allowed origin is your exact site origin (for example `https://example.com`, no wildcard), allowed method is `PUT` only, allowed header is `Content-Type` only. Without it, the browser cannot upload, even though the server works.
3. Create an access key that can read, write and delete objects in this bucket only. Set the `S3_*` variables.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm exec playwright install chromium` | Install the e2e browser |
| `pnpm dev` | Start the dev server at http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate route types, then `tsc --noEmit` |
| `pnpm db:up` | Start local Postgres, Mailpit and SeaweedFS (Docker), wait until ready, then create the media bucket |
| `pnpm db:down` | Stop local Postgres (data stays in the volume) |
| `pnpm db:generate` | Generate a migration from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to the dev database |
| `pnpm test` | Unit tests (Vitest); needs `pnpm db:up` |
| `pnpm e2e` | End-to-end tests (Playwright; builds and starts the app) |

## License

MIT. See `LICENSE`.
