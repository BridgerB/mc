import { DEFAULT_CONFIG, printResult, runTrial, type BenchResult } from "./harness.js";
const result: BenchResult = {
	name: "Crafting Pipeline (logs → wooden pickaxe)",
	typecraft: runTrial("trials/crafting-trial.ts", "typecraft", DEFAULT_CONFIG),
	mineflayer: runTrial("trials/crafting-trial.ts", "mineflayer", DEFAULT_CONFIG),
};
printResult(result);
process.exit(0);
