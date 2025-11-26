# Minecraft World Mapper

Renders top-down 2D maps of Minecraft worlds by reading region files.

## Usage

```bash
deno run --allow-read --allow-write services/mapper/main.ts
```

Or directly (requires shebang support):

```bash
./services/mapper/main.ts
```

## Features

- Reads Minecraft .mca region files
- Parses NBT chunk data with zlib decompression
- Finds top non-air blocks at each position
- Maps blocks to colors using `../block-colors/block-colors.json`
- Generates PNG images
- Tracks block type statistics

## Configuration

Edit `config.ts` to change:

- `WORLD_PATH`: Path to Minecraft world directory
- `RENDER_AREA`: Bounds for rendering (MIN_X, MAX_X, MIN_Z, MAX_Z)
- `OUTPUT_PATH`: Output PNG file location
- `TOP_BLOCKS_TO_DISPLAY`: Number of block types to show in statistics

## Architecture

Modular structure following clean separation of concerns:

- **main.ts** - CLI entry point
- **types.ts** - Type definitions
- **config.ts** - Configuration constants
- **generator.ts** - Main orchestration logic
- **region.ts** - Region file (.mca) reader
- **chunk-parser.ts** - NBT parsing with compression
- **block-resolver.ts** - Block lookup and color mapping
- **image-renderer.ts** - PNG creation and pixel operations
- **statistics.ts** - Statistics tracking and display

## Dependencies

- `pngjs@7.0.0` - PNG generation
- `prismarine-nbt@2.7.0` - NBT parsing
- Block colors from `../block-colors` service

## Example Output

```
🗺️  Minecraft World Mapper MVP
📂 World: /tmp/parkour-limbo-v1.3
📐 Area: -512,-512 to 512,512
🖼️  Output: 1024x1024 pixels

Processing 4 region files...

📦 Processing r.-1.-1.mca
📦 Processing r.0.-1.mca
📦 Processing r.-1.0.mca
📦 Processing r.0.0.mca

✅ Processed 4096 chunks
⏭️  Skipped 0 chunks

📊 Block types found:
  minecraft:air: 839,925 blocks
  minecraft:grass_block: 52,885 blocks
  ...

💾 Writing ./output.png...

🎉 Done! Map saved to ./output.png
```
