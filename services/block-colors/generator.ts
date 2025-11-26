/**
 * Main generation orchestration and I/O functions
 */

import { ensureDir, exists } from "jsr:@std/fs@1.0.20";
import { dirname } from "jsr:@std/path@1.1.3";
import type { BlockColors } from "./types.ts";
import {
  extractMinecraftAssets,
  loadBlockModels,
  loadBlockstates,
  processTextures,
} from "./minecraft-assets.ts";
import { calculateBlockColors } from "./color-calculator.ts";

/**
 * Generate block colors from Minecraft assets
 */
export async function generateBlockColors(
  jarPath: string,
  extractDir: string,
): Promise<BlockColors> {
  console.log("🎮 Minecraft Block Color Mapper");
  console.log("================================\n");

  // Step 1: Extract assets
  await extractMinecraftAssets(jarPath, extractDir);

  // Step 2: Process textures
  const textureColors = await processTextures(extractDir);

  // Step 3: Load block models
  const blockModels = await loadBlockModels(extractDir);

  // Step 4: Load blockstates
  const blockstates = await loadBlockstates(extractDir);

  // Step 5: Calculate block colors
  const blockColors = calculateBlockColors(
    blockstates,
    blockModels,
    textureColors,
  );

  // Step 6: Sort alphabetically
  const sortedBlockColors: BlockColors = {};
  const sortedKeys = Object.keys(blockColors).sort();
  for (const key of sortedKeys) {
    sortedBlockColors[key] = blockColors[key];
  }

  return sortedBlockColors;
}

/**
 * Save block colors to JSON file
 */
export async function saveJSON(
  data: BlockColors,
  outputPath: string,
): Promise<void> {
  console.log(`\n💾 Saving to ${outputPath}...`);

  // Ensure directory exists
  const dir = dirname(outputPath);
  await ensureDir(dir);

  // Write JSON with pretty printing
  const json = JSON.stringify({ blocks: data }, null, 2);
  await Deno.writeTextFile(outputPath, json);

  console.log(`✅ Saved ${Object.keys(data).length} blocks to JSON`);
}

/**
 * Clean up temporary extraction directory
 */
export async function cleanupTempFiles(extractDir: string): Promise<void> {
  try {
    if (await exists(extractDir)) {
      console.log("\n🧹 Cleaning up temporary files...");
      await Deno.remove(extractDir, { recursive: true });
      console.log("✅ Cleanup complete");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("⚠️  Failed to clean up temp files:", message);
  }
}
