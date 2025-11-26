/**
 * Block color calculation logic
 */

import type { BlockColors, ColormapData, RGBA } from "./types.ts";

// Blocks that use grass colormap tinting
const GRASS_TINTED_BLOCKS = new Set([
  "grass_block",
  "grass",
  "tall_grass",
  "fern",
  "large_fern",
  "sugar_cane",
]);

// Blocks that use foliage colormap tinting
const FOLIAGE_TINTED_BLOCKS = new Set([
  "oak_leaves",
  "birch_leaves",
  "spruce_leaves",
  "jungle_leaves",
  "acacia_leaves",
  "dark_oak_leaves",
  "mangrove_leaves",
  "vine",
]);

// Blocks that use dry_foliage colormap tinting
const DRY_FOLIAGE_TINTED_BLOCKS = new Set([
  "leaf_litter",
]);

/**
 * Apply biome tint to a base color (multiplicative blending)
 * This is how Minecraft applies colormap tints to textures
 */
function applyTint(baseColor: RGBA, tint: RGBA): RGBA {
  return {
    r: Math.round((baseColor.r * tint.r) / 255),
    g: Math.round((baseColor.g * tint.g) / 255),
    b: Math.round((baseColor.b * tint.b) / 255),
    a: baseColor.a,
  };
}

/**
 * Calculate average color for each block
 */
export function calculateBlockColors(
  blockstates: Map<string, string>,
  blockModels: Map<string, string[]>,
  textureColors: Map<string, RGBA>,
  colormaps: ColormapData,
): BlockColors {
  console.log("🔢 Calculating block average colors...");

  const blockColors: BlockColors = {};
  let processed = 0;
  let tintedBlocks = 0;

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
      let finalColor: RGBA = {
        r: Math.round(rSum / count),
        g: Math.round(gSum / count),
        b: Math.round(bSum / count),
        a: Math.round(aSum / count),
      };

      // Apply biome tinting for grass, foliage, and dry_foliage blocks
      if (GRASS_TINTED_BLOCKS.has(blockName) && colormaps.grass) {
        finalColor = applyTint(finalColor, colormaps.grass);
        tintedBlocks++;
      } else if (FOLIAGE_TINTED_BLOCKS.has(blockName) && colormaps.foliage) {
        finalColor = applyTint(finalColor, colormaps.foliage);
        tintedBlocks++;
      } else if (
        DRY_FOLIAGE_TINTED_BLOCKS.has(blockName) && colormaps.dry_foliage
      ) {
        finalColor = applyTint(finalColor, colormaps.dry_foliage);
        tintedBlocks++;
      }

      blockColors[blockName] = finalColor;
      processed++;
    }
  }

  console.log(
    `✅ Calculated colors for ${processed} blocks (${tintedBlocks} biome-tinted)`,
  );
  return blockColors;
}
