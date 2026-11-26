# Fairspace

An open-source site builder for nonprofits. One site per install.

## Requirements

- Node 24 (see `.nvmrc`)
- pnpm 10

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm exec playwright install chromium` | Install the e2e browser |
| `pnpm dev` | Start the dev server at http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate route types, then `tsc --noEmit` |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm e2e` | End-to-end tests (Playwright; builds and starts the app) |

## License

MIT. See `LICENSE`.
