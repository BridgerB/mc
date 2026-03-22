/**
 * Run all 5 benchmarks sequentially and print a summary table.
 */

import { execSync } from "node:child_process";

const benches = [
	"bench:pathfind",
	"bench:mining",
	"bench:crafting",
	"bench:combat",
	"bench:trading",
];

const port = process.env.BENCH_PORT ?? "23624";

console.log("mc-bot-bench — typecraft vs mineflayer\n");
console.log(`Server: localhost:${port}`);
console.log(`Date: ${new Date().toISOString()}\n`);

for (const bench of benches) {
	console.log(`Running ${bench}...`);
	try {
		const output = execSync(`npm run ${bench}`, {
			encoding: "utf8",
			timeout: 180_000,
			cwd: import.meta.dirname,
			env: {
				...process.env,
				BENCH_PORT: port,
			},
		});
		console.log(output);
	} catch (err) {
		console.error(`FAILED: ${bench}`, (err as Error).message);
	}
}
