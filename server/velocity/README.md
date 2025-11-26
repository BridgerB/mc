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
- **Secure forwarding**: Modern Velocity forwarding with shared secrets

## Requirements

- NixOS or Nix package manager
- Minecraft Java Edition 1.21+ client
- Ports 25565-25567 and 25577 available

## Quick Start

### 1. Clone or navigate to this directory

```bash
cd /home/bridger/git/mc/server/velocity
```

### 2. Start all servers at once

```bash
nix run .#all
```

This will:

- Generate a Velocity forwarding secret
- Start all 3 Paper backend servers
- Start the Velocity proxy
- Display connection information

### 3. Connect with Minecraft

- Open Minecraft Java Edition 1.21+
- Add server: `localhost:25577`
- Join and you'll spawn in the lobby
- Use `/server creative` or `/server survival` to switch worlds

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

### Development shell

Enter a development environment with Java 21 and tools:

```bash
nix develop
```

## Port Configuration

| Server   | Port  | Access        |
| -------- | ----- | ------------- |
| Velocity | 25577 | Public entry  |
| Lobby    | 25565 | Internal only |
| Creative | 25566 | Internal only |
| Survival | 25567 | Internal only |

**Note**: Players should only connect to port 25577 (Velocity). Backend servers
are not directly accessible.

## Server Data

All server data is stored in `.servers/` directory:

```
.servers/
├── velocity/           # Velocity proxy config and data
│   ├── velocity.toml
│   └── forwarding.secret
├── lobby/              # Lobby server
│   ├── server.jar
│   ├── world/
│   └── config/
├── creative/           # Creative server
│   ├── server.jar
│   ├── world/
│   └── config/
└── survival/           # Survival server
    ├── server.jar
    ├── world/
    └── config/
```

## In-Game Commands

- `/server lobby` - Go to lobby
- `/server creative` - Go to creative world
- `/server survival` - Go to survival world
- `/velocity` - Show Velocity proxy info

## Configuration

### Velocity Configuration

Edit `velocity.toml.template` to customize:

- MOTD (server description)
- Max players
- Online mode
- Server order

### Server Settings

Each Paper server auto-generates `server.properties` with:

- Lobby: Survival mode, peaceful difficulty
- Creative: Creative mode, peaceful difficulty
- Survival: Survival mode, peaceful difficulty, PvP enabled

To customize, modify the `mkPaperServer` function in `flake.nix`.

## Troubleshooting

### "Failed to verify username" errors

- Ensure `online-mode=false` in backend server.properties
- Verify Velocity secret matches in all Paper servers
- Check that Velocity is using `player-info-forwarding-mode = "modern"`

### Backend servers not starting

- Check logs in `.servers/<server-name>/logs/latest.log`
- Ensure ports 25565-25567 are not in use
- Verify Java 21 is available

### Cannot connect to Velocity

- Ensure port 25577 is open and not blocked by firewall
- Check Velocity logs in `.servers/velocity/logs/`
- Verify all backend servers started successfully

### World generation issues

- Delete `.servers/<server-name>/world/` and restart to regenerate
- Check disk space
- Review server logs for errors

## Adding More Servers

To add additional backend servers, edit `flake.nix`:

1. Add to `[servers]` section in `velocity.toml.template`:
   ```toml
   minigames = "127.0.0.1:25568"
   ```

2. Create a new server package:
   ```nix
   paper-minigames = mkPaperServer { name = "minigames"; port = 25568; };
   ```

3. Add to `apps` section and `start-all` script

## Security Notes

- Backend servers run with `online-mode=false` (Velocity handles auth)
- Velocity forwarding secret is auto-generated and shared
- Backend servers should NOT be directly accessible from internet
- Use firewall rules to restrict backend server ports

## Performance Tuning

Each server uses optimized G1GC JVM flags:

- 2GB RAM per server (Xms2G -Xmx2G)
- G1 garbage collector optimizations
- Can be adjusted in `mkPaperServer` function

## Updating

### Update Velocity

Edit `velocity.nix` to change version/build number.

### Update Paper

Edit the Paper server URL in `flake.nix`:

```nix
paperServer = pkgs.callPackage ./minecraft-server.nix {
  version = "1.21.4";
  url = "https://api.papermc.io/v2/projects/paper/versions/1.21.4/builds/XX/downloads/paper-1.21.4-XX.jar";
};
```

Then run: `nix flake update`

## License

This flake configuration is provided as-is for running Minecraft servers.

- Velocity: GPL-3.0
- Paper: GPL-3.0 with exceptions
- Minecraft: Proprietary (Microsoft/Mojang)

## Resources

- [Velocity Documentation](https://docs.papermc.io/velocity)
- [Paper Documentation](https://docs.papermc.io/paper)
- [PaperMC Downloads](https://papermc.io/downloads)
- [Velocity Plugins](https://hangar.papermc.io/)
