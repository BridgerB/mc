# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`mc` is a monorepo for a personal Minecraft operation: a website, the live server infrastructure, supporting tools, and a set of bot/SDK projects vendored as git submodules under `upstream/`. The interesting engineering lives in the submodules — especially **typecraft** (a from-scratch TypeScript Minecraft SDK) and **steve** (an autonomous speedrun bot built on it).

Layout:

- **Root** — a SvelteKit 5 website (Svelte 5 runes, `@sveltejs/adapter-node`) backed by Postgres via Drizzle ORM. Source in `src/`, DB schema in `src/lib/server/db/schema.ts`.
- **`server/oci/`** — NixOS configuration that *is* the production server, deployed to an Oracle Cloud box. Split into a shared `common.nix` base plus a Velocity proxy host (`velocity/`) and the steve game host (`steve/`). `deploy.ts` / `launch.ts` drive it.
- **`services/`** — standalone tools: `block-colors/` (computes average colors of MC block textures for the map), `mapper/`, and `bot/bench/`.
- **`upstream/`** — git submodules, each its own repo with its own `CLAUDE.md`: `typecraft`, `steve`, `ruststeve` (Rust port of steve), `rustcraft`, `eye-of-steve`.

When working inside a submodule, **read that submodule's own `CLAUDE.md` first** — it is authoritative for that project. This file is the map; the submodule files are the territory.

## Root website / server-infra commands

```bash
npm run dev            # SvelteKit dev server (vite)
npm run build          # production build
npm run check          # svelte-check type-check
npm run db:start       # docker compose up (local Postgres, see compose.yaml)
npm run db:push        # push Drizzle schema to DB
npm run db:studio      # Drizzle Studio
```

`drizzle.config.ts` + `DATABASE_URL` (see `.env.example`) configure the DB. `flake.nix` provides the dev shell.

---

## upstream/typecraft — the SDK

**What it is:** a modern TypeScript SDK for Minecraft (bots, worlds, protocol codec, world rendering). It is a ground-up rewrite of [mineflayer](https://github.com/PrismarineJS/mineflayer) and friends as typed, functional TypeScript — e.g. the bot is ~3,800 lines replacing mineflayer's ~7,500 across 41 plugins. It is consumed by `steve` via `"typecraft": "file:../typecraft"`.

**Runs as TypeScript — there is no build and no `dist/`.** Node executes the `.ts` source directly. The package `main`/`types`/`exports` all resolve to `./src/index.ts` and consumers import that source as-is. Never "compile", create a `dist/`, or reason about a src-vs-dist split. Type-check only:

```bash
npm run typecheck      # tsc --noEmit (reports errors, emits nothing)
npm test               # vitest
npm run check          # biome check
npm run build:web      # UNRELATED to the lib — bundles the browser world-viewer with esbuild
```

**Game data is generated, not vendored.** `nix run .#datagen` spins up a Fabric server with a custom datagen mod plus vanilla `--reports`, extracting blocks/items/recipes/protocol/textures straight from the Mojang JARs into `src/data/` (~27s). No third-party data dependencies (no minecraft-data).

**Architecture highlights:**

- `src/index.ts` is the single public surface and re-exports everything: `createBot`, `Vec3` helpers, chunk/world/anvil read-write, NBT, the pathfinder (`createPathfinder`, `createGoal*`, `createMovements`), the protocol codec, RCON (`createRcon`), recipes, and the Babylon.js-based viewer (`createWebViewer`).
- **Bot** (`src/bot/`): `createBot(options)` returns a typed `EventEmitter`. Instead of dynamic plugins, ~14 static `init*(bot, options)` functions register packet handlers + methods (`initGame`, `initEntities`, `initBlocks`, `initPhysics`, `initInventory`, `initCrafting`, `initDigging`, `initPlacing`, …). See `src/bot/README.md` for the full table mapping each to its mineflayer origin.
- **Protocol** (`src/protocol/`): `packet-defs.ts` maps packets to field lists, `shared-types.ts` holds reusable schemas, `generated-mappings.json` holds enum index→name tables, `codec.ts` reads/writes. **Entity-metadata ordering is load-bearing:** the `entityMetadataType` index table must match the server registry order exactly — one missing/extra entry shifts every later type, mis-sizes reads, and desyncs the stream (`offset is out of range` → dropped connection). When a game version adds a serializer, insert it at the correct index in *both* the mapping table and the `entityMetadataEntry` switch.

---

## upstream/steve — the autonomous bot

**What it is:** an autonomous Minecraft bot that attempts an Ender Dragon speedrun (random seed, any%, glitchless) with **zero human input** — the bot could start in any world and reliably do what a human does to beat the game. Reliability and generality matter more than raw speed (no X-ray, no teleporting, no gimmicks). Built entirely on `typecraft`.

**Commands** (most require a running MC server):

```bash
nix run                                  # start MC server on localhost:25565 (fresh world)
nix run .#reset                          # reset world + restart server
node src/main.ts --bots 10 --timeout 600 # run a 10-bot race, 10 min
node src/main.ts -b 1 -t 120             # single bot, quick test
node --test src/test.ts                  # tests (server must be running)
npm run check                            # tsc type-check
node src/lib/repl.ts                     # interactive REPL against a live bot
node src/rcon-cli.ts                     # RCON console
```

**How it works:**

- **Core loop** (`src/main.ts`): every 5s, `sync state → getNextStep → execute`. 8 consecutive failures aborts; a generation counter invalidates stale results after death. Multi-bot mode forks N child processes (`STEVE_BOT_MODE=1`) and tracks race results in SQLite.
- **State model** (`src/types.ts`, `src/state.ts`): pure immutable `GameState` (inventory + equipment + world + vitals). `syncFromBot(bot)` snapshots; `getPhase(state)` derives the phase (STARTING → WOOD → STONE → IRON → NETHER_PREP → NETHER → STRONGHOLD → END_PREP → END → VICTORY).
- **Steps** (`src/steps.ts`): ~30 priority-ordered `Step`s, each with `canExecute` / `isComplete` / `execute`. `getNextStep` returns the first executable, incomplete step. `completedSteps` is re-synced from `isComplete()` each tick, so regressions (items lost on death) auto-retry. A step isn't done until inventory confirms it — blocks dug ≠ items collected.
- **Tasks** (`src/tasks/<name>/`): the actual capabilities (`gather-wood`, `mining`, `craft`, `smelt`, `combat`, `food`, `bucket`, `nether`, `portal`, `stronghold`, `end`), each `main.ts` + `test.ts`, sharing `src/lib/bot-utils.ts`.
- **Bot memory:** typecraft passively emits `blockSeen` for exposed blocks during chunk load; steve stores ore/log sightings and the crafting-table position in a `WeakMap<Bot, BotMemory>`. No scanning, no X-ray (`exposed: false` is banned).
- **Logging:** all debug goes to SQLite WAL (`data/steve.db`, tables `ticks`/`events`/`inventory_snapshots`) via `logEvent()`, **not** `console.log`. Query with `sqlite3`.

**MCP-driven dev loop:** `src/mcp.ts` exposes a live bot to Claude Code as MCP tools (`state`, `inventory`, `look`, `eval`, `craft`, `navigate`, `mine`, `chat`, `sniff`, …) for second-scale iteration instead of minute-scale race runs. `eval` imports are relative to `src/` (the eval file is `src/.mcp-eval.ts`), so `await import("./tasks/...")` — never `"./src/tasks/..."`. See steve's `AGENT.md` for the agent workflow.

**Operational caveat (shared box):** the steve box is shared with `ruststeve`, and both reset the same world. Do **not** auto-wipe or auto-reset the world/server — that is done manually. Use `launch-race.sh`, which kills only its own `src/main.ts` procs and never touches the world. Note 26.x builds use **snake_case** gamerules (`keep_inventory`, not `keepInventory`).

## Code style (steve & typecraft)

Both submodules use Biome and a functional TS style: `const` arrow functions over `function` declarations, early-return guard clauses, destructuring, nullish-coalescing + optional chaining, array methods over `for` loops, comment the *why* not the *what*. See steve's `CLAUDE.md` for the full list.

**Commits:** Conventional-commit prefixes (`feat`/`fix`/`refactor`/`chore`/`docs`). Never add AI attribution (`Co-Authored-By`, "Generated with Claude", etc.) anywhere.
