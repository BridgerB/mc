/**
 * World map generation orchestration
 */

import type { RenderArea, RenderStats } from "./types.ts";
import { RegionFile } from "./region.ts";
import { parseChunk } from "./chunk-parser.ts";
import { getBlockColor, getTopBlock } from "./block-resolver.ts";
import { createEmptyImage, savePNG, setPixel } from "./image-renderer.ts";
import { createStats, trackBlock } from "./statistics.ts";

/**
 * Generate world map PNG from region files
 */
export async function generateWorldMap(
  regionPath: string,
  renderArea: RenderArea,
  outputPath: string,
): Promise<RenderStats> {
  const { minX, maxX, minZ, maxZ, width, height } = renderArea;

  // Create empty image
  const png = createEmptyImage(width, height);

  // Calculate region bounds
  const minChunkX = Math.floor(minX / 16);
  const maxChunkX = Math.floor((maxX - 1) / 16);
  const minChunkZ = Math.floor(minZ / 16);
  const maxChunkZ = Math.floor((maxZ - 1) / 16);

  const minRegionX = Math.floor(minChunkX / 32);
  const maxRegionX = Math.floor(maxChunkX / 32);
  const minRegionZ = Math.floor(minChunkZ / 32);
  const maxRegionZ = Math.floor(maxChunkZ / 32);

  console.log(
    `\nProcessing ${
      (maxRegionX - minRegionX + 1) * (maxRegionZ - minRegionZ + 1)
    } region files...\n`,
  );

  const stats = createStats();

  // Process each region
  for (let regionZ = minRegionZ; regionZ <= maxRegionZ; regionZ++) {
    for (let regionX = minRegionX; regionX <= maxRegionX; regionX++) {
      const regionFile = `${regionPath}/r.${regionX}.${regionZ}.mca`;

      // Check if region exists
      try {
        await Deno.stat(regionFile);
      } catch {
        stats.skippedChunks += 1024; // 32x32 chunks
        continue;
      }

      console.log(`📦 Processing r.${regionX}.${regionZ}.mca`);
      const region = new RegionFile(regionFile);

      try {
        // Process chunks in this region
        for (let localZ = 0; localZ < 32; localZ++) {
          for (let localX = 0; localX < 32; localX++) {
            const chunkX = regionX * 32 + localX;
            const chunkZ = regionZ * 32 + localZ;

            // Skip if chunk doesn't exist
            if (!region.hasChunk(localX, localZ)) {
              stats.skippedChunks++;
              continue;
            }

            // Read chunk data
            const chunkResult = region.readChunk(localX, localZ);
            if (!chunkResult) {
              stats.skippedChunks++;
              continue;
            }

            // Parse chunk
            const chunk = parseChunk(
              chunkResult.data,
              chunkResult.compressionType,
            );

            // Render each block in chunk
            for (let z = 0; z < 16; z++) {
              for (let x = 0; x < 16; x++) {
                const worldX = chunkX * 16 + x;
                const worldZ = chunkZ * 16 + z;

                // Skip if outside render area
                if (
                  worldX < minX || worldX >= maxX || worldZ < minZ ||
                  worldZ >= maxZ
                ) {
                  continue;
                }

                // Get top block and color
                const blockId = getTopBlock(chunk, x, z);
                const color = getBlockColor(blockId);

                // Track block types
                trackBlock(stats, blockId);

                // Set pixel
                const imageX = worldX - minX;
                const imageY = worldZ - minZ;
                setPixel(png, imageX, imageY, color, width);
              }
            }

            stats.processedChunks++;
          }
        }
      } finally {
        region.close();
      }
    }
  }

  // Save PNG
  console.log(`\n💾 Writing ${outputPath}...`);
  await savePNG(png, outputPath);

  return stats;
}
