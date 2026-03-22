/**
 * Pathfind trial — runs in isolated child process.
 * Bot spawns, then pathfinds 100 blocks east from current position.
 */

import { getTrialConfig, emitResult, sleep } from "../harness.js";

const { config, library } = getTrialConfig();
const DISTANCE = 100;

const runTypecraft = async () => {
	const { createBot, createPathfinder, createGoalNear } = await import("typecraft");

	const bot = createBot({
		host: config.host, port: config.port,
		username: "tc_pathfind", version: config.version, auth: "offline",
	});

	await new Promise<void>((res, rej) => {
		bot.once("spawn", res);
		bot.once("error", rej);
	});
	await sleep(3000);

	const startPos = bot.entity.position;
	const goalX = Math.floor(startPos.x) + DISTANCE;
	const goalZ = Math.floor(startPos.z);
	const goalY = Math.floor(startPos.y);

	const pf = createPathfinder(bot);
	const start = performance.now();
	await pf.goto(createGoalNear(goalX, goalY, goalZ, 3));
	const timeMs = performance.now() - start;

	const pos = bot.entity.position;
	const dist = Math.sqrt((pos.x - goalX) ** 2 + (pos.z - goalZ) ** 2);
	bot.end();

	emitResult({ timeMs, success: dist < 5, metadata: { dist: dist.toFixed(1) } });
};

const runMineflayer = async () => {
	const mineflayer = await import("mineflayer");
	const { pathfinder, Movements, goals } = await import("mineflayer-pathfinder");

	const bot = mineflayer.default.createBot({
		host: config.host, port: config.port,
		username: "mf_pathfind", version: config.version, auth: "offline",
	});

	await new Promise<void>((res, rej) => {
		bot.once("spawn", res);
		bot.once("error", rej);
	});
	bot.loadPlugin(pathfinder);
	await sleep(3000);

	const startPos = bot.entity.position;
	const goalX = Math.floor(startPos.x) + DISTANCE;
	const goalZ = Math.floor(startPos.z);
	const goalY = Math.floor(startPos.y);

	const movements = new Movements(bot);
	(bot as any).pathfinder.setMovements(movements);

	const start = performance.now();
	await (bot as any).pathfinder.goto(new goals.GoalNear(goalX, goalY, goalZ, 3));
	const timeMs = performance.now() - start;

	const pos = bot.entity.position;
	const dist = Math.sqrt((pos.x - goalX) ** 2 + (pos.z - goalZ) ** 2);
	bot.end();

	emitResult({ timeMs, success: dist < 5, metadata: { dist: dist.toFixed(1) } });
};

(library === "typecraft" ? runTypecraft() : runMineflayer()).catch((err) => {
	emitResult({ timeMs: 0, success: false, error: String(err) });
	process.exit(1);
});
