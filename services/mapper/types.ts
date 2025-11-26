/**
 * Type definitions for Minecraft world mapper
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ChunkData {
  sections: ChunkSection[];
}

export interface ChunkSection {
  Y?: number;
  y?: number;
  block_states?: BlockStates;
}

export interface BlockStates {
  palette: PaletteEntry[];
  data?: bigint[];
}

export interface PaletteEntry {
  Name: string;
}

export interface RenderArea {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  width: number;
  height: number;
}

export interface RenderStats {
  processedChunks: number;
  skippedChunks: number;
  blockCounts: Map<string, number>;
}
