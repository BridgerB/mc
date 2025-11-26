/**
 * Image processing utilities for extracting average colors
 */

import sharp from "npm:sharp@0.34.5";
import type { RGBA } from "./types.ts";

/**
 * Calculate average RGBA color of an image using sharp
 * Replicates the resize-to-1x1 trick for getting average color
 */
export async function getAverageColor(imagePath: string): Promise<RGBA> {
  try {
    const { data } = await sharp(imagePath)
      .resize(1, 1, { kernel: "cubic" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return {
      r: data[0],
      g: data[1],
      b: data[2],
      a: data[3],
    };
  } catch (error) {
    console.error(`Error processing ${imagePath}:`, error);
    return { r: 0, g: 0, b: 0, a: 0 };
  }
}
