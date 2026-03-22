import { DEFAULT_CONFIG, printResult, runTrial, type BenchResult } from "./harness.js";
const result: BenchResult = {
	name: "Trade Economy (buy + deposit)",
	typecraft: runTrial("trials/trading-trial.ts", "typecraft", DEFAULT_CONFIG),
	mineflayer: runTrial("trials/trading-trial.ts", "mineflayer", DEFAULT_CONFIG),
};
printResult(result);
process.exit(0);
