import { getTrialConfig, emitResult, sleep } from "../harness.ts";
import { rcon } from "../rcon.ts";

const { config, library } = getTrialConfig();

const give = async (username: string) => {
	console.error("rcon op:", rcon(`op ${username}`));
	console.error("rcon gamemode:", rcon(`gamemode survival ${username}`));
	await sleep(500);
	console.error("rcon clear:", rcon(`clear ${username}`));
	await sleep(1000);
	console.error("rcon give:", rcon(`give ${username} oak_log 16`));
	await sleep(2000);
};

const runTypecraft = async () => {
	const { createBot } = await import("typecraft");
	const bot = createBot({ host: config.host, port: config.port, username: "tc_crafting", version: config.version, auth: "offline" });
	await new Promise<void>((r, j) => { bot.once("spawn", r); bot.once("error", j); });
	await sleep(2000);
	await give("tc_crafting");

	const inv = bot.inventory.slots.filter((s: any) => s);
	console.error("tc inv after give:", inv.length, inv.map((s: any) => s.name + ' x' + s.count + ' @' + bot.inventory.slots.indexOf(s)));
	console.error("tc inventoryStart:", bot.inventory.inventoryStart, "end:", bot.inventory.inventoryEnd);

	const start = performance.now();
	const reg = bot.registry!;
	const planks = bot.recipesFor(reg.itemsByName.get("oak_planks")!.id, null, null, false);
	if (!planks.length) throw new Error("No plank recipe");
	await bot.craft(planks[0], 1);
	const timeMs = performance.now() - start;

	console.error("tc inv after craft:", bot.inventory.slots.filter((s: any) => s).map((s: any) => s.name + ' x' + s.count));
	console.error("tc selectedItem:", bot.inventory.selectedItem ? (bot.inventory.selectedItem as any).name : null);
	const hasPlanks = bot.inventory.slots.some(s => s?.name === "oak_planks") || bot.inventory.slots.some(s => s?.name === "oak_log");
	bot.end();
	emitResult({ timeMs, success: hasPlanks, metadata: { hasPlanks } });
};

const runMineflayer = async () => {
	const mf = await import("mineflayer");
	const mcData = (await import("minecraft-data")).default(config.version);
	const bot = mf.default.createBot({ host: config.host, port: config.port, username: "mf_crafting", version: config.version, auth: "offline" });
	await new Promise<void>((r, j) => { bot.once("spawn", r); bot.once("error", j); });
	await sleep(2000);
	await give("mf_crafting");

	const start = performance.now();
	const planks = bot.recipesFor(mcData.itemsByName.oak_planks.id, null, 1, null);
	if (!planks.length) throw new Error("No plank recipe");
	await bot.craft(planks[0], 1);
	const sticks = bot.recipesFor(mcData.itemsByName.stick.id, null, 1, null);
	if (!sticks.length) throw new Error("No stick recipe");
	await bot.craft(sticks[0], 1);
	const tables = bot.recipesFor(mcData.itemsByName.crafting_table.id, null, 1, null);
	if (!tables.length) throw new Error("No table recipe");
	await bot.craft(tables[0], 1);
	const timeMs = performance.now() - start;

	const hasPlanks = bot.inventory.items().some(i => i.name === "oak_planks");
	bot.end();
	emitResult({ timeMs, success: hasPlanks, metadata: { hasPlanks } });
};

(library === "typecraft" ? runTypecraft() : runMineflayer()).catch(e => { emitResult({ timeMs: 0, success: false, error: String(e) }); process.exit(1); });
