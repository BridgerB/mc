/**
 * Statistics tracking and display
 */

import type { RenderStats } from "./types.ts";

/**
 * Create empty statistics object
 */
export function createStats(): RenderStats {
  return {
    processedChunks: 0,
    skippedChunks: 0,
    blockCounts: new Map(),
  };
}

/**
 * Track a block occurrence
 */
export function trackBlock(stats: RenderStats, blockId: string): void {
  stats.blockCounts.set(
    blockId,
    (stats.blockCounts.get(blockId) || 0) + 1,
  );
}

/**
 * Print statistics to console
 */
export function printStats(stats: RenderStats, topN: number): void {
  console.log(`\n✅ Processed ${stats.processedChunks} chunks`);
  console.log(`⏭️  Skipped ${stats.skippedChunks} chunks`);

  console.log(`\n📊 Block types found:`);
  const sorted = Array.from(stats.blockCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  for (const [blockId, count] of sorted) {
    console.log(`  ${blockId}: ${count.toLocaleString()} blocks`);
  }
}
