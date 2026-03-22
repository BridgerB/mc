import { getTrialConfig, emitResult, sleep } from "../harness.ts";
import { rcon } from "../rcon.ts";

const { config, library } = getTrialConfig();
const ORIGIN = { x: 10, y: 60, z: 10 };
const SIZE = 5;

const setup = async (username: string) => {
	rcon(`op ${username}`);
	rcon(`gamemode survival ${username}`);
	rcon(`tp ${username} ${ORIGIN.x - 2} ${ORIGIN.y} ${ORIGIN.z}`);
	await sleep(500);
	rcon(`fill ${ORIGIN.x} ${ORIGIN.y} ${ORIGIN.z} ${ORIGIN.x + SIZE - 1} ${ORIGIN.y + SIZE - 1} ${ORIGIN.z + SIZE - 1} stone`);
	await sleep(500);
	rcon(`give ${username} diamond_pickaxe`);
	await sleep(1000);
};

const runTypecraft = async () => {
	const { createBot } = await import("typecraft");
	const bot = createBot({ host: config.host, port: config.port, username: "tc_mining", version: config.version, auth: "offline" });
	await new Promise<void>((r, j) => { bot.once("spawn", r); bot.once("error", j); });
	await sleep(2000);
	await setup("tc_mining");

	let mined = 0;
	const start = performance.now();
	for (let y = ORIGIN.y + SIZE - 1; y >= ORIGIN.y; y--)
		for (let x = ORIGIN.x; x < ORIGIN.x + SIZE; x++)
			for (let z = ORIGIN.z; z < ORIGIN.z + SIZE; z++) {
				const block = bot.blockAt({ x, y, z } as any);
				if (block && (block as any).name === "stone") { await bot.dig(block, true); mined++; }
			}
	const timeMs = performance.now() - start;
	bot.end();
	emitResult({ timeMs, success: mined > 0, metadata: { mined } });
};

const runMineflayer = async () => {
	const mf = await import("mineflayer");
	const { Vec3 } = await import("vec3");
	const bot = mf.default.createBot({ host: config.host, port: config.port, username: "mf_mining", version: config.version, auth: "offline" });
	await new Promise<void>((r, j) => { bot.once("spawn", r); bot.once("error", j); });
	await sleep(2000);
	await setup("mf_mining");

	let mined = 0;
	const start = performance.now();
	for (let y = ORIGIN.y + SIZE - 1; y >= ORIGIN.y; y--)
		for (let x = ORIGIN.x; x < ORIGIN.x + SIZE; x++)
			for (let z = ORIGIN.z; z < ORIGIN.z + SIZE; z++) {
				const block = bot.blockAt(new Vec3(x, y, z));
				if (block && block.name === "stone") { await bot.dig(block, true); mined++; }
			}
	const timeMs = performance.now() - start;
	bot.end();
	emitResult({ timeMs, success: mined > 0, metadata: { mined } });
};

(library === "typecraft" ? runTypecraft() : runMineflayer()).catch(e => { emitResult({ timeMs: 0, success: false, error: String(e) }); process.exit(1); });
