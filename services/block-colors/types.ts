/**
 * Type definitions for Minecraft block color mapping
 */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface BlockModel {
  textures?: Record<string, string>;
  parent?: string;
}

export interface BlockstateVariant {
  model?: string;
  weight?: number;
}

export interface BlockstateMultipart {
  apply?: {
    model?: string;
  };
}

export interface Blockstate {
  variants?: Record<string, BlockstateVariant | BlockstateVariant[]>;
  multipart?: BlockstateMultipart[];
}

export interface BlockColors {
  [blockName: string]: RGBA;
}

export interface ColorResult {
  block: string;
  color: RGBA;
  distance: number;
}

export interface ColormapData {
  [colormapName: string]: RGBA;
}
