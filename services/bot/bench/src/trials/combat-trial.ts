import { getTrialConfig, emitResult, sleep } from "../harness.js";

const { config, library } = getTrialConfig();
const DURATION = 30_000;

const setup = async (bot: { chat: (m: string) => void }, x: number) => {
	bot.chat(`/tp ${x} 100 0`); await sleep(500);
	bot.chat("/gamemode survival"); await sleep(500);
	bot.chat("/give @s iron_sword"); bot.chat("/give @s cooked_beef 16"); await sleep(500);
	bot.chat(`/fill ${x - 5} 99 -5 ${x + 5} 105 5 air`);
	bot.chat(`/fill ${x - 5} 98 -5 ${x + 5} 98 5 stone`); await sleep(500);
};

const spawn = (bot: { chat: (m: string) => void }, x: number, n: number) => {
	for (let i = 0; i < n; i++) bot.chat(`/summon zombie ${x + (Math.random() - 0.5) * 6} 100 ${(Math.random() - 0.5) * 6}`);
};

const runTypecraft = async () => {
	const { createBot } = await import("typecraft");
	const bot = createBot({ host: config.host, port: config.port, username: "tc_combat", version: config.version, auth: "offline" });
	await new Promise<void>((r, j) => { bot.once("spawn", r); bot.once("error", j); });
	await sleep(2000);
	await setup(bot, 100); await sleep(1000);

	let kills = 0;
	bot.on("entityGone", () => kills++);
	spawn(bot, 100, 5);

	const start = performance.now();
	const end = Date.now() + DURATION;
	while (Date.now() < end) {
		if (bot.health < 10) try { await bot.consume(); } catch {}
		const t = bot.nearestEntity(e => e.name === "zombie" && e.isValid);
		if (t) { await bot.lookAt(t.position, true); bot.attack(t); }
		if (kills > 0 && kills % 3 === 0) spawn(bot, 100, 2);
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
	await setup(bot, -100); await sleep(1000);

	let kills = 0;
	bot.on("entityGone", () => kills++);
	spawn(bot, -100, 5);

	const start = performance.now();
	const end = Date.now() + DURATION;
	while (Date.now() < end) {
		if (bot.health < 10) try { await bot.consume(); } catch {}
		const t = bot.nearestEntity(e => e.name === "zombie" && e.isValid);
		if (t) { await bot.lookAt(t.position, true); bot.attack(t); }
		if (kills > 0 && kills % 3 === 0) spawn(bot, -100, 2);
		await sleep(250);
	}
	const timeMs = performance.now() - start;
	bot.end();
	emitResult({ timeMs, success: true, metadata: { kills, health: bot.health } });
};

(library === "typecraft" ? runTypecraft() : runMineflayer()).catch(e => { emitResult({ timeMs: 0, success: false, error: String(e) }); process.exit(1); });
