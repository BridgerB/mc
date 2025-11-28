# Advanced Portals Plugin Documentation

## Overview

Advanced Portals is a plugin that enables cross-server teleportation through
physical portals using Velocity proxy. Players can walk through configured
portals (like nether portals) to be transferred between backend servers.

**Version**: 2.6.0-SNAPSHOT **Source**:
https://github.com/sekwah41/Advanced-Portals **Built**: 2025-11-28 from main
branch with Java 17

## Installation

### Plugin Locations

The same JAR file (`Advanced-Portals-Spigot-2.6.0-SNAPSHOT.jar`) is used for
both Velocity and Paper servers:

```
/var/lib/velocity/plugins/AdvancedPortals-Spigot.jar
/var/lib/minecraft/lobby/plugins/AdvancedPortals-Spigot.jar
/var/lib/minecraft/creative/plugins/AdvancedPortals-Spigot.jar
/var/lib/minecraft/survival/plugins/AdvancedPortals-Spigot.jar
```

### Important Notes

- **Use the unified Spigot JAR for Velocity**: The Spigot JAR includes support
  for both Spigot/Paper AND Velocity/BungeeCord proxies
- **Do NOT use separate velocity.jar**: The standalone Velocity module JAR is
  missing dependencies and will fail to load
- **Built from source**: Pre-built releases may not have latest Velocity support

### Building from Source

```bash
cd /tmp
git clone git@github.com:sekwah41/Advanced-Portals.git
cd Advanced-Portals
nix-shell -p jdk17 --run "./gradlew build -x test"

# The built JAR will be at:
# /tmp/Advanced-Portals/spigot/build/libs/Advanced-Portals-Spigot-2.6.0-SNAPSHOT.jar
```

## Configuration

### Velocity Proxy

No configuration needed on Velocity. The plugin automatically registers the
plugin message channel (`advancedportals:message`) and listens for cross-server
transfer packets.

**Verify it loaded**:

```bash
tail /var/lib/velocity/logs/latest.log | grep -i advancedportals
# Should show: "Successfully enabled!"
```

### Paper Backend Servers

**Location**: `/var/lib/minecraft/{server}/plugins/AdvancedPortals/config.yaml`

**Required setting for proxy support**:

```yaml
enableProxySupport: true
```

**Full default configuration**:

```yaml
blockSpectatorMode: true
commandPortals:
  console: true
  enabled: true
  op: true
  permsWildcard: true
  proxy: true
defaultTriggerBlock: NETHER_PORTAL
disableGatewayBeam: true
disablePhysicsEvents: true
enableProxySupport: true # REQUIRED FOR VELOCITY
joinCooldown: 5
maxPortalVisualisationSize: 1000
maxSelectionVisualisationSize: 9000
playFailSound: true
portalProtection: true
portalProtectionRadius: 5
selectorMaterial: IRON_AXE
showVisibleRange: 50
stopWaterFlow: true
throwbackStrength: 0.7
translationFile: en_GB
useOnlySpecialAxe: true
warpEffect:
  enabled: true
  soundEffect: ender
  visualEffect: ender
warpMessageInActionBar: true
warpMessageInChat: false
```

### Apply Configuration Changes

After editing `config.yaml`:

```bash
# In-game (if server is running):
/portal reload

# Or restart the server:
systemctl restart minecraft-{server}.service
```

## Creating Cross-Server Portals

### Step 1: Get the Selector Tool

```
/portal selector
```

This gives you an Iron Axe to select the portal region.

### Step 2: Select the Portal Region

With the Iron Axe in hand:

- **Left-click**: Set position 1 (corner 1)
- **Right-click**: Set position 2 (corner 2)

The region should fully encompass all portal blocks that should trigger the
teleport.

**Example for a 3-wide nether portal at coordinates (2, -60, 10)**:

- Left-click: X:1, Y:-61, Z:9 (below and around the portal)
- Right-click: X:5, Y:-57, Z:11 (above and around the portal)

### Step 3: Create the Portal

```
/portal create <portal_name> name:<portal_name> proxy:<server> triggerblock:<block_type>
```

**Required tags**:

- `name:<portal_name>` - Unique identifier (no spaces)
- `proxy:<server_name>` - Target backend server (must match velocity.toml server
  name)
- `triggerblock:<material>` - Block type that activates portal

**Example**:

```
/portal create survival_portal name:survival_portal proxy:survival triggerblock:nether_portal
```

### Step 4: Verify Portal

```
/portal list
```

Check portal details:

```
/portal info <portal_name>
```

## Portal Management Commands

```
/portal selector          # Get selection tool
/portal list             # List all portals
/portal info <name>      # Show portal details
/portal remove <name>    # Delete a portal
/portal reload           # Reload plugin configuration
```

## Current Portals

### Lobby → Survival Portal

**Portal**: `survival_portal` **Location**: Lobby world, coordinates (2-4,
-60, 10) **Type**: Nether portal (3 blocks wide, 3 blocks tall) **Target**:
`survival` server **Configuration**:

```yaml
args:
  proxy:
    - survival
  name:
    - survival_portal
  triggerblock:
    - NETHER_PORTAL
maxLoc:
  posX: 5
  posY: -57
  posZ: 11
  worldName: world
minLoc:
  posX: 1
  posY: -61
  posZ: 9
  worldName: world
```

**File**:
`/var/lib/minecraft/lobby/plugins/AdvancedPortals/portals/survival_portal.yaml`

## How It Works

### Portal Activation Flow

1. **Player enters portal region**: Player stands on a trigger block within the
   defined region
2. **Backend server detects activation**: Paper server checks if player is in a
   portal region
3. **Tag processing**: Portal tags are evaluated (proxy, desti, message, etc.)
4. **Packet sent to Velocity**: Backend sends plugin message via
   `advancedportals:message` channel
5. **Velocity transfers player**: Proxy receives packet and transfers player to
   target server
6. **Target server receives player**: Player joins the destination server

### Plugin Message Types

**ProxyTransferPacket** (just server transfer):

```
proxy:<server_name>
```

**ProxyTransferDestiPacket** (server transfer + specific spawn point):

```
proxy:<server_name> desti:<destination_name>
```

### Server Names

Must match the server names defined in
`/home/bridger/git/mc/server/oci/velocity.toml`:

```toml
[servers]
  lobby = "127.0.0.1:25566"
  creative = "127.0.0.1:25567"
  survival = "127.0.0.1:25568"
```

## Available Portal Tags

### Cross-Server Tags

| Tag     | Example             | Description                              |
| ------- | ------------------- | ---------------------------------------- |
| `proxy` | `proxy:survival`    | Transfer to backend server via Velocity  |
| `desti` | `desti:spawn_point` | Teleport to destination on target server |

### Portal Behavior Tags

| Tag            | Example                      | Description                             |
| -------------- | ---------------------------- | --------------------------------------- |
| `name`         | `name:my_portal`             | Portal identifier (required, no spaces) |
| `triggerblock` | `triggerblock:nether_portal` | Block that activates portal             |
| `message`      | `message:"Warping..."`       | Custom message on teleport              |
| `cooldown`     | `cooldown:3000`              | Cooldown in milliseconds                |
| `command`      | `command:heal`               | Execute command on activation           |

### Valid Trigger Blocks

Common options:

- `NETHER_PORTAL` - Nether portal blocks (default)
- `END_PORTAL` - End portal blocks
- `END_GATEWAY` - End gateway blocks
- `WATER` - Water blocks
- Any valid Minecraft material name

## Troubleshooting

### Portal Doesn't Activate (Wobbling on Nether Portal)

**Symptoms**: Player stands in nether portal, screen wobbles, but doesn't
transfer

**Causes**:

1. Advanced Portals not loaded on Velocity
2. Proxy support disabled in backend config
3. Portal region doesn't cover the trigger blocks
4. Wrong trigger block material specified

**Diagnosis**:

```bash
# Check Velocity loaded the plugin
ssh root@<server> "tail /var/lib/velocity/logs/latest.log | grep -i advancedportals"
# Should see: "Successfully enabled!"

# Check backend proxy support
ssh root@<server> "grep enableProxySupport /var/lib/minecraft/lobby/plugins/AdvancedPortals/config.yaml"
# Should show: enableProxySupport: true

# Check portal configuration
ssh root@<server> "cat /var/lib/minecraft/lobby/plugins/AdvancedPortals/portals/<portal_name>.yaml"
# Verify region covers all portal blocks
```

**Solution**: Ensure Velocity has the unified JAR and `enableProxySupport: true`
on backend servers.

### Velocity Plugin Won't Load

**Error**: `Can't create plugin advancedportals` /
`ClassNotFoundException: ProxyContainer`

**Cause**: Using the standalone `velocity-2.6.0-SNAPSHOT.jar` which is missing
dependencies

**Solution**: Use the unified Spigot JAR instead:

```bash
ssh root@<server> << 'EOF'
rm /var/lib/velocity/plugins/velocity-*.jar
rm /var/lib/velocity/plugins/proxycore-*.jar
rm /var/lib/velocity/plugins/core-*.jar
cp /path/to/Advanced-Portals-Spigot.jar /var/lib/velocity/plugins/
chown velocity:minecraft /var/lib/velocity/plugins/Advanced-Portals-Spigot.jar
systemctl restart velocity-proxy.service
EOF
```

### Portal Region Too Small

**Symptoms**: Portal only works when standing in exact spots

**Cause**: Portal region (min/max coordinates) doesn't fully cover all trigger
blocks

**Solution**: Expand the portal region to include padding around the portal:

```yaml
# Before (too narrow in Z direction):
maxLoc:
  posX: 5
  posY: -57
  posZ: 10 # Only one block in Z
minLoc:
  posX: 1
  posY: -61
  posZ: 10 # Same Z coordinate

# After (proper 3D coverage):
maxLoc:
  posX: 5
  posY: -57
  posZ: 11 # Expanded Z range
minLoc:
  posX: 1
  posY: -61
  posZ: 9 # Covers portal depth
```

Edit the portal YAML file and restart the server, or recreate the portal with a
larger selection.

### "Unknown command" When Running /portal

**Cause**: Advanced Portals not loaded on the backend server

**Diagnosis**:

```bash
ssh root@<server> "tail /var/lib/minecraft/lobby/logs/latest.log | grep -i AdvancedPortals"
```

**Solution**: Check that the JAR is in the plugins folder and server has
restarted.

## File Locations Reference

### Velocity Proxy

```
/var/lib/velocity/plugins/AdvancedPortals-Spigot.jar
/var/lib/velocity/logs/latest.log
```

### Lobby Server

```
/var/lib/minecraft/lobby/plugins/AdvancedPortals-Spigot.jar
/var/lib/minecraft/lobby/plugins/AdvancedPortals/config.yaml
/var/lib/minecraft/lobby/plugins/AdvancedPortals/portals/*.yaml
/var/lib/minecraft/lobby/plugins/AdvancedPortals/playerData/*.yaml
/var/lib/minecraft/lobby/logs/latest.log
```

### Creative Server

```
/var/lib/minecraft/creative/plugins/AdvancedPortals-Spigot.jar
/var/lib/minecraft/creative/plugins/AdvancedPortals/config.yaml
/var/lib/minecraft/creative/plugins/AdvancedPortals/portals/*.yaml
```

### Survival Server

```
/var/lib/minecraft/survival/plugins/AdvancedPortals-Spigot.jar
/var/lib/minecraft/survival/plugins/AdvancedPortals/config.yaml
/var/lib/minecraft/survival/plugins/AdvancedPortals/portals/*.yaml
```

## Future Enhancements

### Planned Portals

1. **Lobby → Creative Portal**
   - Second nether portal in lobby
   - Transfers to creative server
   - Command:
     `/portal create creative_portal name:creative_portal proxy:creative triggerblock:nether_portal`

2. **Survival → Lobby Return Portal**
   - Portal in survival world to return to lobby
   - Specific spawn point in lobby
   - Requires creating destination first:
     `/desti create lobby_spawn name:lobby_spawn`
   - Then portal:
     `/portal create return_lobby name:return_lobby proxy:lobby desti:lobby_spawn triggerblock:nether_portal`

3. **Creative → Lobby Return Portal**
   - Similar to survival return portal

### Destination-Based Spawning

Instead of spawning at the world spawn when transferring servers, create
destinations:

```bash
# On target server, stand where you want players to spawn
/desti create spawn_point name:spawn_point

# Move destination later
/desti move spawn_point

# Then use in portal
/portal create my_portal name:my_portal proxy:survival desti:spawn_point triggerblock:nether_portal
```

### Portal Protection

The plugin automatically creates a protected region around portals (default 5
block radius):

- Prevents explosions
- Stops fluid flow
- Configurable in `config.yaml` with `portalProtectionRadius`

## Additional Resources

- **Official Documentation**: https://advancedportals.sekwah.com/docs/
- **Source Code**: https://github.com/sekwah41/Advanced-Portals
- **Spigot Page**: https://www.spigotmc.org/resources/advanced-portals.14356/
- **Discord Support**: https://discord.gg/fAJ3xJg

## Installation History

**Date**: 2025-11-28 **Installed by**: Automated deployment **Method**: Built
from source (main branch) using Java 17 **Initial Setup**: Lobby → Survival
cross-server portal
