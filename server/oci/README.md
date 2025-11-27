# NixOS Minecraft Server for Oracle Cloud Infrastructure (OCI)

A self-contained NixOS configuration for deploying a vanilla Minecraft server to
Oracle Cloud Infrastructure's ARM Free Tier (Ampere A1).

## Overview

This configuration deploys a production-ready Minecraft server with:

- **Vanilla Minecraft 1.21.4** - Official Mojang server
- **OCI ARM Free Tier** - 4 OCPU, 24GB RAM (free forever)
- **NixOS** - Declarative, reproducible Linux distribution
- **Automatic startup** - Server starts on boot via systemd
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
Internet → OCI Firewall → NixOS Host
                            ├─ SSH (port 22)
                            ├─ fail2ban
                            └─ Minecraft Server (port 25565)
                                └─ systemd service
                                    └─ Java 21 + server.jar
                                        └─ /var/lib/minecraft/
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

This validates your configuration without deploying.

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

#### Option B: Manual Installation

If you already have a NixOS instance running on OCI:

```bash
# On the OCI instance
cd /etc/nixos
git clone https://github.com/yourusername/mc.git
cd mc/server/oci

# Build and activate
sudo nixos-rebuild switch --flake .#minecraft
```

### 4. Connect to Minecraft

Once deployed and the server is running:

```
Minecraft Server Address: <your-oci-ip>:25565
```

Get your instance's public IP from the OCI console.

## Configuration

### Server Settings

Default server settings are in `configuration.nix` (lines 84-102):

```properties
server-port=25565
max-players=20
difficulty=normal
gamemode=survival
pvp=true
motd=NixOS Minecraft Server on Oracle Cloud ARM
```

After first boot, you can modify `/var/lib/minecraft/server.properties` directly
and restart the service.

### Memory Allocation

Default JVM settings allocate 10GB of the 24GB available:

```nix
ExecStart = "${pkgs.jdk21}/bin/java -Xmx10G -Xms10G ...
```

This leaves ~14GB for the OS, which is appropriate for vanilla Minecraft.

**To adjust memory**:

Edit `configuration.nix` line 106 and change `-Xmx10G -Xms10G` to your desired
values, then rebuild:

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
    25565 # Minecraft
  ];
};
```

**To add ports** (e.g., for future Velocity proxy):

```nix
allowedTCPPorts = [ 22 25565 25577 ];
```

Then rebuild and switch.

## Server Management

### Systemd Service

The Minecraft server runs as a systemd service:

```bash
# Check server status
sudo systemctl status minecraft-server

# View logs (live)
sudo journalctl -u minecraft-server -f

# Restart server
sudo systemctl restart minecraft-server

# Stop server
sudo systemctl stop minecraft-server

# Start server
sudo systemctl start minecraft-server

# Disable auto-start on boot
sudo systemctl disable minecraft-server
```

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

All server data is stored in `/var/lib/minecraft/`:

```
/var/lib/minecraft/
├── server.jar          # Minecraft server JAR
├── eula.txt            # EULA acceptance
├── server.properties   # Server configuration
├── world/              # Overworld
├── world_nether/       # Nether dimension
├── world_the_end/      # End dimension
├── logs/               # Server logs
├── plugins/            # Plugin directory (unused in vanilla)
└── banned-players.json # Banned players
```

### Backups

**Important**: Implement a backup strategy for `/var/lib/minecraft/world*`

Example backup script:

```bash
#!/usr/bin/env bash
# /usr/local/bin/backup-minecraft.sh

BACKUP_DIR="/var/backups/minecraft"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Stop server for consistent backup
systemctl stop minecraft-server

# Backup world data
tar -czf "$BACKUP_DIR/minecraft-$DATE.tar.gz" \
  -C /var/lib/minecraft \
  world world_nether world_the_end server.properties

# Restart server
systemctl start minecraft-server

# Keep only last 7 backups
ls -t "$BACKUP_DIR"/minecraft-*.tar.gz | tail -n +8 | xargs rm -f

echo "Backup completed: $BACKUP_DIR/minecraft-$DATE.tar.gz"
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

Only ports 22 (SSH) and 25565 (Minecraft) are exposed.

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
   - **Minecraft**: Source 0.0.0.0/0, TCP port 25565

## Monitoring

### Resource Usage

```bash
# CPU and memory
htop

# Disk usage
duf

# Network activity
iftop

# Minecraft-specific
sudo journalctl -u minecraft-server -f
```

### Player Activity

View server logs:

```bash
sudo journalctl -u minecraft-server | grep joined
sudo journalctl -u minecraft-server | grep left
```

## Troubleshooting

### Server Won't Start

**Check service status**:

```bash
sudo systemctl status minecraft-server
```

**View detailed logs**:

```bash
sudo journalctl -u minecraft-server -n 100
```

**Common issues**:

1. **Out of memory**: Reduce JVM heap size in `configuration.nix`
2. **Port already in use**: Check for other services on port 25565
3. **EULA not accepted**: Verify `/var/lib/minecraft/eula.txt` contains
   `eula=true`

### Can't Connect to Server

**Test connectivity**:

```bash
# From your local machine
nc -zv <oci-ip> 25565
```

**Check firewall**:

```bash
# On OCI instance
sudo iptables -L -n | grep 25565
```

**Verify server is listening**:

```bash
sudo ss -tlnp | grep 25565
```

### Players Can't Join

**Check if server is in online mode**:

```bash
grep online-mode /var/lib/minecraft/server.properties
```

Should be `online-mode=true` for Mojang authentication.

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

### Update Minecraft Version

1. Find the new server.jar URL at
   [Minecraft Downloads](https://www.minecraft.net/en-us/download/server)

2. Update `configuration.nix` line 77 with the new download URL:

```nix
${pkgs.curl}/bin/curl -o server.jar https://piston-data.mojang.com/v1/objects/NEW_HASH_HERE/server.jar
```

3. Remove existing server.jar:

```bash
sudo rm /var/lib/minecraft/server.jar
```

4. Rebuild and restart:

```bash
sudo nixos-rebuild switch --flake .#minecraft
sudo systemctl restart minecraft-server
```

### Update NixOS System

```bash
# Update flake inputs
nix flake update

# Rebuild with new nixpkgs
sudo nixos-rebuild switch --flake .#minecraft

# Reboot if kernel updated
sudo reboot
```

## Future Upgrade Path

This vanilla Minecraft setup is designed to be upgraded incrementally:

### Phase 1: Current - Vanilla Minecraft

✅ You are here

### Phase 2: Upgrade to Paper

Replace vanilla server.jar with Paper for better performance and plugin support.

**Changes needed**:

- Update `configuration.nix` to download Paper instead of vanilla
- Add plugin directory management
- Adjust JVM flags for Paper optimizations

### Phase 3: Add Velocity Proxy

Deploy Velocity proxy for multi-world support.

**Changes needed**:

- Add Velocity proxy service
- Configure modern forwarding with secrets
- Connect to `/home/bridger/git/mc/server/velocity` setup

### Phase 4: Multi-Server Network

Run multiple Paper servers (lobby, creative, survival) behind Velocity.

**Changes needed**:

- Increase instance size or deploy additional instances
- Configure Velocity to proxy multiple backends
- Setup per-world configurations

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

- **flake.nix** - Nix flake configuration and Minecraft server package
- **configuration.nix** - NixOS system configuration
- **hardware-configuration.nix** - Hardware-specific settings for OCI ARM
- **README.md** - This documentation

## Resources

### Official Documentation

- [Minecraft Server Downloads](https://www.minecraft.net/en-us/download/server)
- [NixOS Manual](https://nixos.org/manual/nixos/stable/)
- [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)

### Community

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

1. Server logs: `sudo journalctl -u minecraft-server -f`
2. System logs: `sudo journalctl -xe`
3. NixOS manual: https://nixos.org/manual/nixos/stable/

For Minecraft gameplay issues, consult the
[Minecraft Wiki](https://minecraft.fandom.com/wiki/Minecraft_Wiki) or
[r/Minecraft](https://www.reddit.com/r/Minecraft/).
