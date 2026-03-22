import { getTrialConfig, emitResult, sleep } from "../harness.js";

const { config, library } = getTrialConfig();

const setup = async (bot: { chat: (m: string) => void }, x: number) => {
	bot.chat(`/tp ${x} 100 0`); await sleep(500);
	bot.chat("/gamemode survival"); await sleep(500);
	bot.chat("/give @s emerald 64"); await sleep(500);
	bot.chat(`/setblock ${x + 2} 100 0 chest`); await sleep(500);
	bot.chat(`/summon villager ${x + 1} 100 0 {VillagerData:{profession:farmer,level:2,type:plains},Offers:{Recipes:[{buy:{id:"minecraft:emerald",count:1},sell:{id:"minecraft:bread",count:6},maxUses:999}]}}`);
	await sleep(1000);
};

const runTypecraft = async () => {
	const { createBot } = await import("typecraft");
	const bot = createBot({ host: config.host, port: config.port, username: "tc_trading", version: config.version, auth: "offline" });
	await new Promise<void>((r, j) => { bot.once("spawn", r); bot.once("error", j); });
	await sleep(2000);
	await setup(bot, 50); await sleep(1000);

	const start = performance.now();
	const villager = bot.nearestEntity(e => e.name === "villager");
	if (!villager) throw new Error("No villager");
	const win = await bot.openVillager(villager);
	const trades = (win as any).trades;
	if (!trades?.length) throw new Error("No trades");
	await (win as any).trade(0, Math.min(5, trades[0].maximumNbTradeUses));
	bot.closeWindow(win);
	const timeMs = performance.now() - start;
	bot.end();
	emitResult({ timeMs, success: true });
};

const runMineflayer = async () => {
	const mf = await import("mineflayer");
	const bot = mf.default.createBot({ host: config.host, port: config.port, username: "mf_trading", version: config.version, auth: "offline" });
	await new Promise<void>((r, j) => { bot.once("spawn", r); bot.once("error", j); });
	await sleep(2000);
	await setup(bot, -50); await sleep(1000);

	const start = performance.now();
	const villager = bot.nearestEntity(e => e.name === "villager");
	if (!villager) throw new Error("No villager");
	const win = await bot.openEntity(villager) as any;
	if (!win.trades?.length) throw new Error("No trades");
	await (bot as any).trade(win, 0, Math.min(5, win.trades[0].maximumNbTradeUses));
	bot.closeWindow(win);
	const timeMs = performance.now() - start;
	bot.end();
	emitResult({ timeMs, success: true });
};

(library === "typecraft" ? runTypecraft() : runMineflayer()).catch(e => { emitResult({ timeMs: 0, success: false, error: String(e) }); process.exit(1); });
