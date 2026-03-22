import { getTrialConfig, emitResult, sleep } from "../harness.js";

const { config, library } = getTrialConfig();

const give = async (bot: { chat: (m: string) => void }) => {
	bot.chat("/gamemode survival"); await sleep(500);
	bot.chat("/clear"); await sleep(500);
	bot.chat("/give @s oak_log 16"); await sleep(500);
};

const runTypecraft = async () => {
	const { createBot } = await import("typecraft");
	const bot = createBot({ host: config.host, port: config.port, username: "tc_crafting", version: config.version, auth: "offline" });
	await new Promise<void>((r, j) => { bot.once("spawn", r); bot.once("error", j); });
	await sleep(2000);
	await give(bot);
	await sleep(1000);

	const start = performance.now();
	const reg = bot.registry!;
	const planks = bot.recipesFor(reg.itemsByName.get("oak_planks")!.id, null, null, false);
	await bot.craft(planks[0], 4);
	const sticks = bot.recipesFor(reg.itemsByName.get("stick")!.id, null, null, false);
	await bot.craft(sticks[0], 1);
	const tables = bot.recipesFor(reg.itemsByName.get("crafting_table")!.id, null, null, false);
	await bot.craft(tables[0], 1);
	const timeMs = performance.now() - start;

	const hasPlanks = bot.inventory.slots.some(s => s?.name === "oak_planks");
	bot.end();
	emitResult({ timeMs, success: hasPlanks, metadata: { hasPlanks } });
};

const runMineflayer = async () => {
	const mf = await import("mineflayer");
	const mcData = (await import("minecraft-data")).default(config.version);
	const bot = mf.default.createBot({ host: config.host, port: config.port, username: "mf_crafting", version: config.version, auth: "offline" });
	await new Promise<void>((r, j) => { bot.once("spawn", r); bot.once("error", j); });
	await sleep(2000);
	await give(bot);
	await sleep(1000);

	const start = performance.now();
	const planks = bot.recipesFor(mcData.itemsByName.oak_planks.id, null, 1, null);
	await bot.craft(planks[0], 4);
	const sticks = bot.recipesFor(mcData.itemsByName.stick.id, null, 1, null);
	await bot.craft(sticks[0], 1);
	const tables = bot.recipesFor(mcData.itemsByName.crafting_table.id, null, 1, null);
	await bot.craft(tables[0], 1);
	const timeMs = performance.now() - start;

	const hasPlanks = bot.inventory.items().some(i => i.name === "oak_planks");
	bot.end();
	emitResult({ timeMs, success: hasPlanks, metadata: { hasPlanks } });
};

(library === "typecraft" ? runTypecraft() : runMineflayer()).catch(e => { emitResult({ timeMs: 0, success: false, error: String(e) }); process.exit(1); });
