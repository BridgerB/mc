# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**`AGENTS.md` (next to this file) is the canonical, current monorepo map** — read it for the full layout, dev-env, and per-submodule commands. This file is the short orientation + the guardrails and current-state you need before touching anything. When working inside a submodule, that submodule's own `CLAUDE.md` is authoritative.

## What this repo is

`mc` is a personal Minecraft monorepo: a SvelteKit website, NixOS server infra on Oracle Cloud, small tools, and bot projects as git submodules under `upstream/`. The real engineering is **steve** (`upstream/steve`) — an autonomous Ender-Dragon speedrun bot (zero human input; no X-ray/teleport/gimmicks) built on the from-scratch **typecraft** TS Minecraft SDK.

### The restructure (why older docs mislead you)

`typecraft` and `eye-of-steve` **used to be separate submodules; they were merged into `steve`.** Today:

- **Three** submodules exist: `upstream/steve`, `upstream/ruststeve` and `upstream/clojurecraft` (a from-scratch Clojure bot; see `.gitmodules`). There is no `upstream/typecraft`, `upstream/eye-of-steve`, or `upstream/rustcraft`.
- **steve is now one SvelteKit 5 app** that (1) runs the bot **in-process** (`src/lib/server/bot.ts` `startBot`), (2) holds the bot engine at `src/lib/steve/` and the vendored typecraft SDK at `src/lib/typecraft/`, and (3) serves a live "Mission Control" dashboard + Babylon.js 3D view.
- If any doc says steve is `node src/main.ts`, that typecraft is a submodule with `nix run .#datagen`, that telemetry is SQLite `data/steve.db`, or references `launch-race.sh` — **it is stale.** Reality: `npm run dev`, vendored typecraft, telemetry in **Postgres**, and the multi-bot race launched via `node --import ./typecraft-resolve.mjs src/lib/steve/main.ts --bots N`.

## Working in this worktree vs the main checkout

You may be in a **git worktree** (e.g. `orca/workspaces/mc/steve`) where the submodules are **not checked out** (`upstream/steve` and `upstream/ruststeve` are empty dirs; `upstream/clojurecraft` may be populated). The fully populated checkout — with steve's source, `.env`, `data/gym.db`, `LOOP.md`, and `.race-serial` — is the main clone at **`/Users/bridger/Developer/mc`**. To read or run steve, use the populated checkout (`/Users/bridger/Developer/mc/upstream/steve`), or `git submodule update --init` here first.

## Commands

Root website (this repo root):
```bash
npm run dev            # SvelteKit dev server (vite)
npm run build          # production build
npm run check          # svelte-kit sync && svelte-check (type-check; no lint)
npm run db:start       # docker compose up (local Postgres)
npm run db:push        # drizzle-kit push
```

steve (`upstream/steve`) — runs as TypeScript, no build/`dist/`:
```bash
npm install                    # node_modules not committed
docker compose up -d           # local Postgres → host port 4623 (container steve-db-1)
npm run dev                    # vite dashboard + in-process bot → http://localhost:4558
npm run check                  # svelte-check (type-check; NO lint)
npm run test:unit -- --run     # vitest once (append a path to scope)
npm run sync-viewer            # rebuild the ~12MB Babylon viewer bundle → static/web/

# multi-bot race (CLI orchestrator; forks one child per bot):
STEVE_CLI=1 node --import ./typecraft-resolve.mjs src/lib/steve/main.ts --bots N --timeout 7200

# one gym trial in isolation (needs the RCON tunnel up):
STEP=<slug> node --env-file=.env --import ./typecraft-resolve.mjs gym-cli.ts
```
Ports are **name-derived** from `package.json` name (`eye-of-steve`): dashboard **4558**, Postgres **4623**.

ruststeve (`upstream/ruststeve`): `cargo run` (bot loop), `cargo run --bin datagen` first (registry), `cargo test`.

clojurecraft (`upstream/clojurecraft`): `nix shell nixpkgs#jdk25 nixpkgs#clojure`, `clojure -M:test`, `./local-server.sh start` (local vanilla on 25571/25581), `clojure -M:run ...` — its `CLAUDE.md` has the full set.

## Architecture you can't see from one file

- **Control loop** (`src/lib/steve/lib/run-loop.ts`, bootstrapped by `main.ts`): a CSP go-loop parked on the physics tick. Each tick `syncFromBot → getNextStep → execute`; steps run fire-and-forget under `Promise.race(timeout)`, results posted back epoch-stamped. **≥20 consecutive failures → abort + random relocate.** An `epoch`/generation counter invalidates stale step results after death/preempt.
- **Steps** (`steps.ts`, 31 priority-ordered): each has `canExecute`/`isComplete`/`execute`; `completedSteps` is re-derived from `isComplete()` every tick, so a step is "done" only when inventory/world confirms it — regressions (death, broken tool) auto-retry. `escape_water` is priority 0 and **preempts everything**. Critical path to the goal (`enter_nether`): wood → planks → table → sticks → wooden-pick → stone → stone-pick → furnace → coal → iron → smelt → bucket×2 → fill-water → flint&steel → **build-nether-portal** → **enter-nether**. (iron-pickaxe, food, stone-sword are off-path/skippable on a peaceful server.)
- **Obsidian is cast, never mined** (`tasks/portal/cast.ts`): build an enclosed dirt cup, pour lava, pour water on top → obsidian; frame is cast bottom-up in a deliberate order (do NOT y-sort it). `26.1.2` gotcha: `bot.activateItem()` leaves `usingHeldItem` stuck true and blocks the next bucket use — everything right-click/bucket must go through `reliableUse()`.
- **Bot memory** (`bot-utils.ts` `getMemory`, per-bot `WeakMap`): remembers crafting-table pos, ore/log sightings (from typecraft's passive `blockSeen` on chunk load — **no scanning, `exposed:false` is banned**), and water-trap XZs.
- **Two databases:** telemetry is **Postgres** (container `steve-db-1`, host 4623, db `local`, user `root`) — tables `ticks`/`events`/`inventory_snapshots`/`races`, written via `logEvent()`, read by the dashboard as **raw tagged-template SQL in `src/lib/server/race.ts`** (Drizzle in `db/schema.ts` is a vestigial DDL stub — don't add dashboard queries through it). `ts` is stored as an ISO **TEXT** string → always cast `ts::timestamptz`. The **gym** scores steps into a separate **SQLite** file `data/gym.db` (table `gym_runs`).
- **typecraft consumption:** vendored source at `src/lib/typecraft/`, resolved from the bare `typecraft` specifier by the vite alias (dashboard) and by `typecraft-resolve.mjs` (Node CLI, via `--import`). No npm dep, no `file:` link. `typecraft/data/` is generated by datagen — don't hand-edit.

## Guardrails (operational)

- **Never auto-wipe/reset the world or restart the MC server.** The game box `bridger@144.24.32.76` (SSH as **bridger**, not root; passwordless sudo; RCON localhost-only on 25575, reached via an SSH tunnel) is **shared with ruststeve** — a wipe nukes the other project. Bridger resets manually. MC 26.x uses **snake_case** gamerules (`keep_inventory`, not `keepInventory`); keep it **true** for long runs.
- **steve runs the bot IN-PROCESS.** Server-side edits (`src/lib/steve/**`, `serve.ts`, `race.ts`, `bot.ts`) need a **vite restart**; `+page.svelte` hot-reloads; the viewer bundle needs `npm run sync-viewer`.
- **typecraft water physics** (`typecraft/physics/physics.ts`): no buoyancy, `jump` is ignored in water — the only lift is the wall-collision impulse. The bot escapes by pressing into a bank / digging a notch, never by jumping. `water-harness.ts` reproduces it.
- **typecraft entity-metadata ordering is load-bearing:** the `entityMetadataType` index table must match server registry order exactly — one off entry desyncs the whole stream. Insert at the right index in *both* the mapping table and the `entityMetadataEntry` switch.
- **Commits:** conventional-commit prefixes. **Never** add AI attribution (`Co-Authored-By`, "Generated with Claude", session links) anywhere. Never push or open a PR without explicit approval.

## Current state (as of the last active work, ~Aug 2026 — project was then paused)

- **No bot has ever reached the Nether.** Furthest reach ever: a bot standing at water with a full iron kit (10 ingots + empty bucket) at the **fill-water** step.
- **Two live walls:** (1) **dry-biome water-find** — `tasks/bucket/main.ts` `fillWaterBucket` hangs on water-sparse spawns / refuses deep cave water to avoid the aquifer drown-trap; documented as the #1 endgame bottleneck. (2) **craft/smelt undercount + wood-lock** — `craftItem` (`bot-utils.ts`) results can strand in the 2×2 grid invisible to `windowItems`, flickering completion checks; smelt fuel-at-smelt deadlock historically caps runs at ~3 ingots. Some fixes for both landed but were never confirmed by a clean race.
- **Portal cast + entry are implemented and claimed gym-proven** given a filled water bucket + reachable lava. The **post-Nether endgame** (fortress→blazes→stronghold→End→dragon) is skeletal/unexercised — not the current blocker.
- **`upstream/steve/LOOP.md`** holds the operational loop (RACE → DIAGNOSE → DEBUG+FIX → GYM), a live Blocker board, and a fixes log. Read it before resuming race/gym work. `.race-serial` cursor was at `{"next":540}`.
