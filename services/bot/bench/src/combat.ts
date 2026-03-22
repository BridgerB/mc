import { DEFAULT_CONFIG, printResult, runTrial, type BenchResult } from "./harness.js";
const result: BenchResult = {
	name: "Combat Survival (30s zombie arena)",
	typecraft: runTrial("trials/combat-trial.ts", "typecraft", DEFAULT_CONFIG),
	mineflayer: runTrial("trials/combat-trial.ts", "mineflayer", DEFAULT_CONFIG),
};
printResult(result);
process.exit(0);
