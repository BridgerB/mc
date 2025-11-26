/**
 * Block lookup and color resolution
 */

import type { ChunkData, RGB } from "./types.ts";
import blockColorsData from "../block-colors/block-colors.json" with {
  type: "json",
};

const BLOCK_COLORS: Record<string, RGB> = blockColorsData.blocks;
const DEFAULT_COLOR: RGB = { r: 255, g: 0, b: 255 }; // Magenta for unknown

/**
 * Get RGB color for a block ID
 */
export function getBlockColor(blockId: string): RGB {
  // Strip properties like "minecraft:grass_block[snowy=true]"
  const baseBlockId = blockId.split("[")[0];
  // Remove "minecraft:" prefix for new JSON format
  const blockName = baseBlockId.replace("minecraft:", "");

  // Return color from JSON, or default magenta if not found
  return BLOCK_COLORS[blockName] || DEFAULT_COLOR;
}

/**
 * Find top non-air block at local position
 * Simple top-down iteration (no heightmap)
 */
export function getTopBlock(
  chunk: ChunkData,
  localX: number,
  localZ: number,
): string {
  const sections = chunk.sections || [];

  // Ensure sections is an array
  if (!Array.isArray(sections) || sections.length === 0) {
    return "minecraft:air";
  }

  // Sort sections by Y (top to bottom)
  const sortedSections = sections.sort((a, b) => {
    const yA = a.Y ?? a.y ?? 0;
    const yB = b.Y ?? b.y ?? 0;
    return yB - yA;
  });

  // Iterate through sections from top to bottom
  for (const section of sortedSections) {
    const blockStates = section.block_states;
    if (!blockStates) continue;

    const palette = blockStates.palette || [];
    const data = blockStates.data || [];

    if (palette.length === 0) continue;

    // Single block type in section
    if (palette.length === 1) {
      const blockName = palette[0].Name || "minecraft:air";
      if (blockName !== "minecraft:air" && blockName !== "minecraft:cave_air") {
        return blockName;
      }
      continue;
    }

    // Multiple block types - need to unpack
    const bitsPerBlock = Math.max(4, Math.ceil(Math.log2(palette.length)));

    // Iterate Y from top (15) to bottom (0)
    for (let y = 15; y >= 0; y--) {
      const blockIndex = y * 256 + localZ * 16 + localX;
      const paletteIndex = getPackedValue(data, blockIndex, bitsPerBlock);

      if (paletteIndex >= 0 && paletteIndex < palette.length) {
        const blockName = palette[paletteIndex].Name || "minecraft:air";
        if (
          blockName !== "minecraft:air" && blockName !== "minecraft:cave_air"
        ) {
          return blockName;
        }
      }
    }
  }

  return "minecraft:air";
}

/**
 * Extract value from packed long array
 * Minecraft 1.16+ format: values do NOT span across longs (padding is used)
 */
function getPackedValue(
  data: bigint[],
  index: number,
  bitsPerValue: number,
): number {
  // Calculate how many values fit in each 64-bit long
  const valuesPerLong = Math.floor(64 / bitsPerValue);

  // Find which long contains this index
  const longIndex = Math.floor(index / valuesPerLong);

  // Find position within that long
  const indexInLong = index % valuesPerLong;
  const bitOffset = indexInLong * bitsPerValue;

  if (longIndex >= data.length) return 0;

  // Extract value (never spans across longs in 1.16+)
  const mask = (1n << BigInt(bitsPerValue)) - 1n;
  return Number((data[longIndex] >> BigInt(bitOffset)) & mask);
}
