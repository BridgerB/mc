/**
 * Block color calculation logic
 */

import type { BlockColors, RGBA } from "./types.ts";

/**
 * Calculate average color for each block
 */
export function calculateBlockColors(
  blockstates: Map<string, string>,
  blockModels: Map<string, string[]>,
  textureColors: Map<string, RGBA>,
): BlockColors {
  console.log("🔢 Calculating block average colors...");

  const blockColors: BlockColors = {};
  let processed = 0;

  for (const [blockName, modelName] of blockstates) {
    const textures = blockModels.get(modelName);
    if (!textures || textures.length === 0) {
      continue;
    }

    // Sum all texture colors
    let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
    let count = 0;

    for (const textureName of textures) {
      const color = textureColors.get(textureName);
      if (color) {
        rSum += color.r;
        gSum += color.g;
        bSum += color.b;
        aSum += color.a;
        count++;
      }
    }

    if (count > 0) {
      blockColors[blockName] = {
        r: Math.round(rSum / count),
        g: Math.round(gSum / count),
        b: Math.round(bSum / count),
        a: Math.round(aSum / count),
      };
      processed++;
    }
  }

  console.log(`✅ Calculated colors for ${processed} blocks`);
  return blockColors;
}
