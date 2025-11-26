#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run --allow-sys --allow-ffi

/**
 * Minecraft Block Color Mapper - CLI Entry Point
 * Generates block-colors.json from Minecraft assets
 */

import {
  EXTRACTED_DATA_DIR,
  MINECRAFT_JAR_PATH,
  OUTPUT_JSON_PATH,
} from "./config.ts";
import {
  cleanupTempFiles,
  generateBlockColors,
  saveJSON,
} from "./generator.ts";

if (import.meta.main) {
  try {
    const blockColors = await generateBlockColors(
      MINECRAFT_JAR_PATH,
      EXTRACTED_DATA_DIR,
    );
    await saveJSON(blockColors, OUTPUT_JSON_PATH);

    console.log("\n✨ Generation complete!");
    console.log(`\nOutput: ${OUTPUT_JSON_PATH}`);
    console.log(`Total blocks: ${Object.keys(blockColors).length}`);

    // Show some examples
    console.log("\n📊 Sample blocks:");
    const samples = Object.entries(blockColors).slice(0, 5);
    for (const [name, color] of samples) {
      console.log(
        `  ${name}: rgba(${color.r.toFixed(1)}, ${color.g.toFixed(1)}, ${
          color.b.toFixed(1)
        }, ${color.a.toFixed(1)})`,
      );
    }

    // Clean up temporary files
    await cleanupTempFiles(EXTRACTED_DATA_DIR);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("\n❌ Error:", message);

    // Clean up temporary files even on error
    await cleanupTempFiles(EXTRACTED_DATA_DIR);

    Deno.exit(1);
  }
}
