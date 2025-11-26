/**
 * Generic file system utilities
 */

import { exists } from "jsr:@std/fs@1.0.20";
import { join } from "jsr:@std/path@1.1.3";

/**
 * Load and parse a JSON file
 */
export async function loadJSON<T>(path: string): Promise<T | null> {
  try {
    const content = await Deno.readTextFile(path);
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Walk directory and get all files matching a pattern
 */
export async function* walkFiles(
  dir: string,
  pattern: RegExp,
): AsyncGenerator<string> {
  if (!await exists(dir)) {
    return;
  }

  for await (const entry of Deno.readDir(dir)) {
    const path = join(dir, entry.name);

    if (entry.isDirectory) {
      yield* walkFiles(path, pattern);
    } else if (pattern.test(entry.name)) {
      yield path;
    }
  }
}
