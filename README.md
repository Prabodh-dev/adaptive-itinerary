## Install

pnpm i

## Run (two terminals)

pnpm --filter @adaptive/api dev
pnpm --filter @adaptive/web dev

Web: http://localhost:3000
API: http://localhost:8080/health

## Phase 7 DB Setup (Prisma + SQLite)

1. Ensure `DATABASE_URL` is set in `.env` (example: `DATABASE_URL="file:./dev.db"`).
2. Generate Prisma client:
`pnpm --filter @adaptive/store prisma:generate`
3. Run local migration:
`pnpm --filter @adaptive/store prisma:migrate --name init_phase7`
