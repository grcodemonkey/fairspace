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

`pnpm db:up` also starts Mailpit, a local inbox. Read sign-in emails at http://localhost:8025.

Until there is an admin bootstrap, add a user with SQL (use a lower-case email):

```sh
docker compose exec db psql -U fairspace -c "insert into users (id, email) values (gen_random_uuid(), 'me@example.com')"
```

Then open http://localhost:3000/sign-in. After you sign in, you land on `/admin`.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm exec playwright install chromium` | Install the e2e browser |
| `pnpm dev` | Start the dev server at http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate route types, then `tsc --noEmit` |
| `pnpm db:up` | Start local Postgres and Mailpit (Docker) and wait until ready |
| `pnpm db:down` | Stop local Postgres (data stays in the volume) |
| `pnpm db:generate` | Generate a migration from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to the dev database |
| `pnpm test` | Unit tests (Vitest); needs `pnpm db:up` |
| `pnpm e2e` | End-to-end tests (Playwright; builds and starts the app) |

## License

MIT. See `LICENSE`.
