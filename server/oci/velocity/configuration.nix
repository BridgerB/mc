# NixOS Configuration for Velocity Proxy + Paper Servers on OCI ARM
{
  config,
  lib,
  pkgs,
  mkAdvancedPortals,
  mkPortalsConfig,
  mkGeyserVelocity,
  mkFloodgateVelocity,
  mkSmartRejoin,
  ...
}: let
  velocity = pkgs.velocity;
  paperServer = pkgs.papermc;

  advancedPortalsJar = mkAdvancedPortals pkgs;
  geyserJar = mkGeyserVelocity pkgs;
  floodgateJar = mkFloodgateVelocity pkgs;
  smartRejoinJar = mkSmartRejoin pkgs;

  # Shared forwarding secret path
  secretFile = "/var/lib/velocity/forwarding.secret";

  # Full paper-global.yml baked at build time (secret substituted at runtime)
  paperGlobalYml = pkgs.writeText "paper-global.yml" ''
    _version: 31
    anticheat:
      obfuscation:
        items:
          all-models:
            also-obfuscate: []
            dont-obfuscate:
            - minecraft:lodestone_tracker
            sanitize-count: true
          enable-item-obfuscation: false
          model-overrides:
            minecraft:elytra:
              also-obfuscate: []
              dont-obfuscate:
              - minecraft:damage
              sanitize-count: true
    block-updates:
      disable-chorus-plant-updates: false
      disable-mushroom-block-updates: false
      disable-noteblock-updates: false
      disable-tripwire-updates: false
    chunk-loading-advanced:
      auto-config-send-distance: true
      player-max-concurrent-chunk-generates: 0
      player-max-concurrent-chunk-loads: 0
    chunk-loading-basic:
      player-max-chunk-generate-rate: -1.0
      player-max-chunk-load-rate: 100.0
      player-max-chunk-send-rate: 75.0
    chunk-system:
      io-threads: -1
      worker-threads: -1
    collisions:
      enable-player-collisions: true
      send-full-pos-for-hard-colliding-entities: true
    commands:
      ride-command-allow-player-as-vehicle: false
      suggest-player-names-when-null-tab-completions: true
      time-command-affects-all-worlds: false
    console:
      enable-brigadier-completions: true
      enable-brigadier-highlighting: true
      has-all-permissions: false
    item-validation:
      book:
        author: 8192
        page: 16384
        title: 8192
      book-size:
        page-max: 2560
        total-multiplier: 0.98
      display-name: 8192
      lore-line: 8192
      resolve-selectors-in-books: false
    logging:
      deobfuscate-stacktraces: true
    messages:
      kick:
        authentication-servers-down: <lang:multiplayer.disconnect.authservers_down>
        connection-throttle: Connection throttled! Please wait before reconnecting.
        flying-player: <lang:multiplayer.disconnect.flying>
        flying-vehicle: <lang:multiplayer.disconnect.flying>
      no-permission: <red>I'm sorry, but you do not have permission to perform this command.
        Please contact the server administrators if you believe that this is in error.
      use-display-name-in-quit-message: false
    misc:
      chat-threads:
        chat-executor-core-size: -1
        chat-executor-max-size: -1
      client-interaction-leniency-distance: default
      compression-level: default
      enable-nether: true
      fix-far-end-terrain-generation: true
      load-permissions-yml-before-plugins: true
      max-joins-per-tick: 5
      prevent-negative-villager-demand: false
      region-file-cache-size: 256
      send-full-pos-for-item-entities: false
      strict-advancement-dimension-check: false
      use-alternative-luck-formula: false
      use-dimension-type-for-custom-spawners: false
      xp-orb-groups-per-area: default
    packet-limiter:
      all-packets:
        action: KICK
        interval: 7.0
        max-packet-rate: 500.0
      kick-message: <red><lang:disconnect.exceeded_packet_rate>
      overrides:
        minecraft:place_recipe:
          action: DROP
          interval: 4.0
          max-packet-rate: 5.0
    player-auto-save:
      max-per-tick: -1
      rate: -1
    proxies:
      bungee-cord:
        online-mode: true
      proxy-protocol: false
      velocity:
        enabled: true
        online-mode: true
        secret: '__VELOCITY_SECRET__'
    scoreboards:
      save-empty-scoreboard-teams: true
      track-plugin-scoreboards: false
    spam-limiter:
      incoming-packet-threshold: 300
      recipe-spam-increment: 1
      recipe-spam-limit: 20
      tab-spam-increment: 1
      tab-spam-limit: 500
    spark:
      enable-immediately: false
      enabled: true
    unsupported-settings:
      allow-headless-pistons: false
      allow-permanent-block-break-exploits: false
      allow-piston-duplication: false
      allow-unsafe-end-portal-teleportation: false
      compression-format: ZLIB
      perform-username-validation: true
      skip-tripwire-hook-placement-validation: false
      skip-vanilla-damage-tick-when-shield-blocked: false
      update-equipment-on-player-actions: true
    watchdog:
      early-warning-delay: 10000
      early-warning-every: 5000
  '';

  # Full Advanced Portals config baked at build time
  advancedPortalsConfigFile = pkgs.writeText "advanced-portals-config.yaml" ''
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
    enableProxySupport: true
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
    warpMessageInChat: false
    warpMessageOnActionBar: true
  '';

  # Geyser config baked at build time (Bedrock-to-Java translation)
  geyserConfigYml = pkgs.writeText "geyser-config.yml" ''
    bedrock:
      address: 0.0.0.0
      port: 19132
      clone-remote-port: false
      motd1: Velocity Network
      motd2: Geyser
      server-name: mc.bridgerb.com
    remote:
      auth-type: floodgate
    command-suggestions: true
    passthrough-motd: true
    passthrough-player-counts: true
    legacy-ping-passthrough: false
    max-players: 100
    above-bedrock-nether-building: false
    force-resource-packs: true
    xbox-achievements-enabled: false
  '';

  # Helper to create Paper server configuration
  mkPaperServer = {
    name,
    port,
    gamemode ? "survival",
    pvp ? true,
    difficulty ? "normal",
    memoryMB ? 4096,
    enableCommandBlocks ? false,
    allowFlight ? false,
    levelSeed ? "",
    levelType ? "minecraft\\:normal",
    viewDistance ? 10,
    spawnAnimals ? true,
    spawnMonsters ? true,
    resourcePackUrl ? "",
    resourcePackSha1 ? "",
    requireResourcePack ? false,
  }: {
    "minecraft-${name}" = {
      description = "Paper Minecraft Server - ${name}";
      wantedBy = ["multi-user.target"];
      after = ["network.target" "velocity-proxy.service"];
      requires = ["velocity-proxy.service"];

      serviceConfig = {
        Type = "simple";
        User = "minecraft";
        Group = "minecraft";
        WorkingDirectory = "/var/lib/minecraft/${name}";
        Restart = "always";
        RestartSec = "10s";

        ExecStartPre = [
          # Run as root (+prefix) to ensure velocity dir is readable by minecraft user
          "+${pkgs.writeShellScript "paper-${name}-perms.sh" ''
            chmod 755 /var/lib/velocity
          ''}"
          (pkgs.writeShellScript "paper-${name}-setup.sh" ''
          cd /var/lib/minecraft/${name}

          echo "eula=true" > eula.txt

          cat > server.properties << 'PROPS'
          server-port=${toString port}
          server-ip=127.0.0.1
          max-players=20
          difficulty=${difficulty}
          gamemode=${gamemode}
          pvp=${
            if pvp
            then "true"
            else "false"
          }
          motd=${name} server (via Velocity)
          online-mode=false
          enable-command-block=${
            if enableCommandBlocks
            then "true"
            else "false"
          }
          view-distance=${toString viewDistance}
          spawn-protection=0
          max-world-size=29999984
          level-name=world
          level-seed=${levelSeed}
          level-type=${levelType}
          allow-nether=true
          allow-flight=${
            if allowFlight
            then "true"
            else "false"
          }
          spawn-animals=${
            if spawnAnimals
            then "true"
            else "false"
          }
          spawn-monsters=${
            if spawnMonsters
            then "true"
            else "false"
          }
          resource-pack=${resourcePackUrl}
          resource-pack-sha1=${resourcePackSha1}
          require-resource-pack=${
            if requireResourcePack
            then "true"
            else "false"
          }
          PROPS

          # Bake full paper-global.yml with velocity secret substituted at runtime
          mkdir -p config
          SECRET=$(cat ${secretFile})
          TEMPLATE=$(cat ${paperGlobalYml})
          printf '%s\n' "''${TEMPLATE/__VELOCITY_SECRET__/$SECRET}" > config/paper-global.yml

          # Install Advanced Portals plugin with baked config
          mkdir -p plugins/AdvancedPortals
          ln -sf ${advancedPortalsJar}/lib/advanced-portals.jar plugins/advanced-portals.jar
          cp ${advancedPortalsConfigFile} plugins/AdvancedPortals/config.yaml
          chmod 644 plugins/AdvancedPortals/config.yaml

          # Remove old manually-installed plugin jars
          rm -f plugins/AdvancedPortals-Spigot.jar plugins/.paper-remapped/AdvancedPortals-Spigot.jar

          # Install portal definitions for lobby
          if [ "${name}" = "lobby" ]; then
            mkdir -p plugins/AdvancedPortals/portals
            cp ${./portals}/*.yaml plugins/AdvancedPortals/portals/
            chmod 644 plugins/AdvancedPortals/portals/*.yaml
          fi

          echo "Paper ${name} server setup complete"
        '')
        ];

        ExecStart = "${pkgs.jdk21}/bin/java -Xms${
          toString memoryMB
        }M -Xmx${
          toString memoryMB
        }M -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -jar ${paperServer}/share/papermc/papermc.jar nogui";
      };
    };
  };
in {
  imports = [../common.nix];

  networking.hostName = "minecraft";
  networking.firewall = {
    enable = true;
    allowedTCPPorts = [
      22 # SSH
      80 # HTTP (resource packs)
      25565 # Velocity Proxy (PUBLIC)
    ];
    allowedUDPPorts = [
      19132 # Geyser Bedrock (PUBLIC)
    ];
  };

  # Serve resource packs over HTTP for Minecraft clients
  services.nginx = {
    enable = true;
    virtualHosts.default = {
      root = "/var/lib/minecraft/resource-packs";
    };
  };

  users.users.velocity = {
    isSystemUser = true;
    group = "minecraft";
    home = "/var/lib/velocity";
    createHome = true;
  };

  users.users.minecraft = {
    isSystemUser = true;
    group = "minecraft";
    home = "/var/lib/minecraft";
    createHome = true;
    homeMode = "755";
  };
  users.groups.minecraft = {};

  systemd.tmpfiles.rules = [
    "d /var/lib/velocity 0755 velocity minecraft -"
    "d /var/lib/minecraft/lobby 0755 minecraft minecraft -"
    "d /var/lib/minecraft/creative 0755 minecraft minecraft -"
    "d /var/lib/minecraft/survival 0755 minecraft minecraft -"
    "d /var/lib/minecraft/the-walls 0755 minecraft minecraft -"
    "d /var/lib/minecraft/parkour 0755 minecraft minecraft -"
    "d /var/lib/minecraft/dropper 0755 minecraft minecraft -"
    "d /var/lib/minecraft/exponential 0755 minecraft minecraft -"
    "d /var/lib/minecraft/hot-and-heavy 0755 minecraft minecraft -"
    "d /var/lib/minecraft/planet-parkour 0755 minecraft minecraft -"
    "d /var/lib/minecraft/resource-packs 0755 root root -"
  ];

  systemd.services =
    {
      velocity-proxy = {
        description = "Velocity Minecraft Proxy";
        wantedBy = ["multi-user.target"];
        after = ["network.target"];

        serviceConfig = {
          Type = "simple";
          User = "velocity";
          Group = "minecraft";
          WorkingDirectory = "/var/lib/velocity";
          Restart = "always";
          RestartSec = "10s";

          ExecStartPre = pkgs.writeShellScript "velocity-setup.sh" ''
            cd /var/lib/velocity

            chmod 755 /var/lib/velocity

            if [ ! -f forwarding.secret ]; then
              echo "Generating forwarding secret..."
              ${pkgs.openssl}/bin/openssl rand -base64 32 > forwarding.secret
              chmod 644 forwarding.secret
              chown velocity:minecraft forwarding.secret
            fi

            chmod 644 forwarding.secret

            cp ${./velocity.toml} velocity.toml
            chmod 644 velocity.toml

            mkdir -p plugins
            ln -sf ${advancedPortalsJar}/lib/advanced-portals.jar plugins/advanced-portals.jar

            # Remove old manually-installed plugin jars
            rm -f plugins/AdvancedPortals-Spigot.jar

            # Install Geyser (Bedrock-to-Java translation) and Floodgate (Bedrock auth)
            ln -sf ${geyserJar} plugins/Geyser-Velocity.jar
            ln -sf ${floodgateJar} plugins/floodgate-velocity.jar

            # Install SmartRejoin (remember last server on rejoin)
            ln -sf ${smartRejoinJar} plugins/SmartRejoin.jar
            rm -f plugins/ReconnectVelocity-all.jar

            # Bake Geyser config
            mkdir -p plugins/Geyser-Velocity
            cp ${geyserConfigYml} plugins/Geyser-Velocity/config.yml
            chmod 644 plugins/Geyser-Velocity/config.yml
          '';

          ExecStart = "${velocity}/bin/velocity";
        };
      };
    }
    // mkPaperServer {
      name = "lobby";
      port = 25566;
      gamemode = "adventure";
      pvp = false;
      difficulty = "normal";
      memoryMB = 4096;
    }
    // mkPaperServer {
      name = "creative";
      port = 25567;
      gamemode = "creative";
      pvp = false;
      difficulty = "peaceful";
      memoryMB = 4096;
    }
    // mkPaperServer {
      name = "survival";
      port = 25568;
      gamemode = "survival";
      pvp = true;
      difficulty = "normal";
      memoryMB = 4096;
      viewDistance = 20;
      levelSeed = "47";
      levelType = "minecraft\\:amplified";
    }
    // mkPaperServer {
      name = "the-walls";
      port = 25569;
      gamemode = "adventure";
      pvp = true;
      difficulty = "peaceful";
      memoryMB = 4096;
      enableCommandBlocks = true;
      allowFlight = true;
    }
    // mkPaperServer {
      name = "parkour";
      port = 25570;
      gamemode = "adventure";
      pvp = false;
      difficulty = "peaceful";
      memoryMB = 2048;
      allowFlight = true;
    }
    // mkPaperServer {
      name = "dropper";
      port = 25571;
      gamemode = "adventure";
      pvp = false;
      difficulty = "peaceful";
      memoryMB = 2048;
      enableCommandBlocks = true;
      allowFlight = true;
      viewDistance = 20;
      resourcePackUrl = "http://144.24.32.76/dropper.zip";
      resourcePackSha1 = "49152acd9ab2cd2c386c839c5d7584104e7400e0";
      requireResourcePack = true;
    }
    // mkPaperServer {
      name = "exponential";
      port = 25572;
      gamemode = "adventure";
      pvp = false;
      difficulty = "peaceful";
      memoryMB = 2048;
      enableCommandBlocks = true;
      allowFlight = true;
      viewDistance = 32;
      spawnAnimals = false;
      spawnMonsters = false;
    }
    // mkPaperServer {
      name = "hot-and-heavy";
      port = 25573;
      gamemode = "adventure";
      pvp = true;
      difficulty = "normal";
      memoryMB = 2048;
      enableCommandBlocks = true;
      allowFlight = true;
      resourcePackUrl = "http://144.24.32.76/hot-and-heavy.zip";
      resourcePackSha1 = "22104593f027af455cd396b1d4a29460444e93d9";
      requireResourcePack = true;
    }
    // mkPaperServer {
      name = "planet-parkour";
      port = 25574;
      gamemode = "adventure";
      pvp = false;
      difficulty = "peaceful";
      memoryMB = 2048;
      enableCommandBlocks = true;
      allowFlight = true;
      resourcePackUrl = "http://144.24.32.76/planet-parkour.zip";
      resourcePackSha1 = "ee479873b627c96aa330f6dc86e5ad462135ba04";
      requireResourcePack = true;
    };

  # Paper servers run on Java 21; shared dev tooling lives in ../common.nix.
  environment.systemPackages = [pkgs.jdk21];
}
