/**
 * Color query and lookup functions
 * These can be imported by external applications to query pre-generated block colors
 */

import type { BlockColors, ColorResult, RGBA } from "./types.ts";

/**
 * Get the average color of a specific block
 */
export function getBlockColor(
  blockName: string,
  colors: BlockColors,
): RGBA | null {
  return colors[blockName] || null;
}

/**
 * Find the closest block to a given RGBA color
 * Uses Euclidean distance in RGBA color space
 */
export function getClosestBlock(
  targetColor: RGBA,
  colors: BlockColors,
): ColorResult | null {
  let closestBlock: string | null = null;
  let closestColor: RGBA | null = null;
  let minDistance = Infinity;

  for (const [blockName, blockColor] of Object.entries(colors)) {
    const distance = Math.sqrt(
      Math.pow(blockColor.r - targetColor.r, 2) +
        Math.pow(blockColor.g - targetColor.g, 2) +
        Math.pow(blockColor.b - targetColor.b, 2) +
        Math.pow(blockColor.a - targetColor.a, 2),
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestBlock = blockName;
      closestColor = blockColor;
    }
  }

  if (closestBlock && closestColor) {
    return {
      block: closestBlock,
      color: closestColor,
      distance: minDistance,
    };
  }

  return null;
}

/**
 * Get all blocks with an exact color match
 */
export function getBlocksOfColor(
  targetColor: RGBA,
  colors: BlockColors,
): string[] {
  const matches: string[] = [];

  for (const [blockName, blockColor] of Object.entries(colors)) {
    if (
      blockColor.r === targetColor.r &&
      blockColor.g === targetColor.g &&
      blockColor.b === targetColor.b &&
      blockColor.a === targetColor.a
    ) {
      matches.push(blockName);
    }
  }

  return matches;
}
