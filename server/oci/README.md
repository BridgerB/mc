# NixOS Minecraft Server for Oracle Cloud Infrastructure (OCI)

A self-contained NixOS configuration for deploying a Velocity proxy with
multiple Paper servers to Oracle Cloud Infrastructure's ARM Free Tier (Ampere
A1).

## Overview

This configuration deploys a production-ready Minecraft network with:

- **Velocity Proxy** (from nixpkgs) - High-performance Minecraft proxy
- **Paper Server 1.21.11** (from nixpkgs) - Three backend servers
  (lobby, creative, survival)
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
                            +-- Velocity Proxy (port 25565, PUBLIC)
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
                                    +-- Paper Survival (port 25568)
                                        +-- systemd: minecraft-survival.service
                                            +-- /var/lib/minecraft/survival/
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

```
Minecraft Server Address: 144.24.32.76:25565
```

### 5. Switch Between Servers

Once connected, use the Velocity `/server` command:

```
/server lobby      - Switch to the lobby server (survival, no PVP)
/server creative   - Switch to the creative server (creative mode, peaceful)
/server survival   - Switch to the survival server (hard difficulty, PVP enabled)
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

### Memory Allocation

Total memory allocation (~12GB out of 24GB):

- **Lobby Server**: 4GB
- **Creative Server**: 4GB
- **Survival Server**: 4GB
- **Velocity Proxy**: Uses JVM defaults (~1-2GB)
- **System/OS**: ~12GB remaining

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

Only port 22 (SSH) and port 25565 (Velocity proxy) are exposed. The backend
Paper servers on ports 25566-25568 are bound to 127.0.0.1 and are NOT
accessible externally.

## Server Management

### Systemd Services

```bash
# Check all service statuses
sudo systemctl status velocity-proxy minecraft-lobby minecraft-creative minecraft-survival

# View logs (live)
sudo journalctl -u velocity-proxy -f
sudo journalctl -u minecraft-lobby -f
sudo journalctl -u minecraft-creative -f
sudo journalctl -u minecraft-survival -f

# Restart a specific server
sudo systemctl restart minecraft-lobby

# Stop all servers
sudo systemctl stop velocity-proxy minecraft-lobby minecraft-creative minecraft-survival

# Start all servers
sudo systemctl start velocity-proxy minecraft-lobby minecraft-creative minecraft-survival
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

**Paper Servers** - `/var/lib/minecraft/{lobby,creative,survival}/`:

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
  lobby/world survival/world creative/world
```

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
