/**
 * Bench 1: Pathfinding race — runner
 */

import { DEFAULT_CONFIG, printResult, runTrial, type BenchResult } from "./harness.js";

const result: BenchResult = {
	name: "Pathfinding Race (200 blocks)",
	typecraft: runTrial("trials/pathfind-trial.ts", "typecraft", DEFAULT_CONFIG),
	mineflayer: runTrial("trials/pathfind-trial.ts", "mineflayer", DEFAULT_CONFIG),
};

printResult(result);
process.exit(0);
