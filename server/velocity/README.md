# Velocity Multi-Server Minecraft Network

A NixOS flake for running a Velocity proxy with multiple Paper backend servers
(lobby, creative, and survival worlds).

## Architecture

```
Player connects to → Velocity Proxy (port 25577)
                       ↓
                       ├→ Lobby Server (port 25565)
                       ├→ Creative Server (port 25566)
                       └→ Survival Server (port 25567)
```

## Features

- **Velocity Proxy**: Modern, high-performance proxy server
- **3 Paper Servers**: Lobby, Creative, and Survival worlds
- **Auto-configuration**: Automatic secret generation and server setup
- **Fresh worlds**: Each server generates its own Minecraft world
- **Secure forwarding**: Modern Velocity forwarding with cryptographic secrets

## Requirements

- NixOS or Nix package manager
- Minecraft Java Edition 1.21.4+ client
- Ports 25565-25567 and 25577 available
- ~6GB RAM (2GB per server)

## Quick Start

### 1. Navigate to this directory

```bash
cd path/to/velocity
```

### 2. Start all servers

```bash
nix run
# or explicitly: nix run .#all
```

This will:

- Generate a Velocity forwarding secret
- Start all 3 Paper backend servers
- Start the Velocity proxy
- Display connection information

### 3. Wait for servers to fully start

**Important**: Servers take approximately **30 seconds** to fully start. Wait
until you see:

```
Done (27.xxx)! For help, type "help"
```

for all three Paper servers before connecting.

### 4. Connect with Minecraft

- Open Minecraft Java Edition 1.21.4+
- Add server: `localhost:25577`
- Join and you'll spawn in the lobby
- Use `/server creative` or `/server survival` to switch worlds

## Important Notes

### Startup Time

The first startup takes longer (~30-45 seconds) as Paper downloads and patches
the Minecraft server. Subsequent startups are faster (~25-30 seconds).

### Connection Timing

If you try to connect before all servers finish loading, you'll see:

```
Unable to connect you to lobby. Please try again later.
```

This is normal! Just wait a few more seconds and reconnect.

### First Run

On first run, each server generates:

- Fresh Minecraft world
- Configuration files
- Plugin directories

## Individual Server Control

### Start servers individually

```bash
# Start only the Velocity proxy
nix run .#velocity

# Start only the lobby server
nix run .#lobby

# Start only the creative server
nix run .#creative

# Start only the survival server
nix run .#survival
```

**Note**: When starting servers individually, you must start backend servers
first, then Velocity. The `nix run` command handles this automatically.

### Development shell

Enter a development environment with Java 21 and tools:

```bash
nix develop
```

## Port Configuration

| Server   | Port  | Access        | Protocol |
| -------- | ----- | ------------- | -------- |
| Velocity | 25577 | Public entry  | TCP      |
| Lobby    | 25565 | Internal only | TCP      |
| Creative | 25566 | Internal only | TCP      |
| Survival | 25567 | Internal only | TCP      |

**Note**: Players should **only** connect to port 25577 (Velocity). Backend
servers should not be directly accessible from the internet.

## Server Data

All server data is stored in `.servers/` directory:

```
.servers/
├── velocity-secret        # Shared secret (KEEP PRIVATE!)
├── velocity/              # Velocity proxy config and data
│   ├── velocity.toml
│   ├── forwarding.secret  # Copy of shared secret
│   ├── logs/
│   └── plugins/
├── lobby/                 # Lobby server
│   ├── server.jar -> /nix/store/...  # Symlink to Paper jar
│   ├── server.properties
│   ├── world/
│   ├── world_nether/
│   ├── world_the_end/
│   ├── config/
│   │   └── paper-global.yml  # Contains velocity secret
│   ├── logs/
│   └── plugins/
├── creative/              # Creative server (same structure)
│   └── ...
└── survival/              # Survival server (same structure)
    └── ...
```

**Important**: Add `.servers/` to your `.gitignore` to avoid committing secrets
or world data!

## In-Game Commands

- `/server lobby` - Go to lobby
- `/server creative` - Go to creative world
- `/server survival` - Go to survival world
- `/velocity` - Show Velocity proxy info
- `/server <name>` - Switch to any configured server

## Configuration

### Velocity Configuration

Edit `velocity.toml.template` to customize:

- MOTD (server description) - uses MiniMessage format
- Max players
- Online mode
- Server order in try list

The template is copied to `.servers/velocity/velocity.toml` on first run.

### Server Settings

Each Paper server auto-generates `server.properties` with:

- **Lobby**: Survival mode, peaceful difficulty
- **Creative**: Creative mode, peaceful difficulty
- **Survival**: Survival mode, peaceful difficulty, PvP enabled

To customize, modify the `mkPaperServer` function in `flake.nix` (lines 52-74).

### Adding Plugins

Place plugins in the appropriate directory:

- Velocity plugins: `.servers/velocity/plugins/`
- Paper plugins: `.servers/<server-name>/plugins/`

Restart the servers after adding plugins.

## Security

### How Velocity Forwarding Works

Velocity uses **modern forwarding** with a shared secret to prevent player
impersonation:

1. **Secret Generation**: A random 32-byte secret is generated on first run
2. **Secret Sharing**: The same secret is given to Velocity and all backend
   servers
3. **Cryptographic Signing**: When a player connects, Velocity signs their
   authentication data with the secret
4. **Verification**: Backend servers verify the signature using their copy of
   the secret

```
Player → Velocity (auth with Mojang) → Lobby (verify signature) ✅
Attacker → Lobby directly → Cannot forge signature → Rejected ❌
```

### Security Requirements

#### 1. Keep the Secret Private ⚠️

The file `.servers/velocity-secret` contains your shared secret. **Never**
commit this to git or share it publicly.

```bash
# Add to .gitignore
echo ".servers/" >> .gitignore
```

#### 2. Use a Firewall (Critical!) 🔒

Backend servers run with `online-mode=false`, making them vulnerable if directly
accessible. **You must use a firewall** to block external access.

**For NixOS**, add to your `configuration.nix`:

```nix
networking.firewall = {
  enable = true;
  allowedTCPPorts = [ 25577 ];  # Only allow Velocity
  # Ports 25565-25567 are blocked by default
};
```

**For iptables (other Linux)**:

```bash
# Block direct access to backend servers
sudo iptables -A INPUT -p tcp --dport 25565:25567 ! -s 127.0.0.1 -j DROP

# Allow Velocity
sudo iptables -A INPUT -p tcp --dport 25577 -j ACCEPT

# Save rules
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

#### 3. Network Isolation (Recommended)

If running on the same machine (like this setup), backend servers only listen on
localhost by default. For additional security, you can explicitly bind them:

Edit `server.properties` in each backend server:

```properties
server-ip=127.0.0.1
```

### Secret Rotation

If you suspect your secret has been compromised:

```bash
# Stop servers
# Delete the secret
rm .servers/velocity-secret

# Restart - new secret will be generated
nix run
```

### More Information

- [Velocity Security Documentation](https://docs.papermc.io/velocity/security)
- [PaperMC Security Best Practices](https://docs.papermc.io/paper/admin/reference/configuration/security)

## Troubleshooting

### "Unable to connect you to lobby"

**Cause**: Velocity started before backend servers finished loading.

**Solution**: Wait 30 seconds after running `nix run`, then reconnect. Look for
"Done" messages in the logs.

### "Unable to verify player details"

**Cause**: Velocity secret doesn't match between proxy and backend server.

**Solution**:

1. Stop servers (Ctrl+C)
2. Delete `.servers/` directory: `rm -rf .servers`
3. Restart: `nix run`

This regenerates all configs with a fresh secret.

### "Connection refused: /127.0.0.1:25565"

**Cause**: Backend server (lobby) hasn't started yet.

**Solution**: Wait for all Paper servers to show "Done" message before
connecting.

### Backend servers not starting

**Check**:

- Logs in `.servers/<server-name>/logs/latest.log`
- Ports 25565-25567 not in use: `ss -tlnp | grep 2556`
- Java 21 available: `java -version`
- Sufficient RAM available

### Cannot connect to Velocity

**Check**:

- Port 25577 is not blocked by firewall
- Velocity logs in `.servers/velocity/logs/`
- All backend servers started successfully

### World generation issues

**Solution**:

- Delete world and regenerate: `rm -rf .servers/<server-name>/world*`
- Restart the server
- Check disk space: `df -h`
- Review server logs for errors

## Adding More Servers

To add additional backend servers (e.g., minigames):

### 1. Update `velocity.toml.template`

Add to the `[servers]` section:

```toml
minigames = "127.0.0.1:25568"
```

### 2. Update `flake.nix`

Add server package in the `packages` section:

```nix
paper-minigames = mkPaperServer {
  name = "minigames";
  port = 25568;
};
```

Add to `apps` section:

```nix
minigames = {
  type = "app";
  program = "${mkPaperServer { name = "minigames"; port = 25568; }}/bin/paper-minigames";
};
```

Add to `start-all` script (around line 183):

```nix
${mkPaperServer { name = "minigames"; port = 25568; }}/bin/paper-minigames &
MINIGAMES_PID=$!
```

And update the cleanup function to kill it.

### 3. Restart

```bash
nix run
```

## Performance Tuning

### Memory Allocation

Each server uses 2GB RAM by default (Xms2G -Xmx2G). For a 3-server setup:

- Minimum: 6GB total system RAM
- Recommended: 8GB+ total system RAM

To adjust per-server memory, edit the `mkPaperServer` function in `flake.nix`
(lines 105-106).

### JVM Flags

All servers use optimized G1GC garbage collector flags:

- `-XX:+UseG1GC` - Use G1 collector
- `-XX:MaxGCPauseMillis=200` - Target 200ms pause times
- `-XX:G1HeapRegionSize=8M` - 8MB regions
- Plus additional G1 optimizations

These flags are tuned for Minecraft servers and generally don't need adjustment.

### Reducing Startup Time

After first run, Paper caches the server jar. To speed up subsequent startups:

1. Ensure fast storage (SSD recommended)
2. Allocate sufficient RAM
3. Keep the `.servers/` directory between runs

## Updating

### Update Velocity

1. Find the latest build at
   [PaperMC Velocity Downloads](https://papermc.io/downloads/velocity)
2. Edit `velocity.nix` (lines 10-14):
   ```nix
   version = "3.4.0-SNAPSHOT-XXX";
   src = fetchurl {
     url = "https://api.papermc.io/v2/projects/velocity/versions/3.4.0-SNAPSHOT/builds/XXX/downloads/velocity-3.4.0-SNAPSHOT-XXX.jar";
     sha256 = "";  # Leave empty, Nix will tell you the correct hash
   };
   ```
3. Run `nix build .#velocity` to get the correct hash
4. Update the `sha256` with the hash from the error message

### Update Paper

1. Find the latest build at
   [PaperMC Paper Downloads](https://papermc.io/downloads/paper)
2. Edit `flake.nix` (lines 25-28):
   ```nix
   paperServer = pkgs.callPackage ./minecraft-server.nix {
     version = "1.21.4";
     url = "https://api.papermc.io/v2/projects/paper/versions/1.21.4/builds/XXX/downloads/paper-1.21.4-XXX.jar";
     sha256 = "";  # Leave empty
   };
   ```
3. Run `nix build .#paperServer` to get the correct hash
4. Update the `sha256`

### Update Dependencies

```bash
nix flake update
```

This updates nixpkgs and other flake inputs.

## Advanced Usage

### Running as a System Service

For production deployments, create a systemd service:

```nix
# In your NixOS configuration.nix
systemd.services.velocity-network = {
  description = "Velocity Multi-Server Network";
  after = [ "network.target" ];
  wantedBy = [ "multi-user.target" ];

  serviceConfig = {
    Type = "simple";
    User = "minecraft";
    Group = "minecraft";
    WorkingDirectory = "/var/lib/minecraft/velocity";
    ExecStart = "${pkgs.callPackage ./flake.nix {}}/bin/start-all";
    Restart = "always";
    RestartSec = "10s";
  };
};
```

### Backup Strategy

Important directories to backup:

- `.servers/velocity-secret` - Your secret key
- `.servers/*/world*` - All world data
- `.servers/*/config/` - Server configurations
- `.servers/*/plugins/` - Installed plugins

**Example backup script**:

```bash
#!/usr/bin/env bash
BACKUP_DIR="/backup/minecraft-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r .servers/velocity-secret "$BACKUP_DIR/"
cp -r .servers/*/world* "$BACKUP_DIR/"
cp -r .servers/*/config "$BACKUP_DIR/"
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"
```

### Monitoring

Monitor server status:

```bash
# Check if servers are running
ss -tlnp | grep -E '2556[5-7]|25577'

# Monitor logs
tail -f .servers/lobby/logs/latest.log
tail -f .servers/velocity/logs/latest.log

# Check resource usage
htop
```

## License

This flake configuration is provided as-is for running Minecraft servers.

- **Velocity**: GPL-3.0
- **Paper**: GPL-3.0 with exceptions
- **Minecraft**: Proprietary (Microsoft/Mojang)

## Resources

### Official Documentation

- [Velocity Documentation](https://docs.papermc.io/velocity)
- [Paper Documentation](https://docs.papermc.io/paper)
- [PaperMC Downloads](https://papermc.io/downloads)

### Plugins & Extensions

- [Velocity Plugins (Hangar)](https://hangar.papermc.io/)
- [Paper Plugins (Hangar)](https://hangar.papermc.io/)
- [SpigotMC Resources](https://www.spigotmc.org/resources/)

### Community & Support

- [PaperMC Discord](https://discord.gg/papermc)
- [Velocity GitHub](https://github.com/PaperMC/Velocity)
- [Paper GitHub](https://github.com/PaperMC/Paper)

### Security Resources

- [Velocity Security Guide](https://docs.papermc.io/velocity/security)
- [Minecraft Server Security Best Practices](https://docs.papermc.io/paper/admin/reference/configuration/security)

## Contributing

Found an issue or have a suggestion? This setup is part of a personal project,
but feel free to fork and customize for your needs!
