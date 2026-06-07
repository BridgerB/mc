# Adding a New World to the Server

## Overview

Each world runs as its own Paper server behind the Velocity proxy. Adding a new
world means: preparing the world archive, adding a new server definition in the
NixOS config, registering it in Velocity, deploying, and uploading the world.

## Step-by-Step

### 1. Prepare the world archive

Download the world (usually a zip from Planet Minecraft, CurseForge, etc.) and
convert it to a tar.xz with a clean folder name:

```bash
# Extract the download
cd /tmp
mkdir extract && cd extract
unzip ~/Downloads/some-world-v1.2.zip

# The extracted folder often has a messy name - rename it
mv "Some World v1.2 [by Author]" my-world

# Create tar.xz and move to worlds dir (gitignored)
tar -cJf /home/bridger/Developer/mc/server/worlds/my-world.tar.xz my-world
rm -rf /tmp/extract
```

The folder name inside the tar.xz becomes the name used during extraction. Keep
it simple and lowercase with hyphens.

### 2. Add the server to `configuration.nix`

**Add a tmpfiles rule** for the new server directory:

```nix
systemd.tmpfiles.rules = [
  # ... existing rules ...
  "d /var/lib/minecraft/my-world 0755 minecraft minecraft -"
];
```

**Add a new `mkPaperServer` entry.** Pick the next available port (current
highest is 25569):

```nix
// mkPaperServer {
  name = "my-world";
  port = 25570;
  gamemode = "adventure";   # or "survival", "creative"
  pvp = true;
  difficulty = "normal";    # "peaceful", "easy", "normal", "hard"
  memoryMB = 4096;
  enableCommandBlocks = false;  # true if the map uses command blocks
  allowFlight = false;          # true if the map uses spectator mode
}
```

**Settings to think about:**

| Setting              | Default   | When to change                                   |
| -------------------- | --------- | ------------------------------------------------ |
| `gamemode`           | survival  | `adventure` for minigame maps, `creative` for building |
| `pvp`                | true      | `false` for cooperative/building worlds           |
| `enableCommandBlocks`| false     | `true` if the map has command block game logic    |
| `allowFlight`        | false     | `true` if the map uses spectator mode             |
| `memoryMB`           | 4096      | Can lower to 2048 for small maps                  |

### 3. Register in `velocity.toml`

Add the backend server under `[servers]`:

```toml
[servers]
  # ... existing servers ...
  my-world = "127.0.0.1:25570"
```

Update the MOTD if you want it listed:

```toml
motd = "<gold>Velocity Multi-Server Network\n<gray>Lobby • Creative • Survival • My World"
```

### 4. Deploy the NixOS config

```bash
cd /home/bridger/Developer/mc/server/oci
./deploy.ts 144.24.32.76
```

The new service will start but fail (or run with an empty world) until the world
is uploaded.

### 5. Upload the world to the server

```bash
cd /home/bridger/Developer/mc/server/oci

# Upload
scp ../worlds/my-world.tar.xz root@144.24.32.76:/tmp/

# Extract into place
ssh root@144.24.32.76 'cd /var/lib/minecraft/my-world && tar -xJf /tmp/my-world.tar.xz && mv my-world world && chown -R minecraft:minecraft world && rm /tmp/my-world.tar.xz'

# Restart the server to pick up the world
ssh root@144.24.32.76 'systemctl restart minecraft-my-world'
```

### 6. Verify

```bash
# Check the service
ssh root@144.24.32.76 'systemctl status minecraft-my-world'

# Check the logs
ssh root@144.24.32.76 'journalctl -u minecraft-my-world -n 50 --no-pager'
```

In-game: `/server my-world`

## Port Assignments

| Server    | Port  |
| --------- | ----- |
| Velocity  | 25565 |
| lobby     | 25566 |
| creative  | 25567 |
| survival  | 25568 |
| the-walls | 25569 |
| parkour   | 25570 |
| dropper   | 25571 |
| exponential | 25572 |
| hot-and-heavy | 25573 |
| planet-parkour | 25574 |

Next available: **25575**

## Notes

- World archives go in `server/worlds/` which is gitignored (large binary files)
- Paper auto-upgrades worlds from older Minecraft versions on first load
- Old maps (1.16, 1.17, etc.) may take longer on first boot due to world
  conversion
- The world folder inside the server dir must be named `world` (Paper's
  `level-name` is set to `world`)
- All configs (server.properties, paper-global.yml, Advanced Portals) are baked
  at build time by NixOS - do not edit them on the server, they get overwritten
  on every restart
