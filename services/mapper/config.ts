/**
 * Configuration constants for Minecraft world mapper
 */

export const WORLD_PATH = "/tmp/parkour-limbo-v1.3";
export const REGION_PATH = `${WORLD_PATH}/region`;
export const OUTPUT_PATH = "./services/mapper/output.png";

export const RENDER_AREA = {
  MIN_X: -512,
  MAX_X: 512,
  MIN_Z: -512,
  MAX_Z: 512,
} as const;

export const TOP_BLOCKS_TO_DISPLAY = 20;
