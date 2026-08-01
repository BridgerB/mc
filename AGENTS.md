# AGENTS.md

`mc` is a monorepo for a personal Minecraft operation: a SvelteKit website, NixOS server infrastructure on Oracle Cloud, supporting tools, and bot projects vendored as git submodules under `upstream/`. The real engineering lives in **steve** (`upstream/steve`) — a SvelteKit dashboard that runs an autonomous Ender-Dragon speedrun bot *in-process* and streams a live 3D view of it, with the bot and the from-scratch **typecraft** TypeScript MC SDK vendored under its `src/lib/`. Each submodule has its own `CLAUDE.md` that is authoritative for that project; read it first when working inside the submodule.

> Note: `typecraft` and `eye-of-steve` used to be separate submodules. As of the restructure they're gone — the eye-of-steve dashboard *became* `steve`, and typecraft lives on only as steve's vendored `src/lib/typecraft/`. (Both are archived on GitHub.)

## Layout

- **Root** — SvelteKit 5 site (Svelte 5 runes, `@sveltejs/adapter-node`) backed by Postgres via Drizzle ORM. Source in `src/`, schema in `src/lib/server/db/schema.ts`. This is the public website, separate from steve's dashboard.
- **`server/oci/`** — NixOS configs that *are* the production server. `common.nix` base + `velocity/` proxy host + `steve/` game host. `deploy.ts` / `launch.ts` drive it.
- **`services/`** — standalone tools: `block-colors/` (Deno, avg block texture colors), `mapper/`, `bot/bench/` (Node, bot benchmarks).
- **`upstream/`** — git submodules, each its own repo with its own `CLAUDE.md`:
  - **`steve`** — the project. A SvelteKit 5 dashboard (Svelte 5 runes, `adapter-node`, raw Postgres) that runs the bot in-process and renders a Babylon.js first-person view. The bot lives in `src/lib/steve/`, the typecraft SDK in `src/lib/typecraft/`, the dashboard data layer in `src/lib/server/race.ts`, the UI in `src/routes/+page.svelte`.
  - **`ruststeve`** — Rust port of the bot (single-bot core only).

## Dev environment

`flake.nix` provides a root dev shell with Deno, Node 20, unzip, git. Enter with `nix develop` (or `nix-shell`). Submodules have their own toolchains — `cd` into the submodule and use *its* commands, not the root's.

## Build & test (root website)

```bash
npm run dev            # SvelteKit dev server (vite)
npm run build          # production build
npm run check          # svelte-kit sync && svelte-check (type-check — there is no lint)
npm run db:start       # docker compose up (local Postgres, see compose.yaml)
npm run db:push        # drizzle-kit push — apply schema to DB
npm run db:studio      # Drizzle Studio
```

`drizzle.config.ts` + `DATABASE_URL` (see `.env.example`) configure the DB. There is no `npm test` at the root.

## Server infra (server/oci)

```bash
cd server/oci
./deploy.ts <public-ip> <velocity|steve>   # Deno script — mirrors config + nixos-rebuild switch
./launch.ts                                # launch helper (see script header)
```

Deploy is a Deno script: `deno run --allow-run --allow-env --allow-read deploy.ts …`. Don't hand-edit generated Nix; edit `common.nix` / per-target `configuration.nix`. The MC game host is reached at `bridger@144.24.32.76` (SSH as **`bridger`**, not root; passwordless sudo). RCON is localhost-only on the box (port 25575).

## Submodule commands

**upstream/steve** — the dashboard + bot. Runs as TypeScript (no build/`dist/`; Node executes `.ts` via `--import ./typecraft-resolve.mjs`). Needs Postgres up and (for a live bot) a reachable MC server (`MC_HOST`, default the OCI box).

```bash
npm install            # first — restores node_modules (not committed)
docker compose up -d   # local Postgres (compose.yaml → host port 4623)
npm run dev            # vite dev — dashboard + the in-process bot. → http://localhost:4558
npm run build          # adapter-node production build
npm run check          # svelte-check (type-check — no lint)
npm run test           # vitest --run + playwright e2e
npm run sync-viewer    # rebuild the vendored typecraft Babylon viewer bundle → static/web/
node water-harness.ts  # (via --env-file/--import) interactive water-escape debug harness
```

Ports are **name-derived via `@bridgerb/port-from-name`** (from `package.json` name): vite dashboard **4558**, Postgres **4623**. Rename the package to change them.

**upstream/ruststeve** — Rust port of steve (single-bot core only).

```bash
cargo run                # connect and run the speedrun loop
cargo build
cargo test               # 172 SDK tests + bot, one crate
cargo run --bin datagen   # generate the registry data/ the bot needs at runtime
```

## Conventions

- Root site & steve dashboard: Svelte 5 runes (`$state`/`$derived`/`$effect`), `@sveltejs/adapter-node`, raw SQL via the `postgres` driver (Drizzle is vestigial in steve — see Pitfalls). Match existing style.
- steve & the vendored typecraft: Biome, functional TS — `const` arrow functions over `function`, early-return guards, nullish-coalescing/optional-chaining, array methods over `for` loops, comment the *why* not the *what*.
- Commits: Conventional-commit prefixes (`feat`/`fix`/`refactor`/`chore`/`docs`). **Never** add AI attribution (`Co-Authored-By`, "Generated with Claude", etc.). Never push without explicit approval.

## Pitfalls

- **Submodules are separate repos.** `steve` and `ruststeve` each have their own `CLAUDE.md`, toolchain, and remote. Don't run root commands inside a submodule or vice versa.
- **steve runs the bot IN-PROCESS.** `npm run dev` starts the vite server *and* connects the bot (`src/lib/server/bot.ts` → `startBot`). Server-side changes (`src/lib/steve/**`, `serve.ts`, `race.ts`) need a vite restart; `+page.svelte` hot-reloads; the viewer bundle needs `npm run sync-viewer`.
- **steve logs to Postgres**, not SQLite — tables `events` / `ticks` / `inventory_snapshots`, written via `logEvent()`, read by the dashboard's raw SQL. Query with `docker exec <compose>-db-1 psql -U root -d local -c "…"`.
- **The dashboard reads tables it doesn't own.** The Drizzle schema in steve is vestigial; real queries are raw tagged-template SQL in `src/lib/server/race.ts`. Don't reach for Drizzle to add a dashboard query.
- **typecraft water physics** (`src/lib/typecraft/physics/physics.ts`): no buoyancy and `jump` is ignored in water — the only lift is the wall-collision `outOfLiquidImpulse`. The bot escapes by pressing into a bank / digging a notch, not by jumping.
- **typecraft entity-metadata ordering is load-bearing:** the `entityMetadataType` index table must match the server registry order exactly. One missing/extra entry shifts every later type → stream desync → dropped connection. Insert at the correct index in *both* the mapping table and the `entityMetadataEntry` switch.
- **typecraft game data is generated, not vendored.** `src/lib/typecraft/data/` comes from datagen; don't hand-edit.
- **steve world resets are manual.** The MC game box is shared with `ruststeve` and both reset the same world. Do **not** auto-wipe or auto-reset the world/server. MC 26.x uses **snake_case** gamerules (`keep_inventory`, not `keepInventory`); keep it **true** for long runs.
- **ruststeve needs the registry.** Run `cargo run --bin datagen` first or the bot spawns with an empty registry. Offline-mode only (no auth).
- **`DATABASE_URL` is required** for root, steve, and any DB-touching service. `.env` is gitignored; see `.env.example`. steve's DB is on port **4623**.
