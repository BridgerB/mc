/**
 * Shared benchmark harness — runs typecraft and mineflayer in separate
 * child processes to avoid OOM from loading both in the same heap.
 */

import { execSync } from "node:child_process";

// ── Config ──

export type BenchConfig = {
	readonly host: string;
	readonly port: number;
	readonly version: string;
};

export const DEFAULT_CONFIG: BenchConfig = {
	host: "localhost",
	port: Number(process.env.BENCH_PORT) || 23624,
	version: "1.21.11",
};

// ── Result ──

export type TrialResult = {
	readonly timeMs: number;
	readonly success: boolean;
	readonly error?: string;
	readonly metadata?: Record<string, unknown>;
};

export type BenchResult = {
	readonly name: string;
	readonly typecraft: TrialResult;
	readonly mineflayer: TrialResult;
};

// ── Run a trial in a child process to isolate memory ──

export const runTrial = (
	script: string,
	library: "typecraft" | "mineflayer",
	config: BenchConfig,
): TrialResult => {
	try {
		const heapMb = library === "mineflayer" ? "6144" : "2048";
		const env = {
			...process.env,
			BENCH_HOST: config.host,
			BENCH_PORT: String(config.port),
			BENCH_VERSION: config.version,
			BENCH_LIB: library,
			NODE_OPTIONS: `--max-old-space-size=${heapMb}`,
		};
		const output = execSync(
			`npx tsx "${script}"`,
			{ encoding: "utf8", timeout: 120_000, cwd: import.meta.dirname, env },
		);
		// The child process prints JSON result to stdout
		const lines = output.trim().split("\n");
		const lastLine = lines[lines.length - 1];
		return JSON.parse(lastLine) as TrialResult;
	} catch (err) {
		const msg = (err as { stderr?: string }).stderr ?? String(err);
		return { timeMs: 0, success: false, error: msg.slice(0, 200) };
	}
};

// ── Reporting ──

export const printResult = (result: BenchResult): void => {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`  ${result.name}`);
	console.log(`${"=".repeat(60)}`);

	const tc = result.typecraft;
	const mf = result.mineflayer;

	console.log(`  typecraft:  ${tc.success ? `${tc.timeMs.toFixed(0)}ms` : `FAIL: ${tc.error}`}`);
	console.log(`  mineflayer: ${mf.success ? `${mf.timeMs.toFixed(0)}ms` : `FAIL: ${mf.error}`}`);

	if (tc.success && mf.success) {
		const ratio = mf.timeMs / tc.timeMs;
		const faster = ratio > 1 ? "typecraft" : "mineflayer";
		const pct = Math.abs((ratio - 1) * 100).toFixed(1);
		console.log(`  winner:     ${faster} (${pct}% faster)`);
	}

	if (tc.metadata) console.log(`  tc meta:    ${JSON.stringify(tc.metadata)}`);
	if (mf.metadata) console.log(`  mf meta:    ${JSON.stringify(mf.metadata)}`);
	console.log();
};

// ── Helpers for child process scripts ──

export const getTrialConfig = (): { config: BenchConfig; library: "typecraft" | "mineflayer" } => ({
	config: {
		host: process.env.BENCH_HOST ?? "localhost",
		port: Number(process.env.BENCH_PORT) || 23624,
		version: process.env.BENCH_VERSION ?? "1.21.1",
	},
	library: (process.env.BENCH_LIB as "typecraft" | "mineflayer") ?? "typecraft",
});

/** Print result as JSON (child process → parent). */
export const emitResult = (result: TrialResult): void => {
	console.log(JSON.stringify(result));
};

export const sleep = (ms: number): Promise<void> =>
	new Promise((r) => setTimeout(r, ms));
