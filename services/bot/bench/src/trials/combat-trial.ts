import { getTrialConfig, emitResult, sleep } from "../harness.ts";
import { rcon } from "../rcon.ts";

const { config, library } = getTrialConfig();
const DURATION = 30_000;

const setup = async (username: string, x: number) => {
	rcon(`op ${username}`);
	rcon(`tp ${username} ${x} 100 0`);
	await sleep(500);
	rcon(`gamemode survival ${username}`);
	await sleep(500);
	rcon(`give ${username} iron_sword`);
	rcon(`give ${username} cooked_beef 16`);
	await sleep(500);
	rcon(`fill ${x - 5} 99 -5 ${x + 5} 105 5 air`);
	rcon(`fill ${x - 5} 98 -5 ${x + 5} 98 5 stone`);
	await sleep(500);
};

const spawn = (x: number, n: number) => {
	for (let i = 0; i < n; i++) rcon(`summon zombie ${x + (Math.random() - 0.5) * 6} 100 ${(Math.random() - 0.5) * 6}`);
};

const runTypecraft = async () => {
	const { createBot } = await import("typecraft");
	const bot = createBot({ host: config.host, port: config.port, username: "tc_combat", version: config.version, auth: "offline" });
	await new Promise<void>((r, j) => { bot.once("spawn", r); bot.once("error", j); });
	await sleep(2000);
	await setup("tc_combat", 100);
	await sleep(1000);

	let kills = 0;
	bot.on("entityGone", () => kills++);
	spawn(100, 5);

	const start = performance.now();
	const end = Date.now() + DURATION;
	while (Date.now() < end) {
		if (bot.health < 10) try { await bot.consume(); } catch {}
		const t = bot.nearestEntity(e => e.name === "zombie" && e.isValid);
		if (t) { await bot.lookAt(t.position, true); bot.attack(t); }
		if (kills > 0 && kills % 3 === 0) spawn(100, 2);
		await sleep(250);
	}
	const timeMs = performance.now() - start;
	bot.end();
	emitResult({ timeMs, success: true, metadata: { kills, health: bot.health } });
};

const runMineflayer = async () => {
	const mf = await import("mineflayer");
	const bot = mf.default.createBot({ host: config.host, port: config.port, username: "mf_combat", version: config.version, auth: "offline" });
	await new Promise<void>((r, j) => { bot.once("spawn", r); bot.once("error", j); });
	await sleep(2000);
	await setup("mf_combat", -100);
	await sleep(1000);

	let kills = 0;
	bot.on("entityGone", () => kills++);
	spawn(-100, 5);

	const start = performance.now();
	const end = Date.now() + DURATION;
	while (Date.now() < end) {
		if (bot.health < 10) try { await bot.consume(); } catch {}
		const t = bot.nearestEntity(e => e.name === "zombie" && e.isValid);
		if (t) { await bot.lookAt(t.position, true); bot.attack(t); }
		if (kills > 0 && kills % 3 === 0) spawn(-100, 2);
		await sleep(250);
	}
	const timeMs = performance.now() - start;
	bot.end();
	emitResult({ timeMs, success: true, metadata: { kills, health: bot.health } });
};

(library === "typecraft" ? runTypecraft() : runMineflayer()).catch(e => { emitResult({ timeMs: 0, success: false, error: String(e) }); process.exit(1); });
