# NixOS Minecraft Server for Oracle Cloud Infrastructure (OCI)

A self-contained NixOS configuration for deploying a Velocity proxy with
multiple Paper servers to Oracle Cloud Infrastructure's ARM Free Tier (Ampere
A1).

## Overview

This configuration deploys a production-ready Minecraft network with:

- **Velocity Proxy** (from nixpkgs) - High-performance Minecraft proxy
- **Geyser** - Bedrock-to-Java translation (allows Xbox, mobile, Switch, PS
  players to join)
- **Floodgate** - Bedrock authentication (no Java account needed)
- **Paper Server 1.21.11** (from nixpkgs) - Four backend servers
  (lobby, creative, survival, the-walls)
- **Advanced Portals** - Portal plugin for cross-server teleportation
- **OCI ARM Free Tier** - 4 OCPU, 24GB RAM (free forever)
- **NixOS** - Declarative, reproducible Linux distribution
- **Modern Forwarding** - Cryptographic player authentication between proxy and
  backends
- **Automatic startup** - All services start on boot via systemd
- **Security hardening** - SSH key-only auth, fail2ban, firewall
- **JVM optimization** - G1GC tuning for Minecraft performance

## System Requirements

### OCI Resources

- **Instance**: VM.Standard.A1.Flex (ARM)
- **CPU**: 4 OCPU (always free eligible)
- **RAM**: 24GB (always free eligible)
- **Storage**: 50GB+ boot volume
- **OS**: NixOS (installed via netboot.xyz)

### Local Requirements

- Nix package manager with flakes enabled
- SSH client
- OCI account with ARM free tier availability

## Architecture

```
Internet -> OCI Firewall -> NixOS Host
                            |-- SSH (port 22)
                            |-- fail2ban
                            +-- Velocity Proxy (TCP 25565 Java, UDP 19132 Bedrock)
                                |-- Geyser (Bedrock-to-Java translation)
                                |-- Floodgate (Bedrock auth)
                                |-- systemd: velocity-proxy.service
                                |-- /var/lib/velocity/
                                |-- Modern Forwarding Secret
                                +-- Backend Servers (127.0.0.1, INTERNAL ONLY):
                                    |-- Paper Lobby (port 25566)
                                    |   +-- systemd: minecraft-lobby.service
                                    |       +-- /var/lib/minecraft/lobby/
                                    |-- Paper Creative (port 25567)
                                    |   +-- systemd: minecraft-creative.service
                                    |       +-- /var/lib/minecraft/creative/
                                    |-- Paper Survival (port 25568)
                                    |   +-- systemd: minecraft-survival.service
                                    |       +-- /var/lib/minecraft/survival/
                                    +-- Paper The Walls (port 25569)
                                        +-- systemd: minecraft-the-walls.service
                                            +-- /var/lib/minecraft/the-walls/
```

## Quick Start

### 1. Review and Update SSH Keys

**IMPORTANT**: Before deploying, update the SSH keys in `config.nix`:

```nix
{
  sshKeys = [
    "ssh-ed25519 YOUR_KEY_HERE user@host"
  ];
}
```

Replace with your own public SSH keys.

### 2. Build the Configuration (Local Testing)

```bash
cd /home/bridger/Developer/mc/server/oci

# Test that the configuration builds
nix build .#nixosConfigurations.minecraft.config.system.build.toplevel
```

### 3. Deploy to OCI

#### Option A: Using deploy.ts Script (Recommended for Updates)

If you already have a NixOS instance running on OCI:

```bash
cd /home/bridger/Developer/mc/server/oci

./deploy.ts 144.24.32.76
```

The deployment script will:

1. Wait for SSH to be ready
2. Generate fresh hardware configuration on the server
3. Copy all configuration files to `/etc/nixos/`
4. Run `nixos-rebuild switch --flake .#minecraft`
5. Restart all services

#### Option B: Manual Installation

```bash
# On the OCI instance
cd /etc/nixos
# Copy your configuration files here

nixos-rebuild switch --flake .#minecraft
```

### 4. Connect to Minecraft

**Java Edition:**

```
Server Address: mc.bridgerb.com
```

**Bedrock Edition** (Windows 10, iOS, Android):

```
Server Address: mc.bridgerb.com
Port: 19132
```

**Console** (Xbox, PlayStation, Switch) — no "Add Server" button:

Use the BedrockConnect DNS trick:
1. Set console DNS to `104.238.130.180` (secondary: `8.8.8.8`)
2. In Minecraft, go to Servers tab and click any Featured Server
3. You'll get a server list UI — enter `mc.bridgerb.com` port `19132`

### 5. Switch Between Servers

Once connected, use the Velocity `/server` command:

```
/server lobby      - Switch to the lobby server (survival, no PVP)
/server creative   - Switch to the creative server (creative mode, peaceful)
/server survival   - Switch to the survival server (hard difficulty, PVP enabled)
/server the-walls  - Switch to The Walls (PVP minigame, adventure mode)
```

Portals between servers are also set up via Advanced Portals.

## Configuration

### Server Settings

Default settings for each Paper server are defined in `configuration.nix` using
the `mkPaperServer` helper function:

**Lobby Server** (port 25566):

- Gamemode: survival
- PVP: disabled
- Difficulty: normal
- Memory: 4GB

**Creative Server** (port 25567):

- Gamemode: creative
- PVP: disabled
- Difficulty: peaceful
- Memory: 4GB

**Survival Server** (port 25568):

- Gamemode: survival
- PVP: enabled
- Difficulty: hard
- Memory: 4GB

**The Walls Server** (port 25569):

- Gamemode: adventure
- PVP: enabled
- Difficulty: normal
- Memory: 4GB
- Command blocks: enabled
- Flight: enabled (for spectator mode)
- World: "The Walls: Remastered" PVP minigame map (originally for 1.16.4)

### Memory Allocation

Total memory allocation (~16GB out of 24GB):

- **Lobby Server**: 4GB
- **Creative Server**: 4GB
- **Survival Server**: 4GB
- **The Walls Server**: 4GB
- **Velocity Proxy**: Uses JVM defaults (~1-2GB)
- **System/OS**: ~8GB remaining

To adjust memory, edit the `memoryMB` parameter in `configuration.nix`:

```nix
mkPaperServer {
  name = "survival";
  port = 25568;
  memoryMB = 6144; # Change from 4096 to 6GB
  ...
}
```

### Firewall

Ports 22 (SSH), 25565/TCP (Velocity/Java), and 19132/UDP (Geyser/Bedrock) are
exposed. The backend Paper servers on ports 25566-25569 are bound to 127.0.0.1
and are NOT accessible externally.

**Note:** Both the NixOS firewall AND the OCI VCN security list must allow
traffic. The NixOS firewall is managed declaratively in `configuration.nix`. The
OCI cloud firewall must be updated separately.

#### OCI Security List (Cloud Firewall)

To add or update ingress rules via the OCI CLI (requires the `API_KEY` profile).
The subnet OCID is in `config.ts`.

```bash
# Get the security list ID for the subnet
oci network subnet get --profile API_KEY \
  --subnet-id "<subnet-ocid-from-config.ts>" \
  --query 'data."security-list-ids"'

# View current ingress rules
oci network security-list get --profile API_KEY \
  --security-list-id "<security-list-ocid>" \
  --query 'data."ingress-security-rules"'

# Update rules (REPLACES all ingress rules — include existing ones!)
# Protocol 6 = TCP, Protocol 17 = UDP
oci network security-list update --profile API_KEY \
  --security-list-id "<security-list-ocid>" \
  --ingress-security-rules '[
    {"description":"SSH","protocol":"6","source":"0.0.0.0/0","sourceType":"CIDR_BLOCK","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":22,"max":22}}},
    {"description":"Minecraft Java","protocol":"6","source":"0.0.0.0/0","sourceType":"CIDR_BLOCK","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":25565,"max":25565}}},
    {"description":"Geyser Bedrock","protocol":"17","source":"0.0.0.0/0","sourceType":"CIDR_BLOCK","isStateless":false,"udpOptions":{"destinationPortRange":{"min":19132,"max":19132}}}
  ]' --force
```

**Important:** The `update` command replaces ALL ingress rules. Always include
every existing rule you want to keep, plus any new ones. Omitting a rule deletes
it.

## Server Management

### Systemd Services

```bash
# Check all service statuses
sudo systemctl status velocity-proxy minecraft-lobby minecraft-creative minecraft-survival minecraft-the-walls

# View logs (live)
sudo journalctl -u velocity-proxy -f
sudo journalctl -u minecraft-lobby -f
sudo journalctl -u minecraft-creative -f
sudo journalctl -u minecraft-survival -f
sudo journalctl -u minecraft-the-walls -f

# Restart a specific server
sudo systemctl restart minecraft-lobby

# Stop all servers
sudo systemctl stop velocity-proxy minecraft-lobby minecraft-creative minecraft-survival minecraft-the-walls

# Start all servers
sudo systemctl start velocity-proxy minecraft-lobby minecraft-creative minecraft-survival minecraft-the-walls
```

**Note**: The Paper servers depend on velocity-proxy, so if the proxy restarts,
all backend servers will restart as well.

### World Data

**Velocity Proxy** - `/var/lib/velocity/`:

```
/var/lib/velocity/
|-- velocity.toml       # Proxy configuration (baked from nix, overwritten on start)
|-- forwarding.secret   # Modern forwarding secret (auto-generated)
|-- plugins/            # Velocity plugins
+-- logs/               # Proxy logs
```

**Paper Servers** - `/var/lib/minecraft/{lobby,creative,survival,the-walls}/`:

```
/var/lib/minecraft/lobby/
|-- eula.txt                       # EULA acceptance (baked)
|-- server.properties              # Server configuration (baked)
|-- config/
|   +-- paper-global.yml           # Paper config with Velocity forwarding (baked)
|-- world/                         # Overworld
|-- world_nether/                  # Nether dimension
|-- world_the_end/                 # End dimension
|-- plugins/
|   |-- advanced-portals.jar       # Nix-managed symlink
|   +-- AdvancedPortals/
|       +-- config.yaml            # Plugin config (baked, enableProxySupport: true)
+-- logs/                          # Server logs
```

### Backups

```bash
# Backup all worlds
tar -czf /tmp/minecraft-backup-$(date +%Y%m%d).tar.gz \
  -C /var/lib/minecraft \
  lobby/world survival/world creative/world the-walls/world
```

### The Walls - Initial World Setup

The Walls server uses a pre-built PVP minigame map that must be uploaded once
before the server can start. The world zip is stored locally (gitignored) at
`../worlds/the-walls.tar.xz`.

```bash
# Upload and extract the world (one-time setup)
scp ../worlds/the-walls.tar.xz root@144.24.32.76:/tmp/
ssh root@144.24.32.76 'cd /var/lib/minecraft/the-walls && tar -xJf /tmp/the-walls.tar.xz && mv the-walls world && chown -R minecraft:minecraft world && rm /tmp/the-walls.tar.xz'
```

Paper will auto-upgrade the world from 1.16.4 format to 1.21.11 on first load.

## Updating

### Update to Latest Minecraft Versions

Paper and Velocity versions come from nixpkgs. To update:

```bash
cd /home/bridger/Developer/mc/server/oci

# Update flake inputs to get latest nixpkgs
nix flake update

# Deploy
./deploy.ts 144.24.32.76
```

## Nix Architecture

All configs are **baked at build time** in the nix store:

- `paper-global.yml` - Full Paper config with `velocity.enabled: true` and a
  `__VELOCITY_SECRET__` placeholder that gets substituted at runtime
- `advanced-portals-config.yaml` - Full plugin config with
  `enableProxySupport: true`
- `velocity.toml` - Proxy config copied from this directory
- `server.properties` - Generated per-server from `mkPaperServer` parameters

The only runtime-generated value is the Velocity forwarding secret, which is
created once on first boot and substituted into the baked Paper config via sed.

## Files in This Directory

- **flake.nix** - Nix flake with inline Advanced Portals build and Paper/Velocity from nixpkgs
- **flake.lock** - Pinned nixpkgs and Advanced Portals source
- **configuration.nix** - NixOS system configuration with baked configs
- **hardware-configuration.nix** - Hardware-specific settings for OCI ARM (generated on server)
- **velocity.toml** - Velocity proxy configuration
- **config.nix** - SSH keys (user-specific)
- **deploy.ts** - Deno script to deploy configuration to OCI instance
- **launch.ts** - Deno script to launch OCI instance (requires OCI CLI)
- **config.ts** - OCI configuration for TypeScript scripts
- **README.md** - This documentation
