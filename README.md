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

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm exec playwright install chromium` | Install the e2e browser |
| `pnpm dev` | Start the dev server at http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate route types, then `tsc --noEmit` |
| `pnpm db:up` | Start local Postgres (Docker) and wait until healthy |
| `pnpm db:down` | Stop local Postgres (data stays in the volume) |
| `pnpm db:generate` | Generate a migration from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to the dev database |
| `pnpm test` | Unit tests (Vitest); needs `pnpm db:up` |
| `pnpm e2e` | End-to-end tests (Playwright; builds and starts the app) |

## License

MIT. See `LICENSE`.
