/**
 * PNG image creation and rendering
 */

import { PNG } from "npm:pngjs";
import type { RGB } from "./types.ts";

/**
 * Create empty PNG image with transparent pixels
 */
export function createEmptyImage(width: number, height: number): PNG {
  const png = new PNG({ width, height });

  // Initialize all pixels to transparent
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0; // R
    png.data[i + 1] = 0; // G
    png.data[i + 2] = 0; // B
    png.data[i + 3] = 0; // A (transparent)
  }

  return png;
}

/**
 * Set pixel color at coordinates
 */
export function setPixel(
  png: PNG,
  x: number,
  y: number,
  color: RGB,
  width: number,
): void {
  const idx = (y * width + x) * 4;
  png.data[idx] = color.r;
  png.data[idx + 1] = color.g;
  png.data[idx + 2] = color.b;
  png.data[idx + 3] = 255; // Fully opaque
}

/**
 * Save PNG to file
 */
export async function savePNG(png: PNG, outputPath: string): Promise<void> {
  const buffer = PNG.sync.write(png);
  await Deno.writeFile(outputPath, buffer);
}
