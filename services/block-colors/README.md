# Block Color Mapper

Maps Minecraft blocks to average RGBA colors.

```bash
nix run .#block-color-mapper  # Generates block-colors.json
```

Example output:

```json
{
  "blocks": {
    "diamond_block": { "r": 93, "g": 233, "b": 228, "a": 255 },
    "stone": { "r": 127, "g": 127, "b": 127, "a": 255 }
  }
}
```
