#!/usr/bin/env -S deno run --allow-read --allow-write --node-modules-dir=auto
/**
 * Minecraft World Mapper CLI
 */

import type { RenderArea } from "./types.ts";
import {
  OUTPUT_PATH,
  REGION_PATH,
  RENDER_AREA,
  TOP_BLOCKS_TO_DISPLAY,
  WORLD_PATH,
} from "./config.ts";
import { generateWorldMap } from "./generator.ts";
import { printStats } from "./statistics.ts";

async function main() {
  console.log("🗺️  Minecraft World Mapper MVP");
  console.log(`📂 World: ${WORLD_PATH}`);
  console.log(
    `📐 Area: ${RENDER_AREA.MIN_X},${RENDER_AREA.MIN_Z} to ${RENDER_AREA.MAX_X},${RENDER_AREA.MAX_Z}`,
  );

  const renderArea: RenderArea = {
    minX: RENDER_AREA.MIN_X,
    maxX: RENDER_AREA.MAX_X,
    minZ: RENDER_AREA.MIN_Z,
    maxZ: RENDER_AREA.MAX_Z,
    width: RENDER_AREA.MAX_X - RENDER_AREA.MIN_X,
    height: RENDER_AREA.MAX_Z - RENDER_AREA.MIN_Z,
  };

  console.log(`🖼️  Output: ${renderArea.width}x${renderArea.height} pixels`);

  // Generate map
  const stats = await generateWorldMap(REGION_PATH, renderArea, OUTPUT_PATH);

  // Print statistics
  printStats(stats, TOP_BLOCKS_TO_DISPLAY);

  console.log(`\n🎉 Done! Map saved to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("❌ Error:", error);
  Deno.exit(1);
});
