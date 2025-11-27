# NixOS Minecraft Server for Oracle Cloud Infrastructure (OCI)

A self-contained NixOS configuration for deploying a Velocity proxy with
multiple Paper servers to Oracle Cloud Infrastructure's ARM Free Tier (Ampere
A1).

## Overview

This configuration deploys a production-ready Minecraft network with:

- **Velocity Proxy 3.4.0-unstable-2025-11-09** (from nixpkgs) - High-performance
  Minecraft proxy
- **Paper Server 1.21.10 build 91** (from nixpkgs) - Three backend servers
  (lobby, creative, survival)
- **OCI ARM Free Tier** - 4 OCPU, 24GB RAM (free forever)
- **NixOS** - Declarative, reproducible Linux distribution
- **Modern Forwarding** - Cryptographic player authentication between proxy and
  backends
- **Automatic startup** - All services start on boot via systemd
- **Security hardening** - SSH key-only auth, fail2ban, firewall
- **JVM optimization** - G1GC tuning for Minecraft performance
- **Automatic updates** - Uses nixpkgs unstable for latest Minecraft versions

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
Internet → OCI Firewall → NixOS Host
                            ├─ SSH (port 22)
                            ├─ fail2ban
                            └─ Velocity Proxy (port 25577, PUBLIC)
                                ├─ systemd: velocity-proxy.service
                                ├─ /var/lib/velocity/
                                ├─ Modern Forwarding Secret
                                └─ Backend Servers (127.0.0.1, INTERNAL ONLY):
                                    ├─ Paper Lobby (port 25565)
                                    │   └─ systemd: minecraft-lobby.service
                                    │       └─ /var/lib/minecraft/lobby/
                                    ├─ Paper Creative (port 25566)
                                    │   └─ systemd: minecraft-creative.service
                                    │       └─ /var/lib/minecraft/creative/
                                    └─ Paper Survival (port 25567)
                                        └─ systemd: minecraft-survival.service
                                            └─ /var/lib/minecraft/survival/
```

## Quick Start

### 1. Review and Update SSH Keys

**IMPORTANT**: Before deploying, update the SSH keys in `configuration.nix`:

```nix
users.users.root = {
  openssh.authorizedKeys.keys = [
    "ssh-ed25519 YOUR_KEY_HERE user@host"
  ];
};
```

Replace with your own public SSH keys.

### 2. Build the Configuration (Local Testing)

```bash
cd /home/bridger/git/mc/server/oci

# Test that the configuration builds
nix build .#nixosConfigurations.minecraft.config.system.build.toplevel
```

This validates your configuration without deploying. The configuration
automatically allows unfree packages for Minecraft components.

### 3. Deploy to OCI

#### Option A: Using netboot.xyz (Recommended)

This method uses netboot.xyz to install NixOS on an OCI ARM instance. See the
detailed guide in `/home/bridger/git/oci/CLAUDE.md` for OCI-specific
instructions.

**High-level steps**:

1. Create OCI ARM instance (4 OCPU, 24GB RAM)
2. Boot into rescue mode with netboot.xyz ISO
3. Select NixOS installer from netboot.xyz menu
4. Partition disks and mount filesystems
5. Clone this repository or copy files to `/mnt/etc/nixos/`
6. Run `nixos-install`
7. Reboot and remove rescue ISO

#### Option B: Using deploy.ts Script (Recommended for Updates)

If you already have a NixOS instance running on OCI, use the deployment script:

```bash
# From your local machine
cd /home/bridger/git/mc/server/oci

# Deploy to your OCI instance
./deploy.ts <your-oci-ip>

# Example:
./deploy.ts 144.24.32.76
```

The deployment script will:

1. Wait for SSH to be ready
2. Generate fresh hardware configuration on the server
3. Copy all configuration files to `/etc/nixos/`
4. Run `nixos-rebuild switch --flake .#minecraft`
5. Restart all services

#### Option C: Manual Installation

If you prefer manual deployment:

```bash
# On the OCI instance
cd /etc/nixos
# Copy your configuration files here

# Build and activate
nixos-rebuild switch --flake .#minecraft
```

### 4. Connect to Minecraft

Once deployed and the server is running:

```
Minecraft Server Address: <your-oci-ip>:25577
```

Get your instance's public IP from the OCI console.

**Note**: Connect to port **25577** (Velocity proxy), not 25565. The backend
servers on ports 25565-25567 are internal only.

### 5. Switch Between Servers

Once connected, you can switch between the three servers:

```
/server lobby      - Switch to the lobby server (survival, no PVP)
/server creative   - Switch to the creative server (creative mode, peaceful)
/server survival   - Switch to the survival server (hard difficulty, PVP enabled)
```

## Configuration

### Server Settings

Default settings for each Paper server are defined in `configuration.nix` using
the `mkPaperServer` helper function. Each server has its own configuration:

**Lobby Server** (port 25565):

- Gamemode: survival
- PVP: disabled
- Difficulty: normal
- Memory: 4GB

**Creative Server** (port 25566):

- Gamemode: creative
- PVP: disabled
- Difficulty: peaceful
- Memory: 4GB

**Survival Server** (port 25567):

- Gamemode: survival
- PVP: enabled
- Difficulty: hard
- Memory: 4GB

After first boot, you can modify each server's properties:

- `/var/lib/minecraft/lobby/server.properties`
- `/var/lib/minecraft/creative/server.properties`
- `/var/lib/minecraft/survival/server.properties`

Then restart the corresponding service.

### Memory Allocation

Total memory allocation (~12GB out of 24GB):

- **Lobby Server**: 4GB (configuration.nix:218)
- **Creative Server**: 4GB (configuration.nix:226)
- **Survival Server**: 4GB (configuration.nix:234)
- **Velocity Proxy**: Uses JVM defaults (typically 1-2GB)
- **System/OS**: ~12GB remaining

**To adjust memory for a specific server**:

Edit `configuration.nix` and modify the `memoryMB` parameter in the
corresponding `mkPaperServer` call:

```nix
mkPaperServer {
  name = "survival";
  port = 25567;
  memoryMB = 6144; # Change from 4096 to 6GB
  ...
}
```

Then rebuild:

```bash
sudo nixos-rebuild switch --flake .#minecraft
```

### Firewall

Default firewall rules (in `configuration.nix`):

```nix
networking.firewall = {
  enable = true;
  allowedTCPPorts = [
    22    # SSH
    25577 # Velocity Proxy (PUBLIC)
    # Backend servers (25565-25567) are NOT exposed - internal only
  ];
};
```

**Important**: Only port 25577 (Velocity proxy) is exposed to the internet. The
backend Paper servers on ports 25565-25567 are bound to 127.0.0.1 and are NOT
accessible externally. This is a security feature - all player connections must
go through the Velocity proxy.

## Server Management

### Systemd Services

The server runs as four separate systemd services:

**Velocity Proxy**:

```bash
# Check proxy status
sudo systemctl status velocity-proxy

# View proxy logs (live)
sudo journalctl -u velocity-proxy -f

# Restart proxy (will disconnect all players)
sudo systemctl restart velocity-proxy
```

**Paper Backend Servers**:

```bash
# Check all backend server statuses
sudo systemctl status minecraft-lobby
sudo systemctl status minecraft-creative
sudo systemctl status minecraft-survival

# View logs for a specific server
sudo journalctl -u minecraft-lobby -f
sudo journalctl -u minecraft-creative -f
sudo journalctl -u minecraft-survival -f

# Restart a specific server (only affects players on that server)
sudo systemctl restart minecraft-lobby
sudo systemctl restart minecraft-creative
sudo systemctl restart minecraft-survival

# Stop all servers
sudo systemctl stop velocity-proxy minecraft-lobby minecraft-creative minecraft-survival

# Start all servers
sudo systemctl start velocity-proxy minecraft-lobby minecraft-creative minecraft-survival
```

**Note**: The Paper servers depend on velocity-proxy, so if the proxy restarts,
all backend servers will restart as well.

### Server Console

To send commands to the Minecraft server, you can use `screen` or `tmux`.

**Alternative: Use RCON** (requires enabling RCON in server.properties):

```bash
# Edit server.properties
cd /var/lib/minecraft
sudo -u minecraft vim server.properties

# Add:
# enable-rcon=true
# rcon.password=yourpassword
# rcon.port=25575

# Restart server
sudo systemctl restart minecraft-server
```

Then use an RCON client to send commands.

### World Data

Server data is organized by server type:

**Velocity Proxy** - `/var/lib/velocity/`:

```
/var/lib/velocity/
├── velocity.toml       # Proxy configuration
├── forwarding.secret   # Modern forwarding secret (auto-generated, perms: 644)
├── plugins/            # Velocity plugins (optional)
└── logs/               # Proxy logs

# Directory permissions: 755 (readable by minecraft user for secret access)
```

**Paper Servers** - `/var/lib/minecraft/{lobby,creative,survival}/`:

```
/var/lib/minecraft/lobby/          # Lobby server
├── eula.txt                       # EULA acceptance (auto-generated)
├── server.properties              # Server configuration (auto-generated)
├── config/
│   └── paper-global.yml           # Paper config with Velocity forwarding
├── world/                         # Overworld
├── world_nether/                  # Nether dimension
├── world_the_end/                 # End dimension
├── plugins/                       # Paper plugins (optional)
└── logs/                          # Server logs

# Same structure for /var/lib/minecraft/creative/ and /var/lib/minecraft/survival/
# No server.jar symlink - Paper runs directly from Nix store
```

### Backups

**Important**: Implement a backup strategy for `/var/lib/minecraft/world*`

Example backup script for all three servers:

```bash
#!/usr/bin/env bash
# /usr/local/bin/backup-minecraft.sh

BACKUP_DIR="/var/backups/minecraft"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup each server
for server in lobby creative survival; do
  echo "Backing up $server..."

  # Stop server for consistent backup
  systemctl stop minecraft-$server

  # Backup world data
  tar -czf "$BACKUP_DIR/minecraft-$server-$DATE.tar.gz" \
    -C /var/lib/minecraft/$server \
    world world_nether world_the_end server.properties config/

  # Restart server
  systemctl start minecraft-$server
done

# Backup Velocity config
tar -czf "$BACKUP_DIR/velocity-$DATE.tar.gz" \
  -C /var/lib/velocity \
  velocity.toml forwarding.secret

# Keep only last 7 backups
ls -t "$BACKUP_DIR"/minecraft-*.tar.gz | tail -n +8 | xargs rm -f
ls -t "$BACKUP_DIR"/velocity-*.tar.gz | tail -n +8 | xargs rm -f

echo "Backup completed: $BACKUP_DIR/*-$DATE.tar.gz"
```

Add to crontab for automated backups:

```bash
# Daily backup at 4 AM
0 4 * * * /usr/local/bin/backup-minecraft.sh
```

## Security

### SSH Access

- **Root login**: SSH key authentication only
- **Password authentication**: Disabled
- **Keyboard interactive auth**: Disabled

Your SSH keys are defined in `configuration.nix` (lines 48-53).

### fail2ban

Automatic IP banning after 5 failed SSH attempts:

```bash
# Check banned IPs
sudo fail2ban-client status sshd

# Unban an IP
sudo fail2ban-client set sshd unbanip <ip-address>
```

### Firewall

Only ports 22 (SSH) and 25577 (Velocity Proxy) are exposed.

**Verify firewall rules**:

```bash
sudo iptables -L -n -v
```

### OCI Security Lists

In addition to the NixOS firewall, configure OCI Security Lists:

1. Go to OCI Console → Networking → Virtual Cloud Networks
2. Select your VCN → Security Lists
3. Add ingress rules:
   - **SSH**: Source 0.0.0.0/0, TCP port 22
   - **Velocity Proxy**: Source 0.0.0.0/0, TCP port 25577

**Important**: Do NOT add rules for ports 25565-25567. These backend servers
should remain internal only.

## Monitoring

### Resource Usage

```bash
# CPU and memory
htop

# Disk usage
duf

# Network activity
iftop

# Velocity proxy logs
sudo journalctl -u velocity-proxy -f

# Paper server logs
sudo journalctl -u minecraft-lobby -f
sudo journalctl -u minecraft-creative -f
sudo journalctl -u minecraft-survival -f
```

### Player Activity

View server logs for player joins/leaves:

```bash
# Velocity proxy connections
sudo journalctl -u velocity-proxy | grep "has connected"
sudo journalctl -u velocity-proxy | grep "has disconnected"

# Server switches
sudo journalctl -u velocity-proxy | grep "has connected to"

# Individual server activity
sudo journalctl -u minecraft-lobby | grep joined
sudo journalctl -u minecraft-creative | grep joined
sudo journalctl -u minecraft-survival | grep joined
```

## Troubleshooting

### Server Won't Start

**Check service status for all components**:

```bash
sudo systemctl status velocity-proxy
sudo systemctl status minecraft-lobby
sudo systemctl status minecraft-creative
sudo systemctl status minecraft-survival
```

**View detailed logs**:

```bash
sudo journalctl -u velocity-proxy -n 100
sudo journalctl -u minecraft-lobby -n 100
sudo journalctl -u minecraft-creative -n 100
sudo journalctl -u minecraft-survival -n 100
```

**Common issues**:

1. **Out of memory**: Reduce JVM heap size in `configuration.nix` (memoryMB
   parameter)
2. **Port already in use**: Check for other services on ports 25565-25567 or
   25577
3. **EULA not accepted**: Verify each server's `eula.txt` contains `eula=true`
4. **Forwarding secret mismatch**:
   - Ensure `/var/lib/velocity/forwarding.secret` exists
   - Check `/var/lib/velocity` directory permissions are `755`
   - Verify secret file permissions are `644`
   - Test: `sudo -u minecraft cat /var/lib/velocity/forwarding.secret`
5. **Paper servers can't connect**: Check that Velocity proxy is running first
   (Paper servers depend on it)
6. **"Unable to verify player details"**: Indicates Velocity forwarding secret
   mismatch - delete Paper configs and restart:
   ```bash
   sudo rm -rf /var/lib/minecraft/*/config/paper-global.yml
   sudo systemctl restart minecraft-lobby minecraft-creative minecraft-survival
   ```

### Can't Connect to Server

**Test connectivity**:

```bash
# From your local machine (test Velocity proxy)
nc -zv <oci-ip> 25577
```

**Check firewall**:

```bash
# On OCI instance
sudo iptables -L -n | grep 25577
```

**Verify Velocity proxy is listening**:

```bash
# Should show Velocity listening on 0.0.0.0:25577
sudo ss -tlnp | grep 25577

# Verify backend servers are listening on localhost only
sudo ss -tlnp | grep 25565
sudo ss -tlnp | grep 25566
sudo ss -tlnp | grep 25567
```

### Players Can't Join

**Check if backend servers are in offline mode** (required for Velocity):

```bash
grep online-mode /var/lib/minecraft/lobby/server.properties
```

Should be `online-mode=false` for backend servers. Velocity handles Mojang
authentication.

**Verify network connectivity**:

```bash
# On server
curl -I https://sessionserver.mojang.com
```

### Disk Space Issues

**Check available space**:

```bash
df -h /var/lib/minecraft
```

**Find large files**:

```bash
ncdu /var/lib/minecraft
```

**Clean old logs**:

```bash
sudo find /var/lib/minecraft/logs -name "*.gz" -mtime +30 -delete
```

### Server Performance Issues

**Monitor TPS (ticks per second)**:

In-game: `/forge tps` or check server logs for lag warnings.

**Check system resources**:

```bash
# CPU usage per process
top -p $(pgrep -f minecraft)

# Memory usage
free -h
```

**Increase JVM memory** (if available):

Edit `configuration.nix` line 106 and increase heap size.

## Updating

### Update to Latest Minecraft Versions

This configuration uses nixpkgs packages for both Velocity and Paper, which
means you get automatic updates when you update nixpkgs:

```bash
# Update flake inputs to get latest nixpkgs (and thus latest Minecraft versions)
nix flake update

# Deploy the update
./deploy.ts <your-oci-ip>

# Or manually on the server:
cd /etc/nixos
nixos-rebuild switch --flake .#minecraft
```

The nixpkgs unstable channel typically has the latest stable Minecraft versions
within a few days of release.

**Check current versions**:

```bash
# On server
systemctl status velocity-proxy | grep -i version
journalctl -u minecraft-lobby -n 50 | grep "Paper version"
```

**Manual version override** (not recommended):

If you need a specific version not yet in nixpkgs, you can temporarily override
by creating custom package files. However, this defeats the purpose of using
nixpkgs and requires manual sha256 calculation.

### Update NixOS System

```bash
# Update flake inputs
nix flake update

# Deploy (from local machine)
./deploy.ts <your-oci-ip>

# Or rebuild on server
sudo nixos-rebuild switch --flake .#minecraft

# Reboot if kernel updated
sudo reboot
```

## Current Architecture

This setup runs a complete Velocity + Paper multi-server network:

✅ **Velocity Proxy** - Modern forwarding enabled, handles all player
connections ✅ **Paper Lobby** - Survival mode, no PVP, normal difficulty ✅
**Paper Creative** - Creative mode, no PVP, peaceful difficulty ✅ **Paper
Survival** - Survival mode, PVP enabled, hard difficulty

### Future Enhancements

Possible improvements to this setup:

**Plugins**:

- Add Velocity plugins to `/var/lib/velocity/plugins/`
- Add Paper plugins to each server's `plugins/` directory
- Restart services after adding plugins

**Additional Servers**:

- Add more `mkPaperServer` definitions in `configuration.nix`
- Update `velocity.toml` to register new servers
- Adjust memory allocation as needed

**Resource Packs**:

- Configure server resource packs in each server's `server.properties`
- Host resource packs externally for better performance

## Development

### Local Testing

Test configuration builds without deploying:

```bash
# Build system configuration
nix build .#nixosConfigurations.minecraft.config.system.build.toplevel

# Build VM for testing
nix build .#nixosConfigurations.minecraft.config.system.build.vm
```

### Syntax Checking

```bash
# Check Nix syntax
nix flake check

# Format Nix files
nix fmt
```

## Files in This Directory

- **flake.nix** - Nix flake configuration using nixpkgs Velocity and Paper
  packages
- **configuration.nix** - NixOS system configuration with Velocity proxy + 3
  Paper servers
- **hardware-configuration.nix** - Hardware-specific settings for OCI ARM
  (generated on server, not used locally)
- **velocity.toml** - Velocity proxy configuration template
- **launch.ts** - Deno script to launch OCI instance (requires OCI CLI)
- **deploy.ts** - Deno script to deploy configuration to OCI instance
- **status.ts** - Deno script to check server status
- **check.ts** - Deno script to validate OCI session
- **validate-session.ts** - Deno script to validate OCI authentication
- **README.md** - This documentation

**Note**: The old `velocity.nix` and `minecraft-server.nix` files are no longer
used as we now use packages directly from nixpkgs.

## Resources

### Official Documentation

- [PaperMC](https://papermc.io/) - Paper server and Velocity proxy
- [Velocity Documentation](https://docs.papermc.io/velocity) - Proxy setup and
  configuration
- [Paper Documentation](https://docs.papermc.io/paper) - Server configuration
  and plugins
- [NixOS Manual](https://nixos.org/manual/nixos/stable/)
- [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)

### Community

- [PaperMC Discord](https://discord.gg/papermc) - Official support for Paper and
  Velocity
- [Minecraft Wiki](https://minecraft.fandom.com/wiki/Minecraft_Wiki)
- [NixOS Discourse](https://discourse.nixos.org/)
- [r/admincraft](https://www.reddit.com/r/admincraft/) - Minecraft server admin
  community

## License

This NixOS configuration is provided as-is for running Minecraft servers.

- **NixOS**: MIT License
- **Minecraft**: Proprietary (Microsoft/Mojang EULA applies)

## Support

For issues specific to this configuration, check:

1. Velocity proxy logs: `sudo journalctl -u velocity-proxy -f`
2. Paper server logs:
   `sudo journalctl -u minecraft-{lobby,creative,survival} -f`
3. System logs: `sudo journalctl -xe`
4. NixOS manual: https://nixos.org/manual/nixos/stable/
5. Velocity docs: https://docs.papermc.io/velocity
6. Paper docs: https://docs.papermc.io/paper

For Minecraft gameplay issues, consult the
[Minecraft Wiki](https://minecraft.fandom.com/wiki/Minecraft_Wiki) or
[r/Minecraft](https://www.reddit.com/r/Minecraft/).
