/**
 * Chunk NBT parsing logic
 */

// @ts-ignore - prismarine-nbt lacks proper type definitions
import nbt from "npm:prismarine-nbt@2.7.0";
// @ts-ignore - Node.js Buffer types conflict with Deno globals
import { Buffer } from "node:buffer";
// @ts-ignore - Node.js zlib lacks Deno-compatible types
import { inflateSync } from "node:zlib";
import type { ChunkData } from "./types.ts";

/**
 * Parse chunk NBT data with compression handling
 */
export function parseChunk(
  data: Uint8Array,
  compressionType: number,
): ChunkData {
  let buffer = Buffer.from(data);

  // Manually decompress if zlib (type 2)
  if (compressionType === 2) {
    buffer = Buffer.from(inflateSync(buffer));
  }

  // Parse uncompressed NBT
  const parsed = nbt.parseUncompressed(buffer);

  // Simplify NBT to plain JavaScript objects
  const simplified = nbt.simplify(parsed);

  return simplified as ChunkData;
}
