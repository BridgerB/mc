/**
 * Minecraft asset extraction and processing
 */

import { exists } from "jsr:@std/fs@1.0.20";
import { join } from "jsr:@std/path@1.1.3";
import type { BlockModel, Blockstate, RGBA } from "./types.ts";
import { getAverageColor } from "./image-processing.ts";
import { loadJSON, walkFiles } from "./file-utils.ts";

/**
 * Extract Minecraft .jar file to specified directory
 */
export async function extractMinecraftAssets(
  jarPath: string,
  extractDir: string,
): Promise<void> {
  console.log("📦 Extracting Minecraft assets from .jar file...");

  if (!await exists(jarPath)) {
    throw new Error(`Minecraft .jar not found at: ${jarPath}`);
  }

  // Clean up old extracted data
  if (await exists(extractDir)) {
    console.log("🧹 Cleaning up old extracted data...");
    await Deno.remove(extractDir, { recursive: true });
  }

  // Extract using unzip
  const process = new Deno.Command("unzip", {
    args: ["-q", jarPath, "-d", extractDir],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stderr } = await process.output();

  if (code !== 0) {
    const errorMsg = new TextDecoder().decode(stderr);
    throw new Error(`Failed to extract .jar file: ${errorMsg}`);
  }

  console.log("✅ Assets extracted successfully");
}

/**
 * Process all block textures and calculate average colors
 */
export async function processTextures(
  extractedDataDir: string,
): Promise<Map<string, RGBA>> {
  console.log("🎨 Processing block textures...");

  const texturesDir = join(
    extractedDataDir,
    "assets/minecraft/textures/block",
  );
  const textureColors = new Map<string, RGBA>();

  let count = 0;
  for await (const texturePath of walkFiles(texturesDir, /\.png$/)) {
    const textureName = texturePath
      .replace(texturesDir + "/", "")
      .replace(".png", "");

    const avgColor = await getAverageColor(texturePath);
    textureColors.set(textureName, avgColor);

    count++;
    if (count % 100 === 0) {
      console.log(`  Processed ${count} textures...`);
    }
  }

  console.log(`✅ Processed ${textureColors.size} textures`);
  return textureColors;
}

/**
 * Load all block models and resolve texture references
 */
export async function loadBlockModels(
  extractedDataDir: string,
): Promise<Map<string, string[]>> {
  console.log("📝 Loading block models...");

  const modelsDir = join(extractedDataDir, "assets/minecraft/models/block");
  const blockModels = new Map<string, string[]>();

  // First pass: load all models
  const modelData = new Map<string, BlockModel>();
  for await (const modelPath of walkFiles(modelsDir, /\.json$/)) {
    const modelName = modelPath
      .replace(modelsDir + "/", "")
      .replace(".json", "");

    const model = await loadJSON<BlockModel>(modelPath);
    if (model) {
      modelData.set(modelName, model);
    }
  }

  // Second pass: resolve textures (including parent inheritance)
  function resolveTextures(
    modelName: string,
    visited = new Set<string>(),
  ): string[] {
    if (visited.has(modelName)) return [];
    visited.add(modelName);

    const model = modelData.get(modelName);
    if (!model) return [];

    const textures: string[] = [];

    // Get textures from this model
    if (model.textures) {
      for (const value of Object.values(model.textures)) {
        // Skip texture variables (starting with #)
        if (!value.startsWith("#")) {
          // Handle minecraft: prefix
          const textureName = value.replace("minecraft:", "").replace(
            "block/",
            "",
          );
          textures.push(textureName);
        }
      }
    }

    // Inherit from parent
    if (model.parent) {
      const parentName = model.parent.replace("minecraft:block/", "");
      textures.push(...resolveTextures(parentName, visited));
    }

    return textures;
  }

  for (const [modelName] of modelData) {
    const textures = resolveTextures(modelName);
    if (textures.length > 0) {
      blockModels.set(modelName, textures);
    }
  }

  console.log(`✅ Loaded ${blockModels.size} block models`);
  return blockModels;
}

/**
 * Load all blockstates and map them to models
 */
export async function loadBlockstates(
  extractedDataDir: string,
): Promise<Map<string, string>> {
  console.log("🎮 Loading blockstates...");

  const blockstatesDir = join(
    extractedDataDir,
    "assets/minecraft/blockstates",
  );
  const blockstateToModel = new Map<string, string>();

  for await (const blockstatePath of walkFiles(blockstatesDir, /\.json$/)) {
    const blockName = blockstatePath
      .replace(blockstatesDir + "/", "")
      .replace(".json", "");

    const blockstate = await loadJSON<Blockstate>(blockstatePath);
    if (!blockstate) continue;

    let modelName: string | null = null;

    // Try to get model from variants
    if (blockstate.variants) {
      const firstVariant = Object.values(blockstate.variants)[0];
      if (Array.isArray(firstVariant)) {
        modelName = firstVariant[0]?.model ?? null;
      } else {
        modelName = firstVariant?.model ?? null;
      }
    } // Try to get model from multipart
    else if (blockstate.multipart && blockstate.multipart.length > 0) {
      modelName = blockstate.multipart[0]?.apply?.model ?? null;
    }

    if (modelName) {
      // Clean up model name
      const cleanModelName = modelName.replace("minecraft:block/", "");
      blockstateToModel.set(blockName, cleanModelName);
    }
  }

  console.log(`✅ Loaded ${blockstateToModel.size} blockstates`);
  return blockstateToModel;
}
