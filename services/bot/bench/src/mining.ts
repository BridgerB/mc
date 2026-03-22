import { DEFAULT_CONFIG, printResult, runTrial, type BenchResult } from "./harness.js";
const result: BenchResult = {
	name: "Mining Speed (5x5x5 stone cube)",
	typecraft: runTrial("trials/mining-trial.ts", "typecraft", DEFAULT_CONFIG),
	mineflayer: runTrial("trials/mining-trial.ts", "mineflayer", DEFAULT_CONFIG),
};
printResult(result);
process.exit(0);
